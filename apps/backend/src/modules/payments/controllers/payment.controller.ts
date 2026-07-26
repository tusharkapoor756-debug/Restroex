import { Request, Response } from 'express';
import { PaymentService } from '../services/payment.service';
import { storageService } from '../../../infrastructure/storage/storage.service';
import { logger } from '../../../infrastructure/logger/logger';

export class PaymentController {
  private readonly service: PaymentService;

  constructor(service?: PaymentService) {
    this.service = service ?? new PaymentService();
  }

  /** POST /payments — create a new payment record */
  public async createPayment(req: Request, res: Response): Promise<void> {
    try {
      const { orderId, restaurantId, customerPhone, amount, paymentMethod, idempotencyKey } = req.body;
      const payment = await this.service.createPayment({
        orderId,
        restaurantId,
        customerPhone,
        amount: Number(amount),
        paymentMethod,
        providerName: paymentMethod,
        idempotencyKey,
      });
      res.status(201).json({ success: true, data: payment });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  /** POST /payments/:id/upload-screenshot */
  public async uploadScreenshot(req: Request, res: Response): Promise<void> {
    try {
      const { screenshotUrl, transactionReference } = req.body;
      const payment = await this.service.uploadScreenshot(
        req.params.id as string,
        screenshotUrl,
        transactionReference
      );
      res.status(200).json({ success: true, data: payment });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  /** POST /payments/:id/analyze — trigger Payment Intelligence Engine evaluation on demand */
  public async analyzePayment(req: Request, res: Response): Promise<void> {
    try {
      const paymentId = req.params.id as string;
      const rawText: string | undefined = req.body.rawText;
      const buffer = rawText ? Buffer.from(rawText, 'utf-8') : undefined;

      const analysis = await this.service.analyzePayment(paymentId, buffer);
      res.status(200).json({ success: true, data: analysis });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  /** POST /payments/:id/pending-verification */
  public async markPendingVerification(req: Request, res: Response): Promise<void> {
    try {
      const payment = await this.service.markPendingVerification(req.params.id as string);
      res.status(200).json({ success: true, data: payment });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  /** POST /payments/:id/verify */
  public async verifyPayment(req: Request, res: Response): Promise<void> {
    try {
      const { verifiedBy, notes, verifiedAmount, verifiedTransactionReference } = req.body;
      const payment = await this.service.verifyPayment(
        req.params.id as string,
        verifiedBy,
        notes,
        verifiedAmount ? Number(verifiedAmount) : undefined,
        verifiedTransactionReference,
      );
      res.status(200).json({ success: true, data: payment });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  /** POST /payments/:id/reject */
  public async rejectPayment(req: Request, res: Response): Promise<void> {
    try {
      const { reason } = req.body;
      const payment = await this.service.rejectPayment(req.params.id as string, reason);
      res.status(200).json({ success: true, data: payment });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  /** GET /payments/:id */
  public async getPayment(req: Request, res: Response): Promise<void> {
    try {
      const payment = await this.service.getPayment(req.params.id as string);
      res.status(200).json({ success: true, data: payment });
    } catch (error: any) {
      res.status(404).json({ success: false, error: error.message });
    }
  }

  /** GET /payments/order/:orderId */
  public async getPaymentByOrder(req: Request, res: Response): Promise<void> {
    try {
      const payment = await this.service.getPaymentByOrder(req.params.orderId as string);
      res.status(200).json({ success: true, data: payment ?? null });
    } catch (error: any) {
      res.status(404).json({ success: false, error: error.message });
    }
  }

  /** GET /payments/restaurant/:restaurantId — all payments for a restaurant */
  public async getPaymentsByRestaurant(req: Request, res: Response): Promise<void> {
    try {
      const payments = await this.service.getPaymentsByRestaurant(req.params.restaurantId as string);
      logger.info({ restaurantId: req.params.restaurantId, count: payments.length }, '📤 Dashboard API returning analysis');
      res.status(200).json({ success: true, data: payments });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  /** GET /payments/:id/screenshot-url — generate signed URL for screenshot (authenticated restaurant only) */
  public async getScreenshotUrl(req: Request, res: Response): Promise<void> {
    try {
      const payment = await this.service.getPayment(req.params.id as string);
      const storagePath: string | undefined = (payment.gatewayData as any)?.storagePath;

      if (!storagePath) {
        res.status(404).json({ success: false, error: 'No screenshot available for this payment.' });
        return;
      }

      // storagePath format: "payments/<bucket-path>" — split bucket from inner path
      const slashIdx = storagePath.indexOf('/');
      const bucket = storagePath.substring(0, slashIdx);
      const filePath = storagePath.substring(slashIdx + 1);

      const signedUrl = await storageService.generateSignedUrl(bucket, filePath, 3600);
      res.status(200).json({ success: true, data: { signedUrl, expiresIn: 3600 } });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  /** GET /payments/context/:restaurantId — payment context for a restaurant */
  public async getPaymentContext(req: Request, res: Response): Promise<void> {
    try {
      const context = await this.service.resolvePaymentContext(req.params.restaurantId as string);
      res.status(200).json({ success: true, data: context });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
}
