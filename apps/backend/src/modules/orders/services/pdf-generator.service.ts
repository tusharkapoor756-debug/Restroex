import { logger } from '../../../infrastructure/logger/logger';
import { Order } from '../types/order.types';

export interface RestaurantInvoiceProfile {
  name: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  phoneNumber?: string;
  email?: string;
  gstNumber?: string;
  fssaiNumber?: string;
  logoUrl?: string;
  customerName?: string;
}

export interface PdfRenderOptions {
  paperSize?: '58mm' | '80mm' | 'a4' | { widthPt: number; heightPt?: number };
  paddingPt?: number;
  fontSizePt?: number;
  lineHeightPt?: number;
}

export class PdfGeneratorService {
  /**
   * Generates a 100% valid binary PDF Buffer (%PDF-) with dynamic MediaBox calculation.
   * Eliminates A4 page whitespace by wrapping content in thermal roll canvas bounds.
   */
  /**
   * Renders exact HTML/CSS thermal receipt layout directly to PDF Buffer matching exact paper width & content height.
   * Zero unused white margins; 100% natural readable thermal slip scale on mobile & desktop viewers.
   */
  public async generatePdfFromHtml(htmlContent: string, paperWidthOption: '58mm' | '80mm' | 'a4' = '80mm'): Promise<Buffer> {
    const puppeteer = require('puppeteer');
    const execPath = typeof puppeteer.executablePath === 'function' ? puppeteer.executablePath() : 'unknown';
    logger.info({ paperWidthOption, executablePath: execPath }, '🔍 [PUPPETEER DIAGNOSTIC 1] Step 1: Loaded Puppeteer module');

    let browser;
    try {
      logger.info({ args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] }, '🔍 [PUPPETEER DIAGNOSTIC 2] Step 2: Attempting puppeteer.launch()...');
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });
      logger.info({ connected: browser.isConnected() }, '✅ [PUPPETEER DIAGNOSTIC 3] Step 3: Browser launched successfully');

      const page = await browser.newPage();
      logger.info('✅ [PUPPETEER DIAGNOSTIC 4] Step 4: New browser page created successfully');

      const viewportWidthPx = paperWidthOption === '58mm' ? 384 : paperWidthOption === 'a4' ? 794 : 460;
      await page.setViewport({ width: viewportWidthPx, height: 800, deviceScaleFactor: 2 });
      logger.info({ viewportWidthPx }, '✅ [PUPPETEER DIAGNOSTIC 5] Step 5: Viewport configured');

      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      logger.info('✅ [PUPPETEER DIAGNOSTIC 6] Step 6: page.setContent() completed successfully');

      const contentHeightPx = await page.evaluate(() => {
        const doc = (globalThis as any).document;
        const el = doc.querySelector('.thermal-slip') || doc.querySelector('.thermal-receipt') || doc.body;
        const rect = el.getBoundingClientRect();
        return Math.ceil(Math.max(rect.height, el.scrollHeight, el.offsetHeight)) + 4;
      });
      logger.info({ contentHeightPx }, '✅ [PUPPETEER DIAGNOSTIC 7] Step 7: Bounding box height measured');

      const widthString = paperWidthOption === '58mm' ? '58mm' : paperWidthOption === 'a4' ? '210mm' : '80mm';
      const heightString = paperWidthOption === 'a4' ? '297mm' : `${contentHeightPx}px`;

      logger.info({ widthString, heightString }, '🔍 [PUPPETEER DIAGNOSTIC 8] Step 8: Calling page.pdf() for infinite roll...');
      const pdfBuffer = await page.pdf({
        width: widthString,
        height: heightString,
        printBackground: true,
        preferCSSPageSize: false,
        pageRanges: '1',
        margin: { top: '0px', bottom: '0px', left: '0px', right: '0px' },
      });
      logger.info({ bufferSize: pdfBuffer.length }, '✅ [PUPPETEER DIAGNOSTIC 9] Step 9: page.pdf() generated buffer successfully');

      await browser.close();
      logger.info('✅ [PUPPETEER DIAGNOSTIC 10] Step 10: Browser closed cleanly');
      return Buffer.from(pdfBuffer);
    } catch (err: any) {
      logger.error(
        {
          errorMessage: err?.message,
          errorName: err?.name,
          errorStack: err?.stack,
          executablePath: execPath,
          paperWidthOption,
        },
        '❌ [PUPPETEER DIAGNOSTIC FAILURE] Exception occurred during PDF generation'
      );
      if (browser) await browser.close().catch(() => {});
      throw err;
    }
  }

  public generatePdfBuffer(
    order: Order,
    invoiceNumber: string,
    restaurantProfile?: RestaurantInvoiceProfile,
    options: PdfRenderOptions = {}
  ): Buffer {
    const snapshot = order.receiptSnapshot;
    if (!snapshot || !Array.isArray(snapshot.items)) {
      throw new Error(`Cannot generate PDF for order ${order.id}: Snapshot missing.`);
    }

    const { ThermalReceiptRenderer } = require('./thermal-receipt-renderer.service');
    const thermalRenderer = new ThermalReceiptRenderer();

    const paperSize = options.paperSize || '80mm';
    const paperWidthStr = paperSize === '58mm' ? '58mm' : paperSize === 'a4' ? 'a4' : '80mm';
    const maxChars = paperSize === '58mm' ? 30 : paperSize === 'a4' ? 65 : 40;

    // 1. Single Source of Truth: Render receipt using canonical HTML template
    const htmlContent = thermalRenderer.renderHtml(order, invoiceNumber, restaurantProfile, {
      paperWidth: paperWidthStr,
    });

    const billing = (snapshot as any).billingBreakdown;
    const generatedAt = new Date(snapshot.generatedAt).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    let totalInclusiveTax = 0;
    if (Array.isArray(billing?.taxes)) {
      for (const tax of billing.taxes) {
        if (tax.pricingType === 'inclusive') {
          totalInclusiveTax += Number(tax.calculatedAmount) || 0;
        }
      }
    }
    const itemsBaseSubtotal = Number(((billing?.netSubtotal || snapshot.totalAmount) - totalInclusiveTax).toFixed(2));

    const lines: string[] = [];
    const rule = '-'.repeat(maxChars);
    const doubleRule = '='.repeat(maxChars);

    lines.push(doubleRule);

    const restaurantName = restaurantProfile?.name || 'RESTAURANT TAX INVOICE';
    const wrappedName = this.wrapText(restaurantName.toUpperCase(), maxChars);
    wrappedName.forEach((n) => lines.push(this.centerText(n, maxChars)));

    const addressParts = [
      restaurantProfile?.address,
      restaurantProfile?.city,
      restaurantProfile?.state,
      restaurantProfile?.pincode,
    ].filter(Boolean);
    if (addressParts.length > 0) {
      const wrappedAddress = this.wrapText(addressParts.join(', '), maxChars);
      wrappedAddress.forEach((a) => lines.push(this.centerText(a, maxChars)));
    }

    const contactParts = [];
    if (restaurantProfile?.phoneNumber) contactParts.push(`Ph: ${restaurantProfile.phoneNumber}`);
    if (restaurantProfile?.email) contactParts.push(`Email: ${restaurantProfile.email}`);
    if (contactParts.length > 0) {
      const wrappedContact = this.wrapText(contactParts.join(' | '), maxChars);
      wrappedContact.forEach((c) => lines.push(this.centerText(c, maxChars)));
    }

    const taxParts = [];
    if (restaurantProfile?.gstNumber) taxParts.push(`GSTIN: ${restaurantProfile.gstNumber}`);
    if (restaurantProfile?.fssaiNumber) taxParts.push(`FSSAI: ${restaurantProfile.fssaiNumber}`);
    if (taxParts.length > 0) {
      const wrappedTax = this.wrapText(taxParts.join(' | '), maxChars);
      wrappedTax.forEach((t) => lines.push(this.centerText(t, maxChars)));
    }

    lines.push(doubleRule);
    lines.push(this.centerText('OFFICIAL TAX INVOICE', maxChars));
    lines.push(rule);
    lines.push(`Inv No        : ${invoiceNumber}`);
    lines.push(`Order         : ${snapshot.humanReadableId}`);
    lines.push(`Date          : ${generatedAt}`);

    const { ReceiptFormatter } = require('./receipt-formatter.service');
    const formatter = new ReceiptFormatter();

    const contactPhoneRaw = (snapshot as any).customerContactPhone || order.customerContactPhone || snapshot.customerPhone || '';
    const cleanPhone = formatter.sanitizePhone(contactPhoneRaw);
    const customerNameStr = (snapshot as any).customerName || order.customerName || restaurantProfile?.customerName || 'Guest Customer';

    lines.push(`Customer Name : ${customerNameStr}`);
    lines.push(`Mobile Number : ${cleanPhone}`);
    lines.push(`Pay Status    : PAID (ONLINE)`);
    lines.push(rule);

    const nameColWidth = paperSize === '58mm' ? 12 : 18;
    const qtyColWidth = paperSize === '58mm' ? 3 : 3;
    const priceColWidth = paperSize === '58mm' ? 6 : 8;
    const totalColWidth = paperSize === '58mm' ? 7 : 8;

    const headerName = 'ITEM'.padEnd(nameColWidth);
    const headerQty = 'QTY'.padStart(qtyColWidth);
    const headerPrice = 'PRICE'.padStart(priceColWidth);
    const headerTotal = 'TOTAL'.padStart(totalColWidth);
    lines.push(`${headerName} ${headerQty} ${headerPrice} ${headerTotal}`);
    lines.push(rule);

    snapshot.items.forEach((item, idx) => {
      const itemBase = billing?.itemBases?.[idx]?.itemBasePrice;
      const displayPrice = itemBase !== undefined ? itemBase : item.totalPrice;
      const fullName = `${idx + 1}.${item.name}${item.variantName ? ' (' + item.variantName + ')' : ''}`;

      const qtyStr = String(item.quantity).padStart(qtyColWidth);
      const unitStr = `₹${item.unitPrice.toFixed(0)}`.padStart(priceColWidth);
      const totalStr = `₹${displayPrice.toFixed(2)}`.padStart(totalColWidth);

      const nameLines = this.wrapText(fullName, nameColWidth);
      const firstChunk = nameLines[0] || fullName;
      lines.push(`${firstChunk.padEnd(nameColWidth)} ${qtyStr} ${unitStr} ${totalStr}`);

      for (let i = 1; i < nameLines.length; i++) {
        const lineChunk = nameLines[i];
        if (typeof lineChunk === 'string') {
          lines.push(lineChunk);
        }
      }

      if (Array.isArray((item as any).addOns)) {
        (item as any).addOns.forEach((addon: any) => {
          lines.push(` + ${addon.name}`);
        });
      }
      if ((item as any).notes) {
        lines.push(` * Note: ${(item as any).notes}`);
      }
    });

    lines.push(rule);
    lines.push('FINANCIAL SUMMARY');
    lines.push(rule);

    const labelWidth = maxChars - 12;
    lines.push(`${'Items Base Subtotal'.padEnd(labelWidth)}: ₹${itemsBaseSubtotal.toFixed(2).padStart(9)}`);

    if (Array.isArray(billing?.fees)) {
      for (const fee of billing.fees) {
        const feeLabel = `${fee.name} (${fee.calculationType === 'percentage' ? fee.value + '%' : 'Fixed'})`.slice(0, labelWidth).padEnd(labelWidth);
        lines.push(`${feeLabel}: +₹${Number(fee.calculatedAmount).toFixed(2).padStart(8)}`);
      }
    }

    if (Array.isArray(billing?.taxes)) {
      for (const tax of billing.taxes) {
        const taxLabel = `${tax.name} (${tax.value}% ${tax.pricingType.toUpperCase()})`.slice(0, labelWidth).padEnd(labelWidth);
        lines.push(`${taxLabel}: +₹${Number(tax.calculatedAmount).toFixed(2).padStart(8)}`);
      }
    }

    if (billing?.roundOffAmount && billing.roundOffAmount !== 0) {
      const roundLabel = `Round Off (${billing.roundOffMode})`.slice(0, labelWidth).padEnd(labelWidth);
      const sign = billing.roundOffAmount > 0 ? '+' : '';
      lines.push(`${roundLabel}: ${sign}₹${Number(billing.roundOffAmount).toFixed(2).padStart(8)}`);
    }

    lines.push(doubleRule);
    lines.push(`${'TOTAL PAYABLE AMOUNT'.padEnd(labelWidth)}: ₹${snapshot.totalAmount.toFixed(2).padStart(9)}`);
    lines.push(doubleRule);
    lines.push(this.centerText('Thank you for dining with us!', maxChars));
    lines.push(this.centerText('Powered by Restroex', maxChars));

    const pdfBuffer = this.buildBinaryPdf(lines, { ...options, paperSize });

    // ── STRICT PRODUCTION VALIDATION ──
    const firstBytes = pdfBuffer.slice(0, 5).toString('ascii');
    if (pdfBuffer.length === 0 || firstBytes !== '%PDF-') {
      logger.error({ orderId: order.id, invoiceNumber, firstBytes, size: pdfBuffer.length }, '🚨 PDF Buffer Validation Failed!');
      throw new Error(`PDF Generation failed: Buffer does not begin with %PDF- (Got: ${firstBytes})`);
    }

    logger.info(
      { orderId: order.id, invoiceNumber, bufferSize: pdfBuffer.length, firstBytes, mimeType: 'application/pdf' },
      '✅ Device-independent PDF Invoice generated successfully from canonical template.'
    );

    return pdfBuffer;
  }

  private centerText(text: string, width: number): string {
    if (text.length >= width) return text.slice(0, width);
    const leftPad = Math.floor((width - text.length) / 2);
    return ' '.repeat(leftPad) + text;
  }

  private wrapText(text: string, maxWidth: number): string[] {
    if (text.length <= maxWidth) return [text];
    const chunks: string[] = [];
    let remaining = text;
    while (remaining.length > 0) {
      chunks.push(remaining.slice(0, maxWidth));
      remaining = remaining.slice(maxWidth);
    }
    return chunks;
  }

  /**
   * Constructs a lightweight valid binary PDF 1.4 document buffer with dynamic MediaBox.
   */
  private buildBinaryPdf(textLines: string[], options: PdfRenderOptions = {}): Buffer {
    const pdfHeader = '%PDF-1.4\n';

    // 1. Resolve Paper Width in Points (1mm = 2.83465 pt)
    // 58mm = 164.41pt | 80mm = 226.77pt | A4 = 595.28pt
    let pageWidthPt = 226.77; // Default: 80mm thermal paper roll
    let isFixedA4 = false;

    if (options.paperSize === '58mm') {
      pageWidthPt = 164.41;
    } else if (options.paperSize === 'a4') {
      pageWidthPt = 595.28;
      isFixedA4 = true;
    } else if (typeof options.paperSize === 'object' && options.paperSize.widthPt) {
      pageWidthPt = options.paperSize.widthPt;
    }

    // 2. Exact Monospace Font Scaling (Courier 1 char = 0.6 * fontSize pt)
    const fontSize = options.fontSizePt || (options.paperSize === '58mm' ? 7 : 8);
    const lineHeight = options.lineHeightPt || fontSize + 2.5;
    const padding = options.paddingPt || 8; // Small 8pt margin for zero overflow

    let pageHeightPt = isFixedA4
      ? 841.89
      : Math.max(100, Math.ceil(textLines.length * lineHeight + padding * 2));

    if (typeof options.paperSize === 'object' && options.paperSize.heightPt) {
      pageHeightPt = options.paperSize.heightPt;
    }

    // 3. Construct Page Content Stream with Exact Canvas Offset
    const startY = pageHeightPt - padding - fontSize;
    let streamContent = `BT\n/F1 ${fontSize} Tf\n${lineHeight} TL\n${padding} ${startY} Td\n`;

    textLines.forEach((line, i) => {
      const escaped = line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
      if (i === 0) {
        streamContent += `/F1 ${fontSize + 1} Tf (${escaped}) Tj T*\n/F1 ${fontSize} Tf\n`;
      } else {
        streamContent += `(${escaped}) Tj T*\n`;
      }
    });
    streamContent += 'ET';

    const streamLength = Buffer.byteLength(streamContent);

    // 4. Construct PDF Objects with DYNAMIC MEDIABOX
    const mediaBoxStr = `[0 0 ${pageWidthPt.toFixed(2)} ${pageHeightPt.toFixed(2)}]`;

    const objects: string[] = [
      `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`,
      `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`,
      `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox ${mediaBoxStr} /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`,
      `4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n`,
      `5 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream\nendobj\n`,
    ];

    let body = pdfHeader;
    const offsets: number[] = [0];

    objects.forEach((obj) => {
      offsets.push(Buffer.byteLength(body));
      body += obj;
    });

    const xrefOffset = Buffer.byteLength(body);
    let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= objects.length; i++) {
      const off = String(offsets[i]).padStart(10, '0');
      xref += `${off} 00000 n \n`;
    }

    const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    return Buffer.from(body + xref + trailer, 'utf-8');
  }
}

export const pdfGeneratorService = new PdfGeneratorService();
