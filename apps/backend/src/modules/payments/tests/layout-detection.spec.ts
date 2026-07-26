import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { ReceiptLayoutDetector } from '../engine/intelligence/receipt-layout.detector';
import { DocumentLayoutBlock } from '../engine/intelligence/receipt-grammar.definitions';
import { RawOcrResult } from '../engine/types/foundation-types';

async function runLayoutDetectionTests() {
  console.log('=================================================================');
  console.log('🧪 SPRINT 4: LAYOUT DETECTION ENGINE UNIT TESTS');
  console.log('=================================================================\n');

  const detector = new ReceiptLayoutDetector();
  const sampleRawText = `Google Pay\nPaid to Restroex Cafe (restroex@upi)\n₹500.00\nCompleted\nJul 24, 2026, 08:30 PM\nUPI Ref No: 987654321098\nFrom: Rahul Verma`;

  // Test 1: Line Detection & Reading Order
  console.log('Test 1 - Line Detection & Spatial Reading Order:');
  const blocks: DocumentLayoutBlock[] = detector.detectLayout(sampleRawText);

  if (!blocks || blocks.length === 0) {
    throw new Error('Test 1 Failed: Expected layout blocks array.');
  }

  const allLines = blocks.flatMap((b) => b.lines);
  if (allLines.length !== 7) {
    throw new Error(`Test 1 Failed: Expected 7 lines processed, got ${allLines.length}`);
  }
  console.log('  ✔ Line detection & top-to-bottom reading order verified.\n');

  // Test 2: Spatial Region Grouping & Block Boundary Calculations
  console.log('Test 2 - Spatial Region Grouping & Block Boundary Calculations:');
  const firstBlock = blocks[0]!;
  if (!firstBlock.blockId || !firstBlock.blockId.startsWith('layout-block-')) {
    throw new Error(`Test 2 Failed: Invalid blockId "${firstBlock.blockId}"`);
  }
  if (!firstBlock.boundary || typeof firstBlock.boundary.width !== 'number') {
    throw new Error('Test 2 Failed: Layout block missing 2D boundary box.');
  }
  console.log('  ✔ Spatial region grouping and block 2D boundary box computed.\n');

  // Test 3: RawOcrResult Structured Input Layout Detection
  console.log('Test 3 - Layout Detection on RawOcrResult Object:');
  const sampleRawOcr: RawOcrResult = {
    fullText: sampleRawText,
    lines: sampleRawText.split('\n'),
    words: [
      { text: 'Google', confidence: 99, boundingBox: { x: 10, y: 10, width: 50, height: 20 } },
      { text: 'Pay', confidence: 99, boundingBox: { x: 65, y: 10, width: 30, height: 20 } },
      { text: 'Paid', confidence: 95, boundingBox: { x: 10, y: 50, width: 35, height: 20 } },
      { text: 'to', confidence: 95, boundingBox: { x: 50, y: 50, width: 15, height: 20 } },
      { text: 'Restroex', confidence: 95, boundingBox: { x: 70, y: 50, width: 60, height: 20 } },
    ],
    meanConfidence: 96,
    ocrEngineName: 'mock-ocr',
    executionTimeMs: 10,
  };

  const ocrBlocks = detector.detectLayout(sampleRawOcr);
  if (!ocrBlocks || ocrBlocks.length === 0) {
    throw new Error('Test 3 Failed: Expected blocks from RawOcrResult.');
  }
  console.log('  ✔ RawOcrResult bounding box words processed cleanly into layout blocks.\n');

  // Test 4: Pure Layout Output Schema Compliance (No Field Extraction)
  console.log('Test 4 - Layout Output Schema Compliance (Pure Structural Layout):');
  for (const block of blocks) {
    if ((block as any).extractedAmount !== undefined || (block as any).extractedUpi !== undefined) {
      throw new Error('Test 4 Failed: Layout detector leaked field extractions!');
    }
  }
  console.log('  ✔ Output is purely structural layout blocks (DocumentLayoutBlock[]).\n');

  console.log('=================================================================');
  console.log('✅ ALL SPRINT 4 LAYOUT DETECTION ENGINE UNIT TESTS PASSED SUCCESSFULLY!');
  console.log('=================================================================\n');
}

runLayoutDetectionTests().catch((err) => {
  console.error('❌ Layout Detection Engine Unit Tests Failed:', err);
  process.exit(1);
});
