import { Request, Response, NextFunction } from 'express';
import { db } from '../../infrastructure/database/database.client';
import { UnauthorizedError } from '../../shared/errors/app-error';

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid authorization header');
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await db.getClient().auth.getUser(token);

    if (error || !user) {
      throw new UnauthorizedError('Invalid or expired token');
    }

    // Attach user to request for downstream use
    (req as any).user = user;
    next();
  } catch (error) {
    next(error);
  }
};

