import { Router, type Request, type Response } from 'express';
import type { ApiResponse, HistoryRecord, PaginatedResponse, TaskStatus, FileCategory } from '@shared/types.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import HistoryService from '../services/HistoryService.js';

const router = Router();

router.post(
  '/list',
  asyncHandler(async (req: Request, res: Response<ApiResponse<PaginatedResponse<HistoryRecord>>>) => {
    const { status, page, pageSize, category, keyword, tags } = req.body;
    const result = await HistoryService.listHistory({
      status: status as TaskStatus | undefined,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      category: category as FileCategory | undefined,
      keyword: keyword as string | undefined,
      tags: tags as string[] | undefined,
    });
    res.json({ success: true, data: result });
  }),
);

router.put(
  '/:id',
  asyncHandler(async (req: Request, res: Response<ApiResponse<{ updated: number }>>) => {
    const { id } = req.params;
    const { category, tags } = req.body;
    let result = { updated: 0 };
    if (category) {
      result = await HistoryService.updateCategory([id], category as FileCategory);
    }
    if (tags && Array.isArray(tags)) {
      const record = await HistoryService.getHistory(id);
      if (record) {
        record.tags = tags;
        await HistoryService.flush();
        if (result.updated === 0) result = { updated: 1 };
      }
    }
    res.json({ success: true, data: result });
  }),
);

router.delete(
  '/batch',
  asyncHandler(async (req: Request, res: Response<ApiResponse<{ deleted: number }>>) => {
    const { ids } = req.body;
    const result = await HistoryService.deleteHistory(ids as string[]);
    res.json({ success: true, data: result });
  }),
);

export default router;
