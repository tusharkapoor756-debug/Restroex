import { BillingBreakdown } from '../types/billing.types';
import { OrderItemSnapshot } from '../../orders/types/order.types';
import { FullSettings } from '../../restaurants/types/settings.types';

export class BillingService {
  /**
   * Calculates the full billing breakdown for a set of order items
   * applying configured taxes, charges, and discounts.
   */
  public static calculateBreakdown(
    items: OrderItemSnapshot[],
    settings: FullSettings
  ): BillingBreakdown {
    // 1. Subtotal (Sum of all item total prices)
    const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);

    // 2. Discount (Future proofing, currently 0)
    // Could read from a coupon or promo code in the future
    const discountAmount = 0;

    // 3. Packing Charge (Future ready)
    // Safely default to 0 if not present in settings yet
    const packingCharge = (settings.settings as any).packingCharge || 0;

    // 4. Delivery Charge (Future ready)
    const deliveryCharge = (settings.settings as any).deliveryCharge || 0;

    // 5. Tax Calculation (GST)
    let taxAmount = 0;
    if (settings.settings.gstEnabled && settings.settings.gstPercentage) {
      // Typically tax is calculated on (subtotal - discount + packingCharge)
      // We keep it robust by applying to taxable amount
      const taxableAmount = subtotal - discountAmount + packingCharge;
      taxAmount = (taxableAmount * settings.settings.gstPercentage) / 100;
    }

    // 6. Total Amount
    const totalAmount = subtotal - discountAmount + packingCharge + deliveryCharge + taxAmount;

    return {
      subtotal: Number(subtotal.toFixed(2)),
      discountAmount: Number(discountAmount.toFixed(2)),
      packingCharge: Number(packingCharge.toFixed(2)),
      deliveryCharge: Number(deliveryCharge.toFixed(2)),
      taxAmount: Number(taxAmount.toFixed(2)),
      totalAmount: Number(totalAmount.toFixed(2)),
    };
  }
}
