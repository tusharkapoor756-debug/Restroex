import { PaymentRepository } from '../../../repositories/payment.repository';
import { IValidationLayer, PipelineContext, LayerExecutionResult } from '../../pipeline/validation-layer.interface';
import { logger } from '../../../../../infrastructure/logger/logger';

export class DuplicateDetectionLayer implements IValidationLayer {
  readonly name = 'DuplicateDetectionLayer';
  readonly isCritical = false; // Fraud signal check — non-terminal to allow full evaluation
  private repository: PaymentRepository;

  constructor(repository?: PaymentRepository) {
    this.repository = repository ?? new PaymentRepository();
  }

  public async evaluate(context: PipelineContext): Promise<LayerExecutionResult> {
    logger.info('🔍 Duplicate Detection started');
    const startTime = Date.now();
    const upiRef = context.extractedDetails?.upiReference.value ?? null;
    const txnId = context.extractedDetails?.transactionId.value ?? null;

    if (!upiRef && !txnId) {
      return {
        layerName: this.name,
        passed: true,
        durationMs: Date.now() - startTime,
        explanationChecks: [
          {
            code: 'DUPLICATE_UTR',
            passed: true,
            title: 'No Reference to Check',
            message: 'No UTR reference or Transaction ID found for duplicate lookup.',
            severity: 'info',
          },
        ],
      };
    }

    if (upiRef) {
      const existing = await this.repository.findByUpiReference(
        upiRef,
        context.verificationContext.paymentId
      );

      if (existing) {
        context.duplicatePaymentId = existing.id;
        const warning = `Duplicate UTR reference ${upiRef} detected (Used in payment ${existing.id})`;
        logger.info({ duplicatePaymentId: existing.id, upiRef }, '⚠️ Duplicate UTR detected — marking fraud signal and continuing pipeline...');

        return {
          layerName: this.name,
          passed: false,
          durationMs: Date.now() - startTime,
          shouldShortCircuit: false,
          warnings: [warning],
          explanationChecks: [
            {
              code: 'DUPLICATE_UTR',
              passed: false,
              title: 'Duplicate UTR Reference Detected',
              message: `UPI Reference / UTR "${upiRef}" has already been used in payment ${existing.id}.`,
              severity: 'critical',
            },
          ],
          data: { duplicatePaymentId: existing.id },
        };
      }
    }

    return {
      layerName: this.name,
      passed: true,
      durationMs: Date.now() - startTime,
      explanationChecks: [
        {
          code: 'DUPLICATE_UTR',
          passed: true,
          title: 'Unique UTR Reference',
          message: 'UPI Reference / UTR has not been used previously.',
          severity: 'info',
        },
      ],
    };
  }
}
