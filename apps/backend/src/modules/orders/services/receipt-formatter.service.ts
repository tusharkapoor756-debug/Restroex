export interface FormatOptions {
  locale?: string;
  currency?: string;
}

export class ReceiptFormatter {
  private locale: string;
  private currency: string;
  private currencyFormatter: Intl.NumberFormat;

  constructor(options: FormatOptions = {}) {
    this.locale = options.locale || 'en-IN';
    this.currency = options.currency || 'INR';

    this.currencyFormatter = new Intl.NumberFormat(this.locale, {
      style: 'currency',
      currency: this.currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  public formatMoney(amount: number): string {
    return this.currencyFormatter.format(amount || 0);
  }

  public formatDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat(this.locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }

  public sanitizePhone(phone: string): string {
    if (!phone) return '';
    // Strip WhatsApp internal LID tokens (e.g. 82073285091419@lid -> +91 XXXXX XXXXX or clean number)
    const cleaned = phone.replace(/@.*$/, '').trim();
    if (cleaned.length === 10 && /^\d+$/.test(cleaned)) {
      return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
    }
    if (cleaned.length === 12 && cleaned.startsWith('91')) {
      return `+91 ${cleaned.slice(2, 7)} ${cleaned.slice(7)}`;
    }
    return cleaned;
  }

  public escapeHtml(str: string): string {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  public formatReceipt(order: any, paymentRefId?: string): string {
    let out = `*Order ID:* ${order.humanReadableId}\n`;
    if (order.receiptSnapshot && order.receiptSnapshot.items) {
      for (const item of order.receiptSnapshot.items) {
        out += `- ${item.name}${item.variantName ? ` (${item.variantName})` : ''} x${item.quantity}\n`;
      }
    }
    out += `Grand Total: ${this.formatMoney(order.totalAmount)}\n`;
    if (paymentRefId) {
      out += `*Ref ID:* ${paymentRefId}\n`;
    }
    return out;
  }
}

