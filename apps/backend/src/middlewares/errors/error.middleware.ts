import { Request, Response, NextFunction } from 'express';
import { logger } from '../../infrastructure/logger/logger';
import { AppError } from '../../shared/errors/app-error';
import { env } from '../../config/env';

/**
 * Global Error Handling Middleware.
 * Standardizes error responses across the application.
 */
export const errorMiddleware = (err: any, req: Request, res: Response, next: NextFunction) => {
  const requestId = (req as any).id;
  
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let code = err.code || 'INTERNAL_ERROR';

  // Handle specific known error types if necessary (e.g., Zod, Supabase)
  // For now, focus on AppError consistency
  
  const isDevelopment = env.NODE_ENV === 'development';

  // Log error
  logger.error({
    requestId,
    err: {
      message: err.message,
      stack: isDevelopment ? err.stack : undefined,
      code,
    },
    path: req.originalUrl,
  }, `Error: ${message}`);

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      code,
      requestId,
    },
  });
};
