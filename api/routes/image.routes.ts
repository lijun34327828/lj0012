import { Router, type Request, type Response } from 'express';
import type { ApiResponse, PreprocessConfig, ImageOperation } from '@shared/types.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import ImagePreprocessService from '../services/ImagePreprocessService.js';

const router = Router();

router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
    const { id } = req.params;
    const result = await ImagePreprocessService.getImageMeta(id);
    res.json({ success: true, data: result });
  }),
);

router.post(
  '/preprocess',
  asyncHandler(async (req: Request<{}, {}, PreprocessConfig>, res: Response<ApiResponse>) => {
    const { fileId, operations } = req.body;
    const result = await ImagePreprocessService.preprocess(fileId, operations as ImageOperation[]);
    res.json({ success: true, data: result });
  }),
);

router.post(
  '/autocorrect',
  asyncHandler(async (req: Request, res: Response<ApiResponse>) => {
    const { fileId } = req.body;
    const result = await ImagePreprocessService.autoCorrect(fileId);
    res.json({ success: true, data: result });
  }),
);

export default router;
