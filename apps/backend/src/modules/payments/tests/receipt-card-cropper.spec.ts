import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { ReceiptCardDetectorService } from '../engine/services/receipt-card-detector.service';

async function runReceiptCardCropperTests() {
  console.log('=================================================================');
  console.log('🧪 RECEIPT CARD DETECTOR SERVICE UNIT TESTS');
  console.log('=================================================================\n');

  // Test 1: Standard screenshot canvas (800x1200)
  console.log('Test 1 - Card Bounding Box Detection on Standard Canvas (800x1200):');
  const dummyBuffer = Buffer.alloc(800 * 1200 * 3, 128);
  const cardBox = ReceiptCardDetectorService.detectReceiptCard(dummyBuffer, 800, 1200);

  if (!cardBox || cardBox.width <= 0 || cardBox.height <= 0) {
    throw new Error('Test 1 Failed: Invalid card bounding box returned.');
  }

  console.log(`  ✔ Detected Left: ${cardBox.left}, Top: ${cardBox.top}, Width: ${cardBox.width}, Height: ${cardBox.height}`);
  console.log(`  ✔ Confidence Score: ${cardBox.confidence}%\n`);

  // Test 2: Extreme aspect ratio screenshot canvas (1080x2400 mobile tall display)
  console.log('Test 2 - Mobile Tall Screen Canvas (1080x2400):');
  const tallBuffer = Buffer.alloc(1080 * 2400 * 3, 200);
  const tallCardBox = ReceiptCardDetectorService.detectReceiptCard(tallBuffer, 1080, 2400);

  if (!tallCardBox || tallCardBox.width <= 0 || tallCardBox.height <= 0) {
    throw new Error('Test 2 Failed: Mobile tall screen card bounding box detection failed.');
  }

  console.log(`  ✔ Tall Screen Box: Left=${tallCardBox.left}, Top=${tallCardBox.top}, ${tallCardBox.width}x${tallCardBox.height}\n`);

  console.log('=================================================================');
  console.log('✅ ALL RECEIPT CARD DETECTOR UNIT TESTS PASSED SUCCESSFULLY!');
  console.log('=================================================================\n');
}

runReceiptCardCropperTests().catch((err) => {
  console.error('❌ Receipt Card Cropper Test Failed:', err);
  process.exit(1);
});
