import { PaymentRepository } from '../../../repositories/payment.repository';
import { IValidationLayer, PipelineContext, LayerExecutionResult } from '../../pipeline/validation-layer.interface';
import { ExplanationCheck } from '../../../types/payment-analysis.types';
import { logger } from '../../../../../infrastructure/logger/logger';

export class ImageHashLayer implements IValidationLayer {
  readonly name = 'ImageHashLayer';
  readonly isCritical = false; // Fraud signal check — non-terminal to allow full OCR pipeline execution
  private repository: PaymentRepository;

  constructor(repository?: PaymentRepository) {
    this.repository = repository ?? new PaymentRepository();
  }

  public async evaluate(context: PipelineContext): Promise<LayerExecutionResult> {
    logger.info('📸 Image Hash Layer started');
    const startTime = Date.now();
    const imageHash = context.imageHash;

    if (!imageHash) {
      return {
        layerName: this.name,
        passed: true,
        durationMs: Date.now() - startTime,
        explanationChecks: [
          {
            code: 'EXACT_IMAGE_REUSED',
            passed: true,
            title: 'Original Screenshot',
            message: 'No image hash available for evaluation.',
            severity: 'info',
          },
        ],
      };
    }

    const existing = await this.repository.findByImageHash(
      imageHash,
      context.verificationContext.paymentId
    );

    if (existing) {
      context.duplicatePaymentId = existing.id;
      logger.info(
        { duplicatePaymentId: existing.id },
        '⚠️ Duplicate screenshot detected — marking fraud signal and continuing pipeline...'
      );

      return {
        layerName: this.name,
        passed: false,
        durationMs: Date.now() - startTime,
        shouldShortCircuit: false, // Do NOT short-circuit; continue to OCR & full analysis
        warnings: [`Exact screenshot already uploaded in payment ${existing.id}`],
        explanationChecks: [
          {
            code: 'EXACT_IMAGE_REUSED',
            passed: false,
            title: 'Exact Screenshot Reused',
            message: `This exact screenshot was previously uploaded for payment ${existing.id}.`,
            severity: 'critical',
          },
        ],
        data: { duplicatePaymentId: existing.id },
      };
    }

    return {
      layerName: this.name,
      passed: true,
      durationMs: Date.now() - startTime,
      explanationChecks: [
        {
          code: 'EXACT_IMAGE_REUSED',
          passed: true,
          title: 'Original Screenshot',
          message: 'No duplicate screenshot file detected.',
          severity: 'info',
        },
      ],
    };
  }
}
