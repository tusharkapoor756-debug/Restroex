import { SemanticOntologyConfig, DEFAULT_SEMANTIC_ONTOLOGY } from '../config/semantic-ontology.config';
import { logger } from '../../../../infrastructure/logger/logger';

export class SemanticOntologyLoader {
  private static instance: SemanticOntologyLoader;
  private config: SemanticOntologyConfig;

  private constructor(customConfig?: Partial<SemanticOntologyConfig>) {
    this.config = {
      ...DEFAULT_SEMANTIC_ONTOLOGY,
      ...customConfig,
    };
    logger.info({ version: this.config.version }, '⚙️ Semantic Ontology Loader initialized.');
  }

  public static getInstance(customConfig?: Partial<SemanticOntologyConfig>): SemanticOntologyLoader {
    if (!SemanticOntologyLoader.instance) {
      SemanticOntologyLoader.instance = new SemanticOntologyLoader(customConfig);
    }
    return SemanticOntologyLoader.instance;
  }

  public getConfig(): SemanticOntologyConfig {
    return this.config;
  }

  public extendReceiverLabels(newLabels: string[]): void {
    const existing = this.config.categories.receiver.labels;
    const merged = Array.from(new Set([...existing, ...newLabels.map((l) => l.toLowerCase())]));
    this.config.categories.receiver.labels = merged;
    logger.info({ totalLabels: merged.length }, '🏷️ Extended Receiver ontology labels.');
  }

  public extendSenderLabels(newLabels: string[]): void {
    const existing = this.config.categories.sender.labels;
    const merged = Array.from(new Set([...existing, ...newLabels.map((l) => l.toLowerCase())]));
    this.config.categories.sender.labels = merged;
    logger.info({ totalLabels: merged.length }, '🏷️ Extended Sender ontology labels.');
  }

  public extendTransactionLabels(newLabels: string[]): void {
    const existing = this.config.categories.transactionId.labels;
    const merged = Array.from(new Set([...existing, ...newLabels.map((l) => l.toLowerCase())]));
    this.config.categories.transactionId.labels = merged;
    logger.info({ totalLabels: merged.length }, '🏷️ Extended Transaction ID ontology labels.');
  }

  public resetToDefault(): void {
    this.config = { ...DEFAULT_SEMANTIC_ONTOLOGY };
    logger.info('🔄 Reset Semantic Ontology to default configuration.');
  }
}
