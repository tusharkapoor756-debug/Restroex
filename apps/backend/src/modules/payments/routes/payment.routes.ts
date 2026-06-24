import { Router, Request, Response, NextFunction } from 'express';
import { PaymentWebhookHandler } from '../payment.webhook';
import { logger } from '../../../infrastructure/logger/logger';

const router = Router();
const webhookHandler = new PaymentWebhookHandler();

// POST /api/v1/payments/webhook
router.post('/webhook', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const signature = req.headers['x-razorpay-signature'] as string;
  const rawBody = JSON.stringify(req.body);

  // 1. Verify Signature
  const isValid = webhookHandler.verifySignature(rawBody, signature);
  if (!isValid) {
    logger.warn('❌ Razorpay webhook signature verification failed.');
    res.sendStatus(401);
    return;
  }

  try {
    // 2. Process event captured
    const success = await webhookHandler.handleWebhook(req.body);
    if (success) {
      res.status(200).json({ status: 'ok' });
    } else {
      res.status(400).json({ status: 'ignored' });
    }
  } catch (err) {
    logger.error({ err }, 'Error processing Razorpay payment webhook');
    res.sendStatus(500); // Triggers retry from Razorpay on system crash
  }
});

export default router;
