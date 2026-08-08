import { db } from '../../../infrastructure/database/database.client';
import { logger } from '../../../infrastructure/logger/logger';
import { BadRequestError } from '../../../shared/errors/app-error';
import { billingEngineService } from '../../billing/services/billing-engine.service';
import { WhatsAppMessageService } from '../../whatsapp/message.service';

export type OrderStatus = 'received' | 'accepted' | 'preparing' | 'ready' | 'completed' | 'cancelled' | 'checkout_pending' | 'payment_pending';

export class OrderStateMachineService {
  private get client() {
    return db.getClient();
  }

  private whatsappMessageService = new WhatsAppMessageService();

  /**
   * Deterministic State Transition Matrix
   */
  private readonly ALLOWED_TRANSITIONS: Record<string, string[]> = {
    checkout_pending: ['payment_pending', 'received', 'cancelled'],
    payment_pending: ['received', 'accepted', 'cancelled'],
    received: ['accepted', 'cancelled'],
    accepted: ['preparing', 'cancelled'],
    preparing: ['ready', 'cancelled'],
    ready: ['completed', 'cancelled'],
    completed: [], // Terminal state
    cancelled: [], // Terminal state
  };

  /**
   * Validates and executes a deterministic order state transition.
   */
  public async transitionOrder(
    orderId: string,
    targetStatus: OrderStatus,
    options?: {
      cancellationReason?: string;
      userId?: string;
    }
  ): Promise<any> {
    // 1. Fetch current order state
    const { data: order, error: fetchErr } = await this.client
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (fetchErr || !order) {
      throw new BadRequestError(`Order ${orderId} not found`);
    }

    const currentStatus: string = order.status;

    // 2. Validate State Matrix
    if (currentStatus === targetStatus) {
      return order; // No-op if already in target state
    }

    const allowed = this.ALLOWED_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(targetStatus)) {
      throw new BadRequestError(
        `Invalid order status transition from '${currentStatus}' to '${targetStatus}'. Allowed transitions: ${allowed.join(', ') || 'none'}`
      );
    }

    // 3. Post-Cooking Cancellation Rule Enforcement
    if (targetStatus === 'cancelled' && (currentStatus === 'preparing' || currentStatus === 'ready')) {
      if (!options?.cancellationReason || !options.cancellationReason.trim()) {
        throw new BadRequestError(`Cancellation reason is mandatory when cancelling an order in '${currentStatus}' state.`);
      }

      // Write audit log entry
      await this.client.from('order_cancellation_logs').insert({
        order_id: orderId,
        restaurant_id: order.restaurant_id,
        previous_status: currentStatus,
        cancellation_reason: options.cancellationReason.trim(),
        cancelled_by_user_id: options.userId || null,
      });

      logger.info({ orderId, previousStatus: currentStatus, reason: options.cancellationReason }, 'Audit log written for post-cooking order cancellation');
    }

    // 4. Determine Timestamp Payload
    const timestampPayload: Record<string, any> = {
      status: targetStatus,
      updated_at: new Date().toISOString(),
    };

    if (targetStatus === 'accepted') timestampPayload.accepted_at = new Date().toISOString();
    if (targetStatus === 'preparing') timestampPayload.preparing_started_at = new Date().toISOString();
    if (targetStatus === 'ready') timestampPayload.ready_at = new Date().toISOString();
    if (targetStatus === 'completed') timestampPayload.completed_at = new Date().toISOString();

    // 5. Update Database Record
    const { data: updatedOrder, error: updateErr } = await this.client
      .from('orders')
      .update(timestampPayload)
      .eq('id', orderId)
      .select('*')
      .single();

    if (updateErr) {
      throw new Error(`Failed to execute order state transition: ${updateErr.message}`);
    }

    logger.info({ orderId, from: currentStatus, to: targetStatus }, 'Order state transition executed successfully');

    // 6. Trigger Billing Engine Policy on Order Completion
    if (targetStatus === 'completed') {
      billingEngineService.handleOrderCompleted(order.restaurant_id, orderId).catch(() => {});
    }

    // 7. Deterministic Customer WhatsApp Status Update Notification
    if (order.customer_phone) {
      this.sendWhatsAppStatusNotification(updatedOrder).catch((err) => {
        logger.warn({ err, orderId }, 'Non-fatal: WhatsApp status update notification failed');
      });
    }

    return updatedOrder;
  }

  /**
   * Formats and sends direct WhatsApp status updates
   */
  private async sendWhatsAppStatusNotification(order: any): Promise<void> {
    let textMessage = '';
    const orderNum = order.human_readable_id || order.id.substring(0, 8);

    switch (order.status) {
      case 'accepted':
        textMessage = `✅ *Order Accepted!*\nYour order *#${orderNum}* has been accepted by the kitchen. We will start preparing it shortly!`;
        break;
      case 'preparing':
        textMessage = `👨‍🍳 *Cooking Started!*\nOur chef has started preparing your order *#${orderNum}*.`;
        break;
      case 'ready':
        textMessage = `🔔 *Order Ready!*\nYour order *#${orderNum}* is now ready for pickup / table serving!`;
        break;
      case 'completed':
        textMessage = `🎉 *Order Completed!*\nThank you for dining with us! Hope you enjoyed your meal.`;
        break;
      case 'cancelled':
        textMessage = `❌ *Order Cancelled*\nYour order *#${orderNum}* was cancelled. Contact restaurant if you have any questions.`;
        break;
      default:
        return;
    }

    // Direct deterministic WhatsApp notification dispatch
    await this.whatsappMessageService.sendText(order.restaurant_id, order.customer_phone, textMessage);
  }
}

export const orderStateMachineService = new OrderStateMachineService();
