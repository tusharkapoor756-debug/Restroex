import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

/**
 * Attaches a unique Request ID to each incoming request.
 */
export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const requestId = req.header('x-request-id') || randomUUID();
  
  // Attach to request object for use in controllers/logs
  (req as any).id = requestId;
  
  // Also send back in response headers
  res.setHeader('x-request-id', requestId);
  
  next();
};
