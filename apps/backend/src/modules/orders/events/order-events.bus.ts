import { EventEmitter } from 'events';
import { logger } from '../../../infrastructure/logger/logger';

export type OrderDomainEventType =
  | 'ORDER_CREATED'
  | 'PAYMENT_COMPLETED'
  | 'ORDER_ACCEPTED'
  | 'ORDER_REJECTED'
  | 'ORDER_PREPARING'
  | 'ORDER_READY'
  | 'ORDER_COMPLETED'
  | 'ORDER_CANCELLED';

export interface OrderDomainEventPayload {
  orderId: string;
  restaurantId: string;
  customerPhone?: string;
  status: string;
  orderType?: string;
  tableNumber?: number;
  totalAmount?: number;
  timestamp: string;
  metadata?: Record<string, any>;
}

class OrderEventEmitter extends EventEmitter {
  public emitOrderEvent(type: OrderDomainEventType, payload: OrderDomainEventPayload): void {
    logger.info({ type, orderId: payload.orderId, restaurantId: payload.restaurantId }, `📢 Domain Event Emitted: ${type}`);
    this.emit(type, payload);
    this.emit('*', { type, ...payload });
  }
}

export const orderEventEmitter = new OrderEventEmitter();
