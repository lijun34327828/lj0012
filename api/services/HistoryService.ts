import path from 'node:path';
import type { HistoryRecord, OCRTask, FileCategory, PaginatedResponse, TaskStatus } from '@shared/types.js';
import { config } from '@api/config.js';
import { generateHistoryId, ensureDir, readJson, writeJson, fileExists } from '../utils/index.js';

interface HistoryStore {
  records: Record<string, HistoryRecord>;
}

const HISTORY_DATA_PATH = path.join(config.storage.dataDir, 'history.json');

const historyMap: Record<string, HistoryRecord> = {};
let isInitialized = false;
let hasUnsavedChanges = false;

const getStore = async (): Promise<HistoryStore> => {
  await ensureDir(config.storage.dataDir);
  if (await fileExists(HISTORY_DATA_PATH)) {
    try {
      return await readJson<HistoryStore>(HISTORY_DATA_PATH);
    } catch {
      // ignore corrupt file
    }
  }
  return { records: {} };
};

const saveStore = async (): Promise<void> => {
  if (!hasUnsavedChanges) return;
  const store: HistoryStore = { records: { ...historyMap } };
  await writeJson(HISTORY_DATA_PATH, store);
  hasUnsavedChanges = false;
};

const loadFromDisk = async (): Promise<void> => {
  const store = await getStore();
  Object.assign(historyMap, store.records);
};

const ensureInit = async (): Promise<void> => {
  if (isInitialized) return;
  isInitialized = true;
  await loadFromDisk();

  process.on('exit', () => {
    void saveStore();
  });
};

const buildSummary = (task: OCRTask): string => {
  if (!task.result) return '识别未完成';
  const { statistics } = task.result;
  const typeLabel = statistics.handwrittenChars > statistics.printedChars ? '手写为主' : '印刷为主';
  return `共 ${statistics.totalChars} 字，${typeLabel}，置信度 ${Math.round(statistics.avgConfidence * 100)}%`;
};

const getCharCount = (task: OCRTask): number => {
  return task.result?.statistics.totalChars ?? 0;
};

const CATEGORY_THUMBNAILS: Record<FileCategory, string> = {
  exam: '/category-icons/exam.svg',
  note: '/category-icons/note.svg',
  receipt: '/category-icons/receipt.svg',
  custom: '/category-icons/custom.svg',
};

export const HistoryService = {
  async init(): Promise<void> {
    await ensureInit();
  },

  async addHistoryFromTask(task: OCRTask): Promise<HistoryRecord> {
    await ensureInit();
    const now = Date.now();
    const id = generateHistoryId();
    const record: HistoryRecord = {
      id,
      taskId: task.id,
      name: task.name,
      category: task.category,
      thumbnail: CATEGORY_THUMBNAILS[task.category],
      summary: buildSummary(task),
      charCount: getCharCount(task),
      status: task.status,
      tags: [],
      createdAt: now,
      lastViewedAt: now,
      taskSnapshot: JSON.parse(JSON.stringify(task)),
    };
    historyMap[id] = record;
    hasUnsavedChanges = true;
    await saveStore();
    return record;
  },

  async getHistory(id: string): Promise<HistoryRecord | null> {
    await ensureInit();
    return historyMap[id] || null;
  },

  async touchHistory(id: string): Promise<void> {
    await ensureInit();
    if (historyMap[id]) {
      historyMap[id].lastViewedAt = Date.now();
      hasUnsavedChanges = true;
    }
  },

  async updateCategory(ids: string[], category: FileCategory): Promise<{ updated: number }> {
    await ensureInit();
    let count = 0;
    for (const id of ids) {
      if (historyMap[id]) {
        historyMap[id].category = category;
        if (historyMap[id].taskSnapshot) {
          historyMap[id].taskSnapshot.category = category;
        }
        count++;
      }
    }
    if (count > 0) {
      hasUnsavedChanges = true;
      await saveStore();
    }
    return { updated: count };
  },

  async deleteHistory(ids: string[]): Promise<{ deleted: number }> {
    await ensureInit();
    let count = 0;
    for (const id of ids) {
      if (historyMap[id]) {
        delete historyMap[id];
        count++;
      }
    }
    if (count > 0) {
      hasUnsavedChanges = true;
      await saveStore();
    }
    return { deleted: count };
  },

  async listHistory(params: {
    status?: TaskStatus;
    page?: number;
    pageSize?: number;
    category?: FileCategory;
    keyword?: string;
    tags?: string[];
  }): Promise<PaginatedResponse<HistoryRecord>> {
    await ensureInit();
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;

    let records = Object.values(historyMap);

    if (params.status) {
      records = records.filter((r) => r.status === params.status);
    }
    if (params.category) {
      records = records.filter((r) => r.category === params.category);
    }
    if (params.keyword) {
      const kw = params.keyword.toLowerCase();
      records = records.filter(
        (r) =>
          r.name.toLowerCase().includes(kw) ||
          r.summary.toLowerCase().includes(kw)
      );
    }
    if (params.tags && params.tags.length > 0) {
      records = records.filter((r) => params.tags!.some((t) => r.tags.includes(t)));
    }

    records.sort((a, b) => b.createdAt - a.createdAt);

    const total = records.length;
    const start = (page - 1) * pageSize;
    const items = records.slice(start, start + pageSize);

    return { items, total, page, pageSize };
  },

  async flush(): Promise<void> {
    await saveStore();
  },
};

export default HistoryService;
