import { Router, type Request, type Response } from 'express';
import fs from 'node:fs';
import type { ApiResponse, ExportFormat } from '@shared/types.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import ExportService from '../services/ExportService.js';

const router = Router();

router.post(
  '/generate',
  asyncHandler(async (req: Request, res: Response<ApiResponse<{ exportId: string; filename: string; size: number }>>) => {
    const { taskId, format, options } = req.body;
    const result = await ExportService.generate(taskId, format as ExportFormat, options);
    res.json({ success: true, data: result });
  }),
);

router.get(
  '/download/:exportId',
  asyncHandler(async (req: Request, res: Response) => {
    const { exportId } = req.params;
    const info = await ExportService.getExportPath(exportId);
    if (!info) {
      res.status(404).json({ success: false, error: { code: 'EXPORT_NOT_FOUND', message: '导出文件不存在' } });
      return;
    }
    const encodedFilename = encodeURIComponent(info.filename);
    res.setHeader('Content-Disposition', `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', String(info.size));
    const stream = fs.createReadStream(info.filePath);
    stream.pipe(res);
  }),
);

export default router;
