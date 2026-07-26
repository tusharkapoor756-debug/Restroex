import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { LocalOcrService } from '../engine/services/local-ocr.service';

async function runOcrDebugStageTests() {
  console.log('=================================================================');
  console.log('🧪 OCR DEBUG STAGE & TARGETED HERO REGION CROP TESTS');
  console.log('=================================================================\n');

  const localOcr = new LocalOcrService();

  // Test 1: Simulated Image Buffer Debug Save
  console.log('Test 1 - OCR Debug Stage Image Buffer Persistence:');
  const dummyBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );

  await localOcr.extractDetails(dummyBuffer);

  const debugDir = path.resolve(process.cwd(), 'tmp/ocr-debug');
  if (!fs.existsSync(debugDir)) {
    throw new Error('Test 1 Failed: Debug directory tmp/ocr-debug/ was not created.');
  }

  const files = fs.readdirSync(debugDir);
  const origFiles = files.filter((f) => f.includes('_original.png'));
  const normFiles = files.filter((f) => f.includes('_normalized.png'));

  if (origFiles.length === 0 || normFiles.length === 0) {
    throw new Error('Test 1 Failed: Debug image files were not written to tmp/ocr-debug/.');
  }

  console.log(`  ✔ Original image debug file: ${origFiles[origFiles.length - 1]}`);
  console.log(`  ✔ Normalized image debug file: ${normFiles[normFiles.length - 1]}`);
  console.log('  ✔ OCR Debug stage successfully saved image buffers for visual comparison.\n');

  console.log('=================================================================');
  console.log('✅ ALL OCR DEBUG STAGE TESTS PASSED SUCCESSFULLY!');
  console.log('=================================================================\n');
}

runOcrDebugStageTests().catch((err) => {
  console.error('❌ OCR Debug Stage Test Failed:', err);
  process.exit(1);
});
