import { DocumentIngestionService } from './ingestion/document-ingestion.service';
import { MenuImportRepository } from '../repositories/menu-import.repository';
import { OCRToken, ParsedCategoryGroup, DryRunSummary, ImportSessionPayload } from '../types/menu-import.types';

export class MenuImportService {
  private ingestionService = new DocumentIngestionService();
  private repository = new MenuImportRepository();

  /**
   * Process raw file buffer (Image, PDF, CSV, Excel, JSON) via Universal Document Ingestion Architecture
   */
  public async processImageBuffer(
    sessionId: string,
    imageBuffer: Buffer,
    filename: string
  ): Promise<ParsedCategoryGroup[]> {
    await this.repository.updateSessionStatus(sessionId, 'processing');

    try {
      // 1. Delegate to Universal Document Ingestion Service
      const ingestionResult = await this.ingestionService.ingestDocument(imageBuffer, filename);
      const categories = ingestionResult.categories;
      const report = ingestionResult.report;

      let totalExtracted = 0;
      let needsReviewCount = 0;
      for (const cat of categories) {
        totalExtracted += cat.items.length;
        needsReviewCount += cat.items.filter((i) => i.needsReview).length;
      }

      const dryRunSummary: DryRunSummary = {
        totalExtracted,
        newItemsCount: totalExtracted,
        updatedItemsCount: 0,
        mergedItemsCount: 0,
        needsReviewCount
      };

      console.log(
        `[MenuImport] Staging ${totalExtracted} items across ${categories.length} categories from '${filename}' [Format: ${report.detectedFormat.toUpperCase()}]`
      );

      await this.repository.saveStagedItems(sessionId, categories);
      await this.repository.updateSessionStatus(sessionId, 'draft', undefined, dryRunSummary);

      return categories;
    } catch (err: any) {
      await this.repository.updateSessionStatus(sessionId, 'failed', err.message);
      throw err;
    }
  }

  /**
   * Process raw OCR tokens into structured categories for staging (Legacy/Direct OCR endpoint)
   */
  public async processOCRTokens(
    sessionId: string,
    tokens: OCRToken[]
  ): Promise<ParsedCategoryGroup[]> {
    await this.repository.updateSessionStatus(sessionId, 'processing');

    try {
      const jsonBuffer = Buffer.from(JSON.stringify(tokens), 'utf-8');
      const result = await this.ingestionService.ingestDocument(jsonBuffer, 'tokens.json');
      const categories = result.categories;

      let totalExtracted = 0;
      let needsReviewCount = 0;
      for (const cat of categories) {
        totalExtracted += cat.items.length;
        needsReviewCount += cat.items.filter((i) => i.needsReview).length;
      }

      const dryRunSummary: DryRunSummary = {
        totalExtracted,
        newItemsCount: totalExtracted,
        updatedItemsCount: 0,
        mergedItemsCount: 0,
        needsReviewCount
      };

      await this.repository.saveStagedItems(sessionId, categories);
      await this.repository.updateSessionStatus(sessionId, 'draft', undefined, dryRunSummary);

      return categories;
    } catch (err: any) {
      await this.repository.updateSessionStatus(sessionId, 'failed', err.message);
      throw err;
    }
  }

  /**
   * Fetch full preview payload for staging screen
   */
  public async getSessionPreview(sessionId: string): Promise<ImportSessionPayload | null> {
    return this.repository.getSessionPayload(sessionId);
  }

  /**
   * Commit staged import to live database with version snapshot
   */
  public async commitImportSession(
    restaurantId: string,
    sessionId: string,
    userId?: string
  ): Promise<{ success: boolean; versionNumber: number; evidence: any }> {
    const payload = await this.repository.getSessionPayload(sessionId);
    if (!payload || payload.restaurantId !== restaurantId) {
      throw new Error('Import session not found or unauthorized');
    }

    // 1. Snapshot current menu state BEFORE writing new items (safety net for rollback)
    const versionNumber = await this.repository.createMenuSnapshot(
      restaurantId,
      'import_session',
      sessionId,
      userId
    );

    // 2. Write staged items → real menu_items + categories
    const evidence = await this.repository.writeToLiveMenu(restaurantId, sessionId);

    // 3. Mark session as committed
    await this.repository.updateSessionStatus(sessionId, 'committed');

    console.log(`[MenuImport] Committed session ${sessionId}: ${evidence.itemsInserted.length} items inserted, ${evidence.itemsSkipped.length} skipped, version #${versionNumber}`);

    return { success: true, versionNumber, evidence };
  }
}
