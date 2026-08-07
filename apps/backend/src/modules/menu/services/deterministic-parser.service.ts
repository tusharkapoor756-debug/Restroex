import { SpatialLine, ParsedCategoryGroup, StagedMenuItem, StagedVariant, StagedCustomization } from '../types/menu-import.types';
import { SpatialLayoutReconstructor } from './spatial-layout.service';

export class DeterministicMenuParser {
  private spatialService = new SpatialLayoutReconstructor();

  private categoryKeywords = [
    'STARTER', 'STARTERS', 'APPETIZER', 'APPETIZERS', 'MAIN COURSE', 'SOUPS',
    'SALAD', 'SALADS', 'BEVERAGES', 'DRINKS', 'DESSERTS', 'DESSERT',
    'CHINESE', 'TANDOORI', 'RICE', 'BIRWANI', 'BIRYANI', 'BREADS', 'NAAN',
    'SOUTH INDIAN', 'NORTH INDIAN', 'COMBO', 'COMBOS', 'MEAL', 'SNACKS'
  ];

  private vegKeywords = ['VEG', 'PURE VEG', '[V]', '(V)', '🟢'];
  private nonVegKeywords = ['NON VEG', 'NON-VEG', '[NV]', '(NV)', '🔴', 'CHICKEN', 'MUTTON', 'FISH', 'EGG'];

  private matrixHeaderPatterns = [
    { keywords: ['HALF', 'FULL'], labels: ['Half', 'Full'] },
    { keywords: ['SMALL', 'MEDIUM', 'LARGE'], labels: ['Small', 'Medium', 'Large'] },
    { keywords: ['REGULAR', 'LARGE'], labels: ['Regular', 'Large'] },
    { keywords: ['GLASS', 'BOTTLE'], labels: ['Glass', 'Bottle'] }
  ];

  /**
   * Parse structured spatial lines into category groups and menu items
   */
  public parseLines(lines: SpatialLine[], tenantDictionary: Map<string, string> = new Map()): ParsedCategoryGroup[] {
    const categories: ParsedCategoryGroup[] = [];
    let currentCategory: ParsedCategoryGroup = {
      id: 'cat_default',
      name: 'General',
      confidence: 1.0,
      items: []
    };

    categories.push(currentCategory);
    let activeMatrixLabels: string[] = ['Half', 'Full'];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      let lineText = this.spatialService.stripDotLeaders(line.text);

      // Apply tenant dictionary substitutions
      if (tenantDictionary.has(lineText.toLowerCase())) {
        lineText = tenantDictionary.get(lineText.toLowerCase())!;
      }

      // Check for standalone Matrix Variant Header lines (e.g. "HALF FULL")
      const detectedMatrix = this.detectMatrixHeader(lineText);
      if (detectedMatrix) {
        activeMatrixLabels = detectedMatrix;
        continue;
      }

      if (this.isCategoryHeader(lineText)) {
        currentCategory = {
          id: `cat_${categories.length + 1}`,
          name: this.normalizeCategoryName(lineText),
          confidence: 0.95,
          items: []
        };
        categories.push(currentCategory);
        continue;
      }

      const parsedItem = this.parseItemLine(lineText, line, activeMatrixLabels);
      if (parsedItem) {
        currentCategory.items.push(parsedItem);
      }
    }

    // Filter empty categories
    return categories.filter((c) => c.items.length > 0);
  }

  private detectMatrixHeader(text: string): string[] | null {
    const upper = text.toUpperCase().trim();
    for (const pattern of this.matrixHeaderPatterns) {
      if (pattern.keywords.every((kw) => upper.includes(kw)) && upper.length < 30) {
        return pattern.labels;
      }
    }
    return null;
  }


  private isCategoryHeader(text: string): boolean {
    const upper = text.toUpperCase().trim();
    if (this.categoryKeywords.some((kw) => upper.includes(kw))) {
      return true;
    }
    // Centered or standalone all-caps text under 30 chars without digits
    return upper === text && text.length >= 3 && text.length <= 30 && !/\d/.test(text);
  }

  private normalizeCategoryName(text: string): string {
    return text
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .trim()
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }

  private parseItemLine(lineText: string, line: SpatialLine, matrixLabels: string[] = ['Half', 'Full']): StagedMenuItem | null {
    const prices = this.spatialService.extractPrices(lineText);
    if (prices.length === 0) return null;

    // Detect veg/non-veg type
    let vegType: 'veg' | 'non-veg' | 'egg' | 'vegan' = 'veg';
    const upperText = lineText.toUpperCase();
    if (this.nonVegKeywords.some((kw) => upperText.includes(kw))) {
      vegType = 'non-veg';
    }

    // Detect Bestseller
    const isBestseller = upperText.includes('BESTSELLER') || upperText.includes('MUST TRY') || upperText.includes('CHEF SPECIAL');

    // Extract item title (remove price numbers and badge keywords)
    let title = lineText
      .replace(/(?:₹|Rs\.?|INR|\/-)/gi, '')
      .replace(/\b\d+(?:\.\d{1,2})?\b/g, '')
      .replace(/BESTSELLER|MUST TRY|CHEF SPECIAL|VEG|NON-VEG/gi, '')
      .trim();

    title = this.spatialService.stripDotLeaders(title);
    if (title.length < 2) return null;

    // Variants vs Base Price
    let basePrice: number | null = null;
    const variants: StagedVariant[] = [];

    if (prices.length === 1 && prices[0] !== undefined) {
      basePrice = prices[0];
    } else if (prices.length === 2 && prices[0] !== undefined && prices[1] !== undefined) {
      const label1 = matrixLabels[0] || 'Half';
      const label2 = matrixLabels[1] || 'Full';
      variants.push({ name: label1, price: prices[0], confidence: 0.9 });
      variants.push({ name: label2, price: prices[1], confidence: 0.9 });
    } else if (prices.length >= 3 && prices[0] !== undefined && prices[1] !== undefined && prices[2] !== undefined) {
      const label1 = matrixLabels[0] || 'Small';
      const label2 = matrixLabels[1] || 'Medium';
      const label3 = matrixLabels[2] || 'Large';
      variants.push({ name: label1, price: prices[0], confidence: 0.85 });
      variants.push({ name: label2, price: prices[1], confidence: 0.85 });
      variants.push({ name: label3, price: prices[2], confidence: 0.85 });
    }


    const confidenceScore = title.length > 3 && prices.length > 0 ? 0.92 : 0.65;


    return {
      categoryName: '',
      itemName: title,
      basePrice,
      vegType,
      isBestseller,
      variants,
      customizations: [],
      boundingBox: line.bbox,
      confidenceScore,
      needsReview: confidenceScore < 0.75,
      syncAction: 'create'
    };
  }
}
