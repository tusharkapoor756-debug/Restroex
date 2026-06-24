import { Request, Response, NextFunction } from 'express';
import { logger } from '../../infrastructure/logger/logger';

/**
 * Logs details of each request including execution time and status codes.
 */
export const requestLoggerMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const requestId = (req as any).id;

  // Log on response finish
  res.on('finish', () => {
    const duration = Date.now() - start;
    const { method, originalUrl } = req;
    const { statusCode } = res;

    logger.info({
      requestId,
      method,
      path: originalUrl,
      statusCode,
      duration: `${duration}ms`,
    }, `HTTP ${method} ${originalUrl} ${statusCode} - ${duration}ms`);
  });

  next();
};
