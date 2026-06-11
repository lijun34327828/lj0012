import type { TextBlock, FileCategory } from '@shared/types';
import { mockOCR, sleep } from '../utils/index.js';
import UploadService from './UploadService.js';
import ImagePreprocessService from './ImagePreprocessService.js';

interface RecognizeOptions {
  category?: FileCategory;
  language?: string;
  detectHandwriting?: boolean;
  onProgress?: (progress: number) => void;
}

export const OCRService = {
  async recognize(
    fileIds: string[],
    category?: FileCategory,
    options: RecognizeOptions = {},
  ): Promise<TextBlock[]> {
    const allBlocks: TextBlock[] = [];
    const total = fileIds.length;

    for (let idx = 0; idx < total; idx++) {
      const fileId = fileIds[idx];
      try {
        let imagePath = '';
        const sourceFile = await UploadService.getFile(fileId);
        if (sourceFile) {
          imagePath = sourceFile.path;
        } else {
          const cacheEntry = await ImagePreprocessService.getCacheEntry(fileId);
          if (cacheEntry) {
            imagePath = cacheEntry.storedPath;
          }
        }

        if (!imagePath) {
          continue;
        }

        const blocks = await mockOCR(imagePath, {
          category,
          pageIndex: idx,
        });

        for (const block of blocks) {
          block.pageIndex = idx;
          allBlocks.push(block);
        }
      } catch {
        // skip failed file
      }

      if (options.onProgress) {
        options.onProgress(((idx + 1) / total) * 100);
      }

      if (idx < total - 1) {
        await sleep(30);
      }
    }

    return allBlocks;
  },

  async recognizeSingle(
    fileId: string,
    options?: RecognizeOptions,
  ): Promise<TextBlock[]> {
    return this.recognize([fileId], options?.category, options);
  },

  estimateCost(fileIds: string[]): { pages: number; estimatedMs: number } {
    const pages = fileIds.length;
    const estimatedMs = pages * 150;
    return { pages, estimatedMs };
  },
};

export default OCRService;
