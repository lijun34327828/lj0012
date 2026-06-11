import path from 'node:path';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import type { UploadFile, ImageOperation, FileCategory } from '@shared/types';
import { config } from '@api/config';
import {
  generateId,
  ensureDir,
  fileExists,
  writeJson,
  readJson,
  getFileExtension,
  getFileSize,
  removeFile,
} from '../utils/index.js';
import { mockDetectSkew } from '../utils/index.js';
import UploadService from './UploadService.js';

interface CacheStore {
  entries: Record<
    string,
    {
      fileId: string;
      opsHash: string;
      width: number;
      height: number;
      size: number;
      storedPath: string;
      url: string;
      createdAt: number;
    }
  >;
}

const CACHE_DATA_PATH = path.join(config.storage.dataDir, 'cache.json');
const CACHE_MAP: Record<string, string> = {};

const getCacheStore = async (): Promise<CacheStore> => {
  await ensureDir(config.storage.dataDir);
  if (await fileExists(CACHE_DATA_PATH)) {
    return readJson<CacheStore>(CACHE_DATA_PATH);
  }
  return { entries: {} };
};

const saveCacheStore = async (store: CacheStore): Promise<void> => {
  await writeJson(CACHE_DATA_PATH, store);
};

const hashOps = (ops: ImageOperation[]): string => {
  return Buffer.from(JSON.stringify(ops)).toString('base64url');
};

const getUrlFromPath = (filePath: string): string => {
  const relative = path.relative(config.rootDir, filePath);
  return '/' + relative.replace(/\\/g, '/');
};

interface ImageMeta {
  width: number;
  height: number;
  size: number;
  format: string;
  channels?: number;
}

export const ImagePreprocessService = {
  async preprocess(
    fileId: string,
    operations: ImageOperation[],
  ): Promise<{ id: string; url: string; width: number; height: number }> {
    const sourceFile = await UploadService.getFile(fileId);
    if (!sourceFile) {
      throw new Error(`File not found: ${fileId}`);
    }

    const opsHash = hashOps(operations);
    const cacheKey = `${fileId}:${opsHash}`;

    if (CACHE_MAP[cacheKey]) {
      const cachedId = CACHE_MAP[cacheKey];
      const store = await getCacheStore();
      const entry = store.entries[cachedId];
      if (entry) {
        return { id: cachedId, url: entry.url, width: entry.width, height: entry.height };
      }
    }

    await ensureDir(config.storage.cacheDir);
    const ext = getFileExtension(sourceFile.storedName) || '.png';
    const storedName = `${generateId()}${ext}`;
    const outputPath = path.join(config.storage.cacheDir, storedName);

    let pipeline = sharp(sourceFile.path);

    for (const op of operations) {
      switch (op.type) {
        case 'crop': {
          const { x = 0, y = 0, w, h } = op.params;
          pipeline = pipeline.extract({
            left: Math.round(Number(x)),
            top: Math.round(Number(y)),
            width: Math.round(Number(w)),
            height: Math.round(Number(h)),
          });
          break;
        }
        case 'rotate': {
          const { angle = 0 } = op.params;
          pipeline = pipeline.rotate(Number(angle));
          break;
        }
        case 'flip': {
          const { horizontal = true, vertical = false } = op.params;
          if (horizontal) pipeline = pipeline.flop();
          if (vertical) pipeline = pipeline.flip();
          break;
        }
        case 'enhance': {
          const { brightness = 1, contrast = 1, saturation = 1 } = op.params;
          pipeline = pipeline.modulate({
            brightness: Number(brightness),
            saturation: Number(saturation),
          });
          if (contrast !== 1) {
            const c = Number(contrast);
            const intercept = 128 * (1 - c);
            pipeline = pipeline.linear(c, intercept);
          }
          break;
        }
        case 'denoise': {
          const { level = 1 } = op.params;
          pipeline = pipeline.median(Math.max(1, Math.round(Number(level) * 2)));
          break;
        }
        case 'binarize': {
          const { threshold = 128 } = op.params;
          pipeline = pipeline.threshold(Number(threshold));
          break;
        }
      }
    }

    const info = await pipeline.toFile(outputPath);

    const size = await getFileSize(outputPath);
    const newId = generateId();
    const url = getUrlFromPath(outputPath);

    const store = await getCacheStore();
    store.entries[newId] = {
      fileId,
      opsHash,
      width: info.width,
      height: info.height,
      size,
      storedPath: outputPath,
      url,
      createdAt: Date.now(),
    };
    await saveCacheStore(store);
    CACHE_MAP[cacheKey] = newId;

    return { id: newId, url, width: info.width, height: info.height };
  },

  async autoCorrect(
    fileId: string,
  ): Promise<{ angle: number; id: string; url: string; width: number; height: number }> {
    const sourceFile = await UploadService.getFile(fileId);
    if (!sourceFile) {
      throw new Error(`File not found: ${fileId}`);
    }

    const angle = await mockDetectSkew(sourceFile.path);

    if (Math.abs(angle) < 0.5) {
      const meta = await this.getImageMeta(fileId);
      return {
        angle: 0,
        id: fileId,
        url: sourceFile.url,
        width: meta.width,
        height: meta.height,
      };
    }

    const result = await this.preprocess(fileId, [
      { type: 'rotate', params: { angle: -angle } },
    ]);

    return { angle, ...result };
  },

  async getImageMeta(fileId: string): Promise<ImageMeta> {
    const sourceFile = await UploadService.getFile(fileId);
    if (!sourceFile) {
      const store = await getCacheStore();
      const cacheEntry = store.entries[fileId];
      if (cacheEntry) {
        const meta = await sharp(cacheEntry.storedPath).metadata();
        return {
          width: meta.width || cacheEntry.width,
          height: meta.height || cacheEntry.height,
          size: cacheEntry.size,
          format: meta.format || 'unknown',
          channels: meta.channels,
        };
      }
      throw new Error(`File not found: ${fileId}`);
    }

    const meta = await sharp(sourceFile.path).metadata();
    const size = await getFileSize(sourceFile.path);

    return {
      width: meta.width || 0,
      height: meta.height || 0,
      size,
      format: meta.format || 'unknown',
      channels: meta.channels,
    };
  },

  async getCacheEntry(id: string): Promise<{
    fileId: string;
    width: number;
    height: number;
    url: string;
    storedPath: string;
  } | null> {
    const store = await getCacheStore();
    const entry = store.entries[id];
    if (!entry) return null;
    return {
      fileId: entry.fileId,
      width: entry.width,
      height: entry.height,
      url: entry.url,
      storedPath: entry.storedPath,
    };
  },

  async clearCache(olderThan?: number): Promise<number> {
    const store = await getCacheStore();
    const now = Date.now();
    const entriesToDelete: string[] = [];

    for (const [id, entry] of Object.entries(store.entries)) {
      if (!olderThan || now - entry.createdAt > olderThan) {
        entriesToDelete.push(id);
      }
    }

    for (const id of entriesToDelete) {
      const entry = store.entries[id];
      await removeFile(entry.storedPath);
      delete store.entries[id];
    }

    await saveCacheStore(store);
    return entriesToDelete.length;
  },
};

export default ImagePreprocessService;
