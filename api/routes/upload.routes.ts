import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import type { ApiResponse, UploadFile, FileCategory } from '@shared/types.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { fileValidator } from '../middleware/fileValidator.js';
import UploadService from '../services/UploadService.js';

const router = Router();

const memoryStorage = multer.memoryStorage();
const chunkUpload = multer({ storage: memoryStorage });

router.post(
  '/init',
  asyncHandler(async (req: Request, res: Response<ApiResponse<{ uploadId: string; chunkSize: number }>>) => {
    const { filename, size, type } = req.body;
    const result = await UploadService.initChunkUpload(filename, size, type);
    res.json({ success: true, data: result });
  }),
);

router.post(
  '/chunk',
  chunkUpload.single('file'),
  asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
    const { uploadId, index } = req.body;
    const buffer = req.file?.buffer;
    if (!buffer) {
      res.status(400).json({ success: false, error: { code: 'CHUNK_REQUIRED', message: '分片文件缺失' } });
      return;
    }
    await UploadService.uploadChunk(uploadId, Number(index), buffer);
    res.json({ success: true, message: '分片上传成功' });
  }),
);

router.post(
  '/merge',
  asyncHandler(async (req: Request, res: Response<ApiResponse<UploadFile>>) => {
    const { uploadId, filename, category } = req.body;
    const result = await UploadService.mergeChunks(uploadId, filename, category as FileCategory);
    res.json({ success: true, data: result });
  }),
);

router.post(
  '/single',
  fileValidator('file'),
  asyncHandler(async (req: Request, res: Response<ApiResponse<UploadFile>>) => {
    const buffer = req.file!.buffer;
    const originalname = req.file!.originalname;
    const mimetype = req.file!.mimetype;
    const category = (req.body.category as FileCategory) || 'custom';
    const result = await UploadService.singleUpload(buffer, originalname, mimetype, category);
    res.json({ success: true, data: result });
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response<ApiResponse<boolean>>) => {
    const { id } = req.params;
    const result = await UploadService.deleteFile(id);
    res.json({ success: true, data: result });
  }),
);

export default router;
