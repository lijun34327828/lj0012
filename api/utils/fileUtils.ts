import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';

export const ensureDir = async (dirPath: string): Promise<void> => {
  try {
    await fsPromises.access(dirPath);
  } catch {
    await fsPromises.mkdir(dirPath, { recursive: true });
  }
};

export const ensureDirSync = (dirPath: string): void => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

export const ensureFileDir = async (filePath: string): Promise<void> => {
  const dir = path.dirname(filePath);
  await ensureDir(dir);
};

export const ensureFileDirSync = (filePath: string): void => {
  const dir = path.dirname(filePath);
  ensureDirSync(dir);
};

export const removeFile = async (filePath: string): Promise<boolean> => {
  try {
    await fsPromises.access(filePath);
    await fsPromises.unlink(filePath);
    return true;
  } catch {
    return false;
  }
};

export const removeFileSync = (filePath: string): boolean => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch {
    return false;
  }
};

export const removeDir = async (dirPath: string): Promise<boolean> => {
  try {
    await fsPromises.access(dirPath);
    await fsPromises.rm(dirPath, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
};

export const removeDirSync = (dirPath: string): boolean => {
  try {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
      return true;
    }
    return false;
  } catch {
    return false;
  }
};

export const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await fsPromises.access(filePath);
    return true;
  } catch {
    return false;
  }
};

export const fileExistsSync = (filePath: string): boolean => {
  return fs.existsSync(filePath);
};

export const readJson = async <T = any>(filePath: string): Promise<T> => {
  const content = await fsPromises.readFile(filePath, 'utf-8');
  return JSON.parse(content) as T;
};

export const readJsonSync = <T = any>(filePath: string): T => {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as T;
};

export const writeJson = async <T = any>(filePath: string, data: T): Promise<void> => {
  await ensureFileDir(filePath);
  const content = JSON.stringify(data, null, 2);
  await fsPromises.writeFile(filePath, content, 'utf-8');
};

export const writeJsonSync = <T = any>(filePath: string, data: T): void => {
  ensureFileDirSync(filePath);
  const content = JSON.stringify(data, null, 2);
  fs.writeFileSync(filePath, content, 'utf-8');
};

export const getFileExtension = (filename: string): string => {
  const ext = path.extname(filename);
  return ext.toLowerCase();
};

export const getFileSize = async (filePath: string): Promise<number> => {
  try {
    const stat = await fsPromises.stat(filePath);
    return stat.size;
  } catch {
    return 0;
  }
};

export const getFileSizeSync = (filePath: string): number => {
  try {
    const stat = fs.statSync(filePath);
    return stat.size;
  } catch {
    return 0;
  }
};

export const sanitizeFilename = (filename: string): string => {
  return filename
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
};

export const listFiles = async (
  dirPath: string,
  pattern?: RegExp
): Promise<string[]> => {
  try {
    const files = await fsPromises.readdir(dirPath);
    if (pattern) {
      return files.filter((f) => pattern.test(f));
    }
    return files;
  } catch {
    return [];
  }
};

export const listFilesSync = (dirPath: string, pattern?: RegExp): string[] => {
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

export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

export const mockDetectSkew = async (imagePath: string): Promise<number> => {
  await sleep(50 + Math.random() * 100);
  const skew = (Math.random() - 0.5) * 6;
  return Math.round(skew * 100) / 100;
};
