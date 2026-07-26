import { PaymentIntelligenceEngine } from '../engine/intelligence/payment-intelligence.engine';
import { PaymentVerificationContext } from '../types/payment-analysis.types';
import { PaymentTextRuleEngine } from '../engine/intelligence/text-rule-engine';
import { PaymentFingerprintService } from '../engine/services/payment-fingerprint.service';

async function testPaymentIntelligenceEngine() {
  console.log('🧪 Running Payment Intelligence Engine tests...\n');

  // Test 1: Generic Text Rule Engine
  const sampleGPayText = `
    Google Pay
    Paid to Restroex Cafe (restroex@upi)
    ₹399.00
    Completed
    Jul 24, 2026, 05:45 PM
    UPI Ref No: 123456789012
    From: Tushar Kapoor
    State Bank of India
  `;

  const parsedDetails = PaymentTextRuleEngine.parseRawText(sampleGPayText);
  console.log('Test 1 - Local OCR Rule Engine Extraction:');
  console.log('  Amount:', parsedDetails.amount.value, `(Conf: ${parsedDetails.amount.confidence}%)`);
  console.log('  UTR Ref:', parsedDetails.upiReference.value, `(Conf: ${parsedDetails.upiReference.confidence}%)`);
  console.log('  Receiver UPI:', parsedDetails.receiverUpiId.value, `(Conf: ${parsedDetails.receiverUpiId.confidence}%)`);
  console.log('  Status:', parsedDetails.paymentStatusInScreenshot.value);
  console.log('  Overall Confidence:', parsedDetails.overallConfidence, '%\n');

  if (parsedDetails.amount.value !== 399 || parsedDetails.upiReference.value !== '123456789012') {
    throw new Error('Test 1 Failed: Incorrect field extraction from sample raw text');
  }

  // Test 2: Dual Fingerprint Generation
  const fingerprints = PaymentFingerprintService.generateFingerprints({
    amount: 399,
    upiReference: '123456789012',
    receiverUpiId: 'restroex@upi',
    transactionId: 'TXN881923',
    bankName: 'State Bank of India',
    timestamp: '05:45 PM',
    date: 'Jul 24, 2026',
  });

  console.log('Test 2 - Dual Fingerprints:');
  console.log('  Exact Fingerprint:', fingerprints.exactFingerprint);
  console.log('  Similarity Fingerprint:', fingerprints.similarityFingerprint, '\n');

  if (!fingerprints.exactFingerprint || !fingerprints.similarityFingerprint) {
    throw new Error('Test 2 Failed: Fingerprint generation failed');
  }

  // Test 3: Full Pipeline Evaluation (Matching Merchant UPI)
  const engine = new PaymentIntelligenceEngine();
  const context: PaymentVerificationContext = {
    paymentId: 'test-payment-101',
    orderId: 'test-order-202',
    restaurantId: 'test-rest-303',
    expectedAmount: 399,
    merchantUpiId: 'restroex@upi',
  };

  const analysisResult = await engine.analyze(context, sampleGPayText);
  console.log('Test 3 - Full Payment Intelligence Pipeline Result (Matching Merchant):');
  console.log('  Recommended Action:', analysisResult.recommendedAction);
  console.log('  OCR Confidence:', analysisResult.ocrConfidence, '%');
  console.log('  Verification Score:', analysisResult.verificationScore, '%');
  console.log('  Risk Score:', analysisResult.riskScore, '/ 100');
  console.log('  Human Summary:', analysisResult.humanSummary);
  console.log('  Explanation Checks Count:', analysisResult.explanationChecks.length);

  if (analysisResult.recommendedAction !== 'APPROVE') {
    throw new Error(`Test 3 Failed: Expected APPROVE recommendation but got ${analysisResult.recommendedAction}`);
  }

  // Test 4: Merchant UPI Mismatch -> REJECT
  const mismatchContext: PaymentVerificationContext = {
    paymentId: 'test-payment-102',
    orderId: 'test-order-203',
    restaurantId: 'test-rest-303',
    expectedAmount: 399,
    merchantUpiId: '9618339096@ptyes', // Mismatch vs screenshot's restroex@upi!
  };

  const mismatchResult = await engine.analyze(mismatchContext, sampleGPayText);
  console.log('\nTest 4 - Merchant UPI Mismatch Result (Wrong Recipient):');
  console.log('  Recommended Action:', mismatchResult.recommendedAction);
  console.log('  Verification Score:', mismatchResult.verificationScore, '%');
  console.log('  Fraud Risk Score:', mismatchResult.riskScore, '/ 100');
  console.log('  Human Summary:', mismatchResult.humanSummary);

  if (mismatchResult.recommendedAction !== 'REJECT') {
    throw new Error(`Test 4 Failed: Expected REJECT for merchant UPI mismatch but got ${mismatchResult.recommendedAction}`);
  }

  console.log('\n✅ All Payment Intelligence Engine tests passed successfully!');
}

testPaymentIntelligenceEngine().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
