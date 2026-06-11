import { Router, type Request, type Response } from 'express';
import type { ApiResponse, OCRTask, FileCategory, LayoutResult, TaskProgress, PaginatedResponse, TaskStatus } from '@shared/types.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import TaskQueueService from '../services/TaskQueueService.js';

const router = Router();

const generateTaskName = (fileIds: string[], category: FileCategory): string => {
  const categoryLabels: Record<FileCategory, string> = {
    exam: '试卷识别',
    note: '笔记识别',
    receipt: '单据识别',
    custom: '文档识别',
  };
  const count = fileIds.length;
  const base = categoryLabels[category] || categoryLabels.custom;
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}_${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}`;
  return `${base}_${count}页_${dateStr}`;
};

const taskToProgress = (task: OCRTask | null): TaskProgress | null => {
  if (!task) return null;
  return {
    taskId: task.id,
    status: task.status,
    progress: task.progress,
    currentStage: task.currentStage,
    stageDetail: task.stageDetail,
    etaSeconds: undefined,
  };
};

router.post(
  '/submit',
  asyncHandler(async (req: Request, res: Response<ApiResponse<OCRTask>>) => {
    const { fileIds, category, name } = req.body;
    const cat = category as FileCategory;
    const taskName = name || generateTaskName(fileIds as string[], cat);
    const result = await TaskQueueService.addTask({
      name: taskName,
      category: cat,
      fileIds: fileIds as string[],
    });
    res.json({ success: true, data: result });
  }),
);

router.get(
  '/tasks',
  asyncHandler(async (req: Request, res: Response<ApiResponse<PaginatedResponse<OCRTask>>>) => {
    const { status, page, pageSize } = req.query;
    const result = await TaskQueueService.listTasks({
      status: status as TaskStatus | undefined,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
    res.json({ success: true, data: result });
  }),
);

router.get(
  '/tasks/:taskId',
  asyncHandler(async (req: Request, res: Response<ApiResponse<OCRTask | null>>) => {
    const { taskId } = req.params;
    const result = await TaskQueueService.getTask(taskId);
    res.json({ success: true, data: result });
  }),
);

router.get(
  '/tasks/:taskId/status',
  asyncHandler(async (req: Request, res: Response<ApiResponse<TaskProgress | null>>) => {
    const { taskId } = req.params;
    const task = await TaskQueueService.getTask(taskId);
    res.json({ success: true, data: taskToProgress(task) });
  }),
);

router.get(
  '/tasks/:taskId/result',
  asyncHandler(async (req: Request, res: Response<ApiResponse<OCRTask | null>>) => {
    const { taskId } = req.params;
    const task = await TaskQueueService.getTask(taskId);
    res.json({ success: true, data: task });
  }),
);

router.post(
  '/tasks/:taskId/pause',
  asyncHandler(async (req: Request, res: Response<ApiResponse<OCRTask | null>>) => {
    const { taskId } = req.params;
    const result = await TaskQueueService.pauseTask(taskId);
    res.json({ success: true, data: result });
  }),
);

router.post(
  '/tasks/:taskId/resume',
  asyncHandler(async (req: Request, res: Response<ApiResponse<OCRTask | null>>) => {
    const { taskId } = req.params;
    const result = await TaskQueueService.resumeTask(taskId);
    res.json({ success: true, data: result });
  }),
);

router.post(
  '/tasks/:taskId/retry',
  asyncHandler(async (req: Request, res: Response<ApiResponse<OCRTask | null>>) => {
    const { taskId } = req.params;
    const result = await TaskQueueService.retryTask(taskId);
    res.json({ success: true, data: result });
  }),
);

router.post(
  '/tasks/:taskId/cancel',
  asyncHandler(async (req: Request, res: Response<ApiResponse<OCRTask | null>>) => {
    const { taskId } = req.params;
    const result = await TaskQueueService.cancelTask(taskId);
    res.json({ success: true, data: result });
  }),
);

export default router;
