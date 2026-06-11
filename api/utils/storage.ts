import fs from 'node:fs';
import path from 'node:path';
import { config } from '@api/config.js';

const SUBDIRS = ['uploads', 'cache', 'results', 'exports', 'data', 'temp'] as const;

export type StorageDir = (typeof SUBDIRS)[number];

const ensureDirSync = (dirPath: string): void => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

export const initStorageDirs = (): void => {
  ensureDirSync(config.storage.baseDir);
  for (const subdir of SUBDIRS) {
    ensureDirSync(config.storage[`${subdir}Dir`]);
  }
};

initStorageDirs();

export const getDirPath = (dir: StorageDir): string => {
  return config.storage[`${dir}Dir`];
};

export const getFilePath = (dir: StorageDir, filename: string): string => {
  return path.join(getDirPath(dir), filename);
};

export const fileExists = (dir: StorageDir, filename: string): boolean => {
  const filePath = getFilePath(dir, filename);
  return fs.existsSync(filePath);
};

export const readJSONSync = <T = any>(dir: StorageDir, filename: string): T | null => {
  const filePath = getFilePath(dir, filename);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
};

export const readJSON = <T = any>(dir: StorageDir, filename: string): Promise<T | null> => {
  return Promise.resolve(readJSONSync<T>(dir, filename));
};

export const writeJSONSync = <T = any>(dir: StorageDir, filename: string, data: T): void => {
  const filePath = getFilePath(dir, filename);
  ensureDirSync(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
};

export const writeJSON = <T = any>(dir: StorageDir, filename: string, data: T): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      writeJSONSync(dir, filename, data);
      resolve();
    } catch (err) {
      reject(err);
    }
  });
};

export const deleteFileSync = (dir: StorageDir, filename: string): boolean => {
  const filePath = getFilePath(dir, filename);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      return true;
    } catch {
      return false;
    }
  }
  return false;
};

export const deleteFile = (dir: StorageDir, filename: string): Promise<boolean> => {
  return Promise.resolve(deleteFileSync(dir, filename));
};

export const deleteFileByPath = (filePath: string): boolean => {
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      return true;
    } catch {
      return false;
    }
  }
  return false;
};

export const generateFileUrl = (protocol: string, host: string, dir: StorageDir, filename: string): string => {
  return `${protocol}://${host}/storage/${dir}/${filename}`;
};

export const generateFileUrlFromPath = (protocol: string, host: string, filePath: string): string => {
  const relativePath = path.relative(config.storage.baseDir, filePath);
  const normalized = relativePath.split(path.sep).join('/');
  return `${protocol}://${host}/storage/${normalized}`;
};

export const listFiles = (dir: StorageDir, pattern?: RegExp): string[] => {
  const dirPath = getDirPath(dir);
  if (!fs.existsSync(dirPath)) {
    return [];
  }
  try {
    const files = fs.readdirSync(dirPath);
    if (pattern) {
      return files.filter((f) => pattern.test(f));
    }
    return files;
  } catch {
    return [];
  }
};
