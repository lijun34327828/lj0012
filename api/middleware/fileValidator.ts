import multer from 'multer';
import path from 'node:path';
import type { Request, Response, NextFunction } from 'express';
import type { ApiResponse } from '@shared/types.js';
import { config } from '@api/config.js';
import { generateFileId } from '@api/utils/idGenerator.js';
import { getDirPath, initStorageDirs } from '@api/utils/storage.js';

initStorageDirs();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, getDirPath('uploads'));
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const id = generateFileId();
    cb(null, `${id}${ext}`);
  },
});

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
): void => {
  const mimeType = file.mimetype.toLowerCase();
  const ext = path.extname(file.originalname).toLowerCase();

  if (!config.upload.allowedMimeTypes.includes(mimeType)) {
    cb(new Error(`不支持的文件类型: ${mimeType}`));
    return;
  }

  if (!config.upload.allowedExtensions.includes(ext)) {
    cb(new Error(`不支持的文件扩展名: ${ext}`));
    return;
  }

  cb(null, true);
};

export const uploadMulter = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxFileSize,
  },
});

export interface ValidationError {
  field?: string;
  message: string;
  code: string;
}

export const fileValidator = (fieldName: string = 'file', required: boolean = true) => {
  return (req: Request, res: Response<ApiResponse>, next: NextFunction): void => {
    uploadMulter.single(fieldName)(req, res, (err: any) => {
      if (err) {
        let code = 'UPLOAD_ERROR';
        let message = '文件上传失败';
        let statusCode = 400;

        if (err.code === 'LIMIT_FILE_SIZE') {
          code = 'FILE_TOO_LARGE';
          message = `文件大小超过限制，最大允许 ${config.upload.maxFileSize / (1024 * 1024)}MB`;
          statusCode = 413;
        } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          code = 'UNEXPECTED_FIELD';
          message = `意外的文件字段: ${err.field || fieldName}`;
        } else if (err.message) {
          code = 'INVALID_FILE';
          message = err.message;
        }

        res.status(statusCode).json({
          success: false,
          error: {
            code,
            message,
          },
        });
        return;
      }

      if (required && !req.file) {
        res.status(400).json({
          success: false,
          error: {
            code: 'FILE_REQUIRED',
            message: '请上传文件',
          },
        });
        return;
      }

      next();
    });
  };
};

export const multiFileValidator = (
  fieldName: string = 'files',
  maxCount: number = 10,
  required: boolean = true
) => {
  return (req: Request, res: Response<ApiResponse>, next: NextFunction): void => {
    uploadMulter.array(fieldName, maxCount)(req, res, (err: any) => {
      if (err) {
        let code = 'UPLOAD_ERROR';
        let message = '文件上传失败';
        let statusCode = 400;

        if (err.code === 'LIMIT_FILE_SIZE') {
          code = 'FILE_TOO_LARGE';
          message = `文件大小超过限制，最大允许 ${config.upload.maxFileSize / (1024 * 1024)}MB`;
          statusCode = 413;
        } else if (err.code === 'LIMIT_FILE_COUNT') {
          code = 'TOO_MANY_FILES';
          message = `文件数量超过限制，最多 ${maxCount} 个文件`;
        } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          code = 'UNEXPECTED_FIELD';
          message = `意外的文件字段: ${err.field || fieldName}`;
        } else if (err.message) {
          code = 'INVALID_FILE';
          message = err.message;
        }

        res.status(statusCode).json({
          success: false,
          error: {
            code,
            message,
          },
        });
        return;
      }

      if (required && (!req.files || (Array.isArray(req.files) && req.files.length === 0))) {
        res.status(400).json({
          success: false,
          error: {
            code: 'FILES_REQUIRED',
            message: '请至少上传一个文件',
          },
        });
        return;
      }

      next();
    });
  };
};
