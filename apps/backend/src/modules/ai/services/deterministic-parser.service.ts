import { ParsedItem, ParseResult, MenuMappingItem } from '../types/parser.types';
import { logger } from '../../../infrastructure/logger/logger';

export class DeterministicParserService {
  // Multilingual numeric mappings (Hindi, Hinglish, English)
  private static readonly NUMBER_MAP: Record<string, number> = {
    one: 1, ek: 1,
    two: 2, do: 2,
    three: 3, teen: 3,
    four: 4, chaar: 4,
    five: 5, paanch: 5,
    six: 6, chah: 6,
    seven: 7, saat: 7,
    eight: 8, aath: 8,
    nine: 9, nau: 9,
    ten: 10, das: 10,
  };

  // Multilingual variant mappings
  private static readonly VARIANT_MAP: Record<string, string> = {
    half: 'half',
    hlf: 'half',
    h: 'half',
    haaf: 'half',
    full: 'full',
    fll: 'full',
    f: 'full',
    plate: 'full',
    plt: 'full',
  };

  // Intent mappings
  private static readonly INTENT_KEYWORDS = {
    checkout: ['checkout', 'check out', 'bill', 'pay', 'payment', 'order confirm', 'confirm order', 'done', 'bas yahi', 'yahi kardo'],
    cancel: ['cancel', 'delete', 'remove', 'khali', 'clear'],
    view_menu: ['menu', 'card', 'list', 'what do you have', 'items'],
    // Reserved commands to be handled separately (no item parsing)
    reset: ['reset'],
    confirm: ['confirm', 'yes', 'ok'],
    greeting: ['hello', 'hi', 'hey', 'namaste', 'start'],
  };

  /**
   * Main entry point for parsing raw text against a restaurant's menu list.
   */
    public parseInput(text: string, menu: MenuMappingItem[]): ParseResult {
      const normalized = this.normalizeText(text);
      logger.debug({ raw: text, normalized }, 'Parser: normalized input');
      const intent = this.detectIntent(normalized);


    // If intent is not order placement or is a simple command, return early
    if (intent !== 'add_to_cart' && intent !== 'unknown') {
      return {
        items: [],
        intent,
        overallConfidence: 1.0,
        isFallbackTriggered: false,
        rawInput: text,
      };
    }

    // Split input by delimiters (e.g. "and", "aur", ",", "+") to handle multi-item messages
    const parts = normalized.split(/\s+(?:and|aur|&|\+|,)\s+/);
    const parsedItems: ParsedItem[] = [];

    for (const part of parts) {
      if (!part.trim()) continue;
      const item = this.parseSingleItem(part.trim(), menu);
      if (item) {
        logger.debug({ phrase: part.trim(), parsedItem: item }, 'Parser: parseSingleItem output');
        parsedItems.push(item);
      }
    }

    // Calculate overall confidence (average of all items, or 0 if no items matched)
    const overallConfidence =
      parsedItems.length > 0
        ? parsedItems.reduce((sum, item) => sum + item.confidence, 0) / parsedItems.length
        : 0.0;

    const isFallbackTriggered = overallConfidence < 0.7 || parsedItems.length === 0;

    const result = {
      items: parsedItems,
      intent: parsedItems.length > 0 ? 'add_to_cart' : intent,
      overallConfidence,
      isFallbackTriggered,
      rawInput: text,
    };
    logger.debug({ parseResult: result }, 'Parser: final ParseResult');
    return result;
  }

  private parseSingleItem(phrase: string, menu: MenuMappingItem[]): ParsedItem | null {
    // Tokenise the phrase
    const tokens = phrase.trim().split(/\s+/);
    if (tokens.length === 0) return null;

    // 1. Quantity (if first token is a number)
    let quantity = 1;
    const firstToken = tokens[0];
    if (firstToken && /^\d+$/.test(firstToken)) {
      quantity = parseInt(firstToken, 10);
      tokens.shift();
    }

    // 2. Identify variant token (half/full) anywhere in remaining tokens
    let variantName: string | undefined;
    const variantIdx = tokens.findIndex(t => Object.keys(DeterministicParserService.VARIANT_MAP).includes(t));
    if (variantIdx !== -1) {
      const rawVariant = tokens.splice(variantIdx, 1)[0];
      if (rawVariant) {
        variantName = DeterministicParserService.VARIANT_MAP[rawVariant];
      }
    }

    // 3. Remaining tokens form the item name (ignore any trailing customization keywords for now)
    const rawItemName = tokens.join(' ');
    if (!rawItemName) return null;

    // Resolve against menu
    const matchResult = this.resolveMenuItem(rawItemName.trim(), menu);
    logger.debug({ resolveResult: matchResult }, 'Parser: resolveMenuItem result');

    return {
      itemName: matchResult.matchedName || rawItemName,
      quantity,
      variantName,
      customization: undefined,
      matchedMenuItemId: matchResult.id,
      confidence: matchResult.confidence,
    };
  }

