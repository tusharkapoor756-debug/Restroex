import crypto from 'crypto';
import { Order, ReceiptSnapshot, ReceiptSnapshotItem } from '../types/order.types';
import { BadRequestError, ForbiddenError } from '../../../shared/errors/app-error';

export type ReceiptTokenScope = 'customer_receipt' | 'thermal_receipt';

interface ReceiptTokenPayload {
  orderId: string;
  scope: ReceiptTokenScope;
  exp: number;
  nonce: string;
}

interface ReceiptRenderOptions {
  autoPrint?: boolean;
}

export class ReceiptRenderService {
  private readonly secretKey: string;

  constructor() {
    this.secretKey =
      process.env.RECEIPT_SIGNING_SECRET ||
      process.env.WHATSAPP_APP_SECRET ||
      'restroex-development-receipt-secret';
  }

  public generateSignedToken(
    orderId: string,
    scope: ReceiptTokenScope = 'customer_receipt',
    ttlMs: number = 7 * 24 * 60 * 60 * 1000
  ): string {
    const payload: ReceiptTokenPayload = {
      orderId,
      scope,
      exp: Date.now() + ttlMs,
      nonce: crypto.randomBytes(12).toString('hex'),
    };

    const encodedPayload = this.base64UrlEncode(JSON.stringify(payload));
    const signature = this.sign(encodedPayload);
    return `${encodedPayload}.${signature}`;
  }

  public generateSignedReceiptUrl(
    orderId: string,
    baseUrl: string,
    scope: ReceiptTokenScope = 'customer_receipt',
    ttlMs?: number
  ): string {
    const token = this.generateSignedToken(orderId, scope, ttlMs);
    const normalizedBase = baseUrl.replace(/\/$/, '');
    const path =
      scope === 'thermal_receipt'
        ? `/api/v1/receipts/${encodeURIComponent(orderId)}/thermal`
        : `/api/v1/receipts/${encodeURIComponent(orderId)}`;

    return `${normalizedBase}${path}?token=${encodeURIComponent(token)}`;
  }

  public verifySignedToken(orderId: string, token: string, expectedScope: ReceiptTokenScope): boolean {
    if (!token) return false;

    const [encodedPayload, incomingSignature] = token.split('.');
    if (!encodedPayload || !incomingSignature) return false;

    const computedSignature = this.sign(encodedPayload);
    if (!this.safeEqual(computedSignature, incomingSignature)) return false;

    const payload = this.parseTokenPayload(encodedPayload);
    if (!payload) return false;

    return payload.orderId === orderId && payload.scope === expectedScope && payload.exp > Date.now();
  }

  public assertValidToken(orderId: string, token: string, expectedScope: ReceiptTokenScope): void {
    if (!this.verifySignedToken(orderId, token, expectedScope)) {
      throw new ForbiddenError('Receipt link is invalid or expired');
    }
  }

