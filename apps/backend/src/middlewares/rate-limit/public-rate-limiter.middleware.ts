import { Request, Response, NextFunction } from 'express';
import { logger } from '../../infrastructure/logger/logger';

/**
 * Lightweight in-memory IP rate limiter for public unauthenticated endpoints.
 *
 * This is intentionally simple: it uses a sliding window per IP address backed
 * by a Map stored in process memory. It is NOT a production-grade distributed
 * rate limiter. For production, replace with a Redis-backed limiter (e.g.
 * ioredis + sliding-window script or the rate-limit-redis package).
 *
 * Security intent:
 * - Prevents abuse of public POST /orders (order flooding)
 * - Prevents scraping of GET /bootstrap (menu enumeration)
 */

interface Window {
  count: number;
  resetAt: number;
}

const store = new Map<string, Window>();

/**
 * createPublicRateLimiter
 * @param maxRequests - Maximum requests per window (default: 30)
 * @param windowMs - Window duration in milliseconds (default: 60_000 = 1 min)
 */
export function createPublicRateLimiter(maxRequests = 30, windowMs = 60_000) {
  // Periodic cleanup to avoid unbounded memory growth
  setInterval(() => {
    const now = Date.now();
    for (const [key, win] of store.entries()) {
      if (win.resetAt < now) store.delete(key);
    }
  }, windowMs * 2);

  return function rateLimiter(req: Request, res: Response, next: NextFunction): void {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      'unknown';

    const now = Date.now();
    const key = `rl:${ip}`;
    let win = store.get(key);

    if (!win || win.resetAt < now) {
      win = { count: 1, resetAt: now + windowMs };
      store.set(key, win);
      return next();
    }

    win.count += 1;

    if (win.count > maxRequests) {
      logger.warn({ ip, count: win.count, path: req.path }, '🚦 Rate limit exceeded on public endpoint');
      res.status(429).json({
        success: false,
        error: 'Too many requests. Please try again in a moment.',
      });
      return;
    }

    return next();
  };
}
