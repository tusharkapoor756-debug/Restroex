import { InteractiveScreen } from '../interactive-action.types';
import { SessionService } from '../../../conversations/session.service';
import { db } from '../../../../infrastructure/database/database.client';
import { CartManager } from '../../../conversations/cart.manager';

export class InteractiveCartHandler {
  private sessionService = new SessionService();
  private cartManager = new CartManager();

  private get client() {
    return db.getClient();
  }

  public async addToCart(
    restaurantId: string,
    customerPhone: string,
    itemId: string,
    variantId: string | undefined,
    quantity: number
  ): Promise<string> {
    // 1. Fetch item/variant details to get unit price
    let unitPrice = 0;
    let displayName = '';

    const { data: item } = await this.client
      .from('menu_items')
      .select('name, base_price')
      .eq('id', itemId)
      .single();

    if (!item) throw new Error('Menu item not found');

    if (variantId) {
      const { data: variant } = await this.client
        .from('menu_item_variants')
        .select('variant_name, price')
        .eq('id', variantId)
        .single();
      if (!variant) throw new Error('Variant not found');
      unitPrice = Number(variant.price);
      displayName = `${item.name} (${variant.variant_name})`;
    } else {
      unitPrice = Number(item.base_price);
      displayName = item.name;
    }

    // 2. Perform FSM action to add item
    await this.sessionService.executeSessionAction(
      restaurantId,
      customerPhone,
      async () => ({
        event: {
          name: 'ITEM_ADDED',
          payload: {
            menuItemId: itemId,
            variantId,
            quantity,
            unitPrice,
          },
        },
      })
    );

    return `✅ Added ${quantity} x *${displayName}* to your cart.`;
  }

  public async renderCart(restaurantId: string, customerPhone: string): Promise<InteractiveScreen> {
    const session = await this.sessionService.getSession(restaurantId, customerPhone);
    const cart = session.cart;

    if (!cart.items || cart.items.length === 0) {
      return {
        id: 'cart_empty',
        title: '🛒 Your Cart',
        body: 'Your cart is empty. Explore our menu to add some delicious food!',
        buttons: [
          { id: JSON.stringify({ a: 'browse', p: 1 }), title: '🍽️ Browse Menu' },
          { id: JSON.stringify({ a: 'home' }), title: '🏠 Back to Home' },
        ],
      };
    }

    // Fetch item details for formatting
    const itemIds = cart.items.map((i) => i.menuItemId);
    const { data: menuItems } = await this.client
      .from('menu_items')
      .select('id, name')
      .in('id', itemIds);

    const variantIds = cart.items.filter((i) => i.variantId).map((i) => i.variantId!);
    let variants: any[] = [];
    if (variantIds.length > 0) {
      const { data } = await this.client
        .from('menu_item_variants')
        .select('id, variant_name')
        .in('id', variantIds);
      variants = data || [];
    }

    let body = '🛒 *Your Order Summary:*\n\n';
    let total = 0;

    cart.items.forEach((item, index) => {
      const dbItem = menuItems?.find((m) => m.id === item.menuItemId);
      const dbVariant = variants.find((v) => v.id === item.variantId);
      const name = dbVariant 
        ? `${dbItem?.name || 'Item'} (${dbVariant.variant_name})`
        : (dbItem?.name || 'Item');
      
      const itemTotal = item.quantity * item.unitPrice;
      total += itemTotal;
      body += `${index + 1}. *${name}* x ${item.quantity} = ₹${itemTotal}\n`;
    });

    body += `\n*Grand Total: ₹${total}*`;

    return {
      id: 'cart_view',
      title: 'Your Cart',
      body,
      buttons: [
        { id: JSON.stringify({ a: 'checkout' }), title: 'Proceed to Checkout' },
        { id: JSON.stringify({ a: 'browse', p: 1 }), title: '🍽️ Add More Items' },
        { id: JSON.stringify({ a: 'cart_clear' }), title: 'Clear Cart' },
      ],
      previousScreenId: 'home',
    };
  }

  public async clearCart(restaurantId: string, customerPhone: string): Promise<string> {
    await this.sessionService.executeSessionAction(
      restaurantId,
      customerPhone,
      async () => ({
        event: {
          name: 'RESET',
        },
      })
    );
    return '🧹 Your cart has been cleared.';
  }
}
