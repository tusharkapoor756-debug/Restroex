import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { LocalOcrService } from '../engine/services/local-ocr.service';

async function runOcrFusionTests() {
  console.log('=================================================================');
  console.log('🧪 MULTI-PASS OCR ENSEMBLE & FUSION UNIT TESTS');
  console.log('=================================================================\n');

  const localOcr = new LocalOcrService();

  // Test 1: Plain Text OCR Fusion & Understanding
  console.log('Test 1 - Fused OCR Text Processing:');
  const sampleFusedText = `super.money
Payment Successful
₹200.00
July 7 at 5:38 PM
To: KARE TATARAO
7781051879@okbizaxis
Axis Bank
From: GORIPARTHI YAGNESWAR
6302640041@superyes
UPI reference ID: 655435698968`;

  const details = await localOcr.extractDetails(sampleFusedText);

  if (details.amount.value !== 200) {
    throw new Error(`Test 1 Failed: Expected amount 200, got ${details.amount.value}`);
  }
  if (!details.receiverName.value || !details.receiverName.value.includes('KARE TATARAO')) {
    throw new Error(`Test 1 Failed: Receiver name not recognized cleanly: ${details.receiverName.value}`);
  }
  if (details.upiReference.value !== '655435698968') {
    throw new Error(`Test 1 Failed: UPI reference mismatch: ${details.upiReference.value}`);
  }

  console.log('  ✔ Amount ₹200.00 extracted cleanly.');
  console.log(`  ✔ Receiver: "${details.receiverName.value}"`);
  console.log(`  ✔ UPI Ref: "${details.upiReference.value}"\n`);

  console.log('=================================================================');
  console.log('✅ ALL MULTI-PASS OCR FUSION TESTS PASSED SUCCESSFULLY!');
  console.log('=================================================================\n');
}

runOcrFusionTests().catch((err) => {
  console.error('❌ Multi-Pass OCR Fusion Test Failed:', err);
  process.exit(1);
});
