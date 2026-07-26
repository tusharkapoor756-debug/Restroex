import { PaymentRepository } from '../../../repositories/payment.repository';
import { PaymentFingerprintService } from '../../services/payment-fingerprint.service';
import { IValidationLayer, PipelineContext, LayerExecutionResult } from '../../pipeline/validation-layer.interface';
import { logger } from '../../../../../infrastructure/logger/logger';

export class FingerprintLayer implements IValidationLayer {
  readonly name = 'FingerprintLayer';
  readonly isCritical = false; // Fraud signal check — non-terminal to allow full evaluation
  private repository: PaymentRepository;

  constructor(repository?: PaymentRepository) {
    this.repository = repository ?? new PaymentRepository();
  }

  public async evaluate(context: PipelineContext): Promise<LayerExecutionResult> {
    logger.info('🔑 Fingerprint Layer started');
    const startTime = Date.now();
    const details = context.extractedDetails;

    const { exactFingerprint, similarityFingerprint } =
      PaymentFingerprintService.generateFingerprints({
        amount: details?.amount.value,
        upiReference: details?.upiReference.value,
        receiverUpiId: details?.receiverUpiId.value,
        transactionId: details?.transactionId.value,
        bankName: details?.bankName.value,
        timestamp: details?.time.value,
        date: details?.date.value,
      });

    context.exactFingerprint = exactFingerprint;
    context.similarityFingerprint = similarityFingerprint;

    let exactMatchFound = false;
    let similarityMatchFound = false;
    let duplicatePaymentId: string | undefined;
    let warning: string | undefined;

    if (exactFingerprint) {
      const existingExact = await this.repository.findByExactFingerprint(
        exactFingerprint,
        context.verificationContext.paymentId
      );
      if (existingExact) {
        exactMatchFound = true;
        duplicatePaymentId = existingExact.id;
        warning = `Exact payment transaction signature re-used (Payment ${existingExact.id})`;
      }
    }

    if (similarityFingerprint && !exactMatchFound) {
      const existingSim = await this.repository.findBySimilarityFingerprint(
        similarityFingerprint,
        context.verificationContext.paymentId
      );
      if (existingSim) {
        similarityMatchFound = true;
        duplicatePaymentId = existingSim.id;
        warning = `Suspicious similar payment pattern detected (Same amount & merchant on same date as Payment ${existingSim.id})`;
      }
    }

    if (exactMatchFound) {
      context.duplicatePaymentId = duplicatePaymentId;
      logger.info({ duplicatePaymentId }, '⚠️ Exact fingerprint match detected — marking fraud signal and continuing pipeline...');

      return {
        layerName: this.name,
        passed: false,
        durationMs: Date.now() - startTime,
        shouldShortCircuit: false,
        warnings: warning ? [warning] : [],
        explanationChecks: [
          {
            code: 'EXACT_IMAGE_REUSED',
            passed: false,
            title: 'Identical Payment Signature',
            message: `Exact transaction signature matches previous payment ${duplicatePaymentId}.`,
            severity: 'critical',
          },
        ],
      };
    }

    if (similarityMatchFound) {
      return {
        layerName: this.name,
        passed: false,
        durationMs: Date.now() - startTime,
        shouldShortCircuit: false,
        warnings: warning ? [warning] : [],
        explanationChecks: [
          {
            code: 'SIMILAR_PAYMENT_PATTERN',
            passed: false,
            title: 'Similar Payment Pattern Flagged',
            message: `Suspicious repeated payment of identical amount to same receiver on same date (matches ${duplicatePaymentId}).`,
            severity: 'warning',
          },
        ],
      };
    }

    return {
      layerName: this.name,
      passed: true,
      durationMs: Date.now() - startTime,
      explanationChecks: [
        {
          code: 'SIMILAR_PAYMENT_PATTERN',
          passed: true,
          title: 'Unique Payment Fingerprint',
          message: 'No duplicate or suspicious payment fingerprint detected.',
          severity: 'info',
        },
      ],
    };
  }
}
