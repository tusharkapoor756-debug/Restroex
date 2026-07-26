import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { UniversalAmountExtractor } from '../engine/intelligence/universal-amount.extractor';
import { SectionClassifierService } from '../engine/intelligence/section-classifier.service';
import { ReceiptLayoutDetector } from '../engine/intelligence/receipt-layout.detector';

async function runOcrPipelineHeroAmountTests() {
  console.log('=================================================================');
  console.log('🧪 OCR PIPELINE HERO AMOUNT & TIMESTAMP FALLBACK TESTS');
  console.log('=================================================================\n');

  // Test 1: Date/time fragments only (e.g. 7, 5, 38 from timestamp 7:05:38 PM)
  console.log('Test 1 - Low-Confidence Timestamp Fragments Discard Guardrail:');
  const timestampOnlyText = `Google Pay\nPayment Received\nJul 24, 2026, 7:05:38 PM\nRef: 987654321098`;
  const res1 = UniversalAmountExtractor.extractAmount(timestampOnlyText);
  if (res1.value !== null) {
    throw new Error(`Test 1 Failed: Expected amount = null for timestamp fragments, but got ${res1.value}`);
  }
  console.log('  ✔ Timestamp fragments (7, 5, 38, 2026) correctly discarded. Returned amount = null cleanly.\n');

  // Test 2: Hero Amount Detection without currency symbol (e.g. "200.00" on hero line)
  console.log('Test 2 - Hero Amount Detection Without Currency Symbol:');
  const heroNoSymbolText = `Paytm\nPaid to Suraj Khinda\n200.00\nPayment Successful\nTxn ID: 876543210987`;
  const layoutDetector = new ReceiptLayoutDetector();
  const blocks = layoutDetector.detectLayout(heroNoSymbolText);
  const classifier = new SectionClassifierService();
  const sectionGraph = classifier.classifySections(blocks);

  if (sectionGraph.heroAmountCandidates.length === 0) {
    throw new Error('Test 2 Failed: SectionClassifierService failed to populate heroAmountCandidates.');
  }

  const res2 = UniversalAmountExtractor.extractAmount(heroNoSymbolText, blocks, sectionGraph);
  if (res2.value !== 200) {
    throw new Error(`Test 2 Failed: Expected hero amount 200, got ${res2.value}`);
  }
  console.log('  ✔ Hero amount 200.00 correctly detected in top block with heroCandidatesCount = ' + sectionGraph.heroAmountCandidates.length + '.\n');

  console.log('=================================================================');
  console.log('✅ ALL OCR PIPELINE HERO AMOUNT TESTS PASSED SUCCESSFULLY!');
  console.log('=================================================================\n');
}

runOcrPipelineHeroAmountTests().catch((err) => {
  console.error('❌ OCR Pipeline Hero Amount Test Failed:', err);
  process.exit(1);
});
