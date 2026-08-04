import { Order } from '../types/order.types';
import { ReceiptFormatter } from './receipt-formatter.service';
import { RestaurantInvoiceProfile } from './pdf-generator.service';

export interface ThermalRenderOptions {
  paperWidth?: '58mm' | '80mm' | 'a4';
  locale?: string;
  currency?: string;
  autoPrint?: boolean;
}

export class ThermalReceiptRenderer {
  /**
   * Renders thermal-ready HTML presentation layout from order receipt_snapshot & billingBreakdown
   */
  public renderHtml(
    order: Order,
    invoiceNumber: string,
    profile?: RestaurantInvoiceProfile,
    options: ThermalRenderOptions = {}
  ): string {
    const snapshot = order.receiptSnapshot;
    if (!snapshot) {
      throw new Error(`Cannot render thermal receipt for order ${order.id}: Snapshot missing.`);
    }

    const formatter = new ReceiptFormatter({
      locale: options.locale || 'en-IN',
      currency: options.currency || 'INR',
    });

    const billing = (snapshot as any).billingBreakdown;
    const paperWidth = options.paperWidth || '80mm';
    const containerWidth = paperWidth === '58mm' ? '58mm' : paperWidth === 'a4' ? '210mm' : '80mm';
    const fontSize = paperWidth === '58mm' ? '11px' : '12px';

    const generatedAt = formatter.formatDate(snapshot.generatedAt);

    // Calculate Net Items Base Subtotal for Inclusive Tax presentation
    let totalInclusiveTax = 0;
    if (Array.isArray(billing?.taxes)) {
      for (const tax of billing.taxes) {
        if (tax.pricingType === 'inclusive') {
          totalInclusiveTax += Number(tax.calculatedAmount) || 0;
        }
      }
    }
    const itemsBaseSubtotal = Number(((billing?.netSubtotal || snapshot.totalAmount) - totalInclusiveTax).toFixed(2));

    // Render Items Table Rows (Supporting long names, variants, add-ons, notes)
    const itemRowsHtml = snapshot.items
      .map((item, idx) => {
        const itemBase = billing?.itemBases?.[idx]?.itemBasePrice;
        const displayPrice = itemBase !== undefined ? itemBase : item.totalPrice;

        const name = formatter.escapeHtml(item.name);
        const variant = item.variantName ? `<div class="sub-detail">+ ${formatter.escapeHtml(item.variantName)}</div>` : '';
        const addOns = Array.isArray((item as any).addOns)
          ? (item as any).addOns.map((a: any) => `<div class="sub-detail">+ ${formatter.escapeHtml(a.name)}</div>`).join('')
          : '';
        const notes = (item as any).notes ? `<div class="sub-note">Note: ${formatter.escapeHtml((item as any).notes)}</div>` : '';

        return `
          <div class="item-block">
            <div class="item-main-row">
              <span class="col-name">${idx + 1}. ${name}</span>
              <span class="col-qty">${item.quantity}</span>
              <span class="col-price">${formatter.formatMoney(item.unitPrice)}</span>
              <span class="col-total">${formatter.formatMoney(displayPrice)}</span>
            </div>
            ${variant}
            ${addOns}
            ${notes}
          </div>
        `;
      })
      .join('');

    // Build Financial Summary Rows directly from BillingBreakdown
    let financialHtml = '';
    if (billing) {
      financialHtml += `
        <div class="summary-row">
          <span>Items Base Subtotal</span>
          <strong>${formatter.formatMoney(itemsBaseSubtotal)}</strong>
        </div>
      `;

      if (Array.isArray(billing.fees)) {
        for (const fee of billing.fees) {
          const typeStr = fee.calculationType === 'percentage' ? ` (${fee.value}%)` : '';
          financialHtml += `
            <div class="summary-row">
              <span>${formatter.escapeHtml(fee.name)}${typeStr}</span>
              <strong>+${formatter.formatMoney(fee.calculatedAmount)}</strong>
            </div>
          `;
        }
      }

      if (Array.isArray(billing.taxes)) {
        for (const tax of billing.taxes) {
          financialHtml += `
            <div class="summary-row tax-row">
              <span>${formatter.escapeHtml(tax.name)} (${tax.value}% ${tax.pricingType.toUpperCase()})</span>
              <strong>+${formatter.formatMoney(tax.calculatedAmount)}</strong>
            </div>
          `;
        }
      }

      if (billing.roundOffAmount && billing.roundOffAmount !== 0) {
        const sign = billing.roundOffAmount > 0 ? '+' : '';
        financialHtml += `
          <div class="summary-row">
            <span>Round Off (${billing.roundOffMode})</span>
            <strong>${sign}${formatter.formatMoney(billing.roundOffAmount)}</strong>
          </div>
        `;
      }
    } else {
      financialHtml = `
        <div class="summary-row">
          <span>Subtotal</span>
          <strong>${formatter.formatMoney(snapshot.totalAmount)}</strong>
        </div>
      `;
    }

    // Dynamic Header details
    const storeName = profile?.name || 'TAX INVOICE';
    const addressStr = [profile?.address, profile?.city, profile?.state, profile?.pincode].filter(Boolean).join(', ');
    const gstStr = profile?.gstNumber ? `<div>GSTIN: ${formatter.escapeHtml(profile.gstNumber)}</div>` : '';
    const fssaiStr = profile?.fssaiNumber ? `<div>FSSAI: ${formatter.escapeHtml(profile.fssaiNumber)}</div>` : '';
    const phoneStr = profile?.phoneNumber ? `<div>Phone: ${formatter.escapeHtml(profile.phoneNumber)}</div>` : '';

    const contactPhoneRaw = (snapshot as any).customerContactPhone || (order as any).customerContactPhone || snapshot.customerPhone || '';
    const cleanPhone = formatter.sanitizePhone(contactPhoneRaw);
    const customerNameStr = (snapshot as any).customerName || (order as any).customerName || profile?.customerName;

    const customerDisplay = customerNameStr
      ? `${formatter.escapeHtml(customerNameStr)} (${cleanPhone})`
      : cleanPhone;

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Receipt ${formatter.escapeHtml(invoiceNumber)}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Courier New', Courier, monospace, sans-serif;
            font-size: ${fontSize};
            color: #000;
            background: #fff;
            padding: 8px;
            display: flex;
            justify-content: center;
          }
          .thermal-receipt {
            width: ${containerWidth};
            max-width: 100%;
            padding: 4px;
          }
          .header { text-align: center; margin-bottom: 8px; }
          .header h1 { font-size: 16px; font-weight: bold; text-transform: uppercase; margin-bottom: 2px; }
          .header p { font-size: 10px; color: #333; margin-top: 2px; }
          .divider { border-top: 1px dashed #000; margin: 6px 0; }
          .meta-section { margin-bottom: 6px; font-size: 11px; }
          .meta-row { display: flex; justify-content: space-between; margin-bottom: 2px; }
          .table-header { display: flex; font-weight: bold; border-bottom: 1px dashed #000; padding-bottom: 4px; margin-bottom: 4px; font-size: 11px; }
          .col-name { flex: 1; text-align: left; overflow: hidden; }
          .col-qty { width: 30px; text-align: center; }
          .col-price { width: 70px; text-align: right; }
          .col-total { width: 80px; text-align: right; }
          .item-block { margin-bottom: 4px; }
          .item-main-row { display: flex; align-items: flex-start; }
          .sub-detail { font-size: 10px; color: #444; margin-left: 14px; }
          .sub-note { font-size: 9px; font-style: italic; color: #555; margin-left: 14px; }
          .summary-section { margin-top: 6px; }
          .summary-row { display: flex; justify-content: space-between; margin-bottom: 3px; font-size: 11px; }
          .tax-row { color: #15803d; }
          .grand-total-row { display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 6px 0; margin-top: 6px; }
          .footer { text-align: center; margin-top: 12px; font-size: 10px; }
        </style>
      </head>
      <body>
        <main class="thermal-receipt">
          <header class="header">
            <h1>${formatter.escapeHtml(storeName)}</h1>
            ${addressStr ? `<p>${formatter.escapeHtml(addressStr)}</p>` : ''}
            ${phoneStr}
            ${gstStr}
            ${fssaiStr}
          </header>

          <div class="divider"></div>

          <section class="meta-section">
            <div class="meta-row"><span>Invoice No:</span><strong>${formatter.escapeHtml(invoiceNumber)}</strong></div>
            <div class="meta-row"><span>Order ID:</span><strong>${formatter.escapeHtml(snapshot.humanReadableId)}</strong></div>
            <div class="meta-row"><span>Date:</span><span>${generatedAt}</span></div>
            <div class="meta-row"><span>Customer Name:</span><strong>${formatter.escapeHtml(customerNameStr)}</strong></div>
            <div class="meta-row"><span>Mobile Number:</span><strong>${cleanPhone}</strong></div>
            <div class="meta-row"><span>Pay Status:</span><strong>PAID (ONLINE)</strong></div>
          </section>

          <div class="divider"></div>

          <section class="items-section">
            <div class="table-header">
              <span class="col-name">ITEM</span>
              <span class="col-qty">QTY</span>
              <span class="col-price">PRICE</span>
              <span class="col-total">TOTAL</span>
            </div>
            ${itemRowsHtml}
          </section>

          <div class="divider"></div>

          <section class="summary-section">
            ${financialHtml}
            <div class="grand-total-row">
              <span>TOTAL PAYABLE</span>
              <span>${formatter.formatMoney(snapshot.totalAmount)}</span>
            </div>
          </section>

          <footer class="footer">
            <p>Thank you for dining with us!</p>
            <p style="margin-top: 4px; font-size: 9px; color: #666;">Powered by Restroex AI Restaurant Operating System</p>
          </footer>
        </main>
      </body>
      </html>
    `;
  }
}

export const thermalReceiptRenderer = new ThermalReceiptRenderer();
