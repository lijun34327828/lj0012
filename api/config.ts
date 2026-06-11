import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

export const config = {
  port: parseInt(process.env.PORT || '8652', 10),
  rootDir: ROOT_DIR,
  storage: {
    baseDir: path.join(ROOT_DIR, 'storage'),
    uploadsDir: path.join(ROOT_DIR, 'storage', 'uploads'),
    cacheDir: path.join(ROOT_DIR, 'storage', 'cache'),
    resultsDir: path.join(ROOT_DIR, 'storage', 'results'),
    exportsDir: path.join(ROOT_DIR, 'storage', 'exports'),
    dataDir: path.join(ROOT_DIR, 'storage', 'data'),
    tempDir: path.join(ROOT_DIR, 'storage', 'temp'),
  },
  upload: {
    maxFileSize: 100 * 1024 * 1024,
    chunkSize: 2 * 1024 * 1024,
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/bmp',
      'image/tiff',
      'image/gif',
    ],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff', '.gif'],
  },
  task: {
    maxConcurrentTasks: 2,
    pollInterval: 100,
    saveInterval: 5000,
    maxRetries: 3,
  },
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  },
  rateLimit: {
    windowMs: 60 * 1000,
    max: 200,
  },
};

export type Config = typeof config;
