import fs from 'fs';
import path from 'path';
import { createWorker } from 'tesseract.js';
import { ExtractedPaymentDetails } from '../../types/payment-analysis.types';
import { PaymentTextRuleEngine } from '../intelligence/text-rule-engine';
import { ImageNormalizerService, ImagePreprocessingStagesPayload } from './image-normalizer.service';
import { OcrDebugReportGenerator } from '../diagnostics/ocr-debug-report.generator';
import { UniversalAmountExtractor } from '../intelligence/universal-amount.extractor';
import { ReceiptLayoutDetector } from '../intelligence/receipt-layout.detector';
import { SectionClassifierService } from '../intelligence/section-classifier.service';
import { logger } from '../../../../infrastructure/logger/logger';

export class LocalOcrService {
  /**
   * Executes Universal Payment Receipt Understanding on payment screenshots.
   * Performs image normalization, multi-stage debug persistence, 3-pass parallel OCR ensemble,
   * layout & section classification, candidate evaluation, and debug report generation.
   */
  public async extractDetails(imageBufferOrText: Buffer | string): Promise<ExtractedPaymentDetails> {
    try {
      let rawText = '';
      let stagesPayload: ImagePreprocessingStagesPayload | null = null;
      let passAText = '';
      let passBText = '';
      let passCText = '';

      if (Buffer.isBuffer(imageBufferOrText)) {
        const rawBuffer = imageBufferOrText;
        stagesPayload = ImageNormalizerService.processImageWithStages(rawBuffer);
        const ensemble = await this.performMultiPassOcrEnsemble(stagesPayload);
        passAText = ensemble.passA;
        passBText = ensemble.passB;
        passCText = ensemble.passC;
        rawText = ensemble.fusedText;
      } else if (typeof imageBufferOrText === 'string') {
        const inputStr = imageBufferOrText.trim();

        if (inputStr.startsWith('data:image/') || this.isBase64Image(inputStr)) {
          const parts = inputStr.split('base64,');
          const base64Data: string = parts.length > 1 ? (parts[1] || '') : inputStr;
          const imageBuffer = Buffer.from(base64Data, 'base64');
          stagesPayload = ImageNormalizerService.processImageWithStages(imageBuffer);
          const ensemble = await this.performMultiPassOcrEnsemble(stagesPayload);
          passAText = ensemble.passA;
          passBText = ensemble.passB;
          passCText = ensemble.passC;
          rawText = ensemble.fusedText;
        } else {
          // Plain text input (e.g. from unit tests or pre-parsed text)
          rawText = inputStr;
          passAText = inputStr;
        }
      }

      logger.info({ rawTextLength: rawText.length, rawOcrSample: rawText.slice(0, 200) }, '📝 Fused OCR output extracted');

      const extracted = PaymentTextRuleEngine.parseRawText(rawText);

      // Perform Layout & Candidate Diagnostics for Observability Report
      const layoutDetector = new ReceiptLayoutDetector();
      const blocks = layoutDetector.detectLayout(rawText);
      const classifier = new SectionClassifierService();
      const sectionGraph = classifier.classifySections(blocks);

      const candidateEval = UniversalAmountExtractor.extractAmount(rawText, blocks, sectionGraph);

      // Generate Transparent OCR Debug Report
      if (stagesPayload) {
        OcrDebugReportGenerator.generateReport({
          stages: stagesPayload,
          passAText,
          passBText,
          passCText,
          fusedText: rawText,
          sectionNames: sectionGraph.sections.map((s) => s.sectionType),
          heroCandidatesCount: sectionGraph.heroAmountCandidates.length,
          allCandidates: candidateEval.allCandidates,
          winningCandidate: candidateEval.candidate,
          structuredReceipt: extracted.structuredReceipt,
        });
      }

      logger.info({
        amount: extracted.amount.value,
        upiRef: extracted.upiReference.value,
        receiverUpi: extracted.receiverUpiId.value,
        sender: extracted.senderName.value,
        receiver: extracted.receiverName.value,
        paymentApp: extracted.paymentApp.value,
        status: extracted.paymentStatusInScreenshot.value,
        overallConfidence: extracted.overallConfidence,
      }, '✨ Final structured receipt object');

      return extracted;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error({ error: msg }, '❌ Universal receipt understanding failed');
      return PaymentTextRuleEngine.parseRawText('');
    }
  }

  private async performMultiPassOcrEnsemble(
    stages: ImagePreprocessingStagesPayload
  ): Promise<{ passA: string; passB: string; passC: string; fusedText: string }> {
    logger.info('📸 Executing 3-Pass Parallel Fault-Tolerant OCR Ensemble...');

    const debugDir = path.resolve(process.cwd(), 'tmp/ocr-debug');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }

    let passA = '';
    let passB = '';
    let passC = '';

    // Inspect & Save Pass 1 (Pass A)
    const bufA = stages.binarizedBuffer;
    const metaA = ImageNormalizerService.extractHeaderMetadata(bufA);
    const pass1Path = path.join(debugDir, 'pass1.png');
    fs.writeFileSync(pass1Path, bufA);

    logger.info(
      {
        passName: 'Pass A (Full Card Auto Layout)',
        imageFormat: metaA.format,
        mimeType: `image/${metaA.format === 'unknown' ? 'png' : metaA.format}`,
        width: metaA.width || stages.normalizedImage.width,
        height: metaA.height || stages.normalizedImage.height,
        bufferSizeBytes: bufA.length,
        hasValidMagicHeader: metaA.format !== 'unknown',
        savedDebugFile: pass1Path,
      },
      '📋 [Pass 1/3 Inspection Log]'
    );

