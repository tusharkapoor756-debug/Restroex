import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';

const router = Router();
const controller = new PaymentController();

// Create new payment record
router.post('/', (req, res) => controller.createPayment(req, res));

// Manual UPI flow
router.post('/:id/upload-screenshot',    (req, res) => controller.uploadScreenshot(req, res));
router.post('/:id/pending-verification', (req, res) => controller.markPendingVerification(req, res));

// Admin verification actions
router.post('/:id/verify', (req, res) => controller.verifyPayment(req, res));
router.post('/:id/reject', (req, res) => controller.rejectPayment(req, res));

// Queries — NOTE: specific routes must come before /:id to prevent shadowing
router.get('/restaurant/:restaurantId',  (req, res) => controller.getPaymentsByRestaurant(req, res));
router.get('/order/:orderId',            (req, res) => controller.getPaymentByOrder(req, res));
router.get('/context/:restaurantId',     (req, res) => controller.getPaymentContext(req, res));
router.get('/:id/screenshot-url',        (req, res) => controller.getScreenshotUrl(req, res));
router.get('/:id',                       (req, res) => controller.getPayment(req, res));

export default router;
