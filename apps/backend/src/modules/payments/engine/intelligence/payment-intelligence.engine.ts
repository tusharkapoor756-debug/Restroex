import { PaymentAnalysisResult, PaymentVerificationContext } from '../../types/payment-analysis.types';
import { PaymentEngineConfig, defaultPaymentEngineConfig } from '../../config/payment-engine.config';
import { ValidationPipelineRunner } from '../pipeline/validation-pipeline.runner';
import { PipelineContext } from '../pipeline/validation-layer.interface';
import { ImageHashLayer } from './layers/image-hash.layer';
import { OcrExtractionLayer } from './layers/ocr-extraction.layer';
import { MerchantVerificationLayer } from './layers/merchant-verification.layer';
import { AmountMatchLayer } from './layers/amount-match.layer';
import { DuplicateDetectionLayer } from './layers/duplicate-detection.layer';
import { FingerprintLayer } from './layers/fingerprint.layer';
import { TransactionValidationLayer } from './layers/transaction-validation.layer';
import { FraudIndicatorsLayer } from './layers/fraud-indicators.layer';
import { ImageHasherService } from '../services/image-hasher.service';
import { logger } from '../../../../infrastructure/logger/logger';

export class PaymentIntelligenceEngine {
  private pipelineRunner: ValidationPipelineRunner;
  private config: PaymentEngineConfig;

  constructor(
    pipelineRunner?: ValidationPipelineRunner,
    config?: PaymentEngineConfig
  ) {
    this.config = config ?? defaultPaymentEngineConfig;

    if (pipelineRunner) {
      this.pipelineRunner = pipelineRunner;
    } else {
      // Production pipeline with dedicated Merchant Verification Engine
      this.pipelineRunner = new ValidationPipelineRunner([
        new ImageHashLayer(),
        new OcrExtractionLayer(),
        new MerchantVerificationLayer(),
        new AmountMatchLayer(),
        new DuplicateDetectionLayer(),
        new FingerprintLayer(),
        new TransactionValidationLayer(),
        new FraudIndicatorsLayer(),
      ]);
    }
  }

  /**
   * Executes the dynamic Payment Intelligence Pipeline on a payment verification context.
   */
  public async analyze(
    context: PaymentVerificationContext,
    rawInput?: Buffer | string
  ): Promise<PaymentAnalysisResult> {
    logger.info({ paymentId: context.paymentId, orderId: context.orderId }, '🚀 Payment Intelligence Engine execution started.');

    const startTime = Date.now();
    const inputData = rawInput ?? context.imageBuffer ?? context.imageUrl ?? '';
    const imageHash = inputData ? ImageHasherService.generateHash(inputData) : '';

    // Initialize Shared Pipeline Context
    const pipelineContext: PipelineContext = {
      verificationContext: context,
      config: this.config,
      rawInput: inputData,
      imageHash,
      warnings: [],
      explanationChecks: [],
      timings: {},
    };

    // Run dynamic validation pipeline
    const { context: updatedContext, layerResults } = await this.pipelineRunner.run(pipelineContext);
    const totalDurationMs = Date.now() - startTime;

    const details = updatedContext.extractedDetails ?? {
      amount: { value: null, confidence: 0, source: 'rule_engine' },
      currency: { value: 'INR', confidence: 95, source: 'rule_engine' },
      upiReference: { value: null, confidence: 0, source: 'rule_engine' },
      transactionId: { value: null, confidence: 0, source: 'rule_engine' },
      date: { value: null, confidence: 0, source: 'rule_engine' },
      time: { value: null, confidence: 0, source: 'rule_engine' },
      senderName: { value: null, confidence: 0, source: 'rule_engine' },
      receiverName: { value: null, confidence: 0, source: 'rule_engine' },
      receiverUpiId: { value: null, confidence: 0, source: 'rule_engine' },
      bankName: { value: null, confidence: 0, source: 'rule_engine' },
      paymentApp: { value: null, confidence: 0, source: 'rule_engine' },
      paymentStatusInScreenshot: { value: 'UNKNOWN', confidence: 0, source: 'rule_engine' },
      overallConfidence: 0,
    };

    // Extract Fraud Layer Results
    const fraudLayerResult = layerResults.find((r) => r.layerName === 'FraudIndicatorsLayer');
    const riskScore: number = fraudLayerResult?.data?.riskScore ?? 0;
    const recommendedAction: 'APPROVE' | 'MANUAL_REVIEW' | 'REJECT' =
      fraudLayerResult?.data?.recommendedAction ?? 'MANUAL_REVIEW';
    const humanSummary: string =
      fraudLayerResult?.data?.humanSummary ??
      `Validation pipeline completed with risk score ${riskScore}/100. Recommended Action: ${recommendedAction}.`;

    const finalStatus =
      recommendedAction === 'APPROVE'
        ? 'verified'
        : recommendedAction === 'REJECT'
        ? 'rejected'
        : 'manual_review_required';

    const isDuplicate =
      !!updatedContext.duplicatePaymentId ||
      updatedContext.explanationChecks.some(
        (c) => (c.code === 'EXACT_IMAGE_REUSED' || c.code === 'DUPLICATE_UTR') && !c.passed
      );

    const ocrConfidence = details.overallConfidence;
    const verificationScore = updatedContext.merchantVerification?.verificationScore ?? details.overallConfidence;

    const result: PaymentAnalysisResult = {
      provider: 'upi_screenshot',
      status: finalStatus,
      ocrConfidence,
      verificationScore,
      riskScore,
      overallConfidence: verificationScore, // Backward compatibility
      duplicate: isDuplicate,
      imageHash,
      exactFingerprint: updatedContext.exactFingerprint ?? null,
      similarityFingerprint: updatedContext.similarityFingerprint ?? null,
      warnings: Array.from(new Set(updatedContext.warnings)),
      explanationChecks: updatedContext.explanationChecks,
      humanSummary,
      recommendedAction,
      extractedDetails: details,
      merchantVerification: updatedContext.merchantVerification,
      localOcrDetails: updatedContext.localOcrDetails,
      aiDetails: updatedContext.aiDetails,
      analysisSource: updatedContext.analysisSource ?? 'Local OCR',
      aiStatus: updatedContext.aiStatus ?? 'Skipped',
      aiEscalated: updatedContext.aiEscalated ?? false,
      aiEscalationReason: updatedContext.aiEscalationReason,
      metrics: {
        totalDurationMs,
        layerTimings: updatedContext.timings,
      },
      analyzedAt: new Date().toISOString(),
    };

    logger.info(
      { paymentId: context.paymentId, recommendedAction: result.recommendedAction, riskScore: result.riskScore, totalDurationMs },
      '✅ Payment Intelligence Engine execution completed.'
    );

    return result;
  }
}