    // Pass A Execution (Independent Try/Catch)
    try {
      const workerA = await createWorker('eng');
      try {
        const { data: dataA } = await workerA.recognize(bufA);
        passA = dataA.text ?? '';
      } finally {
        await workerA.terminate().catch(() => {});
      }
    } catch (errA) {
      logger.warn({ errA }, '⚠️ OCR Pass A failed — continuing with remaining passes.');
    }

    // Inspect & Save Pass 2 (Pass B)
    const bufB = stages.binarizedBuffer;
    const metaB = ImageNormalizerService.extractHeaderMetadata(bufB);
    const pass2Path = path.join(debugDir, 'pass2.png');
    fs.writeFileSync(pass2Path, bufB);

    logger.info(
      {
        passName: 'Pass B (Binarized Card Sparse Block)',
        imageFormat: metaB.format,
        mimeType: `image/${metaB.format === 'unknown' ? 'png' : metaB.format}`,
        width: metaB.width || stages.normalizedImage.width,
        height: metaB.height || stages.normalizedImage.height,
        bufferSizeBytes: bufB.length,
        hasValidMagicHeader: metaB.format !== 'unknown',
        savedDebugFile: pass2Path,
      },
      '📋 [Pass 2/3 Inspection Log]'
    );

    // Pass B Execution (Independent Try/Catch)
    try {
      const workerB = await createWorker('eng');
      try {
        await workerB.setParameters({ tessedit_pageseg_mode: '6' as any });
        const { data: dataB } = await workerB.recognize(bufB);
        passB = dataB.text ?? '';
      } finally {
        await workerB.terminate().catch(() => {});
      }
    } catch (errB) {
      logger.warn({ errB }, '⚠️ OCR Pass B failed — continuing with remaining passes.');
    }

    // Inspect & Save Pass 3 (Pass C)
    const bufC = stages.cardCroppedBuffer;
    const metaC = ImageNormalizerService.extractHeaderMetadata(bufC);
    const pass3Path = path.join(debugDir, 'pass3.png');
    fs.writeFileSync(pass3Path, bufC);

    const widthC = metaC.width || stages.normalizedImage.width;
    const heightC = metaC.height || stages.normalizedImage.height;
    const cropHeightC = Math.floor(heightC * 0.45);

    logger.info(
      {
        passName: 'Pass C (Hero Region Top 45% Crop - PSM 11 Sparse Text)',
        imageFormat: metaC.format,
        mimeType: `image/${metaC.format === 'unknown' ? 'png' : metaC.format}`,
        width: widthC,
        height: heightC,
        cropHeight: cropHeightC,
        bufferSizeBytes: bufC.length,
        hasValidMagicHeader: metaC.format !== 'unknown',
        savedDebugFile: pass3Path,
      },
      '📋 [Pass 3/4 Inspection Log]'
    );

    // Pass C Execution (PSM 11 - Sparse Text Mode to extract amounts near icons)
    if (widthC > 10 && cropHeightC > 10) {
      try {
        const workerC = await createWorker('eng');
        try {
          await workerC.setParameters({ tessedit_pageseg_mode: '11' as any });
          const { data: dataC } = await workerC.recognize(bufC, {
            rectangle: {
              top: 0,
              left: 0,
              width: widthC,
              height: cropHeightC,
            },
          });
          passC = dataC.text ?? '';
        } finally {
          await workerC.terminate().catch(() => {});
        }
      } catch (errC) {
        logger.warn({ errC }, '⚠️ OCR Pass C failed — continuing with remaining passes.');
      }
    }

    // Pass D: Full Image Sparse Character Mode (PSM 11)
    let passD = '';
    try {
      const workerD = await createWorker('eng');
      try {
        await workerD.setParameters({ tessedit_pageseg_mode: '11' as any });
        const { data: dataD } = await workerD.recognize(bufA);
        passD = dataD.text ?? '';
      } finally {
        await workerD.terminate().catch(() => {});
      }
    } catch (errD) {
      logger.warn({ errD }, '⚠️ OCR Pass D failed — continuing with remaining passes.');
    }

    // OCR Text Fusion & Line Deduplication Engine
    const fusedText = this.fuseOcrTextPasses(passA, passB, passC, passD);

    return { passA, passB, passC, fusedText };
  }

  private fuseOcrTextPasses(passA: string, passB: string, passC: string, passD: string = ''): string {
    const combinedLines = [
      ...passC.split(/\r?\n/),
      ...passD.split(/\r?\n/),
      ...passA.split(/\r?\n/),
      ...passB.split(/\r?\n/),
    ]
      .map((l) => l.trim())
      .filter(Boolean);

    // Deduplicate lines while preserving sequence order & currency symbols
    const uniqueLines: string[] = [];
    const seenSet = new Set<string>();

    for (const line of combinedLines) {
      const normalizedKey = line.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normalizedKey.length > 0 && !seenSet.has(normalizedKey)) {
        seenSet.add(normalizedKey);
        uniqueLines.push(line);
      }
    }

    return uniqueLines.join('\n');
  }

  private isBase64Image(str: string): boolean {
    if (str.length < 100) return false;
    return /^[A-Za-z0-9+/=]+$/.test(str.replace(/\r?\n|\r/g, '').trim());
  }
}
