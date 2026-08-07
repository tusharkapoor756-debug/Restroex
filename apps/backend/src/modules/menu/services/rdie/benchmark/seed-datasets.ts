import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

interface MenuSeed {
  folder: string;
  title: string;
  categories: Array<{
    name: string;
    items: Array<{ name: string; price?: number; variants?: Array<{ name: string; price: number }> }>;
  }>;
}

const datasetV1Seeds: MenuSeed[] = [
  {
    folder: 'pizza',
    title: 'PIZZERIA BELLA',
    categories: [
      {
        name: 'PIZZAS',
        items: [
          { name: 'Margherita Pizza', variants: [{ name: 'Small', price: 199 }, { name: 'Medium', price: 349 }, { name: 'Large', price: 499 }] },
          { name: 'Farmhouse Special', variants: [{ name: 'Small', price: 249 }, { name: 'Medium', price: 419 }, { name: 'Large', price: 599 }] },
          { name: 'Pepperoni Feast', variants: [{ name: 'Small', price: 299 }, { name: 'Medium', price: 499 }, { name: 'Large', price: 699 }] },
        ],
      },
      {
        name: 'PASTAS',
        items: [
          { name: 'White Sauce Penne', price: 220 },
          { name: 'Arrabbiata Pasta', price: 240 },
        ],
      },
    ],
  },
  {
    folder: 'chinese',
    title: 'GOLDEN DRAGON CHINESE',
    categories: [
      {
        name: 'STARTERS',
        items: [
          { name: 'Veg Spring Roll', price: 160 },
          { name: 'Chilli Chicken Dry', price: 280 },
          { name: 'Honey Chilli Potato', price: 180 },
        ],
      },
      {
        name: 'NOODLES AND RICE',
        items: [
          { name: 'Hakka Noodles', price: 190 },
          { name: 'Schezwan Fried Rice', price: 210 },
        ],
      },
    ],
  },
  {
    folder: 'cafe',
    title: 'THE COFFEE HOUSE',
    categories: [
      {
        name: 'HOT BREWS',
        items: [
          { name: 'Espresso', price: 120 },
          { name: 'Cappuccino', price: 160 },
          { name: 'Cafe Latte', price: 170 },
        ],
      },
      {
        name: 'SANDWICHES',
        items: [
          { name: 'Grilled Cheese Sandwich', price: 150 },
          { name: 'Club Chicken Sandwich', price: 220 },
        ],
      },
    ],
  },
  {
    folder: 'indian',
    title: 'SPICE ROUTE INDIAN',
    categories: [
      {
        name: 'MAIN COURSE',
        items: [
          { name: 'Paneer Butter Masala', variants: [{ name: 'Half', price: 180 }, { name: 'Full', price: 320 }] },
          { name: 'Dal Makhani', variants: [{ name: 'Half', price: 150 }, { name: 'Full', price: 260 }] },
          { name: 'Butter Chicken', variants: [{ name: 'Half', price: 240 }, { name: 'Full', price: 420 }] },
        ],
      },
      {
        name: 'BREADS',
        items: [
          { name: 'Butter Naan', price: 40 },
          { name: 'Garlic Naan', price: 60 },
          { name: 'Tandoori Roti', price: 20 },
        ],
      },
    ],
  },
];

async function generateSvgMenu(seed: MenuSeed): Promise<Buffer> {
  let linesSvg = '';
  let currentY = 80;

  // Title Header
  linesSvg += `<text x="400" y="${currentY}" font-family="Arial" font-size="32" font-weight="bold" text-anchor="middle" fill="#111827">${seed.title}</text>`;
  currentY += 60;

  for (const cat of seed.categories) {
    linesSvg += `<text x="50" y="${currentY}" font-family="Arial" font-size="24" font-weight="bold" fill="#DC2626">${cat.name}</text>`;
    currentY += 40;

    for (const item of cat.items) {
      linesSvg += `<text x="60" y="${currentY}" font-family="Arial" font-size="18" fill="#1F2937">${item.name}</text>`;

      if (item.variants) {
        let xPos = 450;
        for (const v of item.variants) {
          linesSvg += `<text x="${xPos}" y="${currentY}" font-family="Arial" font-size="16" fill="#4B5563">${v.name} ${v.price}/-</text>`;
          xPos += 120;
        }
      } else if (item.price != null) {
        linesSvg += `<text x="650" y="${currentY}" font-family="Arial" font-size="18" font-weight="bold" fill="#059669">${item.price}/-</text>`;
      }
      currentY += 35;
    }
    currentY += 30;
  }

  const svg = `<svg width="800" height="${Math.max(600, currentY + 50)}" xmlns="http://www.w3.org/2000/svg" style="background-color: #ffffff;">
    ${linesSvg}
  </svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function seedDatasets() {
  console.log('🌱 Generating unique real dataset samples for dataset_v1 and dataset_v2...');

  const baseDir = path.join(__dirname, 'datasets');

  for (const seed of datasetV1Seeds) {
    const pngBuffer = await generateSvgMenu(seed);

    // Build Ground Truth JSON
    const gtCategories = seed.categories.map((c) => ({ name: c.name }));
    const gtItems: any[] = [];

    for (const c of seed.categories) {
      for (const i of c.items) {
        gtItems.push({
          name: i.name,
          category: c.name,
          basePrice: i.price ?? null,
          variants: i.variants ?? [],
        });
      }
    }

    const gtContent = JSON.stringify({ categories: gtCategories, items: gtItems }, null, 2);

    // Write to dataset_v1
    const v1Path = path.join(baseDir, 'dataset_v1', seed.folder);
    fs.mkdirSync(v1Path, { recursive: true });
    fs.writeFileSync(path.join(v1Path, 'image.png'), pngBuffer);
    fs.writeFileSync(path.join(v1Path, 'ground_truth.json'), gtContent);

    // Write to dataset_v2
    const v2Path = path.join(baseDir, 'dataset_v2', seed.folder);
    fs.mkdirSync(v2Path, { recursive: true });
    fs.writeFileSync(path.join(v2Path, 'image.png'), pngBuffer);
    fs.writeFileSync(path.join(v2Path, 'ground_truth.json'), gtContent);

    console.log(`   ✅ Seeded unique dataset: [${seed.folder}] (${gtItems.length} items)`);
  }
}

seedDatasets().catch(console.error);
