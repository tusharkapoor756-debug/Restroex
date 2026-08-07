const { SpatialLayoutReconstructor } = require('../apps/backend/dist/modules/menu/services/spatial-layout.service');
const { DeterministicMenuParser } = require('../apps/backend/dist/modules/menu/services/deterministic-parser.service');

const benchmarkDatasets = [
  {
    id: '001',
    format: 'Printed Single-Column Menu',
    tokens: [
      { text: 'STARTERS', confidence: 0.98, bbox: { x0: 50, y0: 50, x1: 200, y1: 80 } },
      { text: 'Paneer Butter Masala ..... 240', confidence: 0.95, bbox: { x0: 50, y0: 100, x1: 400, y1: 130 } },
      { text: 'Dal Makhani ..... 180', confidence: 0.96, bbox: { x0: 50, y0: 140, x1: 350, y1: 170 } }
    ],
    expectedCount: 2,
    expectedCategory: 'Starters'
  },
  {
    id: '002',
    format: 'Multi-Variant Matrix (Half/Full)',
    tokens: [
      { text: 'MAIN COURSE', confidence: 0.97, bbox: { x0: 50, y0: 50, x1: 220, y1: 80 } },
      { text: 'Chicken Biryani 140 240', confidence: 0.94, bbox: { x0: 50, y0: 100, x1: 420, y1: 130 } },
      { text: 'Veg Biryani 100 180', confidence: 0.93, bbox: { x0: 50, y0: 140, x1: 380, y1: 170 } }
    ],
    expectedCount: 2,
    expectedCategory: 'Main Course'
  },
  {
    id: '003',
    format: 'Folded / Creased Menu Scan',
    tokens: [
      { text: 'BEVERAGES', confidence: 0.92, bbox: { x0: 50, y0: 50, x1: 180, y1: 80 } },
      { text: 'Cold Coffee 120/-', confidence: 0.88, bbox: { x0: 50, y0: 100, x1: 300, y1: 130 } },
      { text: 'Masala Chai 40/-', confidence: 0.91, bbox: { x0: 50, y0: 140, x1: 280, y1: 170 } }
    ],
    expectedCount: 2,
    expectedCategory: 'Beverages'
  },
  {
    id: '004',
    format: 'Zomato / Swiggy Screenshot',
    tokens: [
      { text: 'CHINESE', confidence: 0.99, bbox: { x0: 50, y0: 50, x1: 190, y1: 80 } },
      { text: 'Veg Hakka Noodles BESTSELLER 160', confidence: 0.96, bbox: { x0: 50, y0: 100, x1: 450, y1: 130 } },
      { text: 'Chilli Paneer Dry 220', confidence: 0.95, bbox: { x0: 50, y0: 140, x1: 380, y1: 170 } }
    ],
    expectedCount: 2,
    expectedCategory: 'Chinese'
  },
  {
    id: '005',
    format: 'Canva Flyer / Digital Graphics',
    tokens: [
      { text: 'DESSERTS', confidence: 0.97, bbox: { x0: 50, y0: 50, x1: 200, y1: 80 } },
      { text: 'Gulab Jamun (2 Pcs) 80.00', confidence: 0.94, bbox: { x0: 50, y0: 100, x1: 390, y1: 130 } },
      { text: 'Sizzling Brownie with Ice Cream 180.00', confidence: 0.93, bbox: { x0: 50, y0: 140, x1: 500, y1: 170 } }
    ],
    expectedCount: 2,
    expectedCategory: 'Desserts'
  }
];

function runValidationBenchmark() {
  console.log('=============== RESTROEX MENU IMPORT ENGINE BENCHMARK SUITE ===============\n');

  const spatialService = new SpatialLayoutReconstructor();
  const parser = new DeterministicMenuParser();

  let totalTests = benchmarkDatasets.length;
  let passedTests = 0;
  let totalItemsExtracted = 0;

  for (const ds of benchmarkDatasets) {
    console.log(`Testing Dataset ${ds.id} (${ds.format})...`);
    const lines = spatialService.groupTokensIntoLines(ds.tokens);
    const categories = parser.parseLines(lines);

    const itemsExtracted = categories.reduce((acc, c) => acc + c.items.length, 0);
    totalItemsExtracted += itemsExtracted;

    const categoryMatch = categories.some((c) => c.name.toLowerCase() === ds.expectedCategory.toLowerCase());
    const countMatch = itemsExtracted === ds.expectedCount;

    if (categoryMatch && countMatch) {
      console.log(`  ✅ Passed: Extracted ${itemsExtracted}/${ds.expectedCount} items under '${categories[0]?.name}'`);
      passedTests++;
    } else {
      console.error(`  ❌ Failed: Category match: ${categoryMatch}, Extracted: ${itemsExtracted}/${ds.expectedCount}`);
    }
  }

  console.log(`\n================ BENCHMARK SUMMARY ================`);
  console.log(`Total Dataset Scenarios Tested: ${totalTests}`);
  console.log(`Passed Scenarios: ${passedTests} / ${totalTests} (${(passedTests / totalTests * 100).toFixed(1)}%)`);
  console.log(`Total Items Successfully Parsed: ${totalItemsExtracted}`);
  console.log(`====================================================\n`);
}

runValidationBenchmark();
