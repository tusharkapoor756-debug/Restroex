import { PaymentRepository } from '../repositories/payment.repository';
import { PaymentStateMachine } from '../state-machine/payment.state-machine';
import { PaymentProviderRegistry } from '../providers/payment-provider.registry';
import { Payment, PaymentStatus, CreatePaymentDto } from '../types/payment.types';
import { SettingsRepository } from '../../restaurants/repositories/settings.repository';
import { PaymentEngineFacade } from '../engine/payment-engine.facade';
import { PaymentAnalysisProducer } from '../engine/queue/payment-analysis.producer';
import { PaymentAnalysisResult } from '../types/payment-analysis.types';
import { logger } from '../../../infrastructure/logger/logger';

export interface PaymentContext {
  /** Single resolved method (auto-selected when only one is configured) */
  resolvedPaymentMethod: string | null;
  /** All configured methods — caller prompts customer when length > 1 */
  availablePaymentMethods: string[];
  /** Only methods that have a registered provider are usable right now */
  usablePaymentMethods: string[];
  /** UPI merchant details for display (when manual_upi is available) */
  upiId?: string;
  merchantName?: string;
  upiQrImageUrl?: string;
}

export class PaymentService {
  private readonly repository: PaymentRepository;
  private readonly settingsRepository: SettingsRepository;
  private readonly engineFacade: PaymentEngineFacade;
  private readonly analysisProducer: PaymentAnalysisProducer;

  constructor(
    repository?: PaymentRepository,
    settingsRepository?: SettingsRepository,
    engineFacade?: PaymentEngineFacade,
    analysisProducer?: PaymentAnalysisProducer
  ) {
    this.repository = repository ?? new PaymentRepository();
    this.settingsRepository = settingsRepository ?? new SettingsRepository();
    this.engineFacade = engineFacade ?? new PaymentEngineFacade();
    this.analysisProducer = analysisProducer ?? new PaymentAnalysisProducer();
  }

  // ----------------------------------------------------------
  // Context resolution — call before initiating payment
  // ----------------------------------------------------------

  public async resolvePaymentContext(restaurantId: string): Promise<PaymentContext> {
    const settings = await this.settingsRepository.getSettings(restaurantId);
    const configured: string[] = [];
    
    if (settings.settings.manualUpiEnabled) {
      configured.push('manual_upi');
    }
    if (settings.settings.codEnabled) {
      configured.push('cash');
    }

    // Include automated gateways if master onlinePaymentsEnabled is true
    if (settings.settings.onlinePaymentsEnabled) {
      try {
        const { RestaurantPaymentConfigRepository } = require('../repositories/restaurant-payment-config.repository');
        const configRepo = new RestaurantPaymentConfigRepository();
        const gatewayConfigs = await configRepo.getAllByRestaurant(restaurantId);
        
        for (const cfg of gatewayConfigs) {
          if (cfg.isEnabled && cfg.status !== 'invalid_credentials' && cfg.status !== 'configuration_error') {
            configured.push(cfg.providerName);
          }
        }
      } catch (err) {
        logger.warn({ err, restaurantId }, 'Failed to fetch automated gateway configs during context resolution.');
      }
    }

    // Only expose methods that have an active registered provider
    const usable = configured.filter((m) => PaymentProviderRegistry.has(m));

    return {
      resolvedPaymentMethod: (usable.length === 1 ? usable[0] : null) as string | null,
      availablePaymentMethods: configured,
      usablePaymentMethods: usable,
      upiId: settings.settings.upiId,
      merchantName: settings.settings.upiMerchantName || settings.profile.name || settings.profile.ownerName,
      upiQrImageUrl: settings.settings.upiQrImageUrl,
    };
  }

  // ----------------------------------------------------------
  // Create — delegates initial gateway_data to the provider
  // ----------------------------------------------------------

  public async createPayment(dto: CreatePaymentDto): Promise<Payment> {
    // 1. Validate the method is configured for this restaurant
    const context = await this.resolvePaymentContext(dto.restaurantId);
    if (!context.availablePaymentMethods.includes(dto.paymentMethod)) {
      throw new Error(
        `Payment method "${dto.paymentMethod}" is not configured for this restaurant. ` +
        `Available: ${context.availablePaymentMethods.join(', ')}.`
      );
    }

    // 2. Get the provider and let it initialise gateway data
    const provider = PaymentProviderRegistry.get(dto.paymentMethod);
    let gatewayData = dto.gatewayData ?? {};
    let initialStatus: 'pending' | 'initiated' = 'pending';

    if (provider.initiatePayment) {
      const res = await provider.initiatePayment({
        ...dto,
        gatewayData: {
          ...dto.gatewayData,
          upi_id: context.upiId,
          merchant_name: context.merchantName,
          upi_qr_image_url: context.upiQrImageUrl,
        },
      });
      gatewayData = res.gatewayData;
      initialStatus = res.initialStatus;
    }

    // 3. Persist the payment record
    const payment = await this.repository.createPayment({
      ...dto,
      providerName: provider.providerName,
      gatewayData,
    });

    logger.info(
      { paymentId: payment.id, orderId: dto.orderId, method: dto.paymentMethod },
      '💳 Payment record created.'
    );
    return payment;
  }

  // ----------------------------------------------------------
  // Manual UPI flow actions
  // ----------------------------------------------------------

