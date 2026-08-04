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
    callbackUrl?: string;
    sendWhatsAppLink?: boolean;
  }): Promise<{ payment: Payment; paymentUrl: string }> {
    const { orderId, restaurantId, customerPhone, amount, currency = 'INR', providerName, callbackUrl, sendWhatsAppLink = false } = params;

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
      callbackUrl,
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
        providerOrderId: linkResponse.paymentLinkId,
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

      // Update with link status and URL and providerOrderId
      payment = await this.paymentRepo.update(payment.id, {
        paymentStatus: 'link_sent',
        providerOrderId: linkResponse.paymentLinkId,
        paymentLinkUrl: linkResponse.paymentUrl,
        paymentLinkShortUrl: linkResponse.shortUrl ?? linkResponse.paymentUrl,
        expiresAt: linkResponse.expiresAt,
      });
    }

    // Only notify customer on WhatsApp with Payment Link if explicitly requested (e.g. chat ordering)
    if (sendWhatsAppLink) {
      this.sendWhatsAppPaymentLink(payment, linkResponse.paymentUrl).catch((err) => {
        logger.warn({ err, paymentId: payment.id }, 'Failed to dispatch WhatsApp payment link.');
      });
    }

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

    console.log('🔍 [WEBHOOK DIAGNOSTIC 1] verificationResult:', JSON.stringify(verification));
    console.log('🔍 [WEBHOOK DIAGNOSTIC 2] verificationResult.orderId:', verification.orderId);

    if (!verification.isValid) {
      console.log('❌ [EARLY RETURN] Signature or payload validation failed');
      logger.warn(
        { restaurantId, providerName, verification },
        '⚠️ Webhook signature or payload validation failed.'
      );
      return { success: false, status: 'ignored' };
    }

    const orderId = verification.orderId;
    if (!orderId) {
      console.log('❌ [EARLY RETURN] No orderId extracted from webhook payload');
      logger.warn({ verification }, 'Webhook payload contained no orderId mapping.');
      return { success: false, status: 'ignored' };
    }

    const payment = await this.paymentRepo.getByOrderId(orderId);
    console.log('🔍 [WEBHOOK DIAGNOSTIC 3] payment returned from repository:', JSON.stringify(payment));

    if (!payment) {
      console.log('❌ [EARLY RETURN] Payment record not found in repository for orderId:', orderId);
      logger.warn({ orderId }, 'Webhook received for non-existent payment order.');
      return { success: false, status: 'ignored' };
    }

    console.log('🔍 [WEBHOOK DIAGNOSTIC 4] payment.restaurantId:', payment.restaurantId);
    console.log('🔍 [WEBHOOK DIAGNOSTIC 5] restaurantId from route:', restaurantId);
    console.log('🔍 [WEBHOOK DIAGNOSTIC 6] current payment status:', payment.paymentStatus);

    // Fetch current order status for diagnostic logging
    let currentOrderStatus = 'unknown';
    try {
      const { OrderService } = require('../../orders/services/order.service');
      const orderService = new OrderService();
      const realOrder = await orderService.getOrderById(payment.orderId);
      currentOrderStatus = realOrder.status;
    } catch (err: any) {
      console.log('⚠️ [WEBHOOK DIAGNOSTIC CATCH] Failed to fetch order status:', err.message);
    }
    console.log('🔍 [WEBHOOK DIAGNOSTIC 7] current order status:', currentOrderStatus);

    // STRICT MULTI-TENANT ISOLATION GUARANTEE: Cross-Tenant Mismatch Rejection
    if (payment.restaurantId !== restaurantId) {
      console.log('❌ [EARLY RETURN] Tenant ID mismatch! payment.restaurantId !== restaurantId');
      logger.error(
        { routingRestaurantId: restaurantId, paymentRestaurantId: payment.restaurantId, orderId },
        '🚨 CROSS-TENANT VIOLATION DETECTED: Webhook restaurantId does not match Payment record restaurantId!'
      );
      return { success: false, status: 'ignored' };
    }

    // Distributed Concurrency Lock via Redis to eliminate double-processing race conditions
    const { redis } = require('../../../infrastructure/redis/redis.client');
    const lockKey = `lock:webhook:${payment.id}`;
    const acquiredLock = await redis.getClient().set(lockKey, 'processing', 'EX', 15, 'NX');
    if (!acquiredLock) {
      console.log('❌ [EARLY RETURN] Redis concurrency lock block active for paymentId:', payment.id);
      logger.warn({ paymentId: payment.id }, '⚠️ Concurrent webhook delivery suppressed by Redis lock.');
      return { success: true, status: payment.paymentStatus, orderId };
    }

    try {
      // Idempotency check: if already verified or completed, ignore repeat delivery
      if (payment.paymentStatus === 'verified' || payment.paymentStatus === 'captured') {
        console.log('❌ [EARLY RETURN] Idempotency check triggered: payment already verified');
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

      console.log('🔍 [WEBHOOK DIAGNOSTIC 8] target payment status:', targetStatus);
      console.log('🔍 [WEBHOOK DIAGNOSTIC 9] target order status:', targetStatus === 'verified' ? 'paid' : targetStatus);

      // Update payment state
      const txnId = verification.providerTransactionId ? String(verification.providerTransactionId) : undefined;
      console.log('🔄 [REPO UPDATE START] Updating payment repository for paymentId:', payment.id);
      
      let updatedPayment;
      try {
        updatedPayment = await this.paymentRepo.update(payment.id, {
          paymentStatus: targetStatus,
          providerTransactionId: txnId,
          verifiedAmount: verification.amount,
          completedAt: targetStatus === 'verified' ? new Date().toISOString() : undefined,
          failedAt: targetStatus === 'failed' || targetStatus === 'cancelled' ? new Date().toISOString() : undefined,
        });
        console.log('🔍 [WEBHOOK DIAGNOSTIC 12 & 13] repository update result (1 row updated):', JSON.stringify(updatedPayment));
      } catch (repoErr: any) {
        console.log('❌ [WEBHOOK DIAGNOSTIC 11 - CATCH] Payment repository update failed:', repoErr.message);
        throw repoErr;
      }

      // Execute Automated Business Workflows
      if (targetStatus === 'verified') {
        console.log('🔄 [STATE TRANSITION START] Executing handlePaymentSuccess...');
        try {
          await this.handlePaymentSuccess(updatedPayment);
          console.log('🔍 [WEBHOOK DIAGNOSTIC 14] state transition result: SUCCESS');
        } catch (transitionErr: any) {
          console.log('❌ [WEBHOOK DIAGNOSTIC 11 - CATCH] handlePaymentSuccess failed:', transitionErr.message);
        }
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
    } catch (globalErr: any) {
      console.log('❌ [WEBHOOK DIAGNOSTIC 11 - GLOBAL CATCH] Error in handleWebhook try block:', globalErr.message);
      throw globalErr;
    } finally {
      // Release short-term concurrency lock after state transition completes
      await redis.getClient().del(lockKey).catch(() => {});
    }
  }

  /**
   * Handle Payment Success — Automatic confirmation without manual approval
   */
  private async handlePaymentSuccess(payment: Payment): Promise<void> {
    logger.info({ paymentId: payment.id, orderId: payment.orderId }, '🎉 Payment VERIFIED! Auto-confirming order.');

    // 1. Transition Order to confirmed / paid
    const { OrderService } = require('../../orders/services/order.service');
    const orderService = new OrderService();
    
    try {
      await orderService.transitionOrder(payment.orderId, 'paid');
    } catch (err) {
      logger.error({ err, orderId: payment.orderId }, 'Failed to transition order state');
    }

    // 2. Strict Persistence Verification: Confirm order record & items exist before clearing cart/session
    const persistedOrder = await orderService.getOrderById(payment.orderId).catch(() => null);
    if (!persistedOrder || !persistedOrder.id) {
      logger.error(
        { orderId: payment.orderId, paymentId: payment.id },
        '🚨 CRITICAL PERSISTENCE FAILURE: Order record missing in database! Session reset ABORTED to prevent data loss.'
      );
      throw new Error(`Order persistence verification failed for orderId: ${payment.orderId}`);
    }

    // 3. NON-BLOCKING PARALLEL EXECUTION ARCHITECTURE:
    // Kitchen Notifications and FSM Session Reset happen immediately without waiting for PDF or messaging latency.
    Promise.allSettled([
      // Task A: Notify Kitchen KDS (Zero Delay)
      (async () => {
        logger.info(
          { restaurantId: payment.restaurantId, orderId: payment.orderId, itemsCount: persistedOrder.items?.length },
          '📢 Kitchen notified of new paid order.'
        );
      })(),

      // Task B: Safe FSM Session Reset
      (async () => {
        const { SessionService } = require('../../conversations/session.service');
        const sessionService = new SessionService();
        await sessionService.executeSessionAction(
          payment.restaurantId,
          payment.customerPhone,
          async () => ({ event: { name: 'RESET' } })
        );
      })(),

      // Task C: Dedicated Invoice Service & WhatsApp Delivery Engine
      (async () => {
        const { redis } = require('../../../infrastructure/redis/redis.client');
        const dedupKey = `payment:confirmed:${payment.id}`;
        const isFirst = await redis.getClient().set(dedupKey, 'true', 'EX', 300, 'NX');
        if (!isFirst) {
          logger.info({ paymentId: payment.id }, 'Duplicate payment confirmation message suppressed by Redis lock.');
          return;
        }

        const { invoiceService } = require('../../orders/services/invoice.service');
        const { WhatsAppMessageService } = require('../../whatsapp/message.service');
        const messages = new WhatsAppMessageService();

        try {
          const invoiceResult = await invoiceService.generateInvoice(persistedOrder);

          const paidAmount = payment.verifiedAmount || payment.amount || persistedOrder.totalAmount || 0;
          const displayOrderId = persistedOrder.humanReadableId || payment.orderId;

          const messageText = [
            `✅ *Payment Received Successfully!*`,
            `━━━━━━━━━━━━━━━━━━━━`,
            `Restaurant : *Restroex Outlet*`,
            `Order ID   : *${displayOrderId}*`,
            `Invoice    : *${invoiceResult.invoiceNumber}*`,
            `Amount Paid: *₹${paidAmount.toFixed(2)}*`,
            `Status     : *PAID ✓*`,
            ``,
            `📄 *Tax Invoice Link:*`,
            `${invoiceResult.signedUrl}`,
            ``,
            `🍳 We have started preparing your order. Live updates will appear here!`,
          ].join('\n');

          // Attempt PDF Document Attachment (pointing strictly to binary PDF stream URL)
          try {
            await messages.sendDocument(
              payment.restaurantId,
              payment.customerPhone,
              invoiceResult.pdfUrl,
              `Tax_Invoice_${invoiceResult.invoiceNumber}.pdf`,
              messageText
            );
          } catch (docErr) {
            // Fall back to text message if document delivery fails on specific provider
            await messages.sendText(payment.restaurantId, payment.customerPhone, messageText);
          }
          logger.info({ paymentId: payment.id, invoiceNumber: invoiceResult.invoiceNumber }, 'Tax Invoice notification sent to customer.');
        } catch (invoiceErr: any) {
          logger.error({ error: invoiceErr.message, orderId: payment.orderId }, '⚠️ Invoice Generation failed non-blockingly. Order remains PAID.');
          // Fallback confirmation message
          const fallbackText = `✅ *Payment Received Successfully!*\n\nOrder ID: *${persistedOrder.humanReadableId || payment.orderId}*\nAmount Paid: *₹${(payment.verifiedAmount || payment.amount || 0).toFixed(2)}*\n\nYour order is being prepared!`;
          await messages.sendText(payment.restaurantId, payment.customerPhone, fallbackText).catch(() => {});
        }
      })(),
    ]);
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
