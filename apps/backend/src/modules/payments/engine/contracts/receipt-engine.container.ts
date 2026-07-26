// ─── RESTROEX PAYMENT INTELLIGENCE ENGINE — DI CONTAINER REGISTRY ─────────

import {
  IImageNormalizerService,
  IOcrEngine,
  IReceiptLayoutDetector,
  ISectionClassifier,
  ISemanticOntologyLoader,
  IUniversalReceiptGrammarEngine,
  IMerchantVerificationEngine,
  IFraudEngine,
  IDecisionEngine,
  IReceiptUnderstandingService,
} from './receipt-understanding.interface';
import { SemanticOntologyLoader } from '../services/semantic-ontology.loader';
import { ImageNormalizerService } from '../services/image-normalizer.service';
import { OcrService } from '../services/ocr.service';
import { ReceiptLayoutDetector } from '../intelligence/receipt-layout.detector';
import { SectionClassifierService } from '../intelligence/section-classifier.service';
import { UniversalReceiptGrammarEngine } from '../intelligence/universal-receipt-grammar.engine';
import { MerchantVerificationEngine } from '../services/merchant-verification.engine';
import { FraudEngine } from '../services/fraud.engine';
import { DecisionEngine } from '../services/decision.engine';
import { LocalOcrService } from '../services/local-ocr.service';
import { logger } from '../../../../infrastructure/logger/logger';

export class ReceiptEngineContainer {
  private static instance: ReceiptEngineContainer;

  private ontologyLoaderInstance?: ISemanticOntologyLoader;
  private imageNormalizerInstance?: IImageNormalizerService;
  private ocrEngineInstance?: IOcrEngine;
  private layoutDetectorInstance?: IReceiptLayoutDetector;
  private sectionClassifierInstance?: ISectionClassifier;
  private grammarEngineInstance?: IUniversalReceiptGrammarEngine;
  private merchantVerificationInstance?: IMerchantVerificationEngine;
  private fraudEngineInstance?: IFraudEngine;
  private decisionEngineInstance?: IDecisionEngine;
  private understandingServiceInstance?: IReceiptUnderstandingService;

  private constructor() {
    logger.info('📦 Receipt Engine Dependency Injection Container initialized.');
  }

  public static getInstance(): ReceiptEngineContainer {
    if (!ReceiptEngineContainer.instance) {
      ReceiptEngineContainer.instance = new ReceiptEngineContainer();
    }
    return ReceiptEngineContainer.instance;
  }

  // ─── Semantic Ontology Loader (Sprint 1) ──────────────────────────────────
  public getOntologyLoader(): ISemanticOntologyLoader {
    if (!this.ontologyLoaderInstance) {
      this.ontologyLoaderInstance = SemanticOntologyLoader.getInstance();
    }
    return this.ontologyLoaderInstance;
  }

  public setOntologyLoader(loader: ISemanticOntologyLoader): void {
    this.ontologyLoaderInstance = loader;
  }

  // ─── Image Normalizer (Sprint 2) ──────────────────────────────────────────
  public getImageNormalizer(): IImageNormalizerService {
    if (!this.imageNormalizerInstance) {
      this.imageNormalizerInstance = {
        normalizeImage: (buf: Buffer) => ImageNormalizerService.processImage(buf),
      };
    }
    return this.imageNormalizerInstance;
  }

  public setImageNormalizer(normalizer: IImageNormalizerService): void {
    this.imageNormalizerInstance = normalizer;
  }

  // ─── OCR Engine (Sprint 3) ────────────────────────────────────────────────
  public getOcrEngine(): IOcrEngine {
    if (!this.ocrEngineInstance) {
      this.ocrEngineInstance = new OcrService();
    }
    return this.ocrEngineInstance;
  }

  public setOcrEngine(engine: IOcrEngine): void {
    this.ocrEngineInstance = engine;
  }

  // ─── Layout Detector (Sprint 4) ───────────────────────────────────────────
  public getLayoutDetector(): IReceiptLayoutDetector {
    if (!this.layoutDetectorInstance) {
      this.layoutDetectorInstance = new ReceiptLayoutDetector();
    }
    return this.layoutDetectorInstance;
  }

  public setLayoutDetector(detector: IReceiptLayoutDetector): void {
    this.layoutDetectorInstance = detector;
  }

  // ─── Section Classifier (Sprint 5) ────────────────────────────────────────
  public getSectionClassifier(): ISectionClassifier {
    if (!this.sectionClassifierInstance) {
      this.sectionClassifierInstance = new SectionClassifierService();
    }
    return this.sectionClassifierInstance;
  }

  public setSectionClassifier(classifier: ISectionClassifier): void {
    this.sectionClassifierInstance = classifier;
  }

  // ─── Grammar Engine (Sprint 6) ────────────────────────────────────────────
  public getGrammarEngine(): IUniversalReceiptGrammarEngine {
    if (!this.grammarEngineInstance) {
      this.grammarEngineInstance = {
        parseReceipt: (text: string) => UniversalReceiptGrammarEngine.parseReceipt(text),
        parseToStructuredReceipt: (text: string) => UniversalReceiptGrammarEngine.parseToStructuredReceipt(text),
      };
    }
    return this.grammarEngineInstance;
  }

  public setGrammarEngine(engine: IUniversalReceiptGrammarEngine): void {
    this.grammarEngineInstance = engine;
  }

  // ─── Merchant Verification Engine (Sprint 7) ──────────────────────────────
  public getMerchantVerificationEngine(): IMerchantVerificationEngine {
    if (!this.merchantVerificationInstance) {
      this.merchantVerificationInstance = new MerchantVerificationEngine();
    }
    return this.merchantVerificationInstance;
  }

  public setMerchantVerificationEngine(engine: IMerchantVerificationEngine): void {
    this.merchantVerificationInstance = engine;
  }

  // ─── Fraud Engine (Sprint 8) ──────────────────────────────────────────────
  public getFraudEngine(): IFraudEngine {
    if (!this.fraudEngineInstance) {
      this.fraudEngineInstance = new FraudEngine();
    }
    return this.fraudEngineInstance;
  }

  public setFraudEngine(engine: IFraudEngine): void {
    this.fraudEngineInstance = engine;
  }

  // ─── Decision Engine (Sprint 9) ───────────────────────────────────────────
  public getDecisionEngine(): IDecisionEngine {
    if (!this.decisionEngineInstance) {
      this.decisionEngineInstance = new DecisionEngine();
    }
    return this.decisionEngineInstance;
  }

  public setDecisionEngine(engine: IDecisionEngine): void {
    this.decisionEngineInstance = engine;
  }

  // ─── Receipt Understanding Facade Service ─────────────────────────────────
  public getUnderstandingService(): IReceiptUnderstandingService {
    if (!this.understandingServiceInstance) {
      const localOcr = new LocalOcrService();
      this.understandingServiceInstance = {
        processReceipt: (input) => localOcr.extractDetails(input),
      };
    }
    return this.understandingServiceInstance;
  }

  public setUnderstandingService(service: IReceiptUnderstandingService): void {
    this.understandingServiceInstance = service;
  }
}
