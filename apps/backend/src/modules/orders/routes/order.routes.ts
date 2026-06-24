import { Router } from 'express';
import { OrderOperationsController } from '../controllers/order-operations.controller';
import { asyncHandler } from '../../../shared/utils/async-handler';
import { restaurantSessionMiddleware } from '../../../middlewares/auth/restaurant-session.middleware';

const router = Router();
const controller = new OrderOperationsController();

router.get('/orders/active', restaurantSessionMiddleware, asyncHandler(controller.getActiveOrders));
router.patch('/orders/:orderId/status', restaurantSessionMiddleware, asyncHandler(controller.transitionOrder));

export default router;
