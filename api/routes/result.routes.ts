import { Router, type Request, type Response } from 'express';
import type { ApiResponse, LayoutResult, OCRTask, TextBlock } from '@shared/types.js';
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
  asyncHandler(async (req: Request, res: Response<ApiResponse<{ saved: boolean; updatedAt: number }>>) => {
    const { taskId } = req.params;
    const { editedBlocks, result } = req.body;
    const task = await TaskQueueService.getTask(taskId);
    if (!task) {
      res.status(404).json({ success: false, error: { code: 'TASK_NOT_FOUND', message: '任务不存在' } });
      return;
    }

    if (result) {
      task.result = result as LayoutResult;
    } else if (editedBlocks && task.result) {
      for (const block of task.result.blocks) {
        for (const text of block.texts) {
          if (editedBlocks[text.id] !== undefined) {
            (text as TextBlock).content = editedBlocks[text.id];
          }
        }
      }
    }

    await TaskQueueService.flush();
    res.json({ success: true, data: { saved: true, updatedAt: task.updatedAt } });
  }),
);

export default router;
