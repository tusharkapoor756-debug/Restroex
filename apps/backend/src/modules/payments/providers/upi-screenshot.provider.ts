import { BaseProvider } from './base.provider';
import { ProviderCapabilities } from '../types/provider-capabilities.types';
import { PaymentAnalysisResult, PaymentVerificationContext } from '../types/payment-analysis.types';
import { PaymentIntelligenceEngine } from '../engine/intelligence/payment-intelligence.engine';

export class UpiScreenshotProvider extends BaseProvider {
  readonly providerName = 'upi_screenshot';
  private intelligenceEngine: PaymentIntelligenceEngine;

  constructor() {
    super();
    this.intelligenceEngine = new PaymentIntelligenceEngine();
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

  public async analyzePayment(
    context: PaymentVerificationContext,
    rawInput?: Buffer | string
  ): Promise<PaymentAnalysisResult> {
    return this.intelligenceEngine.analyze(context, rawInput);
  }

  public getDisplayName(): string {
    return 'UPI Screenshot Verification';
  }
}
