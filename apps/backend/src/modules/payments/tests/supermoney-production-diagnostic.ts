import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { UniversalAmountExtractor } from '../engine/intelligence/universal-amount.extractor';

async function runSuperMoneyDiagnostic() {
  console.log('=================================================================');
  console.log('🧪 REAL PRODUCTION SUPER.MONEY SCREENSHOT DIAGNOSTIC RUN');
  console.log('=================================================================\n');

  // Super.money Real OCR Text
  const superMoneyOcrText = `super.money
Payment Details
Transferred INR 499.50 to Suraj Khinda (suraj@upi)
Payment Successful
Transaction ID: 987654321098
UPI Ref No: 987654321098
Time: 25 Jul 2026, 11:20 AM`;

  const result = UniversalAmountExtractor.extractAmount(superMoneyOcrText);

  console.log('\n=================================================================');
  console.log('🎯 DIAGNOSTIC SUMMARY EVALUATION');
  console.log('=================================================================');
  console.log(`Extracted Amount: ${result.value}`);
  console.log(`Candidate Score: ${result.candidate?.confidenceScore}`);
  console.log(`Winning Line: "${result.candidate?.sourceLine}"`);
  console.log(`Scoring Reasons: ${JSON.stringify(result.candidate?.scoringReasons, null, 2)}`);
  console.log('=================================================================\n');
}

runSuperMoneyDiagnostic().catch((err) => {
  console.error('❌ Super.money Diagnostic Run Failed:', err);
  process.exit(1);
});
