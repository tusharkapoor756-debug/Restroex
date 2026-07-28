import { Router } from 'express';
import { WhatsAppWebhookController } from '../webhook.controller';
import { WhatsAppSessionController } from '../controllers/whatsapp-session.controller';
import { RestroexManagedWhatsAppController } from '../controllers/restroex-managed-whatsapp.controller';
import { asyncHandler } from '../../../shared/utils/async-handler';
import { restaurantSessionMiddleware } from '../../../middlewares/auth/restaurant-session.middleware';

const router = Router();
const controller = new WhatsAppWebhookController();
const sessionController = new WhatsAppSessionController();
const restroexManagedController = new RestroexManagedWhatsAppController();

// GET endpoint for WhatsApp verify token challenge handshake
router.get('/webhook', controller.handleVerification);

// POST endpoint for incoming webhook event notification updates
router.post('/webhook', controller.handleWebhook);

router.get('/session/status', restaurantSessionMiddleware, asyncHandler(sessionController.getStatus));
router.post('/session/connect', restaurantSessionMiddleware, asyncHandler(sessionController.connect));
router.post('/session/disconnect', restaurantSessionMiddleware, asyncHandler(sessionController.disconnect));
router.post('/test-message', restaurantSessionMiddleware, asyncHandler(sessionController.sendTestMessage));

// Restroex-Managed WhatsApp Cloud API Registration, Verification & Deregistration
router.post('/restroex-managed/register', restaurantSessionMiddleware, asyncHandler(restroexManagedController.registerNumber));
router.post('/restroex-managed/verify', restaurantSessionMiddleware, asyncHandler(restroexManagedController.verifyOtp));
router.post('/restroex-managed/disconnect', restaurantSessionMiddleware, asyncHandler(restroexManagedController.disconnectNumber));

export default router;
