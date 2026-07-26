// ─── RESTROEX PAYMENT INTELLIGENCE ENGINE — BENCHMARK & QA ENGINE ───────────

import { ReceiptEngineContainer } from '../contracts/receipt-engine.container';
import { ExpectedMerchantData } from '../types/foundation-types';
import { StructuredPaymentReceipt } from '../types/structured-receipt.schema';

export interface BenchmarkTestCase {
  id: string;
  name: string;
  paymentApp: string;
  rawText: string;
  expectedMerchant: ExpectedMerchantData;
  expectedReceipt: {
    amount: number;
    receiverUpi: string;
    upiReference: string;
    status: 'SUCCESS' | 'FAILED' | 'PENDING' | 'UNKNOWN';
  };
  expectedDecisionAction: 'APPROVE' | 'REJECT' | 'MANUAL_REVIEW';
  isFraudScenario: boolean;
}

export interface BenchmarkFieldMetrics {
  amountAccuracy: number;
  upiRefAccuracy: number;
  receiverUpiAccuracy: number;
  statusAccuracy: number;
  decisionAccuracy: number;
}

export interface BenchmarkResultReport {
  totalTestCases: number;
  passCount: number;
  failCount: number;
  overallAccuracyPercent: number;
  fieldMetrics: BenchmarkFieldMetrics;
  averageLatencyMs: number;
  markdownReport: string;
}

export class BenchmarkDatasetLoader {
  /**
   * Loads the Golden Dataset containing ground-truth receipt test cases.
   */
  public static getGoldenDataset(): BenchmarkTestCase[] {
    return [
      {
        id: 'tc-001',
        name: 'Google Pay Valid Success Payment',
        paymentApp: 'Google Pay',
        rawText: `Google Pay\nPaid to Restroex Cafe (restroex@upi)\n₹500.00\nCompleted\nJul 24, 2026, 08:30 PM\nUPI Ref No: 987654321098\nFrom: Rahul Verma`,
        expectedMerchant: {
          merchantId: 'mch-101',
          merchantName: 'Restroex Cafe',
          merchantUpiId: 'restroex@upi',
          expectedAmount: 500,
          orderId: 'ord-101',
        },
        expectedReceipt: {
          amount: 500,
          receiverUpi: 'restroex@upi',
          upiReference: '987654321098',
          status: 'SUCCESS',
        },
        expectedDecisionAction: 'APPROVE',
        isFraudScenario: false,
      },
      {
        id: 'tc-002',
        name: 'PhonePe Valid Success Payment',
        paymentApp: 'PhonePe',
        rawText: `PhonePe\nPaid to Restroex Cafe (restroex@upi)\n₹750.00\nTransaction Successful\nUTR: 876543210987\nPaid by: Priya Sharma`,
        expectedMerchant: {
          merchantId: 'mch-101',
          merchantName: 'Restroex Cafe',
          merchantUpiId: 'restroex@upi',
          expectedAmount: 750,
          orderId: 'ord-102',
        },
        expectedReceipt: {
          amount: 750,
          receiverUpi: 'restroex@upi',
          upiReference: '876543210987',
          status: 'SUCCESS',
        },
        expectedDecisionAction: 'APPROVE',
        isFraudScenario: false,
      },
      {
        id: 'tc-003',
        name: 'Paytm Fraud Duplicate UTR Replay',
        paymentApp: 'Paytm',
        rawText: `Paytm\nPaid to Restroex Cafe (restroex@upi)\n₹500.00\nSuccessful\nUPI Ref No: 987654321098\nFrom: Imposter User`,
        expectedMerchant: {
          merchantId: 'mch-101',
          merchantName: 'Restroex Cafe',
          merchantUpiId: 'restroex@upi',
          expectedAmount: 500,
          orderId: 'ord-103',
        },
        expectedReceipt: {
          amount: 500,
          receiverUpi: 'restroex@upi',
          upiReference: '987654321098',
          status: 'SUCCESS',
        },
        expectedDecisionAction: 'REJECT',
        isFraudScenario: true,
      },
      {
        id: 'tc-004',
        name: 'Amazon Pay Wrong Merchant VPA Mismatch',
        paymentApp: 'Amazon Pay',
        rawText: `Amazon Pay\nPaid to Fraudster Store (fraudster@upi)\n₹500.00\nPayment Successful\nUPI Ref: 654321098765`,
        expectedMerchant: {
          merchantId: 'mch-101',
          merchantName: 'Restroex Cafe',
          merchantUpiId: 'restroex@upi',
          expectedAmount: 500,
          orderId: 'ord-104',
        },
        expectedReceipt: {
          amount: 500,
          receiverUpi: 'fraudster@upi',
          upiReference: '654321098765',
          status: 'SUCCESS',
        },
        expectedDecisionAction: 'REJECT',
        isFraudScenario: true,
      },
      {
        id: 'tc-005',
        name: 'Generic UPI Order Amount Mismatch',
        paymentApp: 'UPI Standard',
        rawText: `Paid to Restroex Cafe (restroex@upi)\n₹250.00\nCompleted\nRef: 543210987654`,
        expectedMerchant: {
          merchantId: 'mch-101',
          merchantName: 'Restroex Cafe',
          merchantUpiId: 'restroex@upi',
          expectedAmount: 500,
          orderId: 'ord-105',
        },
        expectedReceipt: {
          amount: 250,
          receiverUpi: 'restroex@upi',
          upiReference: '543210987654',
          status: 'SUCCESS',
        },
        expectedDecisionAction: 'REJECT',
        isFraudScenario: true,
      },
    ];
  }
}

