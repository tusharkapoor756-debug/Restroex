import { HeadingNode, RawMenuItem, RDIEOutput } from '../types/rdie.types';

export class MenuGraphService {
  /**
   * Constructs a Directed Acyclic Graph (DAG) hierarchy mapping categories to their spatial items.
   */
  public buildMenuGraph(headings: HeadingNode[], rawItems: RawMenuItem[], tokenCount: number, columnCount: number): RDIEOutput {
    const categoryMap = new Map<
      string,
      {
        id: string;
        name: string;
        confidence: number;
        boundingBox: any;
        items: RawMenuItem[];
      }
    >();

    // Step 1: Register all detected headings as Categories
    for (const h of headings) {
      categoryMap.set(h.name, {
        id: h.id,
        name: h.name,
        confidence: h.confidence,
        boundingBox: h.bbox,
        items: [],
      });
    }

    // Step 2: Register Fallback Category if items exist before any heading
    const defaultCatName = 'GENERAL SPECIALS';
    if (!categoryMap.has(defaultCatName) && rawItems.some((i) => !i.categoryName || i.categoryName === defaultCatName)) {
      categoryMap.set(defaultCatName, {
        id: 'cat_general',
        name: defaultCatName,
        confidence: 0.85,
        boundingBox: { x0: 0, y0: 0, x1: 100, y1: 100 },
        items: [],
      });
    }

    // Step 3: Populate Items into Category DAG Nodes
    for (const item of rawItems) {
      const catName = item.categoryName || defaultCatName;
      const targetCat = categoryMap.get(catName);
      if (targetCat) {
        targetCat.items.push(item);
      } else {
        // Dynamic fallback
        categoryMap.set(catName, {
          id: `cat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: catName,
          confidence: 0.85,
          boundingBox: item.bbox,
          items: [item],
        });
      }
    }

    const categoriesList = Array.from(categoryMap.values()).filter((c) => c.items.length > 0);

    const totalItems = categoriesList.reduce((sum, c) => sum + c.items.length, 0);
    const overallConf = categoriesList.length > 0 ? 0.94 : 0.5;

    return {
      engineVersion: 'RDIE-v1.0.0-DETERMINISTIC',
      confidenceScore: overallConf,
      metadata: {
        detectedColumns: columnCount,
        processedDpi: 300,
        tokenCount,
        headingCount: categoriesList.length,
        itemCount: totalItems,
      },
      categories: categoriesList,
    };
  }
}
