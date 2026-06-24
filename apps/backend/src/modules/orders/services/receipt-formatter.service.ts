import { Order } from '../types/order.types';

export class ReceiptFormatterService {
  /**
   * Generates a clean, highly readable text receipt for WhatsApp notifications.
   * Leverages the immutable database snapshots to guarantee old receipts never drift.
   */
  public formatReceipt(order: Order, paymentReference?: string): string {
    const snapshot = order.receiptSnapshot;
    if (!snapshot) {
      return this.formatLegacyReceipt(order);
    }

    const dateStr = new Date(snapshot.generatedAt || order.createdAt).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
    });

    let receipt = `🧾 *BILL RECEIPT - RESTROEX*\n`;
    receipt += `--------------------------------\n`;
    receipt += `*Order ID:* ${snapshot.humanReadableId}\n`;
    receipt += `*Phone:* ${snapshot.customerPhone}\n`;
    receipt += `*Date:* ${dateStr}\n`;
    receipt += `--------------------------------\n\n`;

    snapshot.items.forEach((item: any, index: number) => {
      const variantStr = item.variantName ? ` (${item.variantName})` : '';
      receipt += `*${index + 1}. ${item.name}${variantStr}*\n`;
      receipt += `   ${item.quantity} x ₹${Number(item.unitPrice).toFixed(2)} = ₹${Number(item.totalPrice).toFixed(2)}\n`;
    });

    receipt += `\n--------------------------------\n`;
    receipt += `*Subtotal:* ₹${Number(snapshot.totalAmount).toFixed(2)}\n`;
    receipt += `*CGST/SGST (0%):* ₹0.00\n`;
    receipt += `*Grand Total: ₹${Number(snapshot.totalAmount).toFixed(2)}*\n`;
    receipt += `--------------------------------\n`;
    
    const paymentStatusStr = order.status === 'paid' ? 'PAID ✅' : order.status.toUpperCase();
    receipt += `*Payment Status:* ${paymentStatusStr}\n`;
    
    if (paymentReference) {
      receipt += `*Ref ID:* ${paymentReference}\n`;
    }
    
    receipt += `\nThank you for ordering with us! 🙏`;

    return receipt;
  }

  /**
   * Fallback formatter when order is missing receipt snapshot details (legacy compatibility)
   */
  private formatLegacyReceipt(order: Order): string {
    let receipt = `🧾 *ORDER SNAPSHOT - ORD*\n`;
    receipt += `*Order Ref:* ${order.humanReadableId}\n`;
    receipt += `*Grand Total: ₹${order.totalAmount.toFixed(2)}*\n`;
    receipt += `*Status:* ${order.status.toUpperCase()}\n`;
    return receipt;
  }
}