export class BenchmarkRunner {
  /**
   * Executes benchmark accuracy suite across the Golden Dataset.
   */
  public static runBenchmark(): BenchmarkResultReport {
    const dataset = BenchmarkDatasetLoader.getGoldenDataset();
    const container = ReceiptEngineContainer.getInstance();

    const grammarEngine = container.getGrammarEngine();
    const verificationEngine = container.getMerchantVerificationEngine();
    const fraudEngine = container.getFraudEngine();
    const decisionEngine = container.getDecisionEngine();

    let amountCorrect = 0;
    let upiRefCorrect = 0;
    let receiverUpiCorrect = 0;
    let statusCorrect = 0;
    let decisionCorrect = 0;
    let totalDurationMs = 0;

    const testResults: Array<{ tcId: string; name: string; passed: boolean; durationMs: number }> = [];

    for (const tc of dataset) {
      const startTime = Date.now();

      // 1. Stage 6 Universal Grammar Engine
      const receipt: StructuredPaymentReceipt = grammarEngine.parseToStructuredReceipt(tc.rawText);

      // 2. Stage 7 Merchant Verification Engine
      const verification = verificationEngine.verifyMerchant(receipt, tc.expectedMerchant);

      // 3. Stage 8 Fraud Engine
      const metadata: Record<string, any> = {
        merchantUpiId: tc.expectedMerchant.merchantUpiId,
        expectedAmount: tc.expectedMerchant.expectedAmount,
        isDuplicateUtr: tc.id === 'tc-003', // Inject duplicate UTR for tc-003
      };
      const fraud = fraudEngine.analyzeFraud(receipt, 'hash-' + tc.id, metadata);

      // 4. Stage 9 Decision Engine
      const decision = decisionEngine.makeDecision(verification, fraud, receipt);

      const durationMs = Date.now() - startTime;
      totalDurationMs += durationMs;

      // Evaluate field extraction accuracy
      if (receipt.amount === tc.expectedReceipt.amount) amountCorrect++;
      if (receipt.upiReference === tc.expectedReceipt.upiReference) upiRefCorrect++;
      if (receipt.receiverUpi === tc.expectedReceipt.receiverUpi) receiverUpiCorrect++;
      if (receipt.status === tc.expectedReceipt.status) statusCorrect++;

      // Evaluate decision engine accuracy
      const isDecisionMatched = decision.action === tc.expectedDecisionAction;
      if (isDecisionMatched) decisionCorrect++;

      testResults.push({
        tcId: tc.id,
        name: tc.name,
        passed: isDecisionMatched,
        durationMs,
      });
    }

    const total = dataset.length;
    const amountAccuracy = Math.round((amountCorrect / total) * 100);
    const upiRefAccuracy = Math.round((upiRefCorrect / total) * 100);
    const receiverUpiAccuracy = Math.round((receiverUpiCorrect / total) * 100);
    const statusAccuracy = Math.round((statusCorrect / total) * 100);
    const decisionAccuracy = Math.round((decisionCorrect / total) * 100);

    const overallAccuracyPercent = decisionAccuracy;
    const averageLatencyMs = Math.round(totalDurationMs / total);

    const markdownReport = BenchmarkReportGenerator.generateMarkdownReport(
      total,
      decisionCorrect,
      total - decisionCorrect,
      overallAccuracyPercent,
      {
        amountAccuracy,
        upiRefAccuracy,
        receiverUpiAccuracy,
        statusAccuracy,
        decisionAccuracy,
      },
      averageLatencyMs,
      testResults
    );

    return {
      totalTestCases: total,
      passCount: decisionCorrect,
      failCount: total - decisionCorrect,
      overallAccuracyPercent,
      fieldMetrics: {
        amountAccuracy,
        upiRefAccuracy,
        receiverUpiAccuracy,
        statusAccuracy,
        decisionAccuracy,
      },
      averageLatencyMs,
      markdownReport,
    };
  }
}