  public renderMobileReceipt(order: Order, profile?: any): string {
    const snapshot = this.requireSnapshot(order);
    const billing = (snapshot as any).billingBreakdown;
    const invoiceNumber = (order as any).invoiceNumber || `INV-${this.escape(snapshot.humanReadableId)}`;
    const storeName = profile?.name || 'TAX INVOICE';
    const addressStr = [profile?.address, profile?.city, profile?.state, profile?.pincode].filter(Boolean).join(', ');
    const gstStr = profile?.gstNumber ? `<div class="store-info">GSTIN: ${this.escape(profile.gstNumber)}</div>` : '';
    const fssaiStr = profile?.fssaiNumber ? `<div class="store-info">FSSAI: ${this.escape(profile.fssaiNumber)}</div>` : '';
    const phoneStr = profile?.phoneNumber ? `<div class="store-info">Phone: ${this.escape(profile.phoneNumber)}</div>` : '';

    const itemsRows = snapshot.items.map((item, idx) => {
      const itemBase = billing?.itemBases?.[idx]?.itemBasePrice;
      const displayPrice = itemBase !== undefined ? itemBase : item.totalPrice;
      return `
        <div class="item-row">
          <div class="item-top">
            <span class="item-desc">${idx + 1}. ${this.escape(item.name)}</span>
            <span class="col-qty">${item.quantity}</span>
            <span class="col-price">${this.formatMoney(item.unitPrice)}</span>
            <span class="col-total">${this.formatMoney(displayPrice)}</span>
          </div>
          ${item.variantName ? `<div class="item-variant">• ${this.escape(item.variantName)}</div>` : ''}
        </div>
      `;
    }).join('');

    const generatedAt = this.formatDate(snapshot.generatedAt);

    // Build pure breakdown rows
    let breakdownHtml = '';
    if (billing) {
      // Calculate net base subtotal (subtracting inclusive taxes from gross if applicable)
      let totalInclusiveTax = 0;
      if (Array.isArray(billing.taxes)) {
        for (const tax of billing.taxes) {
          if (tax.pricingType === 'inclusive') {
            totalInclusiveTax += Number(tax.calculatedAmount) || 0;
          }
        }
      }
      const itemsBaseSubtotal = Number((billing.netSubtotal - totalInclusiveTax).toFixed(2));

      breakdownHtml += `
        <div class="row-flex">
          <span>Items Base Subtotal</span>
          <strong>${this.formatMoney(itemsBaseSubtotal)}</strong>
        </div>
      `;

      if (Array.isArray(billing.fees)) {
        for (const fee of billing.fees) {
          breakdownHtml += `
            <div class="row-flex">
              <span>${this.escape(fee.name)} (${fee.calculationType === 'percentage' ? fee.value + '%' : 'Fixed'})</span>
              <strong>+${this.formatMoney(fee.calculatedAmount)}</strong>
            </div>
          `;
        }
      }

      if (Array.isArray(billing.taxes)) {
        for (const tax of billing.taxes) {
          breakdownHtml += `
            <div class="row-flex">
              <span>${this.escape(tax.name)} (${tax.value}% ${this.escape(tax.pricingType.toUpperCase())})</span>
              <strong>+${this.formatMoney(tax.calculatedAmount)}</strong>
            </div>
          `;
        }
      }

      if (billing.roundOffAmount !== 0) {
        breakdownHtml += `
          <div class="row-flex">
            <span>Round Off (${this.escape(billing.roundOffMode)})</span>
            <strong>${billing.roundOffAmount > 0 ? '+' : ''}${this.formatMoney(billing.roundOffAmount)}</strong>
          </div>
        `;
      }
    } else {
      breakdownHtml = `
        <div class="row-flex">
          <span>Subtotal</span>
          <strong>${this.formatMoney(snapshot.totalAmount)}</strong>
        </div>
      `;
    }

    const { ReceiptFormatter } = require('./receipt-formatter.service');
    const formatter = new ReceiptFormatter();
    const contactPhoneRaw = (snapshot as any).customerContactPhone || order.customerContactPhone || snapshot.customerPhone || '';
    const cleanPhone = formatter.sanitizePhone(contactPhoneRaw);

    return this.renderDocument({
      title: `Tax Invoice - ${invoiceNumber}`,
      bodyClass: '',
      styles: this.customerStyles(),
      body: `
        <main class="thermal-slip" aria-label="Tax Invoice ${this.escape(invoiceNumber)}">
          <header class="store-header">
            <div class="store-name">${this.escape(storeName.toUpperCase())}</div>
            ${addressStr ? `<div class="store-info">${this.escape(addressStr)}</div>` : ''}
            ${phoneStr}
            ${gstStr}
            ${fssaiStr}
          </header>

          <div class="dashed-divider"></div>

          <section class="meta-block">
            <div class="row-flex"><span>Invoice No:</span><strong>${this.escape(invoiceNumber)}</strong></div>
            <div class="row-flex"><span>Order ID:</span><strong>${this.escape(snapshot.humanReadableId)}</strong></div>
            <div class="row-flex"><span>Date:</span><span>${generatedAt}</span></div>
            <div class="row-flex"><span>Customer Name:</span><strong>${this.escape((snapshot as any).customerName || (order as any).customerName || 'Guest Customer')}</strong></div>
            <div class="row-flex"><span>Mobile Number:</span><strong>${this.escape(cleanPhone)}</strong></div>
            <div class="row-flex"><span>Pay Status:</span><strong>PAID (ONLINE)</strong></div>
          </section>

          <div class="dashed-divider"></div>

          <section class="items-block">
            <div class="table-hdr">
              <span class="col-item">ITEM</span>
              <span class="col-qty">QTY</span>
              <span class="col-price">PRICE</span>
              <span class="col-total">TOTAL</span>
            </div>
            ${itemsRows}
          </section>

          <div class="dashed-divider"></div>

          <section class="summary-block">
            ${breakdownHtml}
            <div class="row-flex grand-total">
              <span>TOTAL PAYABLE</span>
              <strong>${this.formatMoney(snapshot.totalAmount)}</strong>
            </div>
          </section>

          <div class="double-divider"></div>

          <footer class="footer-note">
            <p>Thank you for dining with us!</p>
            <p style="margin-top: 2px;">Powered by Restroex AI Restaurant Operating System</p>
          </footer>

          <div class="actions">
            <button type="button" onclick="window.print()">Print Thermal Receipt</button>
          </div>
        </main>
      `,
    });
  }

