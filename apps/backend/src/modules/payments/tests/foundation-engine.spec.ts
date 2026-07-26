import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { SemanticOntologyLoader } from '../engine/services/semantic-ontology.loader';
import { ReceiptEngineContainer } from '../engine/contracts/receipt-engine.container';
import { DEFAULT_SEMANTIC_ONTOLOGY } from '../engine/config/semantic-ontology.config';
import { DEFAULT_RECEIPT_ENGINE_CONFIG } from '../engine/config/receipt-engine.config';
import { StructuredPaymentReceipt } from '../engine/types/structured-receipt.schema';

async function runFoundationEngineTests() {
  console.log('=================================================================');
  console.log('🧪 SPRINT 1: FOUNDATION ENGINE INFRASTRUCTURE UNIT TESTS');
  console.log('=================================================================\n');

  // Test 1: Engine Configuration Integrity
  console.log('Test 1 - Engine Configuration:');
  if (DEFAULT_RECEIPT_ENGINE_CONFIG.highConfidenceThreshold !== 90) {
    throw new Error('Test 1 Failed: Expected highConfidenceThreshold = 90.');
  }
  if (DEFAULT_RECEIPT_ENGINE_CONFIG.reviewConfidenceThreshold !== 70) {
    throw new Error('Test 1 Failed: Expected reviewConfidenceThreshold = 70.');
  }
  console.log('  ✔ Engine configuration defaults verified.\n');

  // Test 2: Semantic Ontology Loader Default Config & Extension
  console.log('Test 2 - Semantic Ontology Loader & Extension:');
  const ontologyLoader = SemanticOntologyLoader.getInstance();
  const config = ontologyLoader.getConfig();

  if (!config.categories.receiver.labels.includes('paid to')) {
    throw new Error('Test 2 Failed: Expected "paid to" in receiver labels.');
  }

  ontologyLoader.extendReceiverLabels(['custom_payee_label']);
  const updatedConfig = ontologyLoader.getConfig();

  if (!updatedConfig.categories.receiver.labels.includes('custom_payee_label')) {
    throw new Error('Test 2 Failed: Dynamic extension of receiver labels failed.');
  }
  console.log('  ✔ Semantic Ontology loaded and dynamically extended cleanly.\n');

  // Test 3: Dependency Injection Container Binding & Contract Resolution
  console.log('Test 3 - Dependency Injection Container Registration & Resolution:');
  const container = ReceiptEngineContainer.getInstance();
  const loaderFromContainer = container.getOntologyLoader();
  const normalizer = container.getImageNormalizer();
  const grammarEngine = container.getGrammarEngine();
  const layoutDetector = container.getLayoutDetector();

  if (!loaderFromContainer) {
    throw new Error('Test 3 Failed: Container failed to resolve ISemanticOntologyLoader.');
  }
  if (!normalizer) {
    throw new Error('Test 3 Failed: Container failed to resolve IImageNormalizerService.');
  }
  if (!grammarEngine) {
    throw new Error('Test 3 Failed: Container failed to resolve IUniversalReceiptGrammarEngine.');
  }
  if (!layoutDetector) {
    throw new Error('Test 3 Failed: Container failed to resolve IReceiptLayoutDetector.');
  }

  // Test normalizer interface call
  const sampleBuf = Buffer.from('test_image_bytes');
  const normalized = normalizer.normalizeImage(sampleBuf);
  if (!normalized) {
    throw new Error('Test 3 Failed: Image normalizer contract failed.');
  }
  console.log('  ✔ Dependency Injection Container resolved all Sprint 1 contracts successfully.\n');

  // Test 4: Structured Receipt Schema & Grammar Parsing Contract
  console.log('Test 4 - Grammar Engine Contract & Structured Receipt Schema:');
  const sampleRawText = `Google Pay
    Paid to Restroex Cafe (restroex@upi)
    ₹500.00
    Completed
    Jul 24, 2026, 08:30 PM
    UPI Ref No: 987654321098
    From: Rahul Verma`;

  const structuredReceipt: StructuredPaymentReceipt = grammarEngine.parseToStructuredReceipt(sampleRawText);

  if (structuredReceipt.amount !== 500) {
    throw new Error(`Test 4 Failed: Expected amount 500, got ${structuredReceipt.amount}`);
  }
  if (structuredReceipt.upiReference !== '987654321098') {
    throw new Error(`Test 4 Failed: Expected UTR 987654321098, got ${structuredReceipt.upiReference}`);
  }
  if (structuredReceipt.receiverUpi !== 'restroex@upi') {
    throw new Error(`Test 4 Failed: Expected receiver VPA restroex@upi, got ${structuredReceipt.receiverUpi}`);
  }
  if (!structuredReceipt.confidenceScores) {
    throw new Error('Test 4 Failed: Confidence score model missing from structured receipt.');
  }
  console.log('  ✔ Structured Receipt Schema & Grammar Parsing Contract verified cleanly.\n');

  console.log('=================================================================');
  console.log('✅ ALL SPRINT 1 FOUNDATION ENGINE UNIT TESTS PASSED SUCCESSFULLY!');
  console.log('=================================================================\n');
}

runFoundationEngineTests().catch((err) => {
  console.error('❌ Foundation Engine Unit Tests Failed:', err);
  process.exit(1);
});
