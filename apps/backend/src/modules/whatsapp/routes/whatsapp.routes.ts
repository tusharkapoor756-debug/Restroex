import { Router } from 'express';
import { WhatsAppWebhookController } from '../webhook.controller';
import { WhatsAppSessionController } from '../controllers/whatsapp-session.controller';
import { asyncHandler } from '../../../shared/utils/async-handler';
import { restaurantSessionMiddleware } from '../../../middlewares/auth/restaurant-session.middleware';

const router = Router();
const controller = new WhatsAppWebhookController();
const sessionController = new WhatsAppSessionController();

// GET endpoint for WhatsApp verify token challenge handshake
router.get('/webhook', controller.handleVerification);

// POST endpoint for incoming webhook event notification updates
router.post('/webhook', controller.handleWebhook);

router.get('/session/status', restaurantSessionMiddleware, asyncHandler(sessionController.getStatus));
router.post('/session/connect', restaurantSessionMiddleware, asyncHandler(sessionController.connect));
router.post('/session/disconnect', restaurantSessionMiddleware, asyncHandler(sessionController.disconnect));

export default router;