  public renderThermalReceipt(order: Order, options: ReceiptRenderOptions = {}): string {
    const snapshot = this.requireSnapshot(order);
    const itemsRows = snapshot.items.map((item) => this.renderThermalItem(item)).join('');
    const generatedAt = this.formatDate(snapshot.generatedAt);
    const pickupCode = this.escape(snapshot.humanReadableId.split('-')[1] || snapshot.humanReadableId);

    return this.renderDocument({
      title: `Thermal Receipt - ${snapshot.humanReadableId}`,
      bodyClass: 'thermal-page',
      styles: this.thermalStyles(),
      body: `
        <main class="thermal-receipt" aria-label="Thermal receipt ${this.escape(snapshot.humanReadableId)}">
          <header class="center">
            <strong class="brand">RESTROEX</strong>
            ${order.orderType === 'dining' ? `<strong style="font-size: 16px; margin: 4px 0;">*** DINING - TABLE ${order.tableNumber || '?'} ***</strong>` : `<strong style="font-size: 16px; margin: 4px 0;">*** TAKEAWAY ORDER ***</strong>`}
            <span>KITCHEN RECEIPT</span>
            <span class="muted">${generatedAt}</span>
          </header>

          <div class="rule"></div>

          <section class="center">
            <span>PICKUP CODE</span>
            <strong class="pickup-code">${pickupCode}</strong>
            <span>Order ${this.escape(snapshot.humanReadableId)}</span>
          </section>

          <div class="rule"></div>

          <section class="items" aria-label="Kitchen items">
            ${itemsRows}
          </section>

          <div class="rule"></div>

          <section class="totals">
            <div class="row total">
              <span>TOTAL</span>
              <strong>${this.formatMoney(snapshot.totalAmount)}</strong>
            </div>
            <div class="row">
              <span>Status</span>
              <strong>${this.escape(order.status.toUpperCase())}</strong>
            </div>
          </section>

          <div class="rule"></div>

          <footer class="center footer">
            <span>Thank you</span>
            <span>Powered by Restroex</span>
          </footer>
        </main>

        <section class="print-controls" aria-label="Print controls">
          <p id="print-status">If print does not open automatically, use the button below.</p>
          <button type="button" onclick="window.print()">Print Receipt</button>
        </section>

        <script>
          (function () {
            var shouldAutoPrint = ${options.autoPrint === false ? 'false' : 'true'};
            if (!shouldAutoPrint) return;
            window.addEventListener('load', function () {
              window.setTimeout(function () {
                try {
                  window.print();
                  var status = document.getElementById('print-status');
                  if (status) status.textContent = 'Print dialog requested. Use the button if your browser blocked it.';
                } catch (error) {
                  var status = document.getElementById('print-status');
                  if (status) status.textContent = 'Automatic printing was blocked. Use the button below.';
                }
              }, 350);
            });
          })();
        </script>
      `,
    });
  }

