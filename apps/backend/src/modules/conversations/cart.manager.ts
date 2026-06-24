import { Cart } from './types/conversation.types';

export class CartManager {
  /**
   * Computes the total price of all items currently in the cart.
   */
  public calculateTotal(cart: Cart): number {
    return cart.items.reduce((total, item) => {
      return total + item.quantity * item.unitPrice;
    }, 0);
  }

  /**
   * Formats the cart contents into a user-friendly string for WhatsApp responses.
   */
  public formatCartSummary(cart: Cart, menuItemsMap: Record<string, string>): string {
    if (!cart.items || cart.items.length === 0) {
      return 'Your cart is empty.';
    }

    let summary = '🛒 *Your Order Summary:*\n\n';
    let total = 0;

    cart.items.forEach((item, index) => {
      const itemName = menuItemsMap[item.menuItemId] || 'Unknown Item';
      const itemTotal = item.quantity * item.unitPrice;
      total += itemTotal;
      summary += `${index + 1}. *${itemName}* x ${item.quantity} = ₹${itemTotal.toFixed(2)}\n`;
    });

    summary += `\n*Grand Total: ₹${total.toFixed(2)}*`;
    return summary;
  }
}
