import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodSchema } from 'zod';
import { BadRequestError } from '../../shared/errors/app-error';

export const validate = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const message = error.issues.map((issue) => issue.message).join(', ');
        return next(new BadRequestError(message));
      }
      next(error);
    }
  };
};

