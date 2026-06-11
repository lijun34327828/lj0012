import path from 'node:path';
import fs from 'node:fs/promises';
import type { UploadFile, FileCategory } from '@shared/types';
import { config } from '@api/config';
import {
  generateId,
  generateUploadId,
  ensureDir,
  ensureFileDir,
  removeDir,
  removeFile,
  readJson,
  writeJson,
  fileExists,
  getFileExtension,
  sanitizeFilename,
  getFileSize,
  listFiles,
} from '../utils/index.js';

interface UploadChunkMeta {
  filename: string;
  size: number;
  type: string;
  chunkSize: number;
  totalChunks: number;
  uploadedChunks: number[];
  createdAt: number;
}

interface FilesStore {
  files: Record<string, UploadFile>;
  chunks: Record<string, UploadChunkMeta>;
}

const FILES_DATA_PATH = path.join(config.storage.dataDir, 'files.json');

const getFilesStore = async (): Promise<FilesStore> => {
  await ensureDir(config.storage.dataDir);
  if (await fileExists(FILES_DATA_PATH)) {
    return readJson<FilesStore>(FILES_DATA_PATH);
  }
  return { files: {}, chunks: {} };
};

const saveFilesStore = async (store: FilesStore): Promise<void> => {
  await writeJson(FILES_DATA_PATH, store);
};

const getUrlFromPath = (filePath: string): string => {
  const relative = path.relative(config.rootDir, filePath);
  return '/' + relative.replace(/\\/g, '/');
};

export const UploadService = {
  async initChunkUpload(
    filename: string,
    size: number,
    type: string,
  ): Promise<{ uploadId: string; chunkSize: number }> {
    const chunkSize = config.upload.chunkSize;
    const totalChunks = Math.ceil(size / chunkSize);
    const uploadId = generateUploadId();
    const tempDir = path.join(config.storage.tempDir, uploadId);

    await ensureDir(tempDir);

    const store = await getFilesStore();
    store.chunks[uploadId] = {
      filename,
      size,
      type,
      chunkSize,
      totalChunks,
      uploadedChunks: [],
      createdAt: Date.now(),
    };
    await saveFilesStore(store);

    return { uploadId, chunkSize };
  },

  async uploadChunk(
    uploadId: string,
    index: number,
    buffer: Buffer,
  ): Promise<void> {
    const store = await getFilesStore();
    const meta = store.chunks[uploadId];
    if (!meta) {
      throw new Error(`Upload session not found: ${uploadId}`);
    }

    const chunkPath = path.join(config.storage.tempDir, uploadId, String(index));
    await fs.writeFile(chunkPath, buffer);

    if (!meta.uploadedChunks.includes(index)) {
      meta.uploadedChunks.push(index);
      meta.uploadedChunks.sort((a, b) => a - b);
      await saveFilesStore(store);
    }
  },

  async mergeChunks(
    uploadId: string,
    filename: string,
    category: FileCategory,
  ): Promise<UploadFile> {
    const store = await getFilesStore();
    const meta = store.chunks[uploadId];
    if (!meta) {
      throw new Error(`Upload session not found: ${uploadId}`);
    }

    if (meta.uploadedChunks.length !== meta.totalChunks) {
      throw new Error('Incomplete chunks uploaded');
    }

    const ext = getFileExtension(filename) || '.bin';
    const storedName = `${generateId()}${ext}`;
    const safeName = sanitizeFilename(filename);
    const outputPath = path.join(config.storage.uploadsDir, storedName);
    const tempDir = path.join(config.storage.tempDir, uploadId);

    await ensureDir(config.storage.uploadsDir);

    const chunkFiles: string[] = [];
    for (let i = 0; i < meta.totalChunks; i++) {
      chunkFiles.push(path.join(tempDir, String(i)));
    }

    const fsStream = await import('node:fs');
    const writeStream = fsStream.createWriteStream(outputPath);

    for (const chunkPath of chunkFiles) {
      const readStream = fsStream.createReadStream(chunkPath);
      await new Promise<void>((resolve, reject) => {
        readStream.pipe(writeStream, { end: false });
        readStream.on('end', resolve);
        readStream.on('error', reject);
      });
    }

    writeStream.end();
    await new Promise<void>((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    const finalSize = await getFileSize(outputPath);
    const id = generateId();
    const uploadFile: UploadFile = {
      id,
      originalName: safeName,
      storedName,
      path: outputPath,
      url: getUrlFromPath(outputPath),
      size: finalSize,
      mimeType: meta.type,
      category,
      uploadedAt: Date.now(),
    };

    store.files[id] = uploadFile;
    delete store.chunks[uploadId];
    await saveFilesStore(store);
    await removeDir(tempDir);

    return uploadFile;
  },

  async singleUpload(
    buffer: Buffer,
    originalname: string,
    mimetype: string,
    category: FileCategory,
  ): Promise<UploadFile> {
    await ensureDir(config.storage.uploadsDir);

    const ext = getFileExtension(originalname) || '.bin';
    const storedName = `${generateId()}${ext}`;
    const safeName = sanitizeFilename(originalname);
    const outputPath = path.join(config.storage.uploadsDir, storedName);

    await fs.writeFile(outputPath, buffer);
    const finalSize = await getFileSize(outputPath);
    const id = generateId();

    const uploadFile: UploadFile = {
      id,
      originalName: safeName,
      storedName,
      path: outputPath,
      url: getUrlFromPath(outputPath),
      size: finalSize,
      mimeType: mimetype,
      category,
      uploadedAt: Date.now(),
    };

    const store = await getFilesStore();
    store.files[id] = uploadFile;
    await saveFilesStore(store);

    return uploadFile;
  },

  async getFile(id: string): Promise<UploadFile | null> {
    const store = await getFilesStore();
    return store.files[id] || null;
  },

  async deleteFile(id: string): Promise<boolean> {
    const store = await getFilesStore();
    const file = store.files[id];
    if (!file) {
      return false;
    }

    await removeFile(file.path);
    delete store.files[id];
    await saveFilesStore(store);

    return true;
  },
};

export default UploadService;
