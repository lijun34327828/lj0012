import { Router, type Request, type Response } from 'express';
import type { ApiResponse, LayoutResult, OCRTask } from '@shared/types.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import TaskQueueService from '../services/TaskQueueService.js';

const router = Router();

router.get(
  '/:taskId',
  asyncHandler(async (req: Request, res: Response<ApiResponse<LayoutResult | null>>) => {
    const { taskId } = req.params;
    const task = await TaskQueueService.getTask(taskId);
    res.json({ success: true, data: task?.result ?? null });
  }),
);

router.put(
  '/:taskId',
  asyncHandler(async (req: Request, res: Response<ApiResponse<OCRTask | null>>) => {
    const { taskId } = req.params;
    const { result } = req.body;
    const task = await TaskQueueService.getTask(taskId);
    if (!task) {
      res.status(404).json({ success: false, error: { code: 'TASK_NOT_FOUND', message: '任务不存在' } });
      return;
    }
    task.result = result as LayoutResult;
    await TaskQueueService.flush();
    res.json({ success: true, data: task });
  }),
);

export default router;
