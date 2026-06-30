import { Router } from 'express';
import { MenuController } from '../controllers/menu.controller';
import { asyncHandler } from '../../../shared/utils/async-handler';
import { restaurantSessionMiddleware } from '../../../middlewares/auth/restaurant-session.middleware';

const router = Router();
const controller = new MenuController();

router.get('/items', restaurantSessionMiddleware, asyncHandler(controller.list));
router.post('/items', restaurantSessionMiddleware, asyncHandler(controller.create));
router.put('/items/:itemId', restaurantSessionMiddleware, asyncHandler(controller.update));
router.patch('/items/:itemId/availability', restaurantSessionMiddleware, asyncHandler(controller.updateAvailability));

export default router;
