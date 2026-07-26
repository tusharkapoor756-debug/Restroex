import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { FraudEngine } from '../engine/services/fraud.engine';
import { StructuredPaymentReceipt } from '../engine/types/structured-receipt.schema';
import { FraudAnalysisResult } from '../engine/types/foundation-types';

async function runFraudEngineTests() {
  console.log('=================================================================');
  console.log('🧪 SPRINT 8: FRAUD ENGINE UNIT TESTS');
  console.log('=================================================================\n');

  const engine = new FraudEngine();

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

  const cleanMetadata = {
    merchantUpiId: 'restroex@upi',
    expectedAmount: 500,
    isDuplicateScreenshot: false,
    isDuplicateUtr: false,
  };

  // Test 1: Clean Transaction Fraud Analysis (Low Risk)
  console.log('Test 1 - Clean Transaction Fraud Analysis:');
  const cleanResult: FraudAnalysisResult = engine.analyzeFraud(mockReceipt, 'hash-12345', cleanMetadata);

  if (cleanResult.isDuplicateScreenshot || cleanResult.isDuplicateUtr || cleanResult.isWrongMerchant || cleanResult.amountMismatch) {
    throw new Error('Test 1 Failed: Expected zero fraud flags for clean receipt.');
  }
  if (cleanResult.riskLevel !== 'LOW' || cleanResult.fraudScore !== 0) {
    throw new Error(`Test 1 Failed: Expected LOW risk & 0 score, got ${cleanResult.riskLevel} (${cleanResult.fraudScore})`);
  }
  console.log('  ✔ Clean receipt correctly analyzed as LOW risk (Score: 0).\n');

  // Test 2: Duplicate Screenshot Detection
  console.log('Test 2 - Duplicate Screenshot Fraud Detection:');
  const duplicateMetadata = { ...cleanMetadata, isDuplicateScreenshot: true };
  const dupResult = engine.analyzeFraud(mockReceipt, 'hash-12345', duplicateMetadata);

  if (!dupResult.isDuplicateScreenshot) {
    throw new Error('Test 2 Failed: Expected isDuplicateScreenshot = true.');
  }
  if (dupResult.fraudScore < 50 || (dupResult.riskLevel !== 'HIGH' && dupResult.riskLevel !== 'CRITICAL')) {
    throw new Error(`Test 2 Failed: Expected HIGH/CRITICAL risk for duplicate image, got ${dupResult.riskLevel}`);
  }
  console.log('  ✔ Duplicate screenshot flagged and risk score escalated cleanly.\n');

  // Test 3: Duplicate UTR & Wrong Merchant Penalty
  console.log('Test 3 - Duplicate UTR & Wrong Merchant Penalty:');
  const fraudMetadata = {
    merchantUpiId: 'realmerchant@upi',
    expectedAmount: 500,
    isDuplicateUtr: true,
  };
  const fraudResult = engine.analyzeFraud(mockReceipt, 'hash-12345', fraudMetadata);

  if (!fraudResult.isDuplicateUtr || !fraudResult.isWrongMerchant) {
    throw new Error('Test 3 Failed: Expected duplicate UTR and wrong merchant flags.');
  }
  if (fraudResult.riskLevel !== 'CRITICAL') {
    throw new Error(`Test 3 Failed: Expected CRITICAL risk level, got ${fraudResult.riskLevel}`);
  }
  console.log('  ✔ Duplicate UTR & wrong merchant flags combined to CRITICAL risk level.\n');

  // Test 4: Pure Fraud Analysis Output Schema Compliance (No Decision Action)
  console.log('Test 4 - Fraud Output Schema Compliance:');
  if ((fraudResult as any).decisionAction !== undefined || (fraudResult as any).isApproved !== undefined) {
    throw new Error('Test 4 Failed: Fraud engine leaked final decision engine logic!');
  }
  console.log('  ✔ Output is purely FraudAnalysisResult without decision engine execution.\n');

  console.log('=================================================================');
  console.log('✅ ALL SPRINT 8 FRAUD ENGINE UNIT TESTS PASSED SUCCESSFULLY!');
  console.log('=================================================================\n');
}

runFraudEngineTests().catch((err) => {
  console.error('❌ Fraud Engine Unit Tests Failed:', err);
  process.exit(1);
});
