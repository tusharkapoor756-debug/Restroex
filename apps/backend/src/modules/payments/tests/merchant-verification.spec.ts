import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { MerchantVerificationEngine } from '../engine/services/merchant-verification.engine';
import { StructuredPaymentReceipt } from '../engine/types/structured-receipt.schema';
import { ExpectedMerchantData, MerchantVerificationResult } from '../engine/types/foundation-types';

async function runMerchantVerificationTests() {
  console.log('=================================================================');
  console.log('🧪 SPRINT 7: MERCHANT VERIFICATION ENGINE UNIT TESTS');
  console.log('=================================================================\n');

  const engine = new MerchantVerificationEngine();

  const mockReceipt: StructuredPaymentReceipt = {
    amount: 500,
    currency: 'INR',
    receiverName: 'Restroex Cafe Private Limited',
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

  const expectedMerchant: ExpectedMerchantData = {
    merchantId: 'mch-101',
    merchantName: 'Restroex Cafe',
    merchantUpiId: 'restroex@upi',
    expectedAmount: 500,
    orderId: 'ord-999',
  };

  // Test 1: Full Merchant Verification Match
  console.log('Test 1 - Full Merchant Verification Match:');
  const result: MerchantVerificationResult = engine.verifyMerchant(mockReceipt, expectedMerchant);

  if (!result.upiMatch || !result.nameMatch || !result.amountMatch || !result.statusMatch) {
    throw new Error('Test 1 Failed: Expected all merchant verification rules to pass.');
  }
  if (result.overallMatchScore !== 100) {
    throw new Error(`Test 1 Failed: Expected match score 100, got ${result.overallMatchScore}`);
  }
  if (result.discrepancies.length !== 0) {
    throw new Error('Test 1 Failed: Expected zero discrepancies for perfect match.');
  }
  console.log('  ✔ Merchant UPI, Name, Amount, and Status matched cleanly (Score: 100).\n');

  // Test 2: Merchant UPI Mismatch
  console.log('Test 2 - Merchant UPI Mismatch Detection:');
  const wrongUpiReceipt = { ...mockReceipt, receiverUpi: 'imposter@upi' };
  const upiMismatchResult = engine.verifyMerchant(wrongUpiReceipt, expectedMerchant);

  if (upiMismatchResult.upiMatch) {
    throw new Error('Test 2 Failed: Expected upiMatch = false for mismatching VPA.');
  }
  if (upiMismatchResult.discrepancies.length === 0) {
    throw new Error('Test 2 Failed: Expected discrepancy message for UPI mismatch.');
  }
  console.log('  ✔ Merchant UPI mismatch caught and reported cleanly.\n');

  // Test 3: Order Amount Mismatch
  console.log('Test 3 - Order Amount Mismatch Detection:');
  const wrongAmountReceipt = { ...mockReceipt, amount: 250 };
  const amountMismatchResult = engine.verifyMerchant(wrongAmountReceipt, expectedMerchant);

  if (amountMismatchResult.amountMatch) {
    throw new Error('Test 3 Failed: Expected amountMatch = false for amount mismatch.');
  }
  if (!amountMismatchResult.discrepancies.some((d) => d.includes('Amount Mismatch'))) {
    throw new Error('Test 3 Failed: Amount mismatch discrepancy missing.');
  }
  console.log('  ✔ Order amount mismatch detected cleanly.\n');

  // Test 4: Pure Merchant Verification Schema Compliance (No Fraud Calculation)
  console.log('Test 4 - Merchant Verification Output Schema Compliance:');
  if ((result as any).fraudScore !== undefined || (result as any).recommendation !== undefined) {
    throw new Error('Test 4 Failed: Merchant verification leaked fraud or decision logic!');
  }
  console.log('  ✔ Output is purely MerchantVerificationResult without fraud/decision logic.\n');

  console.log('=================================================================');
  console.log('✅ ALL SPRINT 7 MERCHANT VERIFICATION UNIT TESTS PASSED SUCCESSFULLY!');
  console.log('=================================================================\n');
}

runMerchantVerificationTests().catch((err) => {
  console.error('❌ Merchant Verification Unit Tests Failed:', err);
  process.exit(1);
});
