import { IDocumentProcessor, DetectedFormat, FileTypeDetectionResult, DocumentProcessingResult, IngestionReport } from '../ingestion.types';
import { ParsedCategoryGroup, StagedMenuItem } from '../../../types/menu-import.types';

export class JsonProcessor implements IDocumentProcessor {
  public readonly supportedFormats: DetectedFormat[] = ['json'];

  public async process(
    buffer: Buffer,
    filename: string,
    detection: FileTypeDetectionResult
  ): Promise<DocumentProcessingResult> {
    console.log(`[JsonProcessor] Processing JSON document "${filename}" (${buffer.length} bytes)`);

    const jsonText = buffer.toString('utf-8');
    let parsed: any;
    try {
      parsed = JSON.parse(jsonText);
    } catch (err: any) {
      throw new Error(`Invalid JSON document: ${err.message}`);
    }

    const categories: ParsedCategoryGroup[] = [];
    let itemsDetected = 0;

    // Direct Restroex payload format: { categories: [...] } or array of categories
    const categoryArray = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.categories)
      ? parsed.categories
      : Array.isArray(parsed.items)
      ? [{ name: 'GENERAL SPECIALS', items: parsed.items }]
      : [];

    for (let cIdx = 0; cIdx < categoryArray.length; cIdx++) {
      const rawCat = categoryArray[cIdx];
      const categoryName = (rawCat.name || rawCat.categoryName || 'GENERAL SPECIALS').toUpperCase();
      const rawItems = Array.isArray(rawCat.items) ? rawCat.items : [];

      const stagedItems: StagedMenuItem[] = [];

      for (const rawItem of rawItems) {
        const itemName = rawItem.name || rawItem.itemName;
        if (!itemName || typeof itemName !== 'string') continue;

        const basePrice = typeof rawItem.price === 'number' ? rawItem.price : typeof rawItem.basePrice === 'number' ? rawItem.basePrice : null;
        const vegType = rawItem.vegType || (rawItem.dietary === 'NON_VEG' ? 'non-veg' : 'veg');

        const variants = Array.isArray(rawItem.variants)
          ? rawItem.variants.map((v: any) => ({ name: v.name, price: Number(v.price) || 0, confidence: 1.0 }))
          : [];

        stagedItems.push({
          categoryName,
          itemName,
          description: rawItem.description || null,
          basePrice,
          vegType,
          isBestseller: Boolean(rawItem.isBestseller),
          variants,
          customizations: [],
          confidenceScore: 1.0,
          needsReview: false,
          syncAction: 'create'
        });

        itemsDetected++;
      }

      if (stagedItems.length > 0) {
        categories.push({
          id: rawCat.id || `cat_json_${cIdx + 1}`,
          name: categoryName,
          confidence: 1.0,
          items: stagedItems
        });
      }
    }

    const report: IngestionReport = {
      detectedFormat: 'json',
      mimeType: detection.mimeType,
      originalFilename: filename,
      pagesProcessed: 1,
      itemsDetected,
      categoriesDetected: categories.length,
      skippedCount: 0,
      confidenceScore: 1.0,
      warnings: []
    };

    return { categories, report };
  }
}
