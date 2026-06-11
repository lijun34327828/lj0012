import type { Request, Response, NextFunction } from 'express';
import { config } from '@api/config.js';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

const getClientIp = (req: Request): string => {
  const forwarded = req.headers['x-forwarded-for'] as string | string[] | undefined;
  if (forwarded) {
    if (Array.isArray(forwarded)) {
      return forwarded[0];
    }
    return forwarded.split(',')[0].trim();
  }
  return (req.ip || req.socket.remoteAddress || 'unknown') as string;
};

const getKey = (req: Request): string => {
  const ip = getClientIp(req);
  const path = req.baseUrl + req.path;
  return `${ip}:${path}`;
};

export interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  keyGenerator?: (req: Request) => string;
}

export const rateLimiter = (options: RateLimitOptions = {}) => {
  const windowMs = options.windowMs ?? config.rateLimit.windowMs;
  const max = options.max ?? config.rateLimit.max;
  const keyGenerator = options.keyGenerator ?? getKey;

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const key = keyGenerator(req);

    let entry = rateLimitStore.get(key);

    if (!entry || now > entry.resetTime) {
      entry = {
        count: 0,
        resetTime: now + windowMs,
      };
      rateLimitStore.set(key, entry);
    }

    entry.count++;

    const remaining = Math.max(0, max - entry.count);
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(entry.resetTime / 1000)));

    if (entry.count > max) {
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({
        success: false,
        error: {
          code: 'TOO_MANY_REQUESTS',
          message: `请求过于频繁，请在 ${retryAfter} 秒后重试`,
        },
      });
      return;
    }

    next();
  };
};

export const cleanupRateLimitStore = (): void => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
};

setInterval(cleanupRateLimitStore, 60 * 1000);
