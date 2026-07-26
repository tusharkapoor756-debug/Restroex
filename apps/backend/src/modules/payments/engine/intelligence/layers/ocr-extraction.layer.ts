import { IValidationLayer, PipelineContext, LayerExecutionResult } from '../../pipeline/validation-layer.interface';
import { LocalOcrService } from '../../services/local-ocr.service';
import { AiVisionService } from '../../services/ai-vision.service';
import { logger } from '../../../../../infrastructure/logger/logger';

export class OcrExtractionLayer implements IValidationLayer {
  readonly name = 'OcrExtractionLayer';
  readonly isCritical = false;
  readonly order = 20; // Explicitly run at position 20 before Merchant Verification
  private localOcr: LocalOcrService;
  private aiVision: AiVisionService;

  constructor(localOcr?: LocalOcrService, aiVision?: AiVisionService) {
    this.localOcr = localOcr ?? new LocalOcrService();
    this.aiVision = aiVision ?? new AiVisionService();
  }

  public async evaluate(context: PipelineContext): Promise<LayerExecutionResult> {
    logger.info('🔍 OCR Layer started');
    const startTime = Date.now();
    const rawInput = context.rawInput ?? context.verificationContext.imageBuffer ?? context.verificationContext.imageUrl ?? '';

    // Step 1: Execute Local OCR (Deterministic Rule Engine)
    const localDetails = await this.localOcr.extractDetails(rawInput);
    context.localOcrDetails = localDetails;
    context.extractedDetails = localDetails;
    context.analysisSource = 'Local OCR';
    context.aiStatus = 'Skipped';

    // Step 2: Evaluate Multi-Condition AI Escalation Rules
    const escalation = this.shouldEscalateToAi(context);

    if (escalation.shouldEscalate && (context.verificationContext.imageUrl || context.verificationContext.imageBuffer)) {
      try {
        const payload =
          context.verificationContext.imageUrl ??
          `data:image/png;base64,${context.verificationContext.imageBuffer?.toString('base64')}`;

        logger.info({ reason: escalation.reason }, '🤖 Escalating to AI Vision for secondary enhancement...');
        const aiDetails = await this.aiVision.extractDetailsWithVision(payload, escalation.reason!);

        if (aiDetails) {
          context.aiDetails = aiDetails;
          context.extractedDetails = aiDetails;
          context.aiEscalated = true;
          context.aiEscalationReason = escalation.reason;
          context.analysisSource = 'AI Enhanced';
          context.aiStatus = 'Available';
          logger.info('✅ AI Vision enhancement succeeded.');
        } else {
          context.aiStatus = 'Failed';
          context.warnings.push('AI Vision returned empty extraction; retained Local OCR result.');
          logger.warn('⚠️ AI Vision returned empty result — retaining Local OCR result.');
        }
      } catch (aiErr: unknown) {
        const aiErrMsg = aiErr instanceof Error ? aiErr.message : String(aiErr);
        logger.error({ error: aiErrMsg }, '⚠️ AI Vision model failed/unavailable — retaining Local OCR result.');
        context.aiStatus = 'Unavailable';
        context.aiEscalationReason = `AI unavailable: ${aiErrMsg}`;
        context.warnings.push(`AI Vision unavailable (${aiErrMsg}); used Local OCR result.`);
      }
    }

    return {
      layerName: this.name,
      passed: (context.extractedDetails?.overallConfidence ?? 0) >= context.config.ocrConfidenceThreshold,
      durationMs: Date.now() - startTime,
      data: {
        extractedDetails: context.extractedDetails,
        localOcrDetails: context.localOcrDetails,
        aiDetails: context.aiDetails,
        analysisSource: context.analysisSource,
        aiStatus: context.aiStatus,
        aiEscalated: context.aiEscalated,
      },
    };
  }

  private shouldEscalateToAi(
    context: PipelineContext
  ): { shouldEscalate: boolean; reason?: string } {
    const details = context.extractedDetails;
    if (!details) return { shouldEscalate: true, reason: 'Local OCR produced no result' };

    if (details.overallConfidence < context.config.ocrConfidenceThreshold) {
      return { shouldEscalate: true, reason: `Local OCR confidence low (${details.overallConfidence}%)` };
    }

    if (!details.amount.value || !details.upiReference.value) {
      return { shouldEscalate: true, reason: 'Critical fields (amount or UTR reference) missing in local OCR' };
    }

    if (context.verificationContext.expectedAmount && details.amount.value !== context.verificationContext.expectedAmount) {
      return {
        shouldEscalate: true,
        reason: `Amount mismatch: Expected ₹${context.verificationContext.expectedAmount}, detected ₹${details.amount.value}`,
      };
    }

    if (
      context.verificationContext.merchantUpiId &&
      details.receiverUpiId.value &&
      details.receiverUpiId.value.toLowerCase() !== context.verificationContext.merchantUpiId.toLowerCase()
    ) {
      return {
        shouldEscalate: true,
        reason: `Receiver UPI mismatch: Expected ${context.verificationContext.merchantUpiId}, detected ${details.receiverUpiId.value}`,
      };
    }

    return { shouldEscalate: false };
  }
}
