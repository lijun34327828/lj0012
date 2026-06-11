import { Router, type Request, type Response } from 'express';
import type { ApiResponse, OCRTask, PaginatedResponse, TaskStatus } from '@shared/types.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import TaskQueueService from '../services/TaskQueueService.js';

const router = Router();

router.post(
  '/list',
  asyncHandler(async (req: Request, res: Response<ApiResponse<PaginatedResponse<OCRTask>>>) => {
    const { status, page, pageSize } = req.body;
    const result = await TaskQueueService.listTasks({
      status: status as TaskStatus | undefined,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
    res.json({ success: true, data: result });
  }),
);

router.delete(
  '/batch',
  asyncHandler(async (req: Request, res: Response<ApiResponse<{ cancelled: number; tasks: (OCRTask | null)[] }>>) => {
    const { ids } = req.body;
    const result = await TaskQueueService.batchCancel(ids || []);
    res.json({ success: true, data: result });
  }),
);

router.post(
  '/batch-pause',
  asyncHandler(async (req: Request, res: Response<ApiResponse<{ updated: number; tasks: (OCRTask | null)[] }>>) => {
    const { ids } = req.body;
    const result = await TaskQueueService.batchPause(ids || []);
    res.json({ success: true, data: result });
  }),
);

router.post(
  '/batch-resume',
  asyncHandler(async (req: Request, res: Response<ApiResponse<{ updated: number; tasks: (OCRTask | null)[] }>>) => {
    const { ids } = req.body;
    const result = await TaskQueueService.batchResume(ids || []);
    res.json({ success: true, data: result });
  }),
);

router.post(
  '/batch-retry',
  asyncHandler(async (req: Request, res: Response<ApiResponse<{ updated: number; tasks: (OCRTask | null)[] }>>) => {
    const { ids } = req.body;
    const result = await TaskQueueService.batchRetry(ids || []);
    res.json({ success: true, data: result });
  }),
);

router.post(
  '/:id/pause',
  asyncHandler(async (req: Request, res: Response<ApiResponse<OCRTask | null>>) => {
    const { id } = req.params;
    const result = await TaskQueueService.pauseTask(id);
    res.json({ success: true, data: result });
  }),
);

router.post(
  '/:id/resume',
  asyncHandler(async (req: Request, res: Response<ApiResponse<OCRTask | null>>) => {
    const { id } = req.params;
    const result = await TaskQueueService.resumeTask(id);
    res.json({ success: true, data: result });
  }),
);

router.post(
  '/:id/retry',
  asyncHandler(async (req: Request, res: Response<ApiResponse<OCRTask | null>>) => {
    const { id } = req.params;
    const result = await TaskQueueService.retryTask(id);
    res.json({ success: true, data: result });
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response<ApiResponse<OCRTask | null>>) => {
    const { id } = req.params;
    const result = await TaskQueueService.cancelTask(id);
    res.json({ success: true, data: result });
  }),
);

export default router;
