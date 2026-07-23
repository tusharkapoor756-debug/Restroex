import { IPaymentProvider } from './payment-provider.interface';
import { CreatePaymentDto } from '../types/payment.types';

// ============================================================
// ManualUpiProvider
//
// Handles the Manual UPI payment flow:
//   1. Records UPI merchant details in gateway_data
//   2. Customer uploads a screenshot (handled by PaymentService)
//   3. Admin verifies manually (handled by PaymentService)
//
// gateway_data shape for Manual UPI:
// {
//   upi_id: string;
//   merchant_name: string;
//   upi_qr_image_url?: string;
//   screenshot_url?: string;
//   transaction_reference?: string;
// }
// ============================================================
export class ManualUpiProvider implements IPaymentProvider {
  readonly providerName = 'manual_upi';

  public async initiatePayment(dto: CreatePaymentDto): Promise<{
    gatewayData: Record<string, any>;
    initialStatus: 'pending' | 'initiated';
  }> {
    // For manual UPI there is no API call — we simply record the
    // merchant UPI details that the customer should pay to.
    const existingData = dto.gatewayData ?? {};

    return {
      gatewayData: {
        upi_id: existingData.upi_id ?? null,
        merchant_name: existingData.merchant_name ?? null,
        upi_qr_image_url: existingData.upi_qr_image_url ?? null,
        screenshot_url: null,
        transaction_reference: null,
      },
      initialStatus: 'pending',
    };
  }

  public async verifyPayment(): Promise<boolean> {
    // Manual UPI verification is always admin-triggered (always trusted)
    return true;
  }

  public getDisplayName(): string {
    return 'Manual UPI';
  }
}
