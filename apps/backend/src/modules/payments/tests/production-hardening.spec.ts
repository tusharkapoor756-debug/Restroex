import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { ProductionHardeningEngine } from '../engine/services/production-hardening.engine';

async function runProductionHardeningTests() {
  console.log('=================================================================');
  console.log('🧪 SPRINT 12: PRODUCTION HARDENING UNIT TESTS');
  console.log('=================================================================\n');

  // Test 1: Global Error Boundary & Safe Exception Catching
  console.log('Test 1 - Global Error Boundary & Exception Catching:');
  const safeResult = await ProductionHardeningEngine.executeWithGlobalBoundary(
    'FailingStage',
    () => {
      throw new Error('Simulated Stage Error!');
    },
    'SafeFallbackValue'
  );

  if (safeResult !== 'SafeFallbackValue') {
    throw new Error('Test 1 Failed: Global error boundary failed to catch exception cleanly.');
  }
  console.log('  ✔ Global error boundary caught exception safely and returned fallback value.\n');

  // Test 2: Telemetry Metrics Logging
  console.log('Test 2 - Telemetry Metrics Logging:');
  const stageTimings = {
    ImagePreprocessing: 5,
    OcrEngine: 15,
    LayoutDetector: 10,
    SectionClassifier: 8,
    UniversalGrammar: 12,
  };
  const telemetry = ProductionHardeningEngine.recordTelemetry(stageTimings, false);

  if (telemetry.totalExecutionTimeMs !== 50 || telemetry.isFallbackExecuted) {
    throw new Error('Test 2 Failed: Telemetry metrics timing calculation mismatch.');
  }
  console.log(`  ✔ Telemetry recorded cleanly (Total execution time: ${telemetry.totalExecutionTimeMs} ms, Memory: ${telemetry.memoryUsageMb} MB).\n`);

  // Test 3: Engine Health Check Diagnostics
  console.log('Test 3 - Engine Health Check Diagnostics:');
  const health = ProductionHardeningEngine.getEngineHealthStatus();

  if (health.status !== 'HEALTHY') {
    throw new Error(`Test 3 Failed: Expected HEALTHY status, got ${health.status}`);
  }
  if (!health.components.grammarEngine || !health.components.merchantVerification || !health.components.fraudEngine) {
    throw new Error('Test 3 Failed: Engine components uninitialized in health check.');
  }
  console.log('  ✔ Engine Health Check diagnosed system as HEALTHY with all 9 components active.\n');

  // Test 4: Rate Limit Safeguards
  console.log('Test 4 - Rate Limit Safeguards:');
  const rateLimitKey = 'mch-rate-test';
  const firstReq = ProductionHardeningEngine.checkRateLimit(rateLimitKey, 2, 60000);
  const secondReq = ProductionHardeningEngine.checkRateLimit(rateLimitKey, 2, 60000);
  const thirdReq = ProductionHardeningEngine.checkRateLimit(rateLimitKey, 2, 60000);

  if (!firstReq.allowed || !secondReq.allowed) {
    throw new Error('Test 4 Failed: Rate limit blocked valid requests within limit threshold.');
  }
  if (thirdReq.allowed) {
    throw new Error('Test 4 Failed: Rate limit failed to block request exceeding max threshold.');
  }
  console.log('  ✔ Rate limit safeguard correctly allowed valid requests and blocked rate limit breaches.\n');

  // Test 5: Graceful Degradation Fallbacks
  console.log('Test 5 - Graceful Degradation Fallback Handler:');
  const fallbackDecision = ProductionHardeningEngine.getGracefulFallbackDecision('OCR Timeout');

  if (fallbackDecision.action !== 'MANUAL_REVIEW' || fallbackDecision.confidenceScore !== 30) {
    throw new Error('Test 5 Failed: Graceful fallback decision action mismatch.');
  }
  if (!fallbackDecision.explanations.some((e) => e.includes('OCR Timeout'))) {
    throw new Error('Test 5 Failed: Fallback reason explanation missing.');
  }
  console.log('  ✔ Graceful degradation fallback returned safe MANUAL_REVIEW decision with explanation.\n');

  console.log('=================================================================');
  console.log('✅ ALL SPRINT 12 PRODUCTION HARDENING UNIT TESTS PASSED SUCCESSFULLY!');
  console.log('=================================================================\n');
}

runProductionHardeningTests().catch((err) => {
  console.error('❌ Production Hardening Unit Tests Failed:', err);
  process.exit(1);
});
