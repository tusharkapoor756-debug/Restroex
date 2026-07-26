import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { UniversalReceiptGrammarEngine } from '../engine/intelligence/universal-receipt-grammar.engine';
import { StructuredPaymentReceipt } from '../engine/types/structured-receipt.schema';

async function runUniversalGrammarTests() {
  console.log('=================================================================');
  console.log('🧪 SPRINT 6: UNIVERSAL GRAMMAR ENGINE UNIT TESTS');
  console.log('=================================================================\n');

  const sampleRawText = `Google Pay
    Paid to Restroex Cafe (restroex@upi)
    ₹500.00
    Completed
    Jul 24, 2026, 08:30 PM
    UPI Ref No: 987654321098
    From: Rahul Verma`;

  // Test 1: Structured Payment Receipt Parsing
  console.log('Test 1 - Structured Payment Receipt Parsing:');
  const receipt: StructuredPaymentReceipt = UniversalReceiptGrammarEngine.parseToStructuredReceipt(sampleRawText);

  if (!receipt) {
    throw new Error('Test 1 Failed: Expected StructuredPaymentReceipt output object.');
  }
  console.log('  ✔ Universal grammar parser produced StructuredPaymentReceipt object.\n');

  // Test 2: Key-Value Association & Semantic Normalization
  console.log('Test 2 - Key-Value Association & Semantic Normalization:');
  if (receipt.amount !== 500) {
    throw new Error(`Test 2 Failed: Expected amount 500, got ${receipt.amount}`);
  }
  if (receipt.receiverUpi !== 'restroex@upi') {
    throw new Error(`Test 2 Failed: Expected VPA "restroex@upi", got "${receipt.receiverUpi}"`);
  }
  if (receipt.upiReference !== '987654321098') {
    throw new Error(`Test 2 Failed: Expected UTR "987654321098", got "${receipt.upiReference}"`);
  }
  if (receipt.status !== 'SUCCESS') {
    throw new Error(`Test 2 Failed: Expected status "SUCCESS", got "${receipt.status}"`);
  }
  console.log('  ✔ Amounts, VPAs, UTRs, and status values normalized cleanly.\n');

  // Test 3: Composite Confidence Model Breakdown
  console.log('Test 3 - Composite Confidence Model Breakdown:');
  const conf = receipt.confidenceScores;
  if (!conf) {
    throw new Error('Test 3 Failed: Confidence score model missing.');
  }
  if (conf.amountConfidence < 90 || conf.upiReferenceConfidence < 90) {
    throw new Error('Test 3 Failed: Individual field confidence calculation mismatch.');
  }
  if (conf.overallConfidence !== 100 || !conf.isHighConfidence) {
    throw new Error(`Test 3 Failed: Expected high overall confidence >= 90, got ${conf.overallConfidence}`);
  }
  console.log('  ✔ Composite confidence model breakdown computed accurately.\n');

  // Test 4: Pure Grammar Engine Output Schema (No Merchant Verification)
  console.log('Test 4 - Pure Structured Receipt Schema Compliance:');
  if ((receipt as any).merchantVerified !== undefined) {
    throw new Error('Test 4 Failed: Grammar engine leaked merchant verification logic!');
  }
  console.log('  ✔ Output is purely a StructuredPaymentReceipt without merchant verification.\n');

  console.log('=================================================================');
  console.log('✅ ALL SPRINT 6 UNIVERSAL GRAMMAR ENGINE UNIT TESTS PASSED SUCCESSFULLY!');
  console.log('=================================================================\n');
}

runUniversalGrammarTests().catch((err) => {
  console.error('❌ Universal Grammar Engine Unit Tests Failed:', err);
  process.exit(1);
});
