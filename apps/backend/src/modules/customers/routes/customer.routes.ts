import { Router } from 'express';
import { CustomerController } from '../controllers/customer.controller';
import { asyncHandler } from '../../../shared/utils/async-handler';
import { restaurantSessionMiddleware } from '../../../middlewares/auth/restaurant-session.middleware';

const router = Router();
const controller = new CustomerController();

router.get('/customers', restaurantSessionMiddleware, asyncHandler(controller.getCustomers));
router.get('/customers/:customerId/details', restaurantSessionMiddleware, asyncHandler(controller.getCustomerDetails));
router.patch('/customers/:customerId/notes', restaurantSessionMiddleware, asyncHandler(controller.updateCustomerNotes));

export default router;

