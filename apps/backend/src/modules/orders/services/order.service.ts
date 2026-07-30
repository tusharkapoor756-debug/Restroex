import { db } from '../../../infrastructure/database/database.client';
import { OrderRepository } from '../repositories/order.repository';
import { OrderStateMachine } from '../state-machine/order.state-machine';
import { Order, OrderStatus, CheckoutValidationResult, OrderItemSnapshot } from '../types/order.types';
import { Cart } from '../../conversations/types/conversation.types';
import { logger } from '../../../infrastructure/logger/logger';
import { BillingService } from '../../billing/services/billing.service';
import { SettingsRepository } from '../../restaurants/repositories/settings.repository';

export class OrderService {
  private repository: OrderRepository;

  constructor() {
    this.repository = new OrderRepository();
  }

  public async getOrderById(id: string): Promise<Order> {
    const order = await this.repository.findById(id);
    if (!order) throw new Error(`Order ${id} not found`);
    return order;
  }

  /**
   * Validates a cart against the latest database menu items, availability, and prices.
   * Generates final immutable item snapshots for invoice generation.
   */
  public async validateAndRecalculateCart(restaurantId: string, cart: Cart): Promise<CheckoutValidationResult> {
    const errors: string[] = [];
    const validatedItems: OrderItemSnapshot[] = [];

    if (!cart.items || cart.items.length === 0) {
      errors.push('Cart cannot be empty.');
      return { isValid: false, errors, validatedItems };
    }

    const menuItemIds = cart.items.map((i) => i.menuItemId);
    const variantIds = cart.items.map((i) => i.variantId).filter((v): v is string => !!v);

    const supabase = db.getClient();

    // 1. Fetch latest base menu items
    const { data: menuData, error: menuError } = await supabase
      .from('menu_items')
      .select('id, name, base_price, is_available')
      .eq('restaurant_id', restaurantId)
      .in('id', menuItemIds);

    if (menuError || !menuData) {
      throw new Error(`Failed to load menu items for cart validation: ${menuError?.message}`);
    }

    // 2. Fetch latest variants if present
    let variantsMap: Record<string, { name: string; price: number; isAvailable: boolean }> = {};
    if (variantIds.length > 0) {
      const { data: variantData, error: varError } = await supabase
        .from('menu_item_variants')
        .select('id, variant_name, price, is_available')
        .in('id', variantIds);

      if (varError) {
        throw new Error(`Failed to load menu variants for cart validation: ${varError.message}`);
      }

      variantData?.forEach((v: any) => {
        variantsMap[v.id] = {
          name: v.variant_name,
          price: Number(v.price),
          isAvailable: v.is_available,
        };
      });
    }

    const menuItemsMap = new Map<string, { name: string; basePrice: number; isAvailable: boolean }>();
    menuData.forEach((item: any) => {
      menuItemsMap.set(item.id, {
        name: item.name,
        basePrice: Number(item.base_price),
        isAvailable: item.is_available,
      });
    });

    // 3. Process and recalculate prices
    for (const cartItem of cart.items) {
      const dbItem = menuItemsMap.get(cartItem.menuItemId);

      if (!dbItem) {
        errors.push(`Item ID ${cartItem.menuItemId} does not exist in the restaurant's menu.`);
        continue;
      }

      if (!dbItem.isAvailable) {
        errors.push(`"${dbItem.name}" is currently unavailable.`);
        continue;
      }

      let unitPrice = dbItem.basePrice;
      let variantName: string | undefined = undefined;

      // Single pricing rule: IF variant exists → use variant.price (absolute); ELSE → use base_price
      if (cartItem.variantId) {
        const dbVariant = variantsMap[cartItem.variantId];
        if (!dbVariant) {
          errors.push(`Variant ID ${cartItem.variantId} does not exist for item "${dbItem.name}".`);
          continue;
        }

        if (!dbVariant.isAvailable) {
          errors.push(`Variant "${dbVariant.name}" for item "${dbItem.name}" is currently unavailable.`);
          continue;
        }

        unitPrice = dbVariant.price; // absolute variant price overrides base_price
        variantName = dbVariant.name;
      }

      const totalPrice = unitPrice * cartItem.quantity;

      validatedItems.push({
        menuItemId: cartItem.menuItemId,
        itemNameSnapshot: dbItem.name,
        variantNameSnapshot: variantName,
        quantity: cartItem.quantity,
        unitPrice,
        totalPrice,
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      validatedItems,
    };
  }

  /**
   * Places a new order. Enforces idempotency keys to prevent duplicate order generation.
   */
  public async checkoutOrder(
    restaurantId: string,
    customerPhone: string,
    cart: Cart,
    idempotencyKey: string,
    orderType: 'takeaway' | 'dining' = 'takeaway',
    tableNumber?: number | null
  ): Promise<{ order: Order; payment: any; paymentContext?: any }> {
    // 1. Active Idempotency Check — return existing order ONLY if it is still active (non-terminal)
    const existingActiveOrder = await this.repository.findActiveByIdempotencyKey(idempotencyKey);
    if (existingActiveOrder) {
      logger.warn(
        { idempotencyKey, orderId: existingActiveOrder.id, status: existingActiveOrder.status },
        '⚠️ Active order found for this checkout. Safely returning existing active record.'
      );
      const paymentService = new (require('../../payments/services/payment.service').PaymentService)();
      const existingPayment = await paymentService.getPaymentByOrder(existingActiveOrder.id).catch(() => null);
      const existingContext = await paymentService.resolvePaymentContext(existingActiveOrder.restaurantId).catch(() => null);
      return { order: existingActiveOrder, payment: existingPayment, paymentContext: existingContext };
    }

    // 1b. If a historical terminal order exists with exact key, generate a unique key suffix for the new order
    let effectiveIdempotencyKey = idempotencyKey;
    const historicalOrder = await this.repository.findByIdempotencyKey(idempotencyKey);
    if (historicalOrder) {
      effectiveIdempotencyKey = `${idempotencyKey}:${Date.now()}`;
      logger.info(
        { oldOrderId: historicalOrder.id, newKey: effectiveIdempotencyKey },
        'Historical order is in terminal state. Creating a fresh order with unique idempotency key.'
      );
    }

    // 2. Validate Cart pricing/availability
    const validation = await this.validateAndRecalculateCart(restaurantId, cart);
    if (!validation.isValid) {
      throw new Error(`Cart validation failed: ${validation.errors.join(', ')}`);
    }

    // 3. Fetch Settings for Billing
    const settingsRepo = new SettingsRepository();
    const settings = await settingsRepo.getSettings(restaurantId);

    // 4. Calculate Billing Breakdown
    const billing = BillingService.calculateBreakdown(validation.validatedItems, settings);

    // 4.5. Retrieve Customer Profile to bind customer_id
    const { CustomerService } = require('../../customers/services/customer.service');
    const customerService = new CustomerService();
    const customer = await customerService.getOrCreateCustomer(restaurantId, customerPhone);

    const orderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'humanReadableId' | 'receiptSnapshot'> = {
      restaurantId,
      customerPhone,
      status: 'checkout_pending',
      subtotal: billing.subtotal,
      tax: billing.taxAmount,
      discountAmount: billing.discountAmount,
      packingCharge: billing.packingCharge,
      deliveryCharge: billing.deliveryCharge,
      totalAmount: billing.totalAmount,
      idempotencyKey: effectiveIdempotencyKey,
      customerId: customer.id,
      orderType,
      tableNumber: tableNumber ? Math.round(Number(tableNumber)) : null,
    };

    // 5. Persist Order in database (including immutable snapshot items)
    const createdOrder = await this.repository.createOrder(orderData, validation.validatedItems);
    logger.info({ orderId: createdOrder.id }, '✅ Order successfully generated and snapshotted.');

    // 6. Create Payment Record for this Order
    const paymentService = new (require('../../payments/services/payment.service').PaymentService)();

    // Resolve which payment method to use from RestaurantSettings.
    // usablePaymentMethods are those with a registered provider.
    const paymentContext = await paymentService.resolvePaymentContext(restaurantId);
    const resolvedMethod = paymentContext.resolvedPaymentMethod;

    let payment = null;
    if (resolvedMethod) {
      // Single usable method: create payment record immediately
      payment = await paymentService.createPayment({
        orderId: createdOrder.id,
        restaurantId,
        customerPhone,
        amount: createdOrder.totalAmount,
        paymentMethod: resolvedMethod,
        providerName: resolvedMethod,
      });
    }
    // If resolvedMethod is null, multiple methods exist.
    // The caller (WhatsApp handler) uses paymentContext.availablePaymentMethods
    // to prompt the customer to choose.

    return {
      order: createdOrder,
      payment,
      paymentContext,
    };
  }

  /**
   * Transitions an order from current status to a new target status.
   */
  public async transitionOrder(orderId: string, targetStatus: OrderStatus): Promise<Order> {
    const order = await this.repository.findById(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} does not exist.`);
    }

    const isValid = OrderStateMachine.isValidTransition(order.status, targetStatus);
    if (!isValid) {
      throw new Error(`Forbidden transition from "${order.status}" to "${targetStatus}"`);
    }

    const updatedOrder = await this.repository.updateStatus(orderId, targetStatus);
    logger.info({ orderId, oldStatus: order.status, newStatus: targetStatus }, 'Order status updated.');

    // Phase 3: Emit Decoupled Domain Event
    const eventTypeMap: Record<string, any> = {
      accepted: 'ORDER_ACCEPTED',
      preparing: 'ORDER_PREPARING',
      ready: 'ORDER_READY',
      completed: 'ORDER_COMPLETED',
      cancelled: 'ORDER_CANCELLED',
      rejected: 'ORDER_REJECTED',
    };
    const eventType = eventTypeMap[targetStatus];
    if (eventType) {
      const { orderEventEmitter } = require('../events/order-events.bus');
      orderEventEmitter.emitOrderEvent(eventType, {
        orderId: updatedOrder.id,
        restaurantId: updatedOrder.restaurantId,
        customerPhone: updatedOrder.customerPhone,
        status: updatedOrder.status,
        orderType: updatedOrder.orderType,
        tableNumber: updatedOrder.tableNumber,
        totalAmount: updatedOrder.totalAmount,
        timestamp: new Date().toISOString(),
      });
    }

    // Write to order_status_timeline tracking table (Part 8)
    try {
      await db.getClient()
        .from('order_status_timeline')
        .insert({
          order_id: orderId,
          status: targetStatus,
        });
    } catch (err) {
      logger.warn({ err, orderId }, 'Failed to write order timeline transition record');
    }

    // Event hooks will trigger here (e.g. trigger BullMQ worker alerts)
    if (targetStatus === 'cancelled') {
      try {
        const { PaymentService } = require('../../payments/services/payment.service');
        const paymentService = new PaymentService();
        const payment = await paymentService.getPaymentByOrder(orderId);
        if (payment && payment.paymentStatus !== 'cancelled') {
          logger.info({ orderId, paymentId: payment.id }, 'Syncing cancel: Transitioning payment to cancelled.');
          await paymentService.repository.update(payment.id, { paymentStatus: 'cancelled' });
        }
      } catch (err) {
        logger.warn({ err, orderId }, 'Could not automatically transition associated payment to cancelled.');
      }
    }

    return updatedOrder;
  }
}
