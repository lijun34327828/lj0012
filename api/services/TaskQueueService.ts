import path from 'node:path';
import type {
  OCRTask,
  TaskStatus,
  FileCategory,
  PaginatedResponse,
  LayoutResult,
} from '@shared/types';
import { config } from '@api/config';
import {
  generateTaskId,
  ensureDir,
  fileExists,
  readJson,
  writeJson,
  clamp,
  sleep,
} from '../utils/index.js';
import ImagePreprocessService from './ImagePreprocessService.js';

interface TaskQueueItem {
  task: OCRTask;
  priority: number;
  addedAt: number;
}

interface TasksStore {
  tasks: Record<string, OCRTask>;
}

const TASKS_DATA_PATH = path.join(config.storage.dataDir, 'tasks.json');

const taskQueue: TaskQueueItem[] = [];
const taskMap: Record<string, OCRTask> = {};
const runningTaskIds: Set<string> = new Set();
let workerTimer: NodeJS.Timeout | null = null;
let saveTimer: NodeJS.Timeout | null = null;
let isInitialized = false;
let hasUnsavedChanges = false;

interface AddTaskOptions {
  priority?: number;
}

const loadTasksFromDisk = async (): Promise<void> => {
  await ensureDir(config.storage.dataDir);
  if (await fileExists(TASKS_DATA_PATH)) {
    try {
      const store = await readJson<TasksStore>(TASKS_DATA_PATH);
      Object.assign(taskMap, store.tasks);
      for (const task of Object.values(store.tasks)) {
        if (task.status === 'queued') {
          taskQueue.push({ task, priority: 0, addedAt: task.createdAt });
        }
      }
      sortQueue();
    } catch {
      // ignore corrupt file
    }
  }
};

const saveTasksToDisk = async (): Promise<void> => {
  if (!hasUnsavedChanges) return;
  const store: TasksStore = { tasks: { ...taskMap } };
  await writeJson(TASKS_DATA_PATH, store);
  hasUnsavedChanges = false;
};

const sortQueue = (): void => {
  taskQueue.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.addedAt - b.addedAt;
  });
};

const updateTask = (task: OCRTask): void => {
  task.updatedAt = Date.now();
  taskMap[task.id] = task;
  hasUnsavedChanges = true;
};

const computeOverallProgress = (task: OCRTask): number => {
  const { stageProgress } = task;
  const sum = stageProgress.preprocess + stageProgress.ocr + stageProgress.layout;
  return Math.round(sum / 3);
};

const pickNextTask = (): OCRTask | null => {
  if (runningTaskIds.size >= config.task.maxConcurrentTasks) return null;
  while (taskQueue.length > 0) {
    const item = taskQueue.shift()!;
    const task = taskMap[item.task.id];
    if (!task) continue;
    if (task.status !== 'queued') continue;
    return task;
  }
  return null;
};

const executeTask = async (task: OCRTask): Promise<void> => {
  runningTaskIds.add(task.id);

  try {
    task.status = 'preprocessing';
    task.currentStage = 'preprocess';
    updateTask(task);

    const preprocessedIds: string[] = [];
    for (let i = 0; i < task.fileIds.length; i++) {
      const fid = task.fileIds[i];
      try {
        const { id: newId } = await ImagePreprocessService.autoCorrect(fid);
        preprocessedIds.push(newId);
      } catch {
        preprocessedIds.push(fid);
      }
      task.stageProgress.preprocess = clamp(
        Math.round(((i + 1) / task.fileIds.length) * 100),
        0,
        100,
      );
      task.progress = computeOverallProgress(task);
      updateTask(task);
      await sleep(50);
    }

    task.status = 'ocr_running';
    task.currentStage = 'ocr';
    task.stageProgress.preprocess = 100;
    task.progress = computeOverallProgress(task);
    updateTask(task);

    const OCRService = (await import('./OCRService.js')).default;
    const textBlocks = await OCRService.recognize(preprocessedIds, task.category, {
      onProgress: (p: number) => {
        task.stageProgress.ocr = clamp(Math.round(p), 0, 100);
        task.progress = computeOverallProgress(task);
        updateTask(task);
      },
    });

    task.status = 'layout_restoring';
    task.currentStage = 'layout';
    task.stageProgress.ocr = 100;
    task.progress = computeOverallProgress(task);
    updateTask(task);

    const LayoutRestoreService = (await import('./LayoutRestoreService.js')).default;
    const layoutResult: LayoutResult = LayoutRestoreService.restore(textBlocks);
    task.stageProgress.layout = 100;
    task.progress = 100;
    task.currentStage = 'done';
    task.status = 'completed';
    task.result = layoutResult;
    updateTask(task);

    try {
      const HistoryService = (await import('./HistoryService.js')).default;
      await HistoryService.addHistoryFromTask(task);
    } catch {
      // ignore history save errors
    }
  } catch (err: any) {
    task.status = 'failed';
    task.error = {
      code: err.code || 'E_TASK_FAILED',
      message: err.message || 'Task execution failed',
    };
    updateTask(task);
  } finally {
    runningTaskIds.delete(task.id);
  }
};

