import { IValidationLayer, PipelineContext, LayerExecutionResult } from '../../pipeline/validation-layer.interface';
import { ExplanationCheck } from '../../../types/payment-analysis.types';

export class TransactionValidationLayer implements IValidationLayer {
  readonly name = 'TransactionValidationLayer';
  readonly isCritical = false;

  public async evaluate(context: PipelineContext): Promise<LayerExecutionResult> {
    const startTime = Date.now();
    const details = context.extractedDetails;
    const checks: ExplanationCheck[] = [];
    const warnings: string[] = [];

    const screenshotStatus = details?.paymentStatusInScreenshot.value ?? 'UNKNOWN';
    if (screenshotStatus === 'SUCCESS') {
      checks.push({
        code: 'STATUS_VERIFIED',
        passed: true,
        title: 'Status Verified',
        message: 'Payment status in screenshot indicates SUCCESS.',
        severity: 'info',
      });
    } else {
      warnings.push(`Screenshot status is ${screenshotStatus} (Not SUCCESS)`);
      checks.push({
        code: 'STATUS_VERIFIED',
        passed: false,
        title: 'Invalid Status in Screenshot',
        message: `Payment status shown in screenshot is "${screenshotStatus}" (expected SUCCESS).`,
        severity: screenshotStatus === 'FAILED' ? 'critical' : 'warning',
      });
    }

    const detectedReceiverUpi = details?.receiverUpiId.value;
    const expectedMerchantUpi = context.verificationContext.merchantUpiId;

    if (expectedMerchantUpi && detectedReceiverUpi) {
      const match = detectedReceiverUpi.toLowerCase() === expectedMerchantUpi.toLowerCase();
      if (match) {
        checks.push({
          code: 'RECEIVER_VERIFIED',
          passed: true,
          title: 'Receiver UPI Verified',
          message: `Receiver UPI (${detectedReceiverUpi}) matches restaurant UPI account.`,
          severity: 'info',
        });
      } else {
        warnings.push(`Receiver UPI mismatch: Paid to ${detectedReceiverUpi}, expected ${expectedMerchantUpi}`);
        checks.push({
          code: 'RECEIVER_VERIFIED',
          passed: false,
          title: 'Receiver UPI Mismatch',
          message: `Payment was sent to "${detectedReceiverUpi}", but restaurant UPI is "${expectedMerchantUpi}".`,
          severity: 'critical',
        });
      }
    } else if (expectedMerchantUpi && !detectedReceiverUpi) {
      checks.push({
        code: 'RECEIVER_VERIFIED',
        passed: true,
        title: 'Receiver UPI Unconfirmed',
        message: 'Receiver UPI ID could not be explicitly read from screenshot.',
        severity: 'info',
      });
    }

    const upiRef = details?.upiReference.value;
    if (upiRef) {
      const isValidUtrFormat = /^\d{12}$/.test(upiRef);
      if (isValidUtrFormat) {
        checks.push({
          code: 'FORMAT_CHECK',
          passed: true,
          title: 'UTR Format Valid',
          message: `UTR / Reference "${upiRef}" has valid 12-digit format.`,
          severity: 'info',
        });
      } else {
        warnings.push(`Invalid UTR format: "${upiRef}" (must be 12 digits)`);
        checks.push({
          code: 'FORMAT_CHECK',
          passed: false,
          title: 'Invalid UTR Format',
          message: `Extracted reference "${upiRef}" is not a standard 12-digit UTR.`,
          severity: 'warning',
        });
      }
    } else {
      warnings.push('Missing 12-digit UTR reference number');
      checks.push({
        code: 'FORMAT_CHECK',
        passed: false,
        title: 'Missing UTR Reference',
        message: 'No 12-digit UTR reference number was found in the screenshot.',
        severity: 'warning',
      });
    }

    const allPassed = checks.every((c) => c.passed || c.severity === 'info');
    return {
      layerName: this.name,
      passed: allPassed,
      durationMs: Date.now() - startTime,
      warnings,
      explanationChecks: checks,
    };
  }
}
