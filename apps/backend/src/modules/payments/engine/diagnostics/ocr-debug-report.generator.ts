// ─── RESTROEX PAYMENT INTELLIGENCE ENGINE — OCR DEBUG REPORT GENERATOR ──────

import fs from 'fs';
import path from 'path';
import { ImagePreprocessingStagesPayload } from '../services/image-normalizer.service';
import { StructuredPaymentReceipt } from '../types/structured-receipt.schema';
import { AmountCandidate } from '../intelligence/universal-amount.extractor';
import { logger } from '../../../../infrastructure/logger/logger';

export interface OcrDebugReportData {
  stages: ImagePreprocessingStagesPayload;
  passAText: string;
  passBText: string;
  passCText: string;
  fusedText: string;
  sectionNames: string[];
  heroCandidatesCount: number;
  allCandidates: AmountCandidate[];
  winningCandidate: AmountCandidate | null;
  structuredReceipt: StructuredPaymentReceipt;
}

export class OcrDebugReportGenerator {
  /**
   * Generates a complete, transparent OCR Debug Report and persists all 5 intermediate image stages to disk:
   * 1. 01_original_uploaded_image.png
   * 2. 02_cropped_receipt_card.png
   * 3. 03_grayscale_normalized.png
   * 4. 04_high_contrast_binarized.png
   * 5. 05_hero_region_crop.png
   */
  public static generateReport(data: OcrDebugReportData): { reportPath: string; imagePaths: Record<string, string> } {
    const debugDir = path.resolve(process.cwd(), 'tmp/ocr-debug');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }

    const timestamp = Date.now();
    const imagePaths = {
      original: path.join(debugDir, `01_original_${timestamp}.png`),
      cropped: path.join(debugDir, `02_cropped_card_${timestamp}.png`),
      grayscale: path.join(debugDir, `03_grayscale_${timestamp}.png`),
      binarized: path.join(debugDir, `04_binarized_${timestamp}.png`),
      heroCrop: path.join(debugDir, `05_hero_crop_${timestamp}.png`),
    };

    // 1. Write Intermediate Image Stages to Disk
    try {
      fs.writeFileSync(imagePaths.original, data.stages.originalBuffer);
      fs.writeFileSync(imagePaths.cropped, data.stages.cardCroppedBuffer);
      fs.writeFileSync(imagePaths.grayscale, data.stages.grayscaleBuffer);
      fs.writeFileSync(imagePaths.binarized, data.stages.binarizedBuffer);
      fs.writeFileSync(imagePaths.heroCrop, data.stages.heroCropBuffer);
    } catch (fsErr) {
      logger.warn({ fsErr }, '⚠️ Warning: Could not write intermediate image stages to disk.');
    }

    // 2. Build Markdown Report
    const reportPath = path.join(debugDir, `OCR_DEBUG_REPORT_${timestamp}.md`);
    const mdContent = `
# RESTROEX PAYMENT INTELLIGENCE ENGINE — COMPLETE OCR DEBUG REPORT

Generated At: ${new Date().toISOString()}

---

## 1. Image Preprocessing & Transformation Stages

| Stage | Filename | Size (Bytes) | Dimensions / Box |
| :--- | :--- | :--- | :--- |
| **01 Original Upload** | \`${path.basename(imagePaths.original)}\` | ${data.stages.originalBuffer.length} | Native Canvas |
| **02 Receipt Card Crop** | \`${path.basename(imagePaths.cropped)}\` | ${data.stages.cardCroppedBuffer.length} | Box: ${data.stages.cardBox.left},${data.stages.cardBox.top} (${data.stages.cardBox.width}x${data.stages.cardBox.height}) |
| **03 Grayscale Normalization** | \`${path.basename(imagePaths.grayscale)}\` | ${data.stages.grayscaleBuffer.length} | Luminance Channel |
| **04 High-Contrast Binarization** | \`${path.basename(imagePaths.binarized)}\` | ${data.stages.binarizedBuffer.length} | Contrast Amplified |
| **05 Hero Region Crop** | \`${path.basename(imagePaths.heroCrop)}\` | ${data.stages.heroCropBuffer.length} | Top 50% Card Slice |

---

## 2. Multi-Strategy Parallel OCR Ensemble Outputs

### Pass A: Full Foreground Card OCR (PSM 3)
\`\`\`
${data.passAText || '(No text extracted)'}
\`\`\`

### Pass B: Binarized Card OCR (PSM 6)
\`\`\`
${data.passBText || '(No text extracted)'}
\`\`\`

### Pass C: Hero Region Crop OCR (PSM 6)
\`\`\`
${data.passCText || '(No text extracted)'}
\`\`\`

---

## 3. OCR Text Fusion & Deduplication Engine Output
\`\`\`
${data.fusedText || '(No fused text generated)'}
\`\`\`

---

## 4. Layout & Section Classification
- **Detected Sections**: ${data.sectionNames.join(', ') || 'None'}
- **Hero Candidates Count**: ${data.heroCandidatesCount}

---

## 5. Universal Candidate Generation & Evidence Score Breakdown

| Amount Value | Confidence Score | Winning Status | Source Line | Scoring Evidence Reasons |
| :--- | :--- | :--- | :--- | :--- |
${
  data.allCandidates.length > 0
    ? data.allCandidates
        .map(
          (c) =>
            `| **₹${c.value}** | **${c.confidenceScore}/100** | ${
              c.value === data.winningCandidate?.value ? '🏆 **SELECTED WINNER**' : 'Candidate'
            } | \`${c.sourceLine}\` | ${c.scoringReasons.join('; ')} |`
        )
        .join('\n')
    : '| None | 0 | - | - | No numeric candidates evaluated |'
}

---

## 6. Final Structured Receipt Output
\`\`\`json
${JSON.stringify(data.structuredReceipt, null, 2)}
\`\`\`
`;

    try {
      fs.writeFileSync(reportPath, mdContent.trim());
      // Also overwrite main OCR_DEBUG_REPORT.md for easy access
      fs.writeFileSync(path.join(debugDir, 'OCR_DEBUG_REPORT.md'), mdContent.trim());
    } catch (err) {
      logger.warn({ err }, '⚠️ Could not save OCR_DEBUG_REPORT.md.');
    }

    logger.info(
      {
        reportPath,
        imagePaths,
        fusedTextLines: data.fusedText.split('\n').length,
        selectedAmount: data.winningCandidate?.value ?? null,
      },
      '📊 [OCR DEBUG REPORT GENERATOR] Complete OCR diagnostic report generated.'
    );

    return { reportPath, imagePaths };
  }
}
