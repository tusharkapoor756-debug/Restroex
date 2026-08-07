import { Router } from 'express';
import { OperationsController } from '../controllers/operations.controller';
import { asyncHandler } from '../../../shared/utils/async-handler';
import { restaurantSessionMiddleware } from '../../../middlewares/auth/restaurant-session.middleware';

const router = Router();
const controller = new OperationsController();

router.get('/operations/hub', restaurantSessionMiddleware, asyncHandler(controller.getOperationsHub));

export default router;
