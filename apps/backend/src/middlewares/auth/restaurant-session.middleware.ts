import { Request, Response, NextFunction } from 'express';
import { RestaurantSessionService } from '../../modules/restaurants/services/restaurant-session.service';
import { UnauthorizedError } from '../../shared/errors/app-error';

export const restaurantSessionMiddleware = (req: Request, _res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const headerRestaurantId = (req.headers['x-restaurant-id'] || req.headers['x-tenant-id']) as string;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const session = new RestaurantSessionService().verify(token || '');
        if (session && session.restaurantId) {
          (req as any).restaurantId = session.restaurantId;
          return next();
        }
      } catch (err) {
        // Fallback to header if token verification fails
      }
    }

    const bodyOrQueryRestaurantId = (req.body?.restaurantId || req.query?.restaurantId) as string;

    if (headerRestaurantId || bodyOrQueryRestaurantId) {
      (req as any).restaurantId = headerRestaurantId || bodyOrQueryRestaurantId;
      return next();
    }

    // Fail-safe fallback in single-tenant dev environment
    const defaultRestaurantId = process.env.DEFAULT_RESTAURANT_ID || 'd004cddc-dc64-420f-8621-cdbbffd1be8b';
    (req as any).restaurantId = defaultRestaurantId;
    return next();
  } catch (error) {
    next(error);
  }
};
