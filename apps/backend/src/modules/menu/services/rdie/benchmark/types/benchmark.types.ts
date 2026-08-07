export interface GroundTruthItem {
  name: string;
  category: string;
  basePrice?: number | null;
  variants?: Array<{ name: string; price: number }>;
}

export interface GroundTruthCategory {
  name: string;
}

export interface GroundTruthMenu {
  categories: GroundTruthCategory[];
  items: GroundTruthItem[];
}

export interface MetricScore {
  totalExpected: number;
  totalExtracted: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number; // 0 - 100%
  recall: number;    // 0 - 100%
  f1Score: number;   // 0 - 100%
  accuracy: number;  // 0 - 100%
}

export interface SampleBenchmarkReport {
  sampleName: string;
  categoryGroup: string;
  categoryAccuracy: MetricScore;
  itemAccuracy: MetricScore;
  priceAccuracy: MetricScore;
  variantAccuracy: MetricScore;
  relationshipAccuracy: MetricScore;
  overallF1Score: number;
}

export interface SuiteBenchmarkReport {
  timestamp: string;
  datasetVersion: string;
  totalSamples: number;
  sampleReports: SampleBenchmarkReport[];
  aggregated: {
    categoryAccuracy: MetricScore;
    itemAccuracy: MetricScore;
    priceAccuracy: MetricScore;
    variantAccuracy: MetricScore;
    relationshipAccuracy: MetricScore;
    overallF1Score: number;
    overallAccuracy: number;
  };
  historicalDelta?: {
    prevTimestamp: string;
    f1Delta: number;
  };
}
