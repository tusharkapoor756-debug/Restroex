import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { BenchmarkDatasetLoader, BenchmarkRunner, BenchmarkResultReport } from '../engine/benchmark/benchmark.engine';

async function runBenchmarkQaTests() {
  console.log('=================================================================');
  console.log('🧪 SPRINT 11: BENCHMARK & QA SUITE UNIT TESTS');
  console.log('=================================================================\n');

  // Test 1: Golden Dataset Loader
  console.log('Test 1 - Golden Dataset Loader Completeness:');
  const dataset = BenchmarkDatasetLoader.getGoldenDataset();
  if (!dataset || dataset.length < 5) {
    throw new Error('Test 1 Failed: Golden dataset incomplete or fewer than 5 test cases.');
  }
  console.log(`  ✔ Loaded ${dataset.length} golden benchmark test cases across Google Pay, PhonePe, Paytm, Amazon Pay.\n`);

  // Test 2: Benchmark Runner Execution & Accuracy Calculation
  console.log('Test 2 - Benchmark Runner Execution & Accuracy Metrics:');
  const report: BenchmarkResultReport = BenchmarkRunner.runBenchmark();

  if (report.totalTestCases !== dataset.length) {
    throw new Error('Test 2 Failed: Benchmark runner failed to execute all test cases.');
  }
  if (report.overallAccuracyPercent < 90) {
    throw new Error(`Test 2 Failed: Overall system accuracy ${report.overallAccuracyPercent}% below 90% benchmark threshold!`);
  }
  console.log(`  ✔ Benchmark suite passed cleanly with overall system accuracy = ${report.overallAccuracyPercent}%.\n`);

  // Test 3: Field Extraction Accuracy Metrics Assertion
  console.log('Test 3 - Field Extraction Accuracy Metrics Assertion:');
  const metrics = report.fieldMetrics;
  if (metrics.amountAccuracy < 90 || metrics.upiRefAccuracy < 90 || metrics.receiverUpiAccuracy < 90 || metrics.statusAccuracy < 90) {
    throw new Error('Test 3 Failed: One or more field extraction accuracy metrics below 90% target.');
  }
  console.log('  ✔ All field extraction accuracy metrics (Amount, UTR, Payee VPA, Status) >= 90%.\n');

  // Test 4: Benchmark Markdown Report Generation
  console.log('Test 4 - Benchmark Markdown Report Generation:');
  if (!report.markdownReport || !report.markdownReport.includes('BENCHMARK REPORT') || !report.markdownReport.includes('Summary Accuracy Metrics')) {
    throw new Error('Test 4 Failed: Markdown benchmark report incomplete.');
  }
  console.log('  ✔ Markdown benchmark report generated successfully.\n');

  console.log('=================================================================');
  console.log('✅ ALL SPRINT 11 BENCHMARK & QA UNIT TESTS PASSED SUCCESSFULLY!');
  console.log('=================================================================\n');
}

runBenchmarkQaTests().catch((err) => {
  console.error('❌ Benchmark & QA Unit Tests Failed:', err);
  process.exit(1);
});
