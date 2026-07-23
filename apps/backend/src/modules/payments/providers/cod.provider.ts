import { IPaymentProvider } from './payment-provider.interface';
import { CreatePaymentDto } from '../types/payment.types';

export class CodProvider implements IPaymentProvider {
  readonly providerName = 'cash';

  public async initiatePayment(dto: CreatePaymentDto): Promise<{
    gatewayData: Record<string, any>;
    initialStatus: 'pending' | 'initiated';
  }> {
    return {
      gatewayData: {},
      initialStatus: 'initiated',
    };
  }

  public getDisplayName(): string {
    return 'Cash on Delivery';
  }
}
