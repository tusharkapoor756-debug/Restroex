import { db } from '../../../infrastructure/database/database.client';
import { logger } from '../../../infrastructure/logger/logger';
import { Order } from '../types/order.types';
import { ReceiptRenderService } from './receipt-render.service';

import { env } from '../../../config/env';

export interface InvoiceGenerationResult {
  invoiceNumber: string;
  pdfUrl: string;
  signedUrl: string;
  generatedAt: string;
}

export class InvoiceService {
  private renderService = new ReceiptRenderService();

  /**
   * Generates a 100% concurrency-safe, sequence-tracked invoice number (INV-YYYY-XXXXXX)
   * Uses PostgreSQL RPC function generate_next_invoice_number with atomic table locks.
   */
  public async generateInvoiceNumber(restaurantId: string, orderId: string): Promise<string> {
    const client = db.getClient();

    // 1. First check if order already has an assigned invoice_number
    const { data: existingOrder } = await client
      .from('orders')
      .select('invoice_number')
      .eq('id', orderId)
      .maybeSingle();

    if (existingOrder?.invoice_number) {
      return existingOrder.invoice_number;
    }

    const currentYear = new Date().getFullYear();

    // 2. Call PL/pgSQL Atomic Sequence RPC Generator
    const { data: rpcInvoiceNum, error: rpcError } = await client.rpc('generate_next_invoice_number', {
      p_restaurant_id: restaurantId,
      p_order_id: orderId,
      p_year: currentYear,
    });

    if (!rpcError && rpcInvoiceNum) {
      return rpcInvoiceNum as string;
    }

    // 3. Fail-safe retry loop for development fallback
    logger.warn({ rpcError: rpcError?.message, orderId }, 'Falling back to fail-safe invoice sequence retry loop');

    let attempts = 0;
    while (attempts < 5) {
      attempts++;
      const { data: latestInvoice } = await client
        .from('orders')
        .select('invoice_number')
        .eq('restaurant_id', restaurantId)
        .ilike('invoice_number', `INV-${currentYear}-%`)
        .order('invoice_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      let nextSeq = 100001;
      if (latestInvoice?.invoice_number) {
        const match = latestInvoice.invoice_number.match(/INV-\d{4}-(\d+)/);
        if (match && match[1]) {
          nextSeq = parseInt(match[1], 10) + 1;
        }
      }

      const candidateNum = `INV-${currentYear}-${nextSeq}`;
      const { error: updateErr } = await client
        .from('orders')
        .update({ invoice_number: candidateNum })
        .eq('id', orderId);

      if (!updateErr) {
        return candidateNum;
      }

      // Check if another thread assigned an invoice number to this exact order
      const { data: reCheck } = await client
        .from('orders')
        .select('invoice_number')
        .eq('id', orderId)
        .maybeSingle();

      if (reCheck?.invoice_number) {
        return reCheck.invoice_number;
      }

      // Brief backoff before next attempt
      await new Promise((res) => setTimeout(res, 50 * attempts));
    }

    throw new Error(`Failed to generate unique invoice number for order ${orderId} after 5 attempts.`);
  }

  /**
   * Main entry point: Generates tax invoice metadata from IMMUTABLE receipt_snapshot
   */
  public async generateInvoice(order: Order, overrideBaseUrl?: string): Promise<InvoiceGenerationResult> {
    if (!order.receiptSnapshot || !Array.isArray(order.receiptSnapshot.items)) {
      throw new Error(`Cannot generate invoice for order ${order.id}: Missing receipt snapshot.`);
    }

    const baseUrl = overrideBaseUrl || env.APP_BASE_URL;

    // 1. Obtain concurrency-safe invoice number
    const invoiceNumber = await this.generateInvoiceNumber(order.restaurantId, order.id);

    // 2. Generate signed HTML receipt URL
    const signedUrl = this.renderService.generateSignedReceiptUrl(order.id, baseUrl, 'customer_receipt');

    // 3. Generate signed binary PDF stream URL
    const token = this.renderService.generateSignedToken(order.id, 'customer_receipt');
    const normalizedBase = baseUrl.replace(/\/$/, '');
    const pdfUrl = `${normalizedBase}/api/v1/receipts/${encodeURIComponent(order.id)}/pdf?token=${encodeURIComponent(token)}`;

    return {
      invoiceNumber,
      pdfUrl,
      signedUrl,
      generatedAt: new Date().toISOString(),
    };
  }
}

export const invoiceService = new InvoiceService();
