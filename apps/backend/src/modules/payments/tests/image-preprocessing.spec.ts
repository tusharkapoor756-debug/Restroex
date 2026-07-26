import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { ImageNormalizerService } from '../engine/services/image-normalizer.service';
import { NormalizedImage } from '../engine/types/foundation-types';

async function runImagePreprocessingTests() {
  console.log('=================================================================');
  console.log('🧪 SPRINT 2: IMAGE PREPROCESSING ENGINE UNIT TESTS');
  console.log('=================================================================\n');

  // Test 1: Image & File Validation
  console.log('Test 1 - Image Buffer Validation:');
  try {
    ImageNormalizerService.processImage(Buffer.alloc(0));
    throw new Error('Test 1 Failed: Expected error for 0-byte buffer.');
  } catch (err: any) {
    if (!err.message.includes('empty')) {
      throw new Error(`Test 1 Failed unexpected error: ${err.message}`);
    }
  }
  console.log('  ✔ Empty buffer validation caught cleanly.\n');

  // Test 2: PNG Header Metadata & Resolution Analysis
  console.log('Test 2 - PNG Header Metadata & Resolution Analysis:');
  // Create a minimal 800x1200 valid PNG chunk header buffer
  const pngHeader = Buffer.alloc(30);
  // PNG Magic Bytes
  pngHeader[0] = 0x89;
  pngHeader[1] = 0x50;
  pngHeader[2] = 0x4e;
  pngHeader[3] = 0x47;
  // IHDR width (800) and height (1200)
  pngHeader.writeUInt32BE(800, 16);
  pngHeader.writeUInt32BE(1200, 20);

  const pngResult: NormalizedImage = ImageNormalizerService.processImage(pngHeader);

  if (pngResult.format !== 'png') {
    throw new Error(`Test 2 Failed: Expected format "png", got "${pngResult.format}"`);
  }
  if (pngResult.width !== 800 || pngResult.height !== 1200) {
    throw new Error(`Test 2 Failed: Expected dimensions 800x1200, got ${pngResult.width}x${pngResult.height}`);
  }
  console.log('  ✔ PNG Header Metadata and dimensions extracted cleanly.\n');

  // Test 3: Dark Mode Detection & Brightness/Contrast Scoring
  console.log('Test 3 - Dark Mode Detection & Luminance Analysis:');
  // Create dark buffer sample (all dark byte values e.g. 20)
  const darkBuffer = Buffer.alloc(100, 20);
  // Copy PNG header magic bytes so metadata passes
  pngHeader.copy(darkBuffer, 0, 0, 24);

  const darkResult = ImageNormalizerService.processImage(darkBuffer);

  if (!darkResult.isDarkMode) {
    throw new Error('Test 3 Failed: Expected isDarkMode = true for low luminance buffer.');
  }
  if (darkResult.brightnessScore >= 45) {
    throw new Error(`Test 3 Failed: Expected brightnessScore < 45, got ${darkResult.brightnessScore}`);
  }
  console.log('  ✔ Dark mode UI theme detected successfully based on luminance statistics.\n');

  // Test 4: NormalizedImage Model Schema Compliance
  console.log('Test 4 - NormalizedImage Output Schema Compliance:');
  if (!darkResult.buffer || !Buffer.isBuffer(darkResult.buffer)) {
    throw new Error('Test 4 Failed: NormalizedImage missing output Buffer.');
  }
  if (typeof darkResult.orientation !== 'number') {
    throw new Error('Test 4 Failed: NormalizedImage missing orientation number.');
  }
  if (typeof darkResult.contrastScore !== 'number') {
    throw new Error('Test 4 Failed: NormalizedImage missing contrastScore.');
  }
  if (typeof darkResult.hasAutoRotated !== 'boolean') {
    throw new Error('Test 4 Failed: NormalizedImage missing hasAutoRotated flag.');
  }
  console.log('  ✔ NormalizedImage schema completely verified.\n');

  console.log('=================================================================');
  console.log('✅ ALL SPRINT 2 IMAGE PREPROCESSING UNIT TESTS PASSED SUCCESSFULLY!');
  console.log('=================================================================\n');
}

runImagePreprocessingTests().catch((err) => {
  console.error('❌ Image Preprocessing Unit Tests Failed:', err);
  process.exit(1);
});
