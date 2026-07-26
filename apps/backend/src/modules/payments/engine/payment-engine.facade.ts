import { PaymentProviderRegistry } from '../providers/payment-provider.registry';
import { PaymentRepository } from '../repositories/payment.repository';
import { PaymentLoggerService } from './logs/payment-logger.service';
import { PaymentAnalysisResult, PaymentVerificationContext } from '../types/payment-analysis.types';
import { ProviderCapabilities } from '../types/provider-capabilities.types';
import { logger } from '../../../infrastructure/logger/logger';

export class PaymentEngineFacade {
  private repository: PaymentRepository;
  private loggerService: PaymentLoggerService;

  constructor(
    repository?: PaymentRepository,
    loggerService?: PaymentLoggerService
  ) {
    this.repository = repository ?? new PaymentRepository();
    this.loggerService = loggerService ?? new PaymentLoggerService();
  }

  /**
   * Resolves capabilities of a registered payment provider.
   */
  public getProviderCapabilities(paymentMethod: string): ProviderCapabilities {
    const provider = PaymentProviderRegistry.get(paymentMethod);
    return provider.getCapabilities();
  }

  /**
   * Executes Payment Intelligence Engine analysis on a payment record and updates DB state.
   */
  public async analyzePaymentScreenshot(
    paymentId: string,
    imageBuffer?: Buffer
  ): Promise<PaymentAnalysisResult> {
    logger.info({ paymentId }, '🚀 PaymentEngineFacade started');
    const payment = await this.repository.getById(paymentId);
    if (!payment) {
      throw new Error(`Payment record ${paymentId} not found.`);
    }

    const provider = PaymentProviderRegistry.get(payment.paymentMethod);
    if (!provider.analyzePayment) {
      throw new Error(`Provider ${payment.paymentMethod} does not support intelligence analysis.`);
    }

    const storagePath: string | undefined = (payment.gatewayData as any)?.storagePath;
    const upiId: string | undefined = (payment.gatewayData as any)?.upi_id;
    const merchantName: string | undefined = (payment.gatewayData as any)?.merchant_name;

    const context: PaymentVerificationContext = {
      paymentId: payment.id,
      orderId: payment.orderId,
      restaurantId: payment.restaurantId,
      expectedAmount: payment.amount,
      expectedCurrency: payment.currency,
      merchantUpiId: upiId,
      merchantName: merchantName,
      storagePath,
      imageBuffer,
    };

    // Execute provider intelligence engine analysis
    const result = await provider.analyzePayment(context, imageBuffer);

    logger.info({ paymentId }, '💾 Saving analysis result');

    // Update payment record in database with generic provider fields
    await this.repository.update(payment.id, {
      paymentStatus: result.status === 'verified' ? 'verified' : 'pending_verification',
      imageHash: result.imageHash ?? undefined,
      exactFingerprint: result.exactFingerprint ?? undefined,
      similarityFingerprint: result.similarityFingerprint ?? undefined,
      providerTransactionId: result.extractedDetails.upiReference.value ?? undefined,
      verifiedAmount: result.extractedDetails.amount.value ?? undefined,
      verifiedTransactionReference: result.extractedDetails.upiReference.value ?? undefined,
      gatewayData: {
        ...payment.gatewayData,
        analysis_result: result,
        confidence: result.overallConfidence,
        risk_score: result.riskScore,
        recommended_action: result.recommendedAction,
        warnings: result.warnings,
        human_summary: result.humanSummary,
      },
    });

    // Append immutable analysis history log
    await this.loggerService.logAnalysisAttempt(payment.id, result);

    logger.info({ paymentId, recommendedAction: result.recommendedAction, riskScore: result.riskScore }, '✅ Analysis saved');

    return result;
  }
}
