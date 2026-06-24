import { Router } from 'express';
import { ReceiptController } from '../controllers/receipt.controller';
import { asyncHandler } from '../../../shared/utils/async-handler';
import { restaurantSessionMiddleware } from '../../../middlewares/auth/restaurant-session.middleware';

const router = Router();
const controller = new ReceiptController();

router.get('/receipts/:orderId', asyncHandler(controller.getCustomerReceipt));
router.get('/receipts/:orderId/thermal', asyncHandler(controller.getSignedThermalReceipt));
router.post('/orders/:orderId/receipt-link', restaurantSessionMiddleware, asyncHandler(controller.getSignedReceiptLinks));
router.post('/orders/:orderId/thermal-print-link', restaurantSessionMiddleware, asyncHandler(controller.getSignedThermalPrintLink));
router.get('/orders/:orderId/receipt/thermal', restaurantSessionMiddleware, asyncHandler(controller.getThermalReceipt));

export default router;
