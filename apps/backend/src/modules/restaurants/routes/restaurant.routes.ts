import { Router } from 'express';
import { RestaurantSessionController } from '../controllers/restaurant-session.controller';
import { RestaurantController } from '../controllers/restaurant.controller';
import { asyncHandler } from '../../../shared/utils/async-handler';
import { restaurantSessionMiddleware } from '../../../middlewares/auth/restaurant-session.middleware';

const router = Router();
const sessionController = new RestaurantSessionController();
const restaurantController = new RestaurantController();

router.post('/login', asyncHandler(sessionController.login));
router.get('/setup', restaurantSessionMiddleware, asyncHandler(restaurantController.getSetup));
router.patch('/setup', restaurantSessionMiddleware, asyncHandler(restaurantController.updateSetup));
router.post('/setup/complete', restaurantSessionMiddleware, asyncHandler(restaurantController.completeSetup));

export default router;
