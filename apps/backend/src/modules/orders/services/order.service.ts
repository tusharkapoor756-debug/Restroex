import { db } from '../../../infrastructure/database/database.client';
import { OrderRepository } from '../repositories/order.repository';
import { OrderStateMachine } from '../state-machine/order.state-machine';
import { Order, OrderStatus, CheckoutValidationResult, OrderItemSnapshot } from '../types/order.types';
import { Cart } from '../../conversations/types/conversation.types';
import { logger } from '../../../infrastructure/logger/logger';

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
    let totalAmount = 0;

    if (!cart.items || cart.items.length === 0) {
      errors.push('Cart cannot be empty.');
      return { isValid: false, errors, validatedItems, totalAmount };
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
      totalAmount += totalPrice;

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
      totalAmount,
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
  ): Promise<Order> {
    // 1. Idempotency Check
    const existingOrder = await this.repository.findByIdempotencyKey(idempotencyKey);
    if (existingOrder) {
      logger.warn({ idempotencyKey }, '⚠️ Order check triggered duplicate request. Safely returning existing record.');
      return existingOrder;
    }

    // 2. Validate Cart pricing/availability
    const validation = await this.validateAndRecalculateCart(restaurantId, cart);
    if (!validation.isValid) {
      throw new Error(`Cart validation failed: ${validation.errors.join(', ')}`);
    }

    const orderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'humanReadableId' | 'receiptSnapshot'> = {
      restaurantId,
      customerPhone,
      status: 'checkout_pending',
      totalAmount: validation.totalAmount,
      idempotencyKey,
    };

    // 3. Persist Order in database (including immutable snapshot items)
    const createdOrder = await this.repository.createOrder(orderData, validation.validatedItems);
    logger.info({ orderId: createdOrder.id }, '✅ Order successfully generated and snapshotted.');

    return createdOrder;
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

    // Event hooks will trigger here (e.g. trigger BullMQ worker alerts)

    return updated;
  }
}
