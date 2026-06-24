import { Request, Response, NextFunction } from 'express';
import { NotFoundError } from '../../shared/errors/app-error';

/**
 * Middleware to handle routes that don't match any registered routes.
 */
export const notFoundMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const error = new NotFoundError(`Path ${req.originalUrl} not found`);
  next(error);
};
