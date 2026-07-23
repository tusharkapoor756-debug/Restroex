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
    idempotencyKey: string
  ): Promise<{ order: Order; payment: any; paymentContext?: any }> {
    // 1. Idempotency Check
    const existingOrder = await this.repository.findByIdempotencyKey(idempotencyKey);
    if (existingOrder) {
      logger.warn({ idempotencyKey }, '⚠️ Order check triggered duplicate request. Safely returning existing record.');
      const paymentService = new (require('../../payments/services/payment.service').PaymentService)();
      const existingPayment = await paymentService.getPaymentByOrder(existingOrder.id).catch(() => null);
      const existingContext = await paymentService.resolvePaymentContext(existingOrder.restaurantId).catch(() => null);
      return { order: existingOrder, payment: existingPayment, paymentContext: existingContext };
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
      idempotencyKey,
      customerId: customer.id,
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

    const updated = await this.repository.updateStatus(orderId, targetStatus);
    logger.info({ orderId, from: order.status, to: targetStatus }, '🔄 Order state transitioned successfully.');

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

    // Trigger WhatsApp Notification updates to customer (Part 11)
    try {
      const { WhatsAppMessageService } = require('../../whatsapp/message.service');
      const messages = new WhatsAppMessageService();
      
      const notificationsMap: Record<string, string> = {
        accepted: `🍳 Restaurant accepted your order *${updated.humanReadableId || orderId}*. We are preparing your food shortly!`,
        preparing: `🍳 Your food for order *${updated.humanReadableId || orderId}* is now being prepared!`,
        ready: `🎉 Your order *${updated.humanReadableId || orderId}* is ready!`,
        completed: `❤️ Your order *${updated.humanReadableId || orderId}* has been delivered. Thank you!`,
        cancelled: `❌ Your order *${updated.humanReadableId || orderId}* has been cancelled.`,
      };

      const msgText = notificationsMap[targetStatus];
      if (msgText) {
        await messages.sendText(order.restaurantId, order.customerPhone, msgText);
      }
    } catch (err) {
      logger.warn({ err, orderId }, 'Failed to dispatch order update notification');
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

    return updated;
  }
}
