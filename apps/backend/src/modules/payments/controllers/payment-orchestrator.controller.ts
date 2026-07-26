import { Request, Response } from 'express';
import { PaymentOrchestratorService } from '../services/payment-orchestrator.service';
import { PaymentHealthService } from '../services/payment-health.service';
import { logger } from '../../../infrastructure/logger/logger';

export class PaymentOrchestratorController {
  private readonly orchestrator: PaymentOrchestratorService;
  private readonly healthService: PaymentHealthService;

  constructor(
    orchestrator?: PaymentOrchestratorService,
    healthService?: PaymentHealthService
  ) {
    this.orchestrator = orchestrator ?? new PaymentOrchestratorService();
    this.healthService = healthService ?? new PaymentHealthService();
  }

  /**
   * POST /api/v1/payments/link — generate payment link for checkout or retry
   */
  public async createPaymentLink(req: Request, res: Response): Promise<void> {
    try {
      const { orderId, restaurantId, customerPhone, amount, currency, providerName, customerName, customerEmail } = req.body;
      const result = await this.orchestrator.createOrRetryPaymentLink({
        orderId,
        restaurantId,
        customerPhone,
        amount: Number(amount),
        currency,
        providerName,
        customerName,
        customerEmail,
      });

      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      logger.error({ error: error.message }, 'Failed to create payment link');
      res.status(400).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/v1/payments/webhooks/:restaurantId/:provider — dynamic webhook entrypoint
   */
  public async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      const { restaurantId, provider } = req.params;
      const result = await this.orchestrator.handleWebhook(
        restaurantId as string,
        provider as string,
        req.body,
        req.headers
      );

      res.status(200).json({ success: result.success, data: result });
    } catch (error: any) {
      logger.error({ error: error.message }, 'Webhook handler error');
      res.status(400).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/v1/payments/config — Save gateway credentials & configuration
   */
  public async saveProviderConfig(req: Request, res: Response): Promise<void> {
    try {
      const { restaurantId, providerName, credentials, isEnabled, isSandbox, webhookSecret } = req.body;
      const config = await this.healthService.saveProviderConfig(restaurantId, providerName, {
        credentials,
        isEnabled: isEnabled !== undefined ? Boolean(isEnabled) : undefined,
        isSandbox: isSandbox !== undefined ? Boolean(isSandbox) : undefined,
        webhookSecret,
      });

      res.status(200).json({ success: true, data: config });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/v1/payments/config/test — Real-time connection & health check test
   */
  public async testGatewayConnection(req: Request, res: Response): Promise<void> {
    try {
      const { restaurantId, providerName, credentials } = req.body;
      const healthResult = await this.healthService.testGatewayConnection(
        restaurantId,
        providerName,
        credentials
      );

      res.status(200).json({ success: true, data: healthResult });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/v1/payments/config/:restaurantId — Fetch status of all configured providers
   */
  public async getGatewayStatuses(req: Request, res: Response): Promise<void> {
    try {
      const { restaurantId } = req.params;
      const configs = await this.healthService.getRestaurantGatewayStatuses(restaurantId as string);
      res.status(200).json({ success: true, data: configs });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
}
