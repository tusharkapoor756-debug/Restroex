import { RDIEEngineService } from '../rdie-engine.service';
import { BenchmarkEvaluator } from './evaluator/benchmark-evaluator';
import { GroundTruthMenu, SampleBenchmarkReport, SuiteBenchmarkReport } from './types/benchmark.types';
import * as fs from 'fs';
import * as path from 'path';

async function runSuite() {
  const versionArg = process.argv.find((a) => a.startsWith('--version='))?.split('=')[1] || 'dataset_v1';

  console.log('===============================================================');
  console.log(`🚀 RESTROEX RDIE BENCHMARK SUITE RUNNER (${versionArg})`);
  console.log('===============================================================');

  const datasetsDir = path.join(__dirname, 'datasets', versionArg);
  if (!fs.existsSync(datasetsDir)) {
    console.error(`Dataset directory does not exist: ${datasetsDir}`);
    return;
  }

  const groups = fs.readdirSync(datasetsDir).filter((f) => fs.statSync(path.join(datasetsDir, f)).isDirectory());

  const rdie = new RDIEEngineService();
  const evaluator = new BenchmarkEvaluator();
  const sampleReports: SampleBenchmarkReport[] = [];

  for (const group of groups) {
    const groupDir = path.join(datasetsDir, group);
    const files = fs.readdirSync(groupDir);
    const imgFile = files.find((f) => /\.(png|jpg|jpeg|avif|pdf)$/i.test(f));
    const gtFile = files.find((f) => f === 'ground_truth.json');

    if (!imgFile || !gtFile) {
      console.warn(`[SKIP] Missing image or ground_truth.json in dataset group: ${group}`);
      continue;
    }

    console.log(`\n⏳ Running RDIE Pipeline on dataset: [${group}]...`);
    const imgBuffer = fs.readFileSync(path.join(groupDir, imgFile));
    const expectedJson: GroundTruthMenu = JSON.parse(fs.readFileSync(path.join(groupDir, gtFile), 'utf-8'));

    const startTime = Date.now();
    const actualOutput = await rdie.processDocument(imgBuffer);
    const duration = Date.now() - startTime;

    const report = evaluator.evaluateSample(imgFile, group, actualOutput, expectedJson);
    sampleReports.push(report);

    console.log(`   ✅ Finished in ${duration}ms | F1 Score: ${report.overallF1Score}%`);
  }

  // Aggregate Metrics Across Suite
  const aggregatedReport = aggregateMetrics(sampleReports, versionArg);

  // Compare with latest historical run if available
  const reportsDir = path.join(__dirname, 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

  const historicalFiles = fs.readdirSync(reportsDir).filter((f) => f.endsWith('.json')).sort();
  const lastFileName = historicalFiles[historicalFiles.length - 1];
  if (lastFileName) {
    const lastReportPath = path.join(reportsDir, lastFileName);
    const lastReport: SuiteBenchmarkReport = JSON.parse(fs.readFileSync(lastReportPath, 'utf-8'));

    const delta = Math.round((aggregatedReport.aggregated.overallF1Score - lastReport.aggregated.overallF1Score) * 100) / 100;
    aggregatedReport.historicalDelta = {
      prevTimestamp: lastReport.timestamp,
      f1Delta: delta,
    };
  }

  console.log('\n===============================================================');
  console.log(`📊 FINAL RDIE BENCHMARK REPORT (${versionArg})`);
  console.log('===============================================================');
  console.log(`Total Samples Processed: ${sampleReports.length}`);
  console.log(`---------------------------------------------------------------`);
  printMetricRow('Category Accuracy   ', aggregatedReport.aggregated.categoryAccuracy);
  printMetricRow('Item Accuracy       ', aggregatedReport.aggregated.itemAccuracy);
  printMetricRow('Price Accuracy      ', aggregatedReport.aggregated.priceAccuracy);
  printMetricRow('Variant Accuracy    ', aggregatedReport.aggregated.variantAccuracy);
  printMetricRow('Relationship Accuracy', aggregatedReport.aggregated.relationshipAccuracy);
  console.log(`---------------------------------------------------------------`);
  console.log(`🏆 OVERALL SUITE F1 SCORE : ${aggregatedReport.aggregated.overallF1Score}%`);
  console.log(`🏆 OVERALL ACCURACY       : ${aggregatedReport.aggregated.overallAccuracy}%`);
  if (aggregatedReport.historicalDelta) {
    const sign = aggregatedReport.historicalDelta.f1Delta >= 0 ? '+' : '';
    console.log(`📈 F1 SCORE DELTA (vs Prev): ${sign}${aggregatedReport.historicalDelta.f1Delta}%`);
  }
  console.log('===============================================================\n');

  // Save persistent historical report
  const reportFilename = `benchmark_${versionArg}_${Date.now()}.json`;
  const reportPath = path.join(reportsDir, reportFilename);
  fs.writeFileSync(reportPath, JSON.stringify(aggregatedReport, null, 2));
  console.log(`📁 Persistent Historical Report saved to: ${reportPath}`);
}

function printMetricRow(label: string, m: any) {
  console.log(
    `${label}: Acc ${m.accuracy.toFixed(1)}% | Prec ${m.precision.toFixed(1)}% | Rec ${m.recall.toFixed(1)}% | F1 ${m.f1Score.toFixed(1)}% (TP:${m.truePositives}, FP:${m.falsePositives}, FN:${m.falseNegatives})`
  );
}

function aggregateMetrics(reports: SampleBenchmarkReport[], version: string): SuiteBenchmarkReport {
  const sumMetric = (key: keyof SampleBenchmarkReport) => {
    let exp = 0,
      ext = 0,
      tp = 0,
      fp = 0,
      fn = 0;
    for (const r of reports) {
      const m = r[key] as any;
      exp += m.totalExpected;
      ext += m.totalExtracted;
      tp += m.truePositives;
      fp += m.falsePositives;
      fn += m.falseNegatives;
    }
    const prec = ext > 0 ? Math.round((tp / ext) * 10000) / 100 : 0;
    const rec = exp > 0 ? Math.round((tp / exp) * 10000) / 100 : 0;
    const f1 = prec + rec > 0 ? Math.round(((2 * prec * rec) / (prec + rec)) * 100) / 100 : 0;
    const acc = exp > 0 ? Math.round((tp / exp) * 10000) / 100 : 0;

    return { totalExpected: exp, totalExtracted: ext, truePositives: tp, falsePositives: fp, falseNegatives: fn, precision: prec, recall: rec, f1Score: f1, accuracy: acc };
  };

  const catAcc = sumMetric('categoryAccuracy');
  const itemAcc = sumMetric('itemAccuracy');
  const priceAcc = sumMetric('priceAccuracy');
  const varAcc = sumMetric('variantAccuracy');
  const relAcc = sumMetric('relationshipAccuracy');

  const overallF1 = Math.round((catAcc.f1Score * 0.15 + itemAcc.f1Score * 0.35 + priceAcc.f1Score * 0.2 + varAcc.f1Score * 0.15 + relAcc.f1Score * 0.15) * 100) / 100;
  const overallAcc = Math.round((catAcc.accuracy * 0.15 + itemAcc.accuracy * 0.35 + priceAcc.accuracy * 0.2 + varAcc.accuracy * 0.15 + relAcc.accuracy * 0.15) * 100) / 100;

  return {
    timestamp: new Date().toISOString(),
    datasetVersion: version,
    totalSamples: reports.length,
    sampleReports: reports,
    aggregated: {
      categoryAccuracy: catAcc,
      itemAccuracy: itemAcc,
      priceAccuracy: priceAcc,
      variantAccuracy: varAcc,
      relationshipAccuracy: relAcc,
      overallF1Score: overallF1,
      overallAccuracy: overallAcc,
    },
  };
}

runSuite().catch(console.error);
