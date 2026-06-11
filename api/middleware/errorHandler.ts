import type { Request, Response, NextFunction } from 'express';
import type { ApiResponse } from '@shared/types.js';

export class AppError extends Error {
  code: string;
  statusCode: number;

  constructor(message: string, code: string = 'INTERNAL_ERROR', statusCode: number = 500) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.name = 'AppError';
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response<ApiResponse>,
  _next: NextFunction
): void => {
  let code = 'INTERNAL_ERROR';
  let message = '服务器内部错误';
  let statusCode = 500;

  if (err instanceof AppError) {
    code = err.code;
    message = err.message;
    statusCode = err.statusCode;
  } else if (err.name === 'SyntaxError' && 'body' in err) {
    code = 'BAD_REQUEST';
    message = '请求体JSON格式错误';
    statusCode = 400;
  } else if (err.name === 'PayloadTooLargeError') {
    code = 'PAYLOAD_TOO_LARGE';
    message = '请求体过大';
    statusCode = 413;
  } else if (err.message) {
    message = err.message;
  }

  if (process.env.NODE_ENV === 'development') {
    console.error('[Error]', err.stack || err.message);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
    },
  });
};

export const notFoundHandler = (
  req: Request,
  res: Response<ApiResponse>,
  _next: NextFunction
): void => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `路由不存在: ${req.method} ${req.path}`,
    },
  });
};

export const asyncHandler = <T extends Request = Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<void> | void
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req as T, res, next)).catch(next);
  };
};
