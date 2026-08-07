import { SpatialBlock, HeadingNode, VariantMatrixSpec, RawMenuItem, ColumnBounds } from '../types/rdie.types';
import { HeadingDetectorService } from './heading-detector.service';

export class ItemRelationService {
  private headingDetector = new HeadingDetectorService();

  /**
   * Binds item titles, prices, descriptions, and variant columns within strict column boundaries.
   */
  public bindItemRelationships(
    blocks: SpatialBlock[],
    headings: HeadingNode[],
    variantMatrixSpecs: VariantMatrixSpec[],
    columns: ColumnBounds[]
  ): RawMenuItem[] {
    const rawItems: RawMenuItem[] = [];
    let itemCounter = 0;

    for (const block of blocks) {
      const colIndex = block.columnIndex;
      const colBounds = columns.find((c) => c.columnIndex === colIndex) || { x0: 0, x1: 9999 };

      for (let i = 0; i < block.lines.length; i++) {
        const line = block.lines[i]!;

        // Skip footer / banner / disclaimer lines
        if (this.headingDetector.isFooterOrBannerLine(line.text)) {
          continue;
        }

        // Skip heading lines
        if (headings.some((h) => h.columnIndex === colIndex && Math.abs(h.bbox.y0 - line.bbox.y0) < 5)) {
          continue;
        }

        // Parse line tokens for item name vs prices
        const priceTokens: Array<{ value: number; xCenter: number; bbox: any }> = [];
        const nameTokens: string[] = [];

        for (const token of line.tokens) {
          // Normalize currency prefix/suffix from token text
          const cleanedText = token.text.replace(/(?:₹|Rs\.?|INR|\/-)/gi, '').trim();
          const valMatch = cleanedText.match(/^(\d{1,4}(?:\.\d{1,2})?)$/);

          if (valMatch && parseFloat(valMatch[1]!) >= 5 && parseFloat(valMatch[1]!) <= 10000) {
            priceTokens.push({
              value: parseFloat(valMatch[1]!),
              xCenter: (token.bbox.x0 + token.bbox.x1) / 2,
              bbox: token.bbox,
            });
          } else if (!/^[./\\|-]+$/.test(token.text) && !/^(?:₹|Rs\.?|INR|\/-)$/i.test(token.text)) {
            nameTokens.push(token.text);
          }
        }

        let itemName = nameTokens.join(' ').replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '').trim();

        // Heuristic: Remove embedded price symbols from item title
        itemName = itemName.replace(/(?:₹|Rs\.?|INR|\/-)/gi, '').trim();

        if (!itemName || itemName.length < 2 || /^(HALF|FULL|SMALL|MEDIUM|LARGE|RS|PRICE|MENU|ITEMS?|RATE)$/i.test(itemName)) {
          continue;
        }

        // Detect dietary marker
        let dietary: 'VEG' | 'NON_VEG' | 'EGG' | 'UNKNOWN' = 'UNKNOWN';
        if (/(?:NON[- ]?VEG|CHICKEN|MUTTON|FISH|EGG|🔴)/i.test(itemName)) {
          dietary = 'NON_VEG';
        } else if (/(?:PURE\s+VEG|VEG|🟢)/i.test(itemName)) {
          dietary = 'VEG';
        }

        // Find active variant matrix above this line in the same column
        const activeMatrix = variantMatrixSpecs
          .filter((v) => v.columnIndex === colIndex && v.yPosition < line.bbox.y0)
          .sort((a, b) => b.yPosition - a.yPosition)[0];

        let basePrice: number | null = null;
        const variants: Array<{ name: string; price: number; confidence: number }> = [];

        if (priceTokens.length === 1 && !activeMatrix) {
          basePrice = priceTokens[0]!.value;
        } else if (priceTokens.length >= 1) {
          if (activeMatrix && activeMatrix.variants.length > 0) {
            // Map prices to variant specs using spatial X-center distance
            for (const p of priceTokens) {
              let closestVariant = activeMatrix.variants[0]!;
              let minDist = Math.abs(p.xCenter - closestVariant.xCenter);

              for (const varSpec of activeMatrix.variants) {
                const dist = Math.abs(p.xCenter - varSpec.xCenter);
                if (dist < minDist) {
                  minDist = dist;
                  closestVariant = varSpec;
                }
              }

              variants.push({
                name: closestVariant.name,
                price: p.value,
                confidence: 0.95,
              });
            }
          } else if (priceTokens.length === 2) {
            // Fallback for unlabeled 2-column pricing: Half / Full
            variants.push({ name: 'Half', price: priceTokens[0]!.value, confidence: 0.9 });
            variants.push({ name: 'Full', price: priceTokens[1]!.value, confidence: 0.9 });
          } else {
            basePrice = priceTokens[0]!.value;
          }
        }

        // Determine parent category heading directly above this line in the same column
        const parentHeading = headings
          .filter((h) => h.columnIndex === colIndex && h.bbox.y0 < line.bbox.y0)
          .sort((a, b) => b.bbox.y0 - a.bbox.y0)[0];

        rawItems.push({
          id: `item_${itemCounter++}`,
          name: itemName,
          description: undefined,
          dietary,
          columnIndex: colIndex,
          bbox: { ...line.bbox },
          categoryId: parentHeading ? parentHeading.id : 'cat_general',
          categoryName: parentHeading ? parentHeading.name : 'GENERAL SPECIALS',
          hasVariants: variants.length > 0,
          variants,
          basePrice,
          confidence: 0.92,
        });
      }
    }

    return rawItems;
  }
}
