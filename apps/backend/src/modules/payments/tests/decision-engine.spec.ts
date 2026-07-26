import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { DecisionEngine } from '../engine/services/decision.engine';
import { MerchantVerificationResult, FraudAnalysisResult, PaymentDecision } from '../engine/types/foundation-types';
import { StructuredPaymentReceipt } from '../engine/types/structured-receipt.schema';

async function runDecisionEngineTests() {
  console.log('=================================================================');
  console.log('🧪 SPRINT 9: DECISION ENGINE UNIT TESTS');
  console.log('=================================================================\n');

  const engine = new DecisionEngine();

  const mockReceipt: StructuredPaymentReceipt = {
    amount: 500,
    currency: 'INR',
    receiverName: 'Restroex Cafe',
    receiverUpi: 'restroex@upi',
    receiverAccount: null,
    senderName: 'Rahul Verma',
    senderUpi: 'rahul@okaxis',
    senderAccount: null,
    transactionId: '987654321098',
    upiReference: '987654321098',
    status: 'SUCCESS',
    paymentApp: 'Google Pay',
    paymentMethod: 'UPI',
    bankName: 'HDFC Bank',
    timestamp: '08:30 PM',
    date: 'Jul 24, 2026',
    confidenceScores: {
      amountConfidence: 95,
      receiverUpiConfidence: 95,
      upiReferenceConfidence: 95,
      statusConfidence: 95,
      overallConfidence: 100,
      isHighConfidence: true,
      requiresSecondaryReview: false,
    },
    rawLineCount: 7,
  };

  const cleanVerification: MerchantVerificationResult = {
    upiMatch: true,
    nameMatch: true,
    amountMatch: true,
    statusMatch: true,
    overallMatchScore: 100,
    discrepancies: [],
  };

  const cleanFraud: FraudAnalysisResult = {
    isDuplicateScreenshot: false,
    isDuplicateUtr: false,
    isWrongMerchant: false,
    amountMismatch: false,
    fraudScore: 0,
    riskLevel: 'LOW',
    riskFlags: [],
  };

  // Test 1: Auto-Approval Payment Decision
  console.log('Test 1 - Auto-Approval Payment Decision:');
  const approveDecision: PaymentDecision = engine.makeDecision(cleanVerification, cleanFraud, mockReceipt);

  if (approveDecision.action !== 'APPROVE') {
    throw new Error(`Test 1 Failed: Expected APPROVE, got ${approveDecision.action}`);
  }
  if (approveDecision.confidenceScore < 90) {
    throw new Error(`Test 1 Failed: Expected high confidence score >= 90, got ${approveDecision.confidenceScore}`);
  }
  if (!approveDecision.explanations.some((e) => e.includes('APPROVED'))) {
    throw new Error('Test 1 Failed: Expected approval explanation string.');
  }
  console.log('  ✔ Clean payment auto-approved cleanly with high confidence score.\n');

  // Test 2: Auto-Rejection Payment Decision (Duplicate UTR)
  console.log('Test 2 - Auto-Rejection Payment Decision:');
  const rejectFraud: FraudAnalysisResult = {
    ...cleanFraud,
    isDuplicateUtr: true,
    fraudScore: 85,
    riskLevel: 'CRITICAL',
    riskFlags: ['Duplicate UTR Detected'],
  };

  const rejectDecision: PaymentDecision = engine.makeDecision(cleanVerification, rejectFraud, mockReceipt);

  if (rejectDecision.action !== 'REJECT') {
    throw new Error(`Test 2 Failed: Expected REJECT, got ${rejectDecision.action}`);
  }
  if (!rejectDecision.explanations.some((e) => e.includes('REJECTED'))) {
    throw new Error('Test 2 Failed: Expected rejection explanation audit message.');
  }
  console.log('  ✔ Duplicate UTR transaction auto-rejected cleanly with audit explanation.\n');

  // Test 3: Manual Review Routing Payment Decision
  console.log('Test 3 - Manual Review Routing Payment Decision:');
  const reviewFraud: FraudAnalysisResult = {
    ...cleanFraud,
    fraudScore: 35,
    riskLevel: 'MEDIUM',
    riskFlags: ['Medium risk indicator'],
  };

  const reviewDecision: PaymentDecision = engine.makeDecision(cleanVerification, reviewFraud, mockReceipt);

  if (reviewDecision.action !== 'MANUAL_REVIEW') {
    throw new Error(`Test 3 Failed: Expected MANUAL_REVIEW, got ${reviewDecision.action}`);
  }
  if (!reviewDecision.explanations.some((e) => e.includes('MANUAL REVIEW'))) {
    throw new Error('Test 3 Failed: Expected manual review explanation audit message.');
  }
  console.log('  ✔ Medium risk transaction routed to MANUAL_REVIEW cleanly.\n');

  // Test 4: PaymentDecision Output Model Schema Compliance
  console.log('Test 4 - PaymentDecision Output Model Schema Compliance:');
  if (!approveDecision.evidence || !approveDecision.evidence.receipt || !approveDecision.evidence.verification) {
    throw new Error('Test 4 Failed: PaymentDecision evidence bundle incomplete.');
  }
  console.log('  ✔ PaymentDecision evidence bundle completely verified.\n');

  console.log('=================================================================');
  console.log('✅ ALL SPRINT 9 DECISION ENGINE UNIT TESTS PASSED SUCCESSFULLY!');
  console.log('=================================================================\n');
}

runDecisionEngineTests().catch((err) => {
  console.error('❌ Decision Engine Unit Tests Failed:', err);
  process.exit(1);
});