export class BenchmarkReportGenerator {
  /**
   * Generates formatted Markdown report summarizing benchmark accuracy and performance metrics.
   */
  public static generateMarkdownReport(
    total: number,
    passCount: number,
    failCount: number,
    overallAccuracy: number,
    metrics: BenchmarkFieldMetrics,
    avgLatency: number,
    testResults: Array<{ tcId: string; name: string; passed: boolean; durationMs: number }>
  ): string {
    return `# RESTROEX PAYMENT INTELLIGENCE ENGINE BENCHMARK REPORT

## 📊 Summary Accuracy Metrics
- **Total Test Cases Executed**: ${total}
- **Pass Count**: ${passCount}
- **Fail Count**: ${failCount}
- **Overall System Accuracy**: **${overallAccuracy}%** (Benchmark Target: >= 90%)
- **Average Latency**: **${avgLatency} ms**

## 🎯 Field Extraction Accuracy Breakdown
| Field Name | Target Accuracy | Measured Accuracy | Status |
| :--- | :--- | :--- | :--- |
| **Amount Extraction** | 95% | ${metrics.amountAccuracy}% | ${metrics.amountAccuracy >= 95 ? '✅ PASSED' : '⚠️ REVIEW'} |
| **UTR / Ref No Extraction** | 95% | ${metrics.upiRefAccuracy}% | ${metrics.upiRefAccuracy >= 95 ? '✅ PASSED' : '⚠️ REVIEW'} |
| **Payee VPA Extraction** | 95% | ${metrics.receiverUpiAccuracy}% | ${metrics.receiverUpiAccuracy >= 95 ? '✅ PASSED' : '⚠️ REVIEW'} |
| **Payment Status Detection** | 95% | ${metrics.statusAccuracy}% | ${metrics.statusAccuracy >= 95 ? '✅ PASSED' : '⚠️ REVIEW'} |
| **Decision Engine Precision** | 90% | ${metrics.decisionAccuracy}% | ${metrics.decisionAccuracy >= 90 ? '✅ PASSED' : '⚠️ REVIEW'} |

## 🧪 Test Case Execution Log
${testResults.map((t) => `- **[${t.passed ? 'PASS' : 'FAIL'}]** \`${t.tcId}\`: ${t.name} (${t.durationMs} ms)`).join('\n')}
`;
  }
}