const workerLoop = async (): Promise<void> => {
  while (true) {
    const task = pickNextTask();
    if (!task) break;
    await executeTask(task);
  }
};

const ensureInit = async (): Promise<void> => {
  if (isInitialized) return;
  isInitialized = true;
  await loadTasksFromDisk();

  workerTimer = setInterval(() => {
    void workerLoop();
  }, config.task.pollInterval);

  saveTimer = setInterval(() => {
    void saveTasksToDisk();
  }, config.task.saveInterval);

  process.on('exit', () => {
    void saveTasksToDisk();
  });
};

export const TaskQueueService = {
  async init(): Promise<void> {
    await ensureInit();
  },

  async shutdown(): Promise<void> {
    if (workerTimer) {
      clearInterval(workerTimer);
      workerTimer = null;
    }
    if (saveTimer) {
      clearInterval(saveTimer);
      saveTimer = null;
    }
    await saveTasksToDisk();
    isInitialized = false;
  },

  async addTask(
    partialTask: Partial<OCRTask> & {
      name: string;
      category: FileCategory;
      fileIds: string[];
    },
    options: AddTaskOptions = {},
  ): Promise<OCRTask> {
    await ensureInit();
    const now = Date.now();
    const id = generateTaskId();
    const task: OCRTask = {
      id,
      name: partialTask.name,
      category: partialTask.category,
      fileIds: [...partialTask.fileIds],
      status: 'queued',
      progress: 0,
      currentStage: 'pending',
      stageProgress: { preprocess: 0, ocr: 0, layout: 0 },
      retryCount: 0,
      createdAt: now,
      updatedAt: now,
      ...partialTask,
    };

    taskMap[id] = task;
    taskQueue.push({
      task,
      priority: options.priority ?? 0,
      addedAt: now,
    });
    sortQueue();
    hasUnsavedChanges = true;

    return task;
  },

  async pauseTask(id: string): Promise<OCRTask | null> {
    await ensureInit();
    const task = taskMap[id];
    if (!task) return null;
    if (task.status === 'queued' || runningTaskIds.has(id)) {
      task.status = 'paused';
      task.pausedAt = Date.now();
      updateTask(task);
    }
    return task;
  },

  async resumeTask(id: string): Promise<OCRTask | null> {
    await ensureInit();
    const task = taskMap[id];
    if (!task) return null;
    if (task.status === 'paused') {
      task.status = runningTaskIds.has(id) ? 'preprocessing' : 'queued';
      task.pausedAt = undefined;
      updateTask(task);
      if (task.status === 'queued') {
        taskQueue.push({ task, priority: 0, addedAt: Date.now() });
        sortQueue();
      }
    }
    return task;
  },

  async retryTask(id: string): Promise<OCRTask | null> {
    await ensureInit();
    const task = taskMap[id];
    if (!task) return null;
    if (task.status !== 'failed' && task.status !== 'completed') return task;

    if (task.retryCount >= config.task.maxRetries) {
      throw new Error('Max retry count exceeded');
    }

    task.retryCount += 1;
    task.status = 'queued';
    task.progress = 0;
    task.currentStage = 'pending';
    task.stageProgress = { preprocess: 0, ocr: 0, layout: 0 };
    task.error = undefined;
    task.result = undefined;
    updateTask(task);

    taskQueue.push({ task, priority: 1, addedAt: Date.now() });
    sortQueue();

    return task;
  },

  async cancelTask(id: string): Promise<OCRTask | null> {
    await ensureInit();
    const task = taskMap[id];
    if (!task) return null;
    if (task.status === 'completed' || task.status === 'failed') return task;

    task.status = 'failed';
    task.error = { code: 'E_CANCELLED', message: 'Task cancelled by user' };
    updateTask(task);

    return task;
  },

  async batchCancel(ids: string[]): Promise<{ cancelled: number; tasks: (OCRTask | null)[] }> {
    await ensureInit();
    const tasks: (OCRTask | null)[] = [];
    let cancelled = 0;
    for (const id of ids) {
      const result = await TaskQueueService.cancelTask(id);
      tasks.push(result);
      if (result) cancelled++;
    }
    return { cancelled, tasks };
  },

  async batchPause(ids: string[]): Promise<{ updated: number; tasks: (OCRTask | null)[] }> {
    await ensureInit();
    const tasks: (OCRTask | null)[] = [];
    let updated = 0;
    for (const id of ids) {
      const result = await TaskQueueService.pauseTask(id);
      tasks.push(result);
      if (result && result.status === 'paused') updated++;
    }
    return { updated, tasks };
  },

  async batchResume(ids: string[]): Promise<{ updated: number; tasks: (OCRTask | null)[] }> {
    await ensureInit();
    const tasks: (OCRTask | null)[] = [];
    let updated = 0;
    for (const id of ids) {
      const result = await TaskQueueService.resumeTask(id);
      tasks.push(result);
      if (result && result.status !== 'paused') updated++;
    }
    return { updated, tasks };
  },

  async batchRetry(ids: string[]): Promise<{ updated: number; tasks: (OCRTask | null)[] }> {
    await ensureInit();
    const tasks: (OCRTask | null)[] = [];
    let updated = 0;
    for (const id of ids) {
      try {
        const result = await TaskQueueService.retryTask(id);
        tasks.push(result);
        if (result && (result.status === 'queued')) updated++;
      } catch {
        tasks.push(null);
      }
    }
    return { updated, tasks };
  },

  async getTask(id: string): Promise<OCRTask | null> {
    await ensureInit();
    return taskMap[id] || null;
  },

  async listTasks(params: {
    status?: TaskStatus;
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedResponse<OCRTask>> {
    await ensureInit();
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;

    let tasks = Object.values(taskMap);
    if (params.status) {
      tasks = tasks.filter((t) => t.status === params.status);
    }
    tasks.sort((a, b) => b.createdAt - a.createdAt);

    const total = tasks.length;
    const start = (page - 1) * pageSize;
    const items = tasks.slice(start, start + pageSize);

    return { items, total, page, pageSize };
  },

  async updateProgress(
    taskId: string,
    stage: 'preprocess' | 'ocr' | 'layout',
    progress: number,
  ): Promise<OCRTask | null> {
    await ensureInit();
    const task = taskMap[taskId];
    if (!task) return null;

    const clamped = clamp(Math.round(progress), 0, 100);
    task.stageProgress[stage] = clamped;
    task.currentStage = stage;
    if (stage === 'preprocess') task.status = 'preprocessing';
    if (stage === 'ocr') task.status = 'ocr_running';
    if (stage === 'layout') task.status = 'layout_restoring';
    task.progress = computeOverallProgress(task);
    updateTask(task);

    return task;
  },

  async flush(): Promise<void> {
    await saveTasksToDisk();
  },
};

export default TaskQueueService;
