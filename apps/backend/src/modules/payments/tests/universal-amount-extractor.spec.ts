import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { UniversalAmountExtractor } from '../engine/intelligence/universal-amount.extractor';

async function runUniversalAmountExtractorTests() {
  console.log('=================================================================');
  console.log('🧪 UNIVERSAL AMOUNT EXTRACTOR UNIT TESTS');
  console.log('=================================================================\n');

  // Test 1: Google Pay Screenshot (₹200.00)
  console.log('Test 1 - Google Pay Screenshot (₹200.00):');
  const gpayText = `Google Pay\nPaid to Restroex Cafe\n₹200.00\nCompleted\nUPI Ref No: 987654321098`;
  const res1 = UniversalAmountExtractor.extractAmount(gpayText);
  if (res1.value !== 200) {
    throw new Error(`Test 1 Failed: Expected amount 200, got ${res1.value}`);
  }
  if (!res1.candidate || res1.candidate.confidenceScore < 80) {
    throw new Error(`Test 1 Failed: Expected high confidence candidate, got score ${res1.candidate?.confidenceScore}`);
  }
  console.log('  ✔ Google Pay ₹200.00 extracted with score ' + res1.candidate.confidenceScore + '.\n');

  // Test 2: PhonePe Screenshot (₹1,500)
  console.log('Test 2 - PhonePe Screenshot (₹1,500):');
  const phonepeText = `PhonePe\nPayment Successful\nPaid to Restroex Cafe\n₹1,500\nUTR: 876543210987`;
  const res2 = UniversalAmountExtractor.extractAmount(phonepeText);
  if (res2.value !== 1500) {
    throw new Error(`Test 2 Failed: Expected amount 1500, got ${res2.value}`);
  }
  console.log('  ✔ PhonePe ₹1,500 extracted cleanly.\n');

  // Test 3: Paytm Screenshot (Rs 350)
  console.log('Test 3 - Paytm Screenshot (Rs 350):');
  const paytmText = `Paytm\nPaid to Merchant\nRs 350\nSuccessful\nTxn ID: 765432109876`;
  const res3 = UniversalAmountExtractor.extractAmount(paytmText);
  if (res3.value !== 350) {
    throw new Error(`Test 3 Failed: Expected amount 350, got ${res3.value}`);
  }
  console.log('  ✔ Paytm Rs 350 extracted cleanly.\n');

  // Test 4: Super.money / BHIM Screenshot (INR 499.50)
  console.log('Test 4 - BHIM / Super.money Screenshot (INR 499.50):');
  const bhimText = `Super.money\nTransferred INR 499.50 to Restroex\nRef: 654321098765`;
  const res4 = UniversalAmountExtractor.extractAmount(bhimText);
  if (res4.value !== 499.5) {
    throw new Error(`Test 4 Failed: Expected amount 499.5, got ${res4.value}`);
  }
  console.log('  ✔ BHIM / Super.money INR 499.50 extracted cleanly.\n');

  // Test 5: Hard Exclusion Rules (UTR 12-digit number should NOT be extracted as amount)
  console.log('Test 5 - UTR & Phone Number Exclusion Guardrails:');
  const noiseText = `UPI Ref No: 987654321098\nDate: 24 Jul 2026\nPaid ₹200.00`;
  const res5 = UniversalAmountExtractor.extractAmount(noiseText);
  if (res5.value !== 200) {
    throw new Error(`Test 5 Failed: Expected 200, but UTR/date noise was extracted as ${res5.value}`);
  }
  console.log('  ✔ UTR digits and date years correctly excluded from amount candidates.\n');

  console.log('=================================================================');
  console.log('✅ ALL UNIVERSAL AMOUNT EXTRACTOR UNIT TESTS PASSED SUCCESSFULLY!');
  console.log('=================================================================\n');
}

runUniversalAmountExtractorTests().catch((err) => {
  console.error('❌ Universal Amount Extractor Unit Tests Failed:', err);
  process.exit(1);
});
