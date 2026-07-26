import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { SectionClassifierService } from '../engine/intelligence/section-classifier.service';
import { ReceiptLayoutDetector } from '../engine/intelligence/receipt-layout.detector';
import { SectionGraph } from '../engine/types/foundation-types';

async function runSectionClassifierTests() {
  console.log('=================================================================');
  console.log('🧪 SPRINT 5: SECTION CLASSIFIER ENGINE UNIT TESTS');
  console.log('=================================================================\n');

  const layoutDetector = new ReceiptLayoutDetector();
  const classifier = new SectionClassifierService();

  const sampleText = `Google Pay\nPaid to Restroex Cafe (restroex@upi)\n₹500.00\nCompleted\nJul 24, 2026, 08:30 PM\nUPI Ref No: 987654321098\nFrom: Rahul Verma\nPowered by UPI`;

  const layoutBlocks = layoutDetector.detectLayout(sampleText);

  // Test 1: Section Graph Classification
  console.log('Test 1 - Section Graph Classification:');
  const sectionGraph: SectionGraph = classifier.classifySections(layoutBlocks);

  if (!sectionGraph || !Array.isArray(sectionGraph.sections)) {
    throw new Error('Test 1 Failed: Expected SectionGraph with sections array.');
  }

  if (sectionGraph.sections.length === 0) {
    throw new Error('Test 1 Failed: Sections array is empty.');
  }
  console.log('  ✔ Layout blocks classified into SectionGraph nodes cleanly.\n');

  // Test 2: App & Status Section Metadata Detection
  console.log('Test 2 - Payment App & Status Section Detection:');
  if (sectionGraph.detectedApp !== 'Google Pay') {
    throw new Error(`Test 2 Failed: Expected detectedApp "Google Pay", got "${sectionGraph.detectedApp}"`);
  }

  if (sectionGraph.detectedStatus !== 'SUCCESS') {
    throw new Error(`Test 2 Failed: Expected detectedStatus "SUCCESS", got "${sectionGraph.detectedStatus}"`);
  }
  console.log('  ✔ Payment app (Google Pay) and status (SUCCESS) detected in section graph.\n');

  // Test 3: Hero Amount Candidate Identification
  console.log('Test 3 - Hero Amount Candidate Identification:');
  if (!sectionGraph.heroAmountCandidates || sectionGraph.heroAmountCandidates.length === 0) {
    throw new Error('Test 3 Failed: Expected heroAmountCandidates to include numeric candidates.');
  }

  if (sectionGraph.heroAmountCandidates[0] !== 500) {
    throw new Error(`Test 3 Failed: Expected candidate 500, got ${sectionGraph.heroAmountCandidates[0]}`);
  }
  console.log('  ✔ Hero amount candidate (500) identified.\n');

  // Test 4: Pure Section Graph Schema Compliance (No Merchant Verification)
  console.log('Test 4 - Section Graph Schema Compliance:');
  for (const sec of sectionGraph.sections) {
    if (!sec.sectionType || !sec.lines || typeof sec.confidence !== 'number') {
      throw new Error('Test 4 Failed: Invalid SectionBlock schema.');
    }
  }

  if ((sectionGraph as any).isMerchantVerified !== undefined) {
    throw new Error('Test 4 Failed: Section classifier leaked merchant verification logic!');
  }
  console.log('  ✔ Output is purely a SectionGraph model without merchant verification.\n');

  console.log('=================================================================');
  console.log('✅ ALL SPRINT 5 SECTION CLASSIFIER UNIT TESTS PASSED SUCCESSFULLY!');
  console.log('=================================================================\n');
}

runSectionClassifierTests().catch((err) => {
  console.error('❌ Section Classifier Unit Tests Failed:', err);
  process.exit(1);
});
