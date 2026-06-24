import { Request, Response, NextFunction } from 'express';
import { RestaurantSessionService } from '../../modules/restaurants/services/restaurant-session.service';
import { UnauthorizedError } from '../../shared/errors/app-error';

export const restaurantSessionMiddleware = (req: Request, _res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing restaurant session');
    }

    const token = authHeader.split(' ')[1];
    const session = new RestaurantSessionService().verify(token || '');
    (req as any).restaurantId = session.restaurantId;
    next();
  } catch (error) {
    next(error);
  }
};
