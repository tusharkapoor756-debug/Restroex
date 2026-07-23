// ─── Deterministic Parser Service ─────────────────────────────────────────────
//
// Parses customer messages into structured order items.
//
// Strategy: Component-based parsing, NOT whole-phrase matching.
//   Each token is processed as: Quantity → Variant → Item → Customization
//
// This approach handles:
//   "2 half paneer tikka"
//   "paneer tikka half x2"
//   "do half malai chaap"
//   "ek full malai chap"
//   "2 margherita medium"
//
// NEVER fabricates items. If nothing matches confidently, returns isFallbackTriggered=true.

import { logger } from '../../../infrastructure/logger/logger';
import {
  MenuMappingItem,
  MenuVariantMappingItem,
  ParsedItem,
  ParseResult,
} from '../types/parser.types';

// ─── Number Word Map ──────────────────────────────────────────────────────────

const NUMBER_WORDS: Record<string, number> = {
  // English
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  // Hindi / Hinglish
  ek: 1, do: 2, teen: 3, chaar: 4, char: 4,
  paanch: 5, panch: 5, chah: 6, cheh: 6,
  saat: 7, aath: 8, nau: 9, das: 10,
};

// Regex: matches "x2", "x 2", "×2" suffix quantities
const SUFFIX_QUANTITY_RE = /\s*[x×]\s*(\d+)$/i;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeText(text: string): string {
  let s = text.toLowerCase().trim();
  // Replace trailing x2 / ×2 suffixes early so tokenizer sees them
  s = s.replace(/[x×]\s*(\d+)/gi, ' $1');
  // Expand number words → digits (whole word boundary)
  for (const [word, digit] of Object.entries(NUMBER_WORDS)) {
    s = s.replace(new RegExp(`\\b${word}\\b`, 'g'), String(digit));
  }
  // Collapse whitespace
  return s.replace(/\s+/g, ' ').trim();
}

function tokenize(text: string): string[] {
  return text
    .split(/\s*[,&+\n]\s*|\s+(?:and|or|aur)\s+/i)
    .map(t => t.trim())
    .filter(Boolean);
}

function cleanCustomization(text: string): string | undefined {
  let s = text.toLowerCase().trim();
  
  // Replace multi-word verbs first
  const multiWordVerbs = ['add kro', 'kar do', 'kardo', 'dal do', 'mangwa do', 'bhej do'];
  for (const verb of multiWordVerbs) {
    s = s.replace(new RegExp(`\\b${verb}\\b`, 'g'), '');
  }

  // Replace single-word verbs
  const singleWordVerbs = ['add', 'dal', 'mangwa', 'bhej', 'order', 'please', 'pls', 'plz', 'kro', 'do', 'pack'];
  for (const verb of singleWordVerbs) {
    s = s.replace(new RegExp(`\\b${verb}\\b`, 'g'), '');
  }

  s = s.replace(/\s+/g, ' ').trim();
  return s || undefined;
}

/**
 * Levenshtein distance — used only for short alias matching.
 * We keep this tight (threshold ≤ 2) to prevent spurious matches.
 */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i]![j] = a[i - 1] === b[j - 1]
        ? dp[i - 1]![j - 1]!
        : 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!);
    }
  }
  return dp[a.length]![b.length]!;
}

/**
 * Tries to match a phrase against a menu item name or its aliases.
 * Returns confidence 1.0 for exact/alias, 0.9 for prefix, 0.8 for fuzzy.
 */
function matchMenuName(
  phrase: string,
  item: MenuMappingItem,
): number {
  const candidates = [item.name.toLowerCase(), ...item.aliases.map(a => a.toLowerCase())];
  const q = phrase.toLowerCase().trim();
  for (const c of candidates) {
    if (c === q) return 1.0;
  }
  for (const c of candidates) {
    if (q.startsWith(c) || c.startsWith(q)) return 0.9;
  }
  for (const c of candidates) {
    if (c.includes(q) || q.includes(c)) return 0.85;
  }
  // Fuzzy — only for short names (≤ 3 words) to avoid false positives
  const qWords = q.split(' ').length;
  if (qWords <= 3) {
    for (const c of candidates) {
      const dist = levenshtein(q, c);
      const threshold = Math.min(2, Math.floor(Math.max(q.length, c.length) * 0.25));
      if (dist <= threshold) return 0.8;
    }
  }
  return 0;
}

/**
 * Tries to match a phrase against a variant name.
 */
function matchVariantName(
  phrase: string,
  variants: MenuVariantMappingItem[],
): MenuVariantMappingItem | undefined {
  const q = phrase.toLowerCase().trim();
  // Exact
  const exact = variants.find(v => v.variantName.toLowerCase() === q);
  if (exact) return exact;
  // Prefix
  const prefix = variants.find(v => v.variantName.toLowerCase().startsWith(q) || q.startsWith(v.variantName.toLowerCase()));
  return prefix;
}

// ─── Intent Classification ────────────────────────────────────────────────────

const INTENT_KEYWORDS: Record<string, string[]> = {
  checkout: ['checkout', 'check out', 'bill', 'pay', 'payment', 'confirm order', 'place order', 'done', 'bas yahi', 'yahi kardo'],
  view_menu: ['menu', 'list', 'what do you have', 'show menu', 'items available'],
  view_cart: ['cart', 'basket', 'show cart', 'my order', 'show my order', 'mera cart', 'cart dikhao'],
  clear_cart: ['clear cart', 'empty cart', 'reset cart', 'khali karo', 'clear my cart'],
  greeting: ['hi', 'hello', 'hey', 'namaste', 'ram ram', 'start'],
  cancel: ['cancel', 'no', 'nahi', 'nai'],
};

