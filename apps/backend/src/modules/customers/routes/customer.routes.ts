import { Router } from 'express';
import { CustomerController } from '../controllers/customer.controller';
import { asyncHandler } from '../../../shared/utils/async-handler';
import { restaurantSessionMiddleware } from '../../../middlewares/auth/restaurant-session.middleware';

const router = Router();
const controller = new CustomerController();

router.get('/customers', restaurantSessionMiddleware, asyncHandler(controller.getCustomers));

export default router;
