import { BaseProvider } from './base.provider';
import { CreatePaymentDto } from '../types/payment.types';
import { ProviderCapabilities } from '../types/provider-capabilities.types';

export class CodProvider extends BaseProvider {
  readonly providerName = 'cash';

  public getCapabilities(): ProviderCapabilities {
    return {
      supportsOcr: false,
      supportsAutoVerification: true,
      supportsRefund: false,
      supportsWebhooks: false,
      supportsManualReview: false,
      supportsTestMode: true,
    };
  }

  public override async initiatePayment(dto: CreatePaymentDto): Promise<{
    gatewayData: Record<string, any>;
    initialStatus: 'pending' | 'initiated';
  }> {
    return {
      gatewayData: {
        payment_mode: 'cash_on_delivery',
      },
      initialStatus: 'pending',
    };
  }

  public async verifyPayment(): Promise<boolean> {
    return true;
  }

  public getDisplayName(): string {
    return 'Cash on Delivery';
  }
}
