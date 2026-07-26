import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { OcrService, MockOcrAdapter } from '../engine/services/ocr.service';
import { RawOcrResult } from '../engine/types/foundation-types';

async function runOcrEngineTests() {
  console.log('=================================================================');
  console.log('🧪 SPRINT 3: OCR ENGINE UNIT TESTS');
  console.log('=================================================================\n');

  // Test 1: Mock OCR Adapter Execution
  console.log('Test 1 - Mock OCR Adapter Execution:');
  const mockAdapter = new MockOcrAdapter();
  const sampleText = 'PhonePe\nPaid to Restroex Cafe\n₹750.00\nTransaction Successful';
  const mockResult: RawOcrResult = await mockAdapter.recognize(sampleText);

  if (mockResult.ocrEngineName !== 'mock-ocr') {
    throw new Error(`Test 1 Failed: Expected engine "mock-ocr", got "${mockResult.ocrEngineName}"`);
  }
  if (mockResult.lines.length !== 4) {
    throw new Error(`Test 1 Failed: Expected 4 lines, got ${mockResult.lines.length}`);
  }
  console.log('  ✔ Mock OCR adapter executed cleanly.\n');

  // Test 2: OcrService Abstraction & Word Bounding Boxes
  console.log('Test 2 - OcrService & Word Token Bounding Box Extraction:');
  const ocrService = new OcrService(mockAdapter);
  const result: RawOcrResult = await ocrService.extractRawOcr(sampleText);

  if (!result.words || result.words.length === 0) {
    throw new Error('Test 2 Failed: Expected word tokens array.');
  }

  const firstWord = result.words[0];
  if (!firstWord || !firstWord.boundingBox) {
    throw new Error('Test 2 Failed: Word token missing 2D bounding box.');
  }
  if (typeof firstWord.confidence !== 'number') {
    throw new Error('Test 2 Failed: Word token missing confidence score.');
  }
  console.log('  ✔ Word token bounding boxes and confidence scores extracted.\n');

  // Test 3: Raw OCR Model Schema Integrity (No field interpretation)
  console.log('Test 3 - Raw OCR Result Model Schema Compliance (Pure Text):');
  if (typeof result.fullText !== 'string') {
    throw new Error('Test 3 Failed: RawOcrResult missing fullText string.');
  }
  if (typeof result.meanConfidence !== 'number') {
    throw new Error('Test 3 Failed: RawOcrResult missing meanConfidence score.');
  }
  if (typeof result.executionTimeMs !== 'number') {
    throw new Error('Test 3 Failed: RawOcrResult missing executionTimeMs metric.');
  }
  // Verify ZERO business/semantic interpretation in raw OCR result
  if ((result as any).amount !== undefined || (result as any).receiver !== undefined) {
    throw new Error('Test 3 Failed: RawOcrResult leaked semantic field interpretations!');
  }
  console.log('  ✔ Raw OCR Result model is purely un-parsed raw text.\n');

  console.log('=================================================================');
  console.log('✅ ALL SPRINT 3 OCR ENGINE UNIT TESTS PASSED SUCCESSFULLY!');
  console.log('=================================================================\n');
}

runOcrEngineTests().catch((err) => {
  console.error('❌ OCR Engine Unit Tests Failed:', err);
  process.exit(1);
});
