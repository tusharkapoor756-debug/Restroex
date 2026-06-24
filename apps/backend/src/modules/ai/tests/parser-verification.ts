// apps/backend/src/modules/ai/tests/parser-verification.ts
import { DeterministicParserService } from '../services/deterministic-parser.service';
import { MenuMappingItem } from '../types/parser.types';

function runParserVerification() {
  console.log('🧪 Starting Deterministic Parser Verification Tests...');

  const parser = new DeterministicParserService();

  // Mock Menu items matching restaurants table
  const mockMenu: MenuMappingItem[] = [
    { id: 'item-1', name: 'Malai Chaap', aliases: ['malai chap', 'mlai chp', 'chaap'], basePrice: 220 },
    { id: 'item-2', name: 'Rumali Roti', aliases: ['rumali', 'roti'], basePrice: 20 },
    { id: 'item-3', name: 'Paneer Roll', aliases: ['paneer kathi roll', 'paneer roll'], basePrice: 120 },
    { id: 'item-4', name: 'Coke', aliases: ['coca cola', 'cold drink'], basePrice: 40 },
  ];

  const testCases = [
    {
      input: '2 full chaap',
      expectedItem: 'Malai Chaap',
      expectedQty: 2,
      expectedVariant: 'full',
    },
    {
      input: 'do rumali', // Hinglish/Hindi number normalization
      expectedItem: 'Rumali Roti',
      expectedQty: 2,
      expectedVariant: undefined,
    },
    {
      input: '1 coke no ice', // Customization extraction
      expectedItem: 'Coke',
      expectedQty: 1,
      expectedVariant: undefined,
      expectedCustomization: 'no ice',
    },
    {
      input: 'mlai chp', // Spelling mistake & Shorthand alias matching
      expectedItem: 'Malai Chaap',
      expectedQty: 1,
      expectedVariant: undefined,
    },
    {
      input: '2 paneer roll extra spicy', // Multi-word item name & customization
      expectedItem: 'Paneer Roll',
      expectedQty: 2,
      expectedVariant: undefined,
      expectedCustomization: 'extra spicy',
    },
    {
      input: 'checkout please', // Intent classification
      expectedIntent: 'checkout',
    },
  ];

  for (const tc of testCases) {
    console.log(`\nTesting phrase: "${tc.input}"`);
    const result = parser.parseInput(tc.input, mockMenu);

    if (tc.expectedIntent) {
      if (result.intent !== tc.expectedIntent) {
        console.error(`❌ Expected intent [${tc.expectedIntent}], but parsed [${result.intent}]`);
        process.exit(1);
      }
      console.log(`✅ Correctly classified intent: [${result.intent}]`);
      continue;
    }

    const parsedItem = result.items[0];
    if (!parsedItem) {
      console.error(`❌ Failed to parse any items from phrase: "${tc.input}"`);
      process.exit(1);
    }

    console.log(`- Matched: "${parsedItem.itemName}" (ID: ${parsedItem.matchedMenuItemId})`);
    console.log(`- Quantity: ${parsedItem.quantity}`);
    console.log(`- Variant: ${parsedItem.variantName || 'None'}`);
    console.log(`- Customization: ${parsedItem.customization || 'None'}`);
    console.log(`- Confidence: ${parsedItem.confidence}`);

    if (parsedItem.itemName !== tc.expectedItem) {
      console.error(`❌ Expected item "${tc.expectedItem}", got "${parsedItem.itemName}"`);
      process.exit(1);
    }

    if (parsedItem.quantity !== tc.expectedQty) {
      console.error(`❌ Expected quantity [${tc.expectedQty}], got [${parsedItem.quantity}]`);
      process.exit(1);
    }

    if (parsedItem.variantName !== tc.expectedVariant) {
      console.error(`❌ Expected variant [${tc.expectedVariant}], got [${parsedItem.variantName}]`);
      process.exit(1);
    }

    if (tc.expectedCustomization && parsedItem.customization !== tc.expectedCustomization) {
      console.error(`❌ Expected customization [${tc.expectedCustomization}], got [${parsedItem.customization}]`);
      process.exit(1);
    }

    console.log('✅ Matches expectations.');
  }

  console.log('\n🌟 ALL DETERMINISTIC PARSER TEST CASES PASSED SUCCESSFULLY!');
}

runParserVerification();
