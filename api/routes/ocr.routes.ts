import { Router, type Request, type Response } from 'express';
import type { ApiResponse, OCRTask, FileCategory, LayoutResult } from '@shared/types.js';
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
  '/task/:taskId',
  asyncHandler(async (req: Request, res: Response<ApiResponse<OCRTask | null>>) => {
    const { taskId } = req.params;
    const result = await TaskQueueService.getTask(taskId);
    res.json({ success: true, data: result });
  }),
);

router.get(
  '/result/:taskId',
  asyncHandler(async (req: Request, res: Response<ApiResponse<LayoutResult | null>>) => {
    const { taskId } = req.params;
    const task = await TaskQueueService.getTask(taskId);
    res.json({ success: true, data: task?.result ?? null });
  }),
);

export default router;
