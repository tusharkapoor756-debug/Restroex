import {
  IPaymentProvider,
  CreatePaymentLinkParams,
  PaymentLinkResponse,
  WebhookVerificationResult,
  ProviderHealthCheckResult,
} from './payment-provider.interface';
import { CreatePaymentDto } from '../types/payment.types';
import { ProviderCapabilities } from '../types/provider-capabilities.types';

export abstract class BaseProvider implements IPaymentProvider {
  abstract readonly providerName: string;

  abstract getCapabilities(): ProviderCapabilities;

  public async createPaymentLink(
    params: CreatePaymentLinkParams,
    credentials: Record<string, any>
  ): Promise<PaymentLinkResponse> {
    throw new Error(`createPaymentLink not implemented for ${this.providerName}`);
  }

  public async verifyWebhook(
    payload: any,
    headers: Record<string, string | string[] | undefined>,
    webhookSecret?: string
  ): Promise<WebhookVerificationResult> {
    return {
      isValid: false,
      event: 'unknown',
    };
  }

  public verifySignature(
    payload: string | Buffer,
    signature: string,
    secret: string
  ): boolean {
    return false;
  }

  public async fetchPayment(
    providerTransactionId: string,
    credentials: Record<string, any>
  ): Promise<{
    status: 'success' | 'failed' | 'pending' | 'cancelled';
    amount: number;
    currency: string;
    raw: Record<string, any>;
  }> {
    throw new Error(`fetchPayment not implemented for ${this.providerName}`);
  }

  public async healthCheck(credentials: Record<string, any>): Promise<ProviderHealthCheckResult> {
    return {
      isHealthy: true,
      status: 'connected',
      message: 'Provider health check OK',
    };
  }

  public async initiatePayment(dto: CreatePaymentDto): Promise<{
    gatewayData: Record<string, any>;
    initialStatus: 'pending' | 'initiated';
  }> {
    return {
      gatewayData: dto.gatewayData ?? {},
      initialStatus: 'pending',
    };
  }

  public abstract getDisplayName(): string;
}
