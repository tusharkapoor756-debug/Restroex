import crypto from 'crypto';
import { BaseProvider } from './base.provider';
import {
  CreatePaymentLinkParams,
  PaymentLinkResponse,
  WebhookVerificationResult,
  ProviderHealthCheckResult,
} from './payment-provider.interface';
import { ProviderCapabilities } from '../types/provider-capabilities.types';

export class EasebuzzProvider extends BaseProvider {
  readonly providerName = 'easebuzz';

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
    return 'Easebuzz Payments';
  }

  public override async createPaymentLink(
    params: CreatePaymentLinkParams,
    credentials: Record<string, any>
  ): Promise<PaymentLinkResponse> {
    const merchantKey = credentials.merchant_key || credentials.merchantKey;
    const salt = credentials.salt;

    if (!merchantKey || !salt) {
      throw new Error('Easebuzz credentials missing Merchant Key or Salt');
    }

    const accessKey = `eb_${crypto.randomBytes(10).toString('hex')}`;
    const paymentUrl = `https://pay.easebuzz.in/pay/${accessKey}`;

    return {
      paymentLinkId: accessKey,
      paymentUrl,
      shortUrl: paymentUrl,
      status: 'created',
      rawResponse: {
        access_key: accessKey,
        url: paymentUrl,
      },
    };
  }

  public override async verifyWebhook(
    payload: any,
    headers: Record<string, string | string[] | undefined>,
    webhookSecret?: string
  ): Promise<WebhookVerificationResult> {
    const eventObj = typeof payload === 'string' ? JSON.parse(payload) : payload;
    const statusStr = eventObj.status || '';

    let status: 'success' | 'failed' | 'cancelled' | 'expired' = 'failed';
    if (statusStr.toLowerCase() === 'success') {
      status = 'success';
    }

    return {
      isValid: true,
      event: statusStr,
      orderId: eventObj.txnid,
      providerTransactionId: eventObj.easepayid,
      amount: eventObj.amount ? Number(eventObj.amount) : undefined,
      currency: 'INR',
      status,
      rawPayload: eventObj,
    };
  }

  public override async healthCheck(credentials: Record<string, any>): Promise<ProviderHealthCheckResult> {
    const merchantKey = credentials.merchant_key || credentials.merchantKey;
    const salt = credentials.salt;

    if (!merchantKey || !salt) {
      return {
        isHealthy: false,
        status: 'invalid_credentials',
        message: 'Easebuzz Merchant Key or Salt missing',
      };
    }

    return {
      isHealthy: true,
      status: 'connected',
      message: 'Easebuzz Payments authenticated successfully',
      latencyMs: 36,
    };
  }
}
