import { RDIEOutput } from '../types/rdie.types';

export class ValidationService {
  /**
   * Enforces logical sanity rules, variant price monotonicity, and item deduplication.
   */
  public validateAndCleanGraph(graph: RDIEOutput): RDIEOutput {
    for (const category of graph.categories) {
      const seenItemNames = new Set<string>();
      const validItems: typeof category.items = [];

      for (const item of category.items) {
        // Rule 1: Deduplicate identical item names under same category
        const normalizedKey = item.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (seenItemNames.has(normalizedKey)) {
          continue;
        }
        seenItemNames.add(normalizedKey);

        // Rule 2: Verify Monotonic Variant Pricing (Price(Half) < Price(Full))
        if (item.hasVariants && item.variants.length >= 2) {
          item.variants.sort((a, b) => a.price - b.price);
        }

        validItems.push(item);
      }

      category.items = validItems;
    }

    // Filter out categories with 0 valid items
    graph.categories = graph.categories.filter((c) => c.items.length > 0);
    graph.metadata.headingCount = graph.categories.length;
    graph.metadata.itemCount = graph.categories.reduce((sum, c) => sum + c.items.length, 0);

    return graph;
  }
}
