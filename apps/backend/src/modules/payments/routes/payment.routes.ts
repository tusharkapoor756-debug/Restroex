import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';
import { PaymentOrchestratorController } from '../controllers/payment-orchestrator.controller';

const router = Router();
const controller = new PaymentController();
const orchestratorController = new PaymentOrchestratorController();

// Create payment link / retry
router.post('/link', (req, res) => orchestratorController.createPaymentLink(req, res));

// Dynamic provider webhooks
router.post('/webhooks/:restaurantId/:provider', (req, res) =>
  orchestratorController.handleWebhook(req, res)
);

// Gateway configuration & health check APIs
router.post('/config', (req, res) => orchestratorController.saveProviderConfig(req, res));
router.post('/config/test', (req, res) => orchestratorController.testGatewayConnection(req, res));
router.get('/config/:restaurantId', (req, res) => orchestratorController.getGatewayStatuses(req, res));

// Legacy payment creation
router.post('/', (req, res) => controller.createPayment(req, res));

// Manual UPI flow & Intelligence Engine
router.post('/:id/upload-screenshot', (req, res) => controller.uploadScreenshot(req, res));
router.post('/:id/analyze', (req, res) => controller.analyzePayment(req, res));
router.post('/:id/pending-verification', (req, res) => controller.markPendingVerification(req, res));

// Admin verification actions
router.post('/:id/verify', (req, res) => controller.verifyPayment(req, res));
router.post('/:id/reject', (req, res) => controller.rejectPayment(req, res));

// Queries — NOTE: specific routes must come before /:id to prevent shadowing
router.get('/restaurant/:restaurantId', (req, res) => controller.getPaymentsByRestaurant(req, res));
router.get('/order/:orderId', (req, res) => controller.getPaymentByOrder(req, res));
router.get('/context/:restaurantId', (req, res) => controller.getPaymentContext(req, res));
router.get('/:id/screenshot-url', (req, res) => controller.getScreenshotUrl(req, res));
router.get('/:id', (req, res) => controller.getPayment(req, res));

export default router;
