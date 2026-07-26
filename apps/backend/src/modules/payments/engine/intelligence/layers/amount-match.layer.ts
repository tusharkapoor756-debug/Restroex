import { IValidationLayer, PipelineContext, LayerExecutionResult } from '../../pipeline/validation-layer.interface';
import { logger } from '../../../../../infrastructure/logger/logger';

export class AmountMatchLayer implements IValidationLayer {
  readonly name = 'AmountMatchLayer';
  readonly isCritical = false;

  public async evaluate(context: PipelineContext): Promise<LayerExecutionResult> {
    logger.info('💰 Amount Match started');
    const startTime = Date.now();
    const expectedAmount = context.verificationContext.expectedAmount;
    const detectedAmount = context.extractedDetails?.amount.value ?? null;
    const tolerance = context.config.amountTolerance;

    if (detectedAmount === null) {
      const warning = `Could not detect payment amount in screenshot (Expected ₹${expectedAmount.toFixed(2)})`;
      return {
        layerName: this.name,
        passed: false,
        durationMs: Date.now() - startTime,
        warnings: [warning],
        explanationChecks: [
          {
            code: 'AMOUNT_MATCH',
            passed: false,
            title: 'Amount Not Detected',
            message: `Unable to read payment amount from screenshot. Expected ₹${expectedAmount.toFixed(2)}.`,
            severity: 'warning',
          },
        ],
      };
    }

    const isMatch = Math.abs(expectedAmount - detectedAmount) <= tolerance;

    if (isMatch) {
      return {
        layerName: this.name,
        passed: true,
        durationMs: Date.now() - startTime,
        explanationChecks: [
          {
            code: 'AMOUNT_MATCH',
            passed: true,
            title: 'Amount Verified',
            message: `Detected payment amount (₹${detectedAmount.toFixed(2)}) matches expected order total (₹${expectedAmount.toFixed(2)}).`,
            severity: 'info',
          },
        ],
      };
    }

    const warning = `Amount mismatch: Expected ₹${expectedAmount.toFixed(2)}, detected ₹${detectedAmount.toFixed(2)}`;
    return {
      layerName: this.name,
      passed: false,
      durationMs: Date.now() - startTime,
      warnings: [warning],
      explanationChecks: [
        {
          code: 'AMOUNT_MATCH',
          passed: false,
          title: 'Amount Mismatch',
          message: `Detected amount (₹${detectedAmount.toFixed(2)}) does not match expected order total (₹${expectedAmount.toFixed(2)}).`,
          severity: 'critical',
        },
      ],
    };
  }
}
