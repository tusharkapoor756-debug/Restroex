import { orderEventEmitter, OrderDomainEventPayload } from '../../orders/events/order-events.bus';
import { whatsappProviderFactory } from '../providers/whatsapp-provider.factory';
import { logger } from '../../../infrastructure/logger/logger';

export class WhatsAppOrderEventListener {
  private static instance: WhatsAppOrderEventListener;
  private isSubscribed = false;

  public static getInstance(): WhatsAppOrderEventListener {
    if (!WhatsAppOrderEventListener.instance) {
      WhatsAppOrderEventListener.instance = new WhatsAppOrderEventListener();
    }
    return WhatsAppOrderEventListener.instance;
  }

  public initialize(): void {
    if (this.isSubscribed) return;

    logger.info('📱 Initializing WhatsApp Order Event Listener...');

    orderEventEmitter.on('ORDER_ACCEPTED', (payload) => this.handleOrderEvent('accepted', payload));
    orderEventEmitter.on('ORDER_PREPARING', (payload) => this.handleOrderEvent('preparing', payload));
    orderEventEmitter.on('ORDER_READY', (payload) => this.handleOrderEvent('ready', payload));
    orderEventEmitter.on('ORDER_COMPLETED', (payload) => this.handleOrderEvent('completed', payload));
    orderEventEmitter.on('ORDER_CANCELLED', (payload) => this.handleOrderEvent('cancelled', payload));

    this.isSubscribed = true;
  }

  private async handleOrderEvent(status: string, payload: OrderDomainEventPayload): Promise<void> {
    const { restaurantId, customerPhone, orderId, cancellationReason } = payload;
    if (!customerPhone || !restaurantId) return;

    try {
      const provider = await whatsappProviderFactory.getProviderForRestaurant(restaurantId);
      
      const { OrderRepository } = require('../../orders/repositories/order.repository');
      const orderRepo = new OrderRepository();
      const realOrder = await orderRepo.findById(orderId).catch(() => null);

      const displayOrderId = realOrder?.humanReadableId
        ? (realOrder.humanReadableId.startsWith('#') ? realOrder.humanReadableId : `#${realOrder.humanReadableId}`)
        : `#${orderId.slice(0, 5).toUpperCase()}`;

      const cancelledMessage = cancellationReason
        ? `❌ *Order Cancelled*\nYour order ${displayOrderId} has been cancelled.\n📋 *Reason:* ${cancellationReason}\n\nWe apologize for the inconvenience. Please feel free to place a new order.`
        : `❌ *Order Cancelled*\nYour order ${displayOrderId} has been cancelled. We apologize for the inconvenience.`;

      const statusMessages: Record<string, string> = {
        // Consolidated message for Accept Order (NEW → PREPARING): Single WhatsApp update
        preparing: `🍳 *Order Accepted & Preparing!*\nYour order ${displayOrderId} has been accepted by the restaurant and is now being prepared in the kitchen.`,
        accepted: `✅ *Order Accepted!*\nYour order ${displayOrderId} has been accepted by the restaurant and is confirmed.`,
        ready: `🔔 *Order Ready!*\nYour order ${displayOrderId} is ready!`,
        completed: `✨ *Order Completed*\nThank you for dining with us! We hope you enjoyed your meal.`,
        cancelled: cancelledMessage,
      };

      const messageText = statusMessages[status];
      if (messageText) {
        await provider.sendMessage({
          restaurantId,
          to: customerPhone,
          body: messageText,
        });
        logger.info({ orderId, status, customerPhone, displayOrderId }, '💬 WhatsApp status notification sent to customer.');
      }
    } catch (err) {
      logger.warn({ err, orderId, status }, 'Failed to dispatch WhatsApp status notification.');
    }
  }
}

export const whatsappOrderEventListener = WhatsAppOrderEventListener.getInstance();
