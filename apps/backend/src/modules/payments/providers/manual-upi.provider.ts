import { BaseProvider } from './base.provider';
import { CreatePaymentDto } from '../types/payment.types';
import { ProviderCapabilities } from '../types/provider-capabilities.types';
import { PaymentAnalysisResult, PaymentVerificationContext } from '../types/payment-analysis.types';
import { PaymentIntelligenceEngine } from '../engine/intelligence/payment-intelligence.engine';

export class ManualUpiProvider extends BaseProvider {
  readonly providerName = 'manual_upi';
  private intelligenceEngine: PaymentIntelligenceEngine;

  constructor(intelligenceEngine?: PaymentIntelligenceEngine) {
    super();
    this.intelligenceEngine = intelligenceEngine ?? new PaymentIntelligenceEngine();
  }

  public getCapabilities(): ProviderCapabilities {
    return {
      supportsOcr: true,
      supportsAutoVerification: false,
      supportsRefund: false,
      supportsWebhooks: false,
      supportsManualReview: true,
      supportsTestMode: true,
    };
  }

  public override async initiatePayment(dto: CreatePaymentDto): Promise<{
    gatewayData: Record<string, any>;
    initialStatus: 'pending' | 'initiated';
  }> {
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
    return true;
  }

  public async analyzePayment(
    context: PaymentVerificationContext,
    rawInput?: Buffer | string
  ): Promise<PaymentAnalysisResult> {
    return this.intelligenceEngine.analyze(context, rawInput);
  }

  public getDisplayName(): string {
    return 'Manual UPI';
  }
}
