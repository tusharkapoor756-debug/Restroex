import { DeterministicParserService } from '../apps/backend/src/modules/ai/services/deterministic-parser.service';
import { logger } from '../apps/backend/src/infrastructure/logger/logger';

(async () => {
  const parser = new DeterministicParserService();

  const menu = [
    { id: '1', name: 'malai chap full', aliases: [], isAvailable: true } as any,
    { id: '2', name: 'malai chap half', aliases: [], isAvailable: true } as any,
  ];

  const testMessages = ['malai chap', '2 full malai chap'];
  for (const text of testMessages) {
    logger.info({ text }, 'Running parser test');
    const result = parser.parseInput(text, menu);
    console.log('Result for', text, ':', JSON.stringify(result, null, 2));
  }
  process.exit(0);
})();