  private requireSnapshot(order: Order): ReceiptSnapshot {
    if (!order.receiptSnapshot || !Array.isArray(order.receiptSnapshot.items)) {
      throw new BadRequestError('Receipt snapshot is missing for this order');
    }

    return order.receiptSnapshot;
  }

  private renderMobileItem(item: ReceiptSnapshotItem): string {
    const variant = item.variantName ? `<span class="variant">${this.escape(item.variantName)}</span>` : '';

    return `
      <article class="item">
        <div class="item-main">
          <strong>${this.escape(item.name)}</strong>
          ${variant}
        </div>
        <div class="item-price">
          <span>${item.quantity} x ${this.formatMoney(item.unitPrice)}</span>
          <strong>${this.formatMoney(item.totalPrice)}</strong>
        </div>
      </article>
    `;
  }

  private renderThermalItem(item: ReceiptSnapshotItem): string {
    const variant = item.variantName ? `<span class="variant">${this.escape(item.variantName)}</span>` : '';

    return `
      <article class="thermal-item">
        <div class="thermal-name">
          <strong>${this.escape(item.name)}</strong>
          ${variant}
        </div>
        <div class="row calc">
          <span>${item.quantity} x ${this.formatMoney(item.unitPrice)}</span>
          <strong>${this.formatMoney(item.totalPrice)}</strong>
        </div>
      </article>
    `;
  }

