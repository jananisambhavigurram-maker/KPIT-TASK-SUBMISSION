import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors.js';

const attempts = new Map<string, { count: number; resetAt: number }>();
const limit = 10;
const windowMs = 15 * 60 * 1000;

export function loginRateLimit(req: Request, _res: Response, next: NextFunction) {
  const key = req.ip ?? 'unknown'; const now = Date.now(); const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) { attempts.set(key, { count: 1, resetAt: now + windowMs }); return next(); }
  if (entry.count >= limit) return next(new AppError(429, 'TOO_MANY_LOGIN_ATTEMPTS', 'Too many login attempts. Please try again later.'));
  entry.count += 1; return next();
}
