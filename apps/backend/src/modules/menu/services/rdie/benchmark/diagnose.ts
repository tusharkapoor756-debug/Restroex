import { RDIEEngineService } from '../rdie-engine.service';
import { GroundTruthMenu } from './types/benchmark.types';
import * as fs from 'fs';
import * as path from 'path';

async function diagnose() {
  console.log('===============================================================');
  console.log('🔍 RDIE BENCHMARK FORENSIC DIAGNOSTIC SUITE');
  console.log('===============================================================');

  const datasetsDir = path.join(__dirname, 'datasets', 'dataset_v1');
  const groups = fs.readdirSync(datasetsDir).filter((f) => fs.statSync(path.join(datasetsDir, f)).isDirectory());

  const rdie = new RDIEEngineService();

  for (const group of groups) {
    const groupDir = path.join(datasetsDir, group);
    const imgFile = fs.readdirSync(groupDir).find((f) => /\.(png|jpg|jpeg|avif|pdf)$/i.test(f));
    const gtFile = fs.readdirSync(groupDir).find((f) => f === 'ground_truth.json');

    if (!imgFile || !gtFile) continue;

    console.log(`\n===============================================================`);
    console.log(`📁 SAMPLE: [${group}] (${imgFile})`);
    console.log(`===============================================================`);

    const imgBuffer = fs.readFileSync(path.join(groupDir, imgFile));
    const expected: GroundTruthMenu = JSON.parse(fs.readFileSync(path.join(groupDir, gtFile), 'utf-8'));

    const actual = await rdie.processDocument(imgBuffer);

    console.log('\n--- EXPECTED ITEMS & PRICES ---');
    for (const item of expected.items) {
      console.log(`  EXPECTED: "${item.name}" | BasePrice: ${item.basePrice} | Variants: ${JSON.stringify(item.variants)}`);
    }

    console.log('\n--- PREDICTED ITEMS & PRICES (RDIE OUTPUT) ---');
    for (const cat of actual.categories) {
      console.log(`  CATEGORY: [${cat.name}]`);
      for (const item of cat.items) {
        console.log(`    PREDICTED: "${item.name}" | BasePrice: ${item.basePrice} | Variants: ${JSON.stringify(item.variants)}`);
      }
    }
  }
}

diagnose().catch(console.error);