function detectIntent(normalizedText: string): string {
  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    for (const kw of keywords) {
      if (normalizedText === kw || normalizedText.startsWith(kw + ' ') || normalizedText.endsWith(' ' + kw)) {
        return intent;
      }
    }
  }
  return 'unknown';
}

// ─── Core Component Parser ────────────────────────────────────────────────────

/**
 * Parses a single order token (e.g. "2 half paneer tikka") into components.
 *
 * Algorithm:
 *   1. Strip leading quantity digit(s) → `quantity`
 *   2. Try all n-gram substrings to match an item name → `matchedItem`
 *   3. From remaining text, try to match a variant name → `matchedVariant`
 *   4. Everything leftover → `customization`
 */
function parseOrderToken(
  token: string,
  menu: MenuMappingItem[],
): ParsedItem | null {
  let remaining = token.trim();

  // ── 1. Extract quantity (leading or trailing) ──────────────────────────
  let quantity = 1;
  const trailingNum = remaining.match(/\s+(\d+)$/);
  if (trailingNum) {
    quantity = parseInt(trailingNum[1]!, 10);
    remaining = remaining.slice(0, remaining.length - trailingNum[0].length).trim();
  } else {
    const leadingNum = remaining.match(/^(\d+)\s+/);
    if (leadingNum) {
      quantity = parseInt(leadingNum[1]!, 10);
      remaining = remaining.slice(leadingNum[0].length).trim();
    }
  }

  // ── 2. Find best menu item match across all n-grams ─────────────────────
  const words = remaining.split(' ');
  let bestItem: MenuMappingItem | undefined;
  let bestConf = 0;
  let bestItemStart = -1;
  let bestItemEnd = -1;

  for (let start = 0; start < words.length; start++) {
    for (let end = words.length; end > start; end--) {
      const phrase = words.slice(start, end).join(' ');
      for (const item of menu) {
        const conf = matchMenuName(phrase, item);
        if (conf > bestConf) {
          bestConf = conf;
          bestItem = item;
          bestItemStart = start;
          bestItemEnd = end;
        }
      }
    }
  }

  // Must meet minimum confidence threshold
  if (!bestItem || bestConf < 0.8) return null;

  // ── 3. Extract text OUTSIDE the matched item span ────────────────────────
  const beforeItem = words.slice(0, bestItemStart).join(' ').trim();
  const afterItem = words.slice(bestItemEnd).join(' ').trim();
  const surrounding = [beforeItem, afterItem].filter(Boolean).join(' ').trim();

  // ── 4. Match variant from surrounding text ───────────────────────────────
  let matchedVariant: MenuVariantMappingItem | undefined;

  if (bestItem.variants.length > 0 && surrounding) {
    matchedVariant = matchVariantName(surrounding, bestItem.variants);
  }

  // ── 5. Determine customization = leftover after variant is stripped ───────
  let customization: string | undefined;
  if (surrounding) {
    if (matchedVariant) {
      const varLower = matchedVariant.variantName.toLowerCase();
      const leftover = surrounding.replace(varLower, '').replace(/\s+/g, ' ').trim();
      if (leftover) customization = cleanCustomization(leftover);
    } else {
      // No variant matched — all surrounding text is customization
      customization = cleanCustomization(surrounding);
    }
  }

  // ── 6. Build ParsedItem ─────────────────────────────────────────────────
  const item: ParsedItem = {
    itemName: bestItem.name,
    quantity,
    confidence: bestConf,
    matchedMenuItemId: bestItem.id,
    customization,
  };

  const hasVariants = bestItem.variants.length > 0;

  if (hasVariants) {
    if (matchedVariant) {
      item.matchedVariantId = matchedVariant.id;
      item.variantPrice = matchedVariant.price;
      item.variantName = matchedVariant.variantName;
      item.needsVariant = false;
    } else {
      item.needsVariant = true;
    }
  } else {
    item.needsVariant = false;
  }

  return item;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class DeterministicParserService {
  /**
   * Primary entry point.
   *
   * Returns a ParseResult. If any part of the message cannot be matched to a
   * menu item with sufficient confidence, isFallbackTriggered=true is returned
   * and items=[] so the caller can route to the Planner.
   */
  public parseInput(
    text: string,
    menu: MenuMappingItem[],
  ): ParseResult {
    const normalized = normalizeText(text);

    // Early intent classification — shortcuts that never need item parsing
    const intent = detectIntent(normalized);
    if (intent !== 'unknown') {
      logger.debug({ text, intent }, 'Parser: early intent shortcut');
      return {
        items: [],
        intent: intent as any,
        overallConfidence: 1.0,
        isFallbackTriggered: false,
        rawInput: text,
      };
    }

    const tokens = tokenize(normalized);
    if (tokens.length === 0) {
      return this.fallback(text);
    }

    const items: ParsedItem[] = [];
    let hasUnmatched = false;

    for (const token of tokens) {
      const parsed = parseOrderToken(token, menu);
      if (parsed) {
        items.push(parsed);
      } else {
        logger.debug({ token }, 'Parser: token unmatched — triggering fallback');
        hasUnmatched = true;
      }
    }

    logger.debug({ raw: text, normalized, tokens, items, hasUnmatched }, 'Parser: result');

    if (hasUnmatched || items.length === 0) {
      return this.fallback(text, hasUnmatched);
    }

    return {
      items,
      intent: 'add_to_cart',
      overallConfidence: Math.min(...items.map(i => i.confidence)),
      isFallbackTriggered: false,
      hasUnmatched: false,
      rawInput: text,
    };
  }

  private fallback(text: string, hasUnmatched = true): ParseResult {
    return {
      items: [],
      intent: 'unknown',
      overallConfidence: 0,
      isFallbackTriggered: true,
      hasUnmatched,
      rawInput: text,
    };
  }
}