  public async uploadScreenshot(
    paymentId: string,
    storagePath: string,
    transactionReference?: string
  ): Promise<Payment> {
    const payment = await this.findOrFail(paymentId);
    this.assertTransition(payment.paymentStatus, 'screenshot_uploaded');

    // Merge storagePath into gateway_data — NEVER store public/signed URLs
    const updatedGatewayData = {
      ...payment.gatewayData,
      storagePath, // e.g. "payments/restaurantId/paymentId/1/screenshot.jpg"
      ...(transactionReference && { transaction_reference: transactionReference }),
    };

    const updated = await this.repository.update(paymentId, {
      paymentStatus: 'screenshot_uploaded',
      gatewayData: updatedGatewayData,
    });

    logger.info({ paymentId }, '📸 Screenshot storage path saved.');

    // Asynchronous non-blocking analysis pipeline (<100ms response time to client)
    const context = await this.resolvePaymentContext(payment.restaurantId);
    this.analysisProducer
      .enqueueAnalysis({
        paymentId: payment.id,
        orderId: payment.orderId,
        restaurantId: payment.restaurantId,
        expectedAmount: payment.amount,
        storagePath,
        merchantUpiId: context.upiId,
        merchantName: context.merchantName,
        traceId: `trace_pay_${paymentId}`,
        timestamp: new Date().toISOString(),
      })
      .catch((err) => {
        logger.error({ err, paymentId }, 'Failed to enqueue payment analysis job');
      });

    return updated;
  }

  public async analyzePayment(
    paymentId: string,
    imageBuffer?: Buffer
  ): Promise<PaymentAnalysisResult> {
    return this.engineFacade.analyzePaymentScreenshot(paymentId, imageBuffer);
  }

  public async markPendingVerification(paymentId: string): Promise<Payment> {
    const payment = await this.findOrFail(paymentId);
    this.assertTransition(payment.paymentStatus, 'pending_verification');
    return this.repository.update(paymentId, { paymentStatus: 'pending_verification' });
  }

  public async verifyPayment(
    paymentId: string,
    verifiedBy?: string,
    notes?: string,
    verifiedAmount?: number,
    verifiedTransactionReference?: string,
  ): Promise<Payment> {
    const payment = await this.findOrFail(paymentId);
    this.assertTransition(payment.paymentStatus, 'verified');

    const updated = await this.repository.update(paymentId, {
      paymentStatus: 'verified',
      ...(verifiedBy && { verifiedBy }),
      verificationNotes: notes,
      verifiedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      ...(verifiedAmount !== undefined && { verifiedAmount }),
      ...(verifiedTransactionReference && { verifiedTransactionReference }),
    });

    // Transition the Order from payment_pending → paid
    try {
      const { OrderService } = require('../../orders/services/order.service');
      const orderService = new OrderService();
      await orderService.transitionOrder(payment.orderId, 'paid');
      logger.info({ paymentId, orderId: payment.orderId }, '📦 Order transitioned to paid.');
    } catch (err) {
      logger.warn({ err, paymentId }, 'Could not transition order to paid — continuing.');
    }

    // Notify customer via WhatsApp
    try {
      const { WhatsAppMessageService } = require('../../whatsapp/message.service');
      const messages = new WhatsAppMessageService();
      await messages.sendText(
        payment.restaurantId,
        payment.customerPhone,
        '✅ Payment verified! Your order has been confirmed. We will start preparing it shortly. 🎉'
      );
    } catch (err) {
      logger.warn({ err, paymentId }, 'Could not send WhatsApp verification notification.');
    }

    logger.info({ paymentId, verifiedBy: verifiedBy ?? null }, '✅ Payment verified.');
    return updated;
  }

  public async rejectPayment(paymentId: string, reason: string): Promise<Payment> {
    const payment = await this.findOrFail(paymentId);
    this.assertTransition(payment.paymentStatus, 'rejected');

    const updated = await this.repository.update(paymentId, {
      paymentStatus: 'rejected',
      rejectedReason: reason,
      failedAt: new Date().toISOString(),
    });

    // Notify customer to re-upload
    try {
      const { WhatsAppMessageService } = require('../../whatsapp/message.service');
      const messages = new WhatsAppMessageService();
      await messages.sendText(
        payment.restaurantId,
        payment.customerPhone,
        `❌ Payment could not be verified.\n\nReason: ${reason}\n\nPlease send a clear screenshot of your payment.`
      );
    } catch (err) {
      logger.warn({ err, paymentId }, 'Could not send WhatsApp rejection notification.');
    }

    logger.info({ paymentId, reason }, '❌ Payment rejected.');
    return updated;
  }

  // ----------------------------------------------------------
  // Queries
  // ----------------------------------------------------------

  public async getPayment(paymentId: string): Promise<Payment> {
    return this.findOrFail(paymentId);
  }

  public async getPaymentByOrder(orderId: string): Promise<Payment | null> {
    return this.repository.getByOrderId(orderId);
  }

  public async getPaymentsByRestaurant(restaurantId: string): Promise<Payment[]> {
    return this.repository.getByRestaurantId(restaurantId);
  }

  public async getPaginatedPaymentsByRestaurant(
    restaurantId: string,
    options: {
      page?: number;
      limit?: number;
      status?: string;
      search?: string;
      sortOrder?: 'asc' | 'desc';
    }
  ): Promise<{ payments: Payment[]; totalCount: number }> {
    return this.repository.getPaginatedByRestaurantId(restaurantId, options);
  }

  // ----------------------------------------------------------
  // Internal helpers
  // ----------------------------------------------------------

  private async findOrFail(paymentId: string): Promise<Payment> {
    const payment = await this.repository.getById(paymentId);
    if (!payment) throw new Error(`Payment ${paymentId} not found.`);
    return payment;
  }

  private assertTransition(current: PaymentStatus, next: PaymentStatus): void {
    if (!PaymentStateMachine.isValidTransition(current, next)) {
      throw new Error(
        `Invalid payment state transition: "${current}" → "${next}".`
      );
    }
  }
}