  private renderDocument(input: { title: string; bodyClass: string; styles: string; body: string }): string {
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${this.escape(input.title)}</title>
  <style>${input.styles}</style>
</head>
<body class="${input.bodyClass}">
${input.body}
</body>
</html>`;
  }

  private customerStyles(): string {
    return `
      :root { color-scheme: light; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        background: #eef1f5;
        color: #000;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        font-size: 11px;
        line-height: 1.35;
        display: flex;
        justify-content: center;
        padding: 16px 8px;
        -webkit-font-smoothing: antialiased;
      }
      .thermal-slip {
        width: 80mm;
        max-width: 100%;
        background: #ffffff;
        padding: 14px 12px;
        border: 0;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      }
      .store-header { text-align: center; margin-bottom: 6px; }
      .store-name { font-size: 16px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
      .store-info { font-size: 10px; color: #333; margin-top: 1px; }
      .dashed-divider { border-top: 1px dashed #000; margin: 6px 0; }
      .double-divider { border-top: 2px dashed #000; margin: 6px 0; }
      .meta-block { font-size: 10.5px; margin: 4px 0; }
      .row-flex { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 2.5px; }
      .row-flex span:first-child { color: #222; }
      .row-flex strong { font-weight: 700; color: #000; }
      .table-hdr { display: flex; font-weight: 700; border-bottom: 1px dashed #000; padding-bottom: 3px; margin-bottom: 4px; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.3px; }
      .col-item { flex: 1; min-width: 0; text-align: left; }
      .col-qty { width: 32px; text-align: center; }
      .col-price { width: 62px; text-align: right; }
      .col-total { width: 68px; text-align: right; }
      .item-row { margin-bottom: 4px; font-size: 11px; }
      .item-top { display: flex; align-items: flex-start; }
      .item-desc { flex: 1; min-width: 0; overflow-wrap: anywhere; word-break: break-word; font-weight: 600; padding-right: 4px; }
      .item-variant { font-size: 10px; color: #444; margin-left: 12px; margin-top: 1px; }
      .summary-block { font-size: 10.5px; margin-top: 4px; }
      .grand-total { font-size: 13.5px; font-weight: 800; border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 5px 0; margin-top: 5px; text-transform: uppercase; }
      .footer-note { text-align: center; margin-top: 8px; font-size: 9.5px; color: #333; }
      .actions { margin-top: 12px; }
      button { width: 100%; padding: 8px; border: 1px solid #000; background: #000; color: #fff; font-family: inherit; font-size: 11px; font-weight: 700; cursor: pointer; border-radius: 2px; }
      @media print {
        body { background: #fff; padding: 0; }
        .thermal-slip { width: 80mm; padding: 4px; box-shadow: none; }
        .actions { display: none; }
      }
    `;
  }

  private thermalStyles(): string {
    return `
      * { box-sizing: border-box; }
      body { margin: 0; background: #f4f4f4; color: #000; font-family: "Courier New", Courier, monospace; }
      .thermal-page { display: flex; flex-direction: column; align-items: center; padding: 12px; }
      .thermal-receipt { width: 80mm; max-width: 100%; background: #fff; padding: 3mm; font-size: 12px; line-height: 1.25; }
      .center { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 2px; }
      .brand { font-size: 16px; letter-spacing: 0; }
      .muted { font-size: 11px; }
      .pickup-code { display: block; font-size: 26px; line-height: 1.1; margin: 2mm 0; }
      .rule { border-top: 1px dashed #000; margin: 2mm 0; }
      .thermal-item { break-inside: avoid; page-break-inside: avoid; padding: 1.5mm 0; }
      .thermal-name { overflow-wrap: anywhere; word-break: break-word; }
      .variant { display: block; font-size: 11px; overflow-wrap: anywhere; word-break: break-word; }
      .row { display: flex; justify-content: space-between; gap: 3mm; }
      .row span:first-child { min-width: 0; overflow-wrap: anywhere; }
      .row strong:last-child { white-space: nowrap; }
      .calc { font-size: 11px; margin-top: 1mm; }
      .total { font-size: 14px; }
      .footer { padding-bottom: 10mm; font-size: 11px; }
      .print-controls { width: 80mm; max-width: 100%; margin-top: 12px; padding: 10px; background: #fff; border: 1px solid #d7d7d7; font-family: Arial, Helvetica, sans-serif; }
      .print-controls p { margin: 0 0 8px; font-size: 13px; color: #333; }
      .print-controls button { width: 100%; min-height: 40px; border: 0; border-radius: 4px; background: #000; color: #fff; font-weight: 700; cursor: pointer; }
      @page { size: 80mm auto; margin: 0; }
      @media print {
        body { background: #fff; }
        .thermal-page { display: block; padding: 0; }
        .thermal-receipt { width: 80mm; padding: 2mm; }
        .print-controls { display: none; }
      }
    `;
  }

  private formatMoney(value: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(Number(value || 0));
  }

  private formatDate(value: string): string {
    return new Date(value).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  private maskPhone(phone: string): string {
    if (phone.length <= 4) return this.escape(phone);
    return this.escape(`${'*'.repeat(Math.max(0, phone.length - 4))}${phone.slice(-4)}`);
  }

  private escape(value: string | number | null | undefined): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private sign(encodedPayload: string): string {
    return this.base64UrlEncode(
      crypto.createHmac('sha256', this.secretKey).update(encodedPayload).digest()
    );
  }

  private parseTokenPayload(encodedPayload: string): ReceiptTokenPayload | null {
    try {
      const parsed = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as ReceiptTokenPayload;
      if (!parsed.orderId || !parsed.scope || typeof parsed.exp !== 'number') return null;
      return parsed;
    } catch {
      return null;
    }
  }

  private safeEqual(a: string, b: string): boolean {
    try {
      return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
    } catch {
      return false;
    }
  }

  private base64UrlEncode(input: string | Buffer): string {
    return Buffer.from(input).toString('base64url');
  }
}
