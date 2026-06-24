const { DeterministicParserService } = require('../apps/backend/dist/modules/ai/services/deterministic-parser.service.js');
const { logger } = require('../apps/backend/dist/infrastructure/logger/logger.js');

(async () => {
  const parser = new DeterministicParserService();
  const menu = [
    { id: '1', name: 'malai chap full', aliases: [], isAvailable: true },
    { id: '2', name: 'malai chap half', aliases: [], isAvailable: true },
  ];
  const testMessages = ['malai chap', '2 full malai chap'];
  for (const text of testMessages) {
    logger.info({ text }, 'Running parser test');
    const result = parser.parseInput(text, menu);
    console.log('Result for', text, ':', JSON.stringify(result, null, 2));
  }
  process.exit(0);
})();
