import { PaymentRepository } from '../repositories/payment.repository';
import { RestaurantPaymentConfigRepository } from '../repositories/restaurant-payment-config.repository';
import { PaymentProviderRegistry } from '../providers/payment-provider.registry';
import { PaymentStateMachine } from '../state-machine/payment.state-machine';
import { Payment, PaymentStatus, RestaurantPaymentConfig, GatewayConfigStatus } from '../types/payment.types';
import { CreatePaymentLinkParams } from '../providers/payment-provider.interface';
import { logger } from '../../../infrastructure/logger/logger';

export class PaymentOrchestratorService {
  private readonly paymentRepo: PaymentRepository;
  private readonly configRepo: RestaurantPaymentConfigRepository;

  constructor(
    paymentRepo?: PaymentRepository,
    configRepo?: RestaurantPaymentConfigRepository
  ) {
    this.paymentRepo = paymentRepo ?? new PaymentRepository();
    this.configRepo = configRepo ?? new RestaurantPaymentConfigRepository();
  }

  /**
   * Get active gateway configuration for a restaurant & provider.
   */
  public async getActiveGatewayConfig(
    restaurantId: string,
    providerName: string
  ): Promise<RestaurantPaymentConfig> {
    const config = await this.configRepo.getByRestaurantAndProvider(restaurantId, providerName);
    if (!config || !config.isEnabled) {
      throw new Error(
        `Payment provider "${providerName}" is not enabled for restaurant ${restaurantId}.`
      );
    }
    if (config.status === 'invalid_credentials' || config.status === 'configuration_error') {
      throw new Error(
        `Payment provider "${providerName}" has configuration error: ${config.statusMessage ?? config.status}.`
      );
    }
    return config;
  }

  /**
   * Create payment link or reuse existing order record (Retry loop).
   */
  public async createOrRetryPaymentLink(params: {
    orderId: string;
    restaurantId: string;
    customerPhone: string;
    amount: number;
    currency?: string;
    providerName: string;
    customerName?: string;
    customerEmail?: string;
  }): Promise<{ payment: Payment; paymentUrl: string }> {
    const { orderId, restaurantId, customerPhone, amount, currency = 'INR', providerName } = params;

    // Resolve provider implementation & restaurant credentials
    const provider = PaymentProviderRegistry.get(providerName);
    const config = await this.getActiveGatewayConfig(restaurantId, providerName);

    // Look up if an existing payment record exists for this order (Reuse order, increment attempt)
    let payment = await this.paymentRepo.getByOrderId(orderId);
    let attemptNumber = 1;

    if (payment) {
      // Existing payment found — check status and prepare retry attempt if applicable
      attemptNumber = (payment.paymentAttempt ?? 1) + 1;
      logger.info(
        { orderId, paymentId: payment.id, attemptNumber, providerName },
        '🔄 Reusing existing order for payment retry attempt.'
      );
    }

    // Call provider abstraction to create payment link
    const linkParams: CreatePaymentLinkParams = {
      orderId,
      restaurantId,
      amount,
      currency,
      customerName: params.customerName,
      customerPhone,
      customerEmail: params.customerEmail,
      description: `Payment for Order #${orderId}`,
    };

    const linkResponse = await provider.createPaymentLink(linkParams, config.credentials);

    if (payment) {
      // Update existing payment record with new link, reset status to pending, bump attempt
      payment = await this.paymentRepo.update(payment.id, {
        paymentStatus: 'pending',
        paymentLinkUrl: linkResponse.paymentUrl,
        paymentLinkShortUrl: linkResponse.shortUrl ?? linkResponse.paymentUrl,
        providerName,
        gatewayData: {
          ...payment.gatewayData,
          paymentLinkId: linkResponse.paymentLinkId,
          rawLinkResponse: linkResponse.rawResponse,
        },
        expiresAt: linkResponse.expiresAt,
      });
    } else {
      // Create new payment record
      payment = await this.paymentRepo.createPayment({
        orderId,
        restaurantId,
        customerPhone,
        paymentMethod: providerName,
        providerName,
        amount,
        currency,
        gatewayData: {
          paymentLinkId: linkResponse.paymentLinkId,
          rawLinkResponse: linkResponse.rawResponse,
        },
      });

      // Update with link status and URL
      payment = await this.paymentRepo.update(payment.id, {
        paymentStatus: 'link_sent',
        paymentLinkUrl: linkResponse.paymentUrl,
        paymentLinkShortUrl: linkResponse.shortUrl ?? linkResponse.paymentUrl,
        expiresAt: linkResponse.expiresAt,
      });
    }

    // Notify customer on WhatsApp with Payment Link
    this.sendWhatsAppPaymentLink(payment, linkResponse.paymentUrl).catch((err) => {
      logger.warn({ err, paymentId: payment.id }, 'Failed to dispatch WhatsApp payment link.');
    });

    return {
      payment,
      paymentUrl: linkResponse.paymentUrl,
    };
  }

