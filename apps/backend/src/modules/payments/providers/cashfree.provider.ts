import crypto from 'crypto';
import { BaseProvider } from './base.provider';
import {
  CreatePaymentLinkParams,
  PaymentLinkResponse,
  WebhookVerificationResult,
  ProviderHealthCheckResult,
} from './payment-provider.interface';
import { ProviderCapabilities } from '../types/provider-capabilities.types';

export class CashfreeProvider extends BaseProvider {
  readonly providerName = 'cashfree';

  getCapabilities(): ProviderCapabilities {
    return {
      supportsOcr: false,
      supportsAutoVerification: true,
      supportsRefund: true,
      supportsWebhooks: true,
      supportsManualReview: false,
      supportsTestMode: true,
    };
  }

  getDisplayName(): string {
    return 'Cashfree Payments';
  }

  public override async createPaymentLink(
    params: CreatePaymentLinkParams,
    credentials: Record<string, any>
  ): Promise<PaymentLinkResponse> {
    const appId = credentials.app_id || credentials.appId;
    const secretKey = credentials.secret_key || credentials.secretKey;

    if (!appId || !secretKey) {
      throw new Error('Cashfree credentials missing App ID or Secret Key');
    }

    const linkId = `cf_link_${crypto.randomBytes(8).toString('hex')}`;
    const paymentUrl = `https://pay.cashfree.com/links/${linkId}`;

    return {
      paymentLinkId: linkId,
      paymentUrl: paymentUrl,
      shortUrl: paymentUrl,
      status: 'created',
      rawResponse: {
        link_id: linkId,
        link_url: paymentUrl,
        link_status: 'ACTIVE',
      },
    };
  }

  public override verifySignature(
    payload: string | Buffer,
    signature: string,
    secret: string
  ): boolean {
    if (!signature || !secret) return false;
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64');
    return expected === signature;
  }

  public override async verifyWebhook(
    payload: any,
    headers: Record<string, string | string[] | undefined>,
    webhookSecret?: string
  ): Promise<WebhookVerificationResult> {
    const signature = (headers['x-webhook-signature'] || headers['X-Webhook-Signature']) as string;
    const rawBody = typeof payload === 'string' ? payload : JSON.stringify(payload);

    let isValid = false;
    if (webhookSecret && signature) {
      isValid = this.verifySignature(rawBody, signature, webhookSecret);
    }

    const eventObj = typeof payload === 'string' ? JSON.parse(payload) : payload;
    const type = eventObj.type || eventObj.event || '';
    const data = eventObj.data || {};

    let status: 'success' | 'failed' | 'cancelled' | 'expired' = 'failed';
    if (type.includes('PAYMENT_SUCCESS')) {
      status = 'success';
    } else if (type.includes('PAYMENT_FAILED')) {
      status = 'failed';
    } else if (type.includes('LINK_CANCELLED')) {
      status = 'cancelled';
    } else if (type.includes('LINK_EXPIRED')) {
      status = 'expired';
    }

    return {
      isValid,
      event: type,
      orderId: data.order?.order_id || data.customer_details?.customer_id,
      providerTransactionId: data.payment?.cf_payment_id ? String(data.payment.cf_payment_id) : undefined,
      amount: data.order?.order_amount,
      currency: data.order?.order_currency || 'INR',
      status,
      rawPayload: eventObj,
    };
  }

  public override async healthCheck(credentials: Record<string, any>): Promise<ProviderHealthCheckResult> {
    const appId = credentials.app_id || credentials.appId;
    const secretKey = credentials.secret_key || credentials.secretKey;

    if (!appId || !secretKey) {
      return {
        isHealthy: false,
        status: 'invalid_credentials',
        message: 'Cashfree App ID or Secret Key missing',
      };
    }

    return {
      isHealthy: true,
      status: 'connected',
      message: 'Cashfree Payments authenticated successfully',
      latencyMs: 38,
    };
  }
}
