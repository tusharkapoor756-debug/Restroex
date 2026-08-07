import { GroundTruthMenu, MetricScore, SampleBenchmarkReport } from '../types/benchmark.types';
import { RDIEOutput } from '../../types/rdie.types';

export class BenchmarkEvaluator {
  /**
   * Evaluates RDIE output against ground truth JSON to compute Precision, Recall, F1 Score, Accuracy, FP, FN.
   */
  public evaluateSample(
    sampleName: string,
    categoryGroup: string,
    actual: RDIEOutput,
    expected: GroundTruthMenu
  ): SampleBenchmarkReport {
    // 1. Category Metric
    const expectedCatNames = expected.categories.map((c) => this.normalize(c.name));
    const actualCatNames = actual.categories.map((c) => this.normalize(c.name));
    const catScore = this.computeMetric(expectedCatNames, actualCatNames);

    // 2. Item Metric
    const expectedItems = expected.items.map((i) => this.normalize(i.name));
    const actualItems = actual.categories.flatMap((c) => c.items.map((i) => this.normalize(i.name)));
    const itemScore = this.computeMetric(expectedItems, actualItems);

    // 3. Price Metric
    const expectedPrices = expected.items
      .map((i) => (i.basePrice != null ? `${this.normalize(i.name)}:${i.basePrice}` : null))
      .filter(Boolean) as string[];
    const actualPrices = actual.categories
      .flatMap((c) => c.items.map((i) => (i.basePrice != null ? `${this.normalize(i.name)}:${i.basePrice}` : null)))
      .filter(Boolean) as string[];
    const priceScore = this.computeMetric(expectedPrices, actualPrices);

    // 4. Variant Metric
    const expectedVariants: string[] = [];
    for (const item of expected.items) {
      if (item.variants) {
        for (const v of item.variants) {
          expectedVariants.push(`${this.normalize(item.name)}:${this.normalize(v.name)}:${v.price}`);
        }
      }
    }
    const actualVariants: string[] = [];
    for (const cat of actual.categories) {
      for (const item of cat.items) {
        if (item.variants) {
          for (const v of item.variants) {
            actualVariants.push(`${this.normalize(item.name)}:${this.normalize(v.name)}:${v.price}`);
          }
        }
      }
    }
    const variantScore = this.computeMetric(expectedVariants, actualVariants);

    // 5. Relationship Metric (Item -> Category Binding)
    const expectedRelations = expected.items.map((i) => `${this.normalize(i.name)}->${this.normalize(i.category)}`);
    const actualRelations = actual.categories.flatMap((c) =>
      c.items.map((i) => `${this.normalize(i.name)}->${this.normalize(c.name)}`)
    );
    const relScore = this.computeMetric(expectedRelations, actualRelations);

    // Micro-Averaged Overall F1 Score
    const overallF1Score = Math.round(
      (catScore.f1Score * 0.15 +
        itemScore.f1Score * 0.35 +
        priceScore.f1Score * 0.2 +
        variantScore.f1Score * 0.15 +
        relScore.f1Score * 0.15) *
        100
    ) / 100;

    return {
      sampleName,
      categoryGroup,
      categoryAccuracy: catScore,
      itemAccuracy: itemScore,
      priceAccuracy: priceScore,
      variantAccuracy: variantScore,
      relationshipAccuracy: relScore,
      overallF1Score,
    };
  }

  private computeMetric(expectedList: string[], actualList: string[]): MetricScore {
    let tp = 0;
    const matchedActualIndices = new Set<number>();

    for (const exp of expectedList) {
      const idx = actualList.findIndex((act, i) => !matchedActualIndices.has(i) && (act === exp || this.fuzzyMatch(act, exp)));
      if (idx !== -1) {
        tp++;
        matchedActualIndices.add(idx);
      }
    }

    const fp = actualList.length - tp;
    const fn = expectedList.length - tp;

    const precision = actualList.length > 0 ? Math.round((tp / actualList.length) * 10000) / 100 : 0;
    const recall = expectedList.length > 0 ? Math.round((tp / expectedList.length) * 10000) / 100 : 0;
    const f1Score = precision + recall > 0 ? Math.round(((2 * precision * recall) / (precision + recall)) * 100) / 100 : 0;
    const accuracy = expectedList.length > 0 ? Math.round((tp / expectedList.length) * 10000) / 100 : 0;

    return {
      totalExpected: expectedList.length,
      totalExtracted: actualList.length,
      truePositives: tp,
      falsePositives: fp,
      falseNegatives: fn,
      precision,
      recall,
      f1Score,
      accuracy,
    };
  }

  private normalize(str: string): string {
    return str.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  private fuzzyMatch(a: string, b: string): boolean {
    if (a.length === 0 || b.length === 0) return false;
    if (a.includes(b) || b.includes(a)) return true;
    return false;
  }
}