  /**
   * Process provider webhooks idempotently across all gateways.
   */
  public async handleWebhook(
    restaurantId: string,
    providerName: string,
    rawBody: any,
    headers: Record<string, string | string[] | undefined>
  ): Promise<{ success: boolean; status: PaymentStatus | 'ignored'; orderId?: string }> {
    const config = await this.configRepo.getByRestaurantAndProvider(restaurantId, providerName);
    if (!config) {
      throw new Error(`No payment configuration found for ${restaurantId}:${providerName}`);
    }

    const provider = PaymentProviderRegistry.get(providerName);
    const secret = config.webhookSecret ? config.webhookSecret : undefined;
    const verification = await provider.verifyWebhook(rawBody, headers, secret);

    if (!verification.isValid) {
      logger.warn(
        { restaurantId, providerName, verification },
        '⚠️ Webhook signature or payload validation failed.'
      );
      return { success: false, status: 'ignored' };
    }

    const orderId = verification.orderId;
    if (!orderId) {
      logger.warn({ verification }, 'Webhook payload contained no orderId mapping.');
      return { success: false, status: 'ignored' };
    }

    const payment = await this.paymentRepo.getByOrderId(orderId);
    if (!payment) {
      logger.warn({ orderId }, 'Webhook received for non-existent payment order.');
      return { success: false, status: 'ignored' };
    }

    // Idempotency check: if already verified or completed, ignore repeat delivery
    if (payment.paymentStatus === 'verified' || payment.paymentStatus === 'captured') {
      logger.info({ paymentId: payment.id }, 'Idempotent webhook delivery skipped (Already verified).');
      return { success: true, status: payment.paymentStatus, orderId };
    }

    // Map webhook outcome to PaymentStatus
    let targetStatus: PaymentStatus = payment.paymentStatus;
    if (verification.status === 'success') {
      targetStatus = 'verified';
    } else if (verification.status === 'failed') {
      targetStatus = 'failed';
    } else if (verification.status === 'cancelled') {
      targetStatus = 'cancelled';
    } else if (verification.status === 'expired') {
      targetStatus = 'expired';
    }

    // Update payment state
    const txnId = verification.providerTransactionId ? String(verification.providerTransactionId) : undefined;
    const updatedPayment = await this.paymentRepo.update(payment.id, {
      paymentStatus: targetStatus,
      providerTransactionId: txnId,
      verifiedAmount: verification.amount,
      completedAt: targetStatus === 'verified' ? new Date().toISOString() : undefined,
      failedAt: targetStatus === 'failed' || targetStatus === 'cancelled' ? new Date().toISOString() : undefined,
    });

    // Execute Automated Business Workflows
    if (targetStatus === 'verified') {
      await this.handlePaymentSuccess(updatedPayment);
    } else if (targetStatus === 'failed') {
      await this.handlePaymentFailed(updatedPayment);
    } else if (targetStatus === 'cancelled') {
      await this.handlePaymentCancelled(updatedPayment);
    } else if (targetStatus === 'expired') {
      await this.handlePaymentExpired(updatedPayment);
    }

    return {
      success: true,
      status: targetStatus,
      orderId,
    };
  }

