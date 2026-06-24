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

  public renderMobileReceipt(order: Order): string {
    const snapshot = this.requireSnapshot(order);
    const itemsRows = snapshot.items.map((item) => this.renderMobileItem(item)).join('');
    const generatedAt = this.formatDate(snapshot.generatedAt);

    return this.renderDocument({
      title: `Receipt - ${snapshot.humanReadableId}`,
      bodyClass: 'customer-page',
      styles: this.customerStyles(),
      body: `
        <main class="receipt-card" aria-label="Receipt ${this.escape(snapshot.humanReadableId)}">
          <header class="receipt-header">
            <p class="eyebrow">Receipt</p>
            <h1>${this.escape(snapshot.humanReadableId)}</h1>
            <p>${generatedAt}</p>
          </header>

          <section class="meta-grid" aria-label="Order details">
            <div>
              <span>Customer</span>
              <strong>${this.maskPhone(snapshot.customerPhone)}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>${this.escape(order.status.toUpperCase())}</strong>
            </div>
          </section>

          <div class="divider"></div>

          <section class="items" aria-label="Receipt items">
            ${itemsRows}
          </section>

          <div class="divider"></div>

          <section class="totals" aria-label="Receipt total">
            <div class="total-row">
              <span>Subtotal</span>
              <strong>${this.formatMoney(snapshot.totalAmount)}</strong>
            </div>
            <div class="total-row grand-total">
              <span>Grand total</span>
              <strong>${this.formatMoney(snapshot.totalAmount)}</strong>
            </div>
          </section>

          <section class="actions" aria-label="Receipt actions">
            <button type="button" onclick="window.print()">Print or Save PDF</button>
          </section>

          <p class="print-note">Use your browser print dialog to save this receipt as PDF.</p>
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
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; background: #f4f6f8; color: #17202a; font-family: Arial, Helvetica, sans-serif; }
      .customer-page { display: flex; justify-content: center; padding: 16px; }
      .receipt-card { width: min(100%, 460px); background: #fff; border: 1px solid #dfe4ea; border-radius: 8px; padding: 20px; }
      .receipt-header { text-align: center; }
      .eyebrow { margin: 0 0 4px; color: #5f6b7a; font-size: 12px; text-transform: uppercase; }
      h1 { margin: 0 0 6px; font-size: 26px; line-height: 1.15; }
      p { margin: 0; color: #5f6b7a; }
      .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 18px; }
      .meta-grid div { border: 1px solid #e5e9ef; border-radius: 6px; padding: 10px; min-width: 0; }
      .meta-grid span { display: block; color: #6b7684; font-size: 12px; margin-bottom: 4px; }
      .meta-grid strong, .item strong { overflow-wrap: anywhere; }
      .divider { border-top: 1px dashed #aeb7c2; margin: 18px 0; }
      .item { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; padding: 10px 0; border-bottom: 1px solid #edf0f3; }
      .item:last-child { border-bottom: 0; }
      .item-main { min-width: 0; overflow-wrap: anywhere; }
      .variant { display: block; color: #66717f; font-size: 13px; margin-top: 3px; overflow-wrap: anywhere; }
      .item-price { text-align: right; white-space: nowrap; }
      .item-price span { display: block; color: #66717f; font-size: 13px; margin-bottom: 4px; }
      .total-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 8px 0; }
      .grand-total { font-size: 20px; }
      .actions { margin-top: 20px; }
      button { width: 100%; min-height: 44px; border: 0; border-radius: 6px; background: #111827; color: #fff; font-weight: 700; cursor: pointer; }
      .print-note { margin-top: 10px; text-align: center; font-size: 12px; }
      @media (max-width: 360px) {
        .receipt-card { padding: 14px; }
        .meta-grid, .item { grid-template-columns: 1fr; }
        .item-price { text-align: left; white-space: normal; }
      }
      @media print {
        body { background: #fff; }
        .customer-page { display: block; padding: 0; }
        .receipt-card { width: 100%; max-width: none; border: 0; border-radius: 0; padding: 0; }
        .actions, .print-note { display: none; }
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