  /**
   * Normalizes Hinglish/Hindi text strings to standardized tokens.
   */
  private normalizeText(text: string): string {
    let normalized = text.toLowerCase().trim();

    // Replace multilingual quantity words with actual digits
    for (const [word, digit] of Object.entries(DeterministicParserService.NUMBER_MAP)) {
      const regex = new RegExp(`\\b${word}\\b`, 'g');
      normalized = normalized.replace(regex, digit.toString());
    }

    // Remove common filler words
    normalized = normalized.replace(/\b(?:karde|kar|do|chahiye|please|plz|pack)\b/g, '');

    // Standardize spacing around punctuation
    normalized = normalized.replace(/\s+/g, ' ');

    return normalized;
  }

  /**
   * Simple intent classification.
   */
  private detectIntent(normalizedText: string): ParseResult['intent'] {
    for (const [intent, keywords] of Object.entries(DeterministicParserService.INTENT_KEYWORDS)) {
      for (const keyword of keywords) {
        if (normalizedText.includes(keyword)) {
          return intent as ParseResult['intent'];
        }
      }
    }
    return 'unknown';
  }

  /**
   * Matches string against active menu items using a waterfall strategy:
   * 1. Exact case-insensitive match
   * 2. Alias match
   * 3. Fuzzy Levenshtein match
   */
  private resolveMenuItem(
    searchText: string,
    menu: MenuMappingItem[]
  ): { id?: string; matchedName?: string; confidence: number } {
    const cleanSearch = searchText.toLowerCase().trim();

    // 1. Exact Match
    logger.debug({ searchText: cleanSearch }, 'Parser: resolveMenuItem searchText');
    const exactMatch = menu.find((item) => item.name.toLowerCase() === cleanSearch);
    logger.debug({ exactMatch }, 'Parser: exact match result');
    if (exactMatch) {
      return { id: exactMatch.id, matchedName: exactMatch.name, confidence: 1.0 };
    }

    // 2. Alias Match (scan arrays)
    const aliasMatch = menu.find((item) =>
      item.aliases.some((alias) => alias.toLowerCase() === cleanSearch)
    );
    logger.debug({ aliasMatch }, 'Parser: alias match result');
    if (aliasMatch) {
      return { id: aliasMatch.id, matchedName: aliasMatch.name, confidence: 0.95 };
    }

    // 3. Fuzzy match (Levenshtein distance calculation)
    let bestMatch: MenuMappingItem | null = null;
    let highestScore = 0;

    for (const item of menu) {
      // Check distance against item name
      const score = this.calculateMatchScore(cleanSearch, item.name.toLowerCase());
      logger.debug({ itemName: item.name, score }, 'Parser: fuzzy match candidate (name)');
      if (score > highestScore) {
        highestScore = score;
        bestMatch = item;
      }

      // Check distance against all aliases
      for (const alias of item.aliases) {
        const aliasScore = this.calculateMatchScore(cleanSearch, alias.toLowerCase());
        logger.debug({ alias, aliasScore }, 'Parser: fuzzy match candidate (alias)');
        if (aliasScore > highestScore) {
          highestScore = aliasScore;
          bestMatch = item;
        }
      }
    }

    logger.debug({ bestMatch, highestScore }, 'Parser: fuzzy match best result');
    // Only return fuzzy match if confidence is reasonably high (> 75% match quality)
    if (bestMatch && highestScore > 0.75) {
      return {
        id: bestMatch.id,
        matchedName: bestMatch.name,
        confidence: parseFloat(highestScore.toFixed(2)),
      };
    }

    return { confidence: 0.0 }; // Triggers AI Fallback
  }

  /**
   * Helper that returns a normalized match score (0.0 to 1.0) based on Levenshtein Distance.
   */
  private calculateMatchScore(str1: string, str2: string): number {
    const distance = this.getLevenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0) return 1.0;

    return 1.0 - distance / maxLength;
  }

  /**
   * Classic Levenshtein Distance algorithm.
   */
  private getLevenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    const firstRow = matrix[0];
    if (firstRow) {
      for (let j = 0; j <= a.length; j++) {
        firstRow[j] = j;
      }
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        const row = matrix[i];
        const prevRow = matrix[i - 1];
        if (row && prevRow) {
          if (b.charAt(i - 1) === a.charAt(j - 1)) {
            row[j] = prevRow[j - 1] ?? 0;
          } else {
            row[j] = Math.min(
              (prevRow[j] ?? 0) + 1, // deletion
              (row[j - 1] ?? 0) + 1, // insertion
              (prevRow[j - 1] ?? 0) + 1 // substitution
            );
          }
        }
      }
    }

    const lastRow = matrix[b.length];
    return lastRow ? (lastRow[a.length] ?? 0) : 0;
  }
}