  /**
   * Handle Payment Success — Automatic confirmation without manual approval
   */
  private async handlePaymentSuccess(payment: Payment): Promise<void> {
    logger.info({ paymentId: payment.id, orderId: payment.orderId }, '🎉 Payment VERIFIED! Auto-confirming order.');

    // 1. Transition Order to confirmed / paid
    try {
      const { OrderService } = require('../../orders/services/order.service');
      const orderService = new OrderService();
      await orderService.transitionOrder(payment.orderId, 'paid');
    } catch (err) {
      logger.error({ err, orderId: payment.orderId }, 'Failed to transition order state');
    }

    // 2. Notify Restaurant Kitchen Workflow
    try {
      const { NotificationService } = require('../../notifications/services/notification.service');
      const notifications = new NotificationService();
      await notifications.notifyNewPaidOrder(payment.restaurantId, payment.orderId);
    } catch (err) {
      logger.warn({ err }, 'Failed to notify kitchen');
    }

    // 3. Clear Customer Cart and Reset Conversation Session State
    try {
      const { SessionService } = require('../../conversations/session.service');
      const sessionService = new SessionService();
      await sessionService.executeSessionAction(
        payment.restaurantId,
        payment.customerPhone,
        async () => ({ event: { name: 'RESET' } })
      );
    } catch (err) {
      logger.warn({ err }, 'Failed to reset customer session after payment success');
    }

    // 4. Send Rich Interactive Payment Confirmation Card via WhatsApp
    try {
      const { ReplyBuilder } = require('../../whatsapp/interactive/reply-builder');
      const { SessionRepository } = require('../../conversations/repositories/session.repository');
      const { WhatsAppMessageService } = require('../../whatsapp/message.service');
      const { OrderService } = require('../../orders/services/order.service');

      const sessionRepo = new SessionRepository();
      const messages = new WhatsAppMessageService();
      const orderService = new OrderService();
      const realOrder = await orderService['repository'].findById(payment.orderId).catch(() => null);

      const displayOrderId = realOrder?.humanReadableId
        ? (realOrder.humanReadableId.startsWith('#') ? realOrder.humanReadableId : `#${realOrder.humanReadableId}`)
        : `#ORD-${payment.orderId.slice(0, 4).toUpperCase()}`;

      const paidAmount = payment.verifiedAmount || payment.amount || realOrder?.totalAmount || 0;

      const confirmationScreen = {
        id: 'payment_confirmed',
        title: 'Payment Confirmed',
        body: [
          `✅ *Your payment of ₹${paidAmount} was received!*`,
          `━━━━━━━━━━━━━━`,
          `Order ID : *${displayOrderId}*`,
          ``,
          `🍳 Please wait while restaurant is accepting your order shortly.`,
        ].join('\n'),
        buttons: [
          { id: JSON.stringify({ a: 'track_order' }), title: '📦 Track Order' },
          { id: JSON.stringify({ a: 'browse', p: 1 }), title: '🍽️ Place a New Order' },
          { id: JSON.stringify({ a: 'talk_to_staff' }), title: '💬 Talk to Support' },
          { id: JSON.stringify({ a: 'home' }), title: '🏠 Back to Home' },
        ],
      };

      const { text, optionsMap } = ReplyBuilder.buildTextFallback(confirmationScreen);

      // Save optionsMap to session so user numbers (1, 2, 3, 4) route cleanly
      await sessionRepo.patchContext(payment.restaurantId, payment.customerPhone, {
        lastInteractiveScreen: {
          id: confirmationScreen.id,
          options: optionsMap,
        },
      });

      await messages.sendText(
        payment.restaurantId,
        payment.customerPhone,
        text
      );
    } catch (err) {
      logger.warn({ err }, 'Failed to send WhatsApp confirmation');
    }
  }

  private async handlePaymentFailed(payment: Payment): Promise<void> {
    try {
      const { WhatsAppMessageService } = require('../../whatsapp/message.service');
      const messages = new WhatsAppMessageService();
      await messages.sendText(
        payment.restaurantId,
        payment.customerPhone,
        `❌ Payment Failed\n\nYour payment for Order #${payment.orderId} could not be completed.\n\nReply with:\n1. Retry Payment\n2. Cancel Order`
      );
    } catch (err) { }
  }

  private async handlePaymentCancelled(payment: Payment): Promise<void> {
    try {
      const { WhatsAppMessageService } = require('../../whatsapp/message.service');
      const messages = new WhatsAppMessageService();
      await messages.sendText(
        payment.restaurantId,
        payment.customerPhone,
        `❌ Payment Cancelled\n\nPayment for Order #${payment.orderId} was cancelled.\n\nReply with:\n1. Retry Payment\n2. Cancel Order`
      );
    } catch (err) { }
  }

  private async handlePaymentExpired(payment: Payment): Promise<void> {
    try {
      const { WhatsAppMessageService } = require('../../whatsapp/message.service');
      const messages = new WhatsAppMessageService();
      await messages.sendText(
        payment.restaurantId,
        payment.customerPhone,
        `⏰ Payment Link Expired\n\nThe payment link for Order #${payment.orderId} has expired.\n\nReply with:\n1. Generate New Payment Link\n2. Cancel Order`
      );
    } catch (err) { }
  }

  private async sendWhatsAppPaymentLink(payment: Payment, paymentUrl: string): Promise<void> {
    try {
      const { WhatsAppMessageService } = require('../../whatsapp/message.service');
      const messages = new WhatsAppMessageService();
      await messages.sendText(
        payment.restaurantId,
        payment.customerPhone,
        `💳 Restroex Payment Link\n\nPlease complete your payment of ₹${payment.amount} for Order #${payment.orderId}:\n\n${paymentUrl}`
      );
    } catch (err) { }
  }
}
