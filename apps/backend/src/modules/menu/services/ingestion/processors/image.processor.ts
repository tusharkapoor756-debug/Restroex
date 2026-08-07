import { IDocumentProcessor, DetectedFormat, FileTypeDetectionResult, DocumentProcessingResult, IngestionReport } from '../ingestion.types';
import { RDIEEngineService } from '../../rdie/rdie-engine.service';
import { LocalOCRWorkerService } from '../../ocr-worker.service';
import { SpatialLayoutReconstructor } from '../../spatial-layout.service';
import { DeterministicMenuParser } from '../../deterministic-parser.service';
import { ParsedCategoryGroup, StagedMenuItem } from '../../../types/menu-import.types';
import { RDIEOutput } from '../../rdie/types/rdie.types';

const ACTIVE_ENGINE: 'legacy' | 'rdie' =
  (process.env.MENU_IMPORT_ENGINE || 'legacy').toLowerCase() === 'rdie' ? 'rdie' : 'legacy';

export class ImageProcessor implements IDocumentProcessor {
  public readonly supportedFormats: DetectedFormat[] = ['image'];

  private rdieEngine = new RDIEEngineService();
  private ocrWorker = new LocalOCRWorkerService();
  private spatialService = new SpatialLayoutReconstructor();
  private parser = new DeterministicMenuParser();

  public async process(
    buffer: Buffer,
    filename: string,
    detection: FileTypeDetectionResult
  ): Promise<DocumentProcessingResult> {
    console.log(`[ImageProcessor] Processing image "${filename}" with engine = ${ACTIVE_ENGINE.toUpperCase()}`);

    let categories: ParsedCategoryGroup[] = [];
    let confidenceScore = 0.85;

    if (ACTIVE_ENGINE === 'rdie') {
      const rdieOutput = await this.rdieEngine.processDocument(buffer);
      categories = this.adaptRdieOutput(rdieOutput);
      confidenceScore = rdieOutput.confidenceScore;
    } else {
      const tokens = await this.ocrWorker.extractTokensFromBuffer(buffer, filename);
      const spatialLines = this.spatialService.groupTokensIntoLines(tokens);
      categories = this.parser.parseLines(spatialLines);
    }

    let itemsDetected = 0;
    for (const cat of categories) {
      itemsDetected += cat.items.length;
    }

    const report: IngestionReport = {
      detectedFormat: 'image',
      mimeType: detection.mimeType,
      originalFilename: filename,
      pagesProcessed: 1,
      totalPages: 1,
      itemsDetected,
      categoriesDetected: categories.length,
      skippedCount: 0,
      confidenceScore,
      warnings: []
    };

    return { categories, report };
  }

  private adaptRdieOutput(rdieOutput: RDIEOutput): ParsedCategoryGroup[] {
    return rdieOutput.categories
      .filter((cat: { items: string | any[] }) => cat.items.length > 0)
      .map((cat: { name: string; confidence: number; items: any[]; id?: string }, catIdx: number) => {
        const stagedItems: StagedMenuItem[] = cat.items.map((item: any) => {
          const vegType: 'veg' | 'non-veg' | 'egg' | 'vegan' =
            item.dietary === 'NON_VEG' ? 'non-veg' :
            item.dietary === 'EGG'     ? 'egg'      : 'veg';

          return {
            categoryName: cat.name,
            itemName: item.name,
            description: item.description || null,
            basePrice: item.basePrice ?? null,
            vegType,
            isBestseller: false,
            variants: (item.variants || []).map((v: any) => ({
              name: v.name,
              price: v.price,
              confidence: v.confidence
            })),
            customizations: [],
            boundingBox: item.bbox || null,
            confidenceScore: item.confidence,
            needsReview: item.confidence < 0.8,
            syncAction: 'create' as const
          };
        });

        return {
          id: cat.id || `cat_rdie_${catIdx + 1}`,
          name: cat.name,
          confidence: cat.confidence,
          items: stagedItems
        };
      });
  }
}
