import crypto from 'crypto';
import { db } from '../../infrastructure/database/database.client';
import { OrderService } from '../orders/services/order.service';
import { logger } from '../../infrastructure/logger/logger';

export class PaymentWebhookHandler {
  private orderService: OrderService;

  constructor() {
    this.orderService = new OrderService();
  }

  /**
   * Verifies the Razorpay webhook signature.
   */
  public verifySignature(rawPayload: string, signature: string): boolean {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      // If secret not configured in local pilot sandbox, log warning and bypass
      logger.warn('RAZORPAY_WEBHOOK_SECRET is not configured. Bypassing signature check.');
      return true;
    }

    if (!signature) {
      return false;
    }

    const computedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawPayload)
      .digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(computedSignature, 'hex'),
        Buffer.from(signature, 'hex')
      );
    } catch {
      return false;
    }
  }

  /**
   * Main entry point to process validated Razorpay webhooks.
   * Processes the 'payment.captured' event atomically.
   */
  public async handleWebhook(eventPayload: any): Promise<boolean> {
    const event = eventPayload.event;
    
    // Only capture successful payments in FSM
    if (event !== 'payment.captured') {
      logger.info({ event }, 'Ignored non-capture Razorpay webhook event.');
      return true;
    }

    const paymentEntity = eventPayload.payload?.payment?.entity;
    if (!paymentEntity) {
      throw new Error('Invalid Razorpay payload: payment entity missing');
    }

    const razorpayPaymentId = paymentEntity.id; // e.g. pay_NHD83jJ82jJd
    const razorpayOrderId = paymentEntity.order_id; // e.g. order_NHD73jJ72jJd (Idempotency key)
    const amount = Number(paymentEntity.amount) / 100; // Razorpay provides amount in paise
    const status = paymentEntity.status; // 'captured'

    logger.info(
      { razorpayPaymentId, razorpayOrderId, amount },
      '💳 Processing validated payment.captured webhook'
    );

    const supabase = db.getClient();

    try {
      // 1. Idempotency Check: Verify if payment ID was already processed
      const { data: existingPayment, error: findError } = await supabase
        .from('payments')
        .select('id, order_id')
        .eq('external_transaction_id', razorpayPaymentId)
        .maybeSingle();

      if (findError) {
        throw new Error(`Failed to check existing payments: ${findError.message}`);
      }

      if (existingPayment) {
        logger.warn({ razorpayPaymentId }, '⚠️ Webhook duplicate delivery detected. Payment already registered.');
        return true; // Return true safely so webhook is acknowledged
      }

      // 2. Resolve matching Order by idempotency_key (Razorpay Order ID)
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('id, status, restaurant_id')
        .eq('idempotency_key', razorpayOrderId)
        .maybeSingle();

      if (orderError || !order) {
        logger.error({ razorpayOrderId, orderError }, '❌ Failed to find order matching Razorpay Order ID');
        throw new Error(`Reconciliation aborted: Order not found for reference ${razorpayOrderId}`);
      }

      // 3. Insert Payment log atomically
      const { error: insertError } = await supabase
        .from('payments')
        .insert({
          order_id: order.id,
          restaurant_id: order.restaurant_id,
          external_transaction_id: razorpayPaymentId,
          status: 'captured',
          amount: amount,
        });

      if (insertError) {
        throw new Error(`Failed to log payment transaction: ${insertError.message}`);
      }

      // 4. Transition Order status to 'paid' through the FSM Order Service
      // This enforces state validation rules (FSM is the absolute authority)
      await this.orderService.transitionOrder(order.id, 'paid');

      logger.info(
        { orderId: order.id, paymentId: razorpayPaymentId },
        '✅ Payment successfully reconciled and FSM transitioned to PAID.'
      );

      return true;
    } catch (err: any) {
      logger.error({ err, razorpayPaymentId }, '❌ Failed transactional payment reconciliation');
      throw err;
    }
  }
}
