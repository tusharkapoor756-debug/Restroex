import { logger } from '../../../infrastructure/logger/logger';
import { MenuMappingItem } from '../types/parser.types';
import { ExecutionAction } from '../types/planner.types';
import { DeterministicParserService } from './deterministic-parser.service';

export interface RouteMatch {
  route: string;
  confidence: number;
  reason: string;
  actions?: ExecutionAction[];
}

export interface DetectorContext {
  message: string;
  normalizedText: string;
  menu: MenuMappingItem[];
  session: any;
}

export interface Detector {
  name: string;
  detect(ctx: DetectorContext): Promise<RouteMatch>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Scores a message against a set of keyword phrases.
 *
 * Rules:
 *  - Multi-word phrases score higher (1.0) than single-word keywords (0.9).
 *  - Exact full-message matches score 1.0 regardless of phrase length.
 *  - Returns highest score found across all phrases.
 */
function scoreKeywords(text: string, phrases: string[]): number {
  let best = 0;
  for (const phrase of phrases) {
    if (!text.includes(phrase)) continue;
    // Exact match → maximum confidence
    if (text === phrase) return 1.0;
    // Multi-word phrase → high confidence
    const score = phrase.includes(' ') ? 1.0 : 0.9;
    if (score > best) best = score;
  }
  return best;
}

// ─── 1. Greeting Detector ────────────────────────────────────────────────────
export class GreetingDetector implements Detector {
  public name = 'GreetingDetector';

  public static readonly GREETING_PHRASES = [
    'hi', 'hello', 'hey', 'namaste', 'start', 'ram ram', 'yo',
    'good morning', 'good evening', 'good afternoon',
  ];

  public async detect(ctx: DetectorContext): Promise<RouteMatch> {
    const score = scoreKeywords(ctx.normalizedText, GreetingDetector.GREETING_PHRASES);
    if (score > 0) {
      return {
        route: 'GREETING',
        confidence: score,
        reason: 'Matched greeting keyword',
        actions: [{ type: 'GREETING' }],
      };
    }
    return { route: 'UNKNOWN', confidence: 0.0, reason: 'No greeting match' };
  }
}

// ─── 2. Menu Detector ────────────────────────────────────────────────────────
export class MenuDetector implements Detector {
  public name = 'MenuDetector';

  public static readonly MENU_PHRASES = [
    'show menu', 'view menu', 'see menu', 'menu dikhao', 'menu dikha',
    'what do you have', 'what do you serve', 'whats on the menu',
    'menu', 'card', 'list',
  ];

  public async detect(ctx: DetectorContext): Promise<RouteMatch> {
    const score = scoreKeywords(ctx.normalizedText, MenuDetector.MENU_PHRASES);
    if (score > 0) {
      return {
        route: 'VIEW_MENU',
        confidence: score,
        reason: 'Matched menu keyword',
        actions: [{ type: 'VIEW_MENU' }],
      };
    }
    return { route: 'UNKNOWN', confidence: 0.0, reason: 'No menu match' };
  }
}

// ─── 3. Checkout Detector ────────────────────────────────────────────────────
export class CheckoutDetector implements Detector {
  public name = 'CheckoutDetector';

  public static readonly CHECKOUT_PHRASES = [
    'checkout',
    'check out',
    'order confirm',
    'confirm order',
    'place order',
    'bas yahi',
    'yahi kardo',
    'bill',
    'pay',
    'payment',
    'done',
  ];

  public async detect(ctx: DetectorContext): Promise<RouteMatch> {
    const score = scoreKeywords(ctx.normalizedText, CheckoutDetector.CHECKOUT_PHRASES);
    if (score > 0) {
      return {
        route: 'CHECKOUT',
        confidence: score,
        reason: 'Matched checkout keyword',
        actions: [{ type: 'CHECKOUT' }],
      };
    }
    return { route: 'UNKNOWN', confidence: 0.0, reason: 'No checkout match' };
  }
}

// ─── 4. Cart Detector ────────────────────────────────────────────────────────
//
// Precedence (highest wins):
//   CLEAR_CART > REMOVE_ITEM > UPDATE_QUANTITY > ADD_ITEM > VIEW_CART
//
// This prevents "clear my cart" from matching VIEW_CART's "cart" token first.
export class CartDetector implements Detector {
  public name = 'CartDetector';

  private readonly parser = new DeterministicParserService();

  // ── Mutation phrases (higher priority, checked BEFORE view phrases) ─────────
  public static readonly CLEAR_CART_PHRASES = [
    'clear my cart', 'clear cart', 'empty my cart', 'empty cart',
    'delete my cart', 'delete cart', 'reset cart', 'reset my cart',
    'delet cart', 'delte cart', 'cler cart',
    'mera cart clear', 'cart clear kardo', 'cart khali karo', 'khali karo', 'khali krdo', 'khali kardo',
    'sabka hatao', 'sab hatao', 'remove all', 'delete all',
  ];

  public static readonly REMOVE_ITEM_WORDS = [
    'remove', 'rmove', 'delete', 'delet', 'delte', 'minus', 'subtract', 'cancel item',
    'hatao', 'hata', 'nikal do', 'nikal', 'nikaldo',
  ];

  public static readonly UPDATE_QUANTITY_WORDS = [
    'update', 'change quantity', 'set quantity', 'make it',
  ];

  // ── View phrase (lower priority, only if no mutation matched) ────────────────
  public static readonly VIEW_CART_PHRASES = [
    'show my cart', 'show cart', 'view my cart', 'view cart',
    'mera cart dikhao', 'cart dikhao', 'my order', 'show my order',
    'items in cart', 'cart', 'basket',
  ];

  public async detect(ctx: DetectorContext): Promise<RouteMatch> {
    const textLower = ctx.normalizedText;

    // ── 1. CLEAR_CART — must be checked BEFORE VIEW_CART ────────────────────
    const clearScore = scoreKeywords(textLower, CartDetector.CLEAR_CART_PHRASES);
    if (clearScore > 0) {
      return {
        route: 'CLEAR_CART',
        confidence: clearScore,
        reason: 'Matched clear cart phrase',
        actions: [{ type: 'CLEAR_CART' }],
      };
    }

    // ── 2. Try item-level parse first (catches remove/update/add before view) ─
    const parseResult = this.parser.parseInput(ctx.message, ctx.menu);
    if (!parseResult.isFallbackTriggered && parseResult.items.length > 0) {
      const removeScore = scoreKeywords(textLower, CartDetector.REMOVE_ITEM_WORDS);
      const updateScore = scoreKeywords(textLower, CartDetector.UPDATE_QUANTITY_WORDS);

      if (removeScore > 0) {
        const actions: ExecutionAction[] = parseResult.items.map((item) => ({
          type: 'REMOVE_ITEM',
          item: item.itemName,
          variant: item.variantName,
        }));
        return {
          route: 'REMOVE_ITEM',
          confidence: removeScore,
          reason: 'Matched remove + parsed menu item',
          actions,
        };
      }

      if (updateScore > 0) {
        const actions: ExecutionAction[] = parseResult.items.map((item) => ({
          type: 'UPDATE_QUANTITY',
          item: item.itemName,
          quantity: item.quantity,
          delta: false,
        }));
        return {
          route: 'UPDATE_QUANTITY',
          confidence: updateScore,
          reason: 'Matched update + parsed menu item',
          actions,
        };
      }

      // Plain add to cart
      const actions: ExecutionAction[] = parseResult.items.map((item) => ({
        type: 'ADD_ITEM',
        item: item.itemName,
        variant: item.variantName,
        quantity: item.quantity,
      }));
      return {
        route: 'ADD_ITEM',
        confidence: Math.min(...parseResult.items.map((i) => i.confidence)),
        reason: 'Deterministic parse successful',
        actions,
      };
    }

    // Do not classify as VIEW_CART if message contains delete/remove/clear/hatao/etc.
    const hasMutationWord = [
      'delete', 'delte', 'delet', 'remove', 'rmove', 'hatao', 'hata',
      'nikal', 'clear', 'khali', 'empty', 'cancel'
    ].some(word => textLower.includes(word));

    if (hasMutationWord) {
      return { route: 'UNKNOWN', confidence: 0.0, reason: 'Contains mutation keyword but failed parse' };
    }

    // ── 3. VIEW_CART — lowest priority, only if no mutation or item matched ──
    const viewScore = scoreKeywords(textLower, CartDetector.VIEW_CART_PHRASES);
    if (viewScore > 0) {
      return {
        route: 'VIEW_CART',
        confidence: viewScore,
        reason: 'Matched view cart phrase',
        actions: [{ type: 'VIEW_CART' }],
      };
    }

    return { route: 'UNKNOWN', confidence: 0.0, reason: 'No cart match' };
  }
}

// ─── 5. Price Detector ───────────────────────────────────────────────────────
export class PriceDetector implements Detector {
  public name = 'PriceDetector';

  public static readonly PRICE_PHRASES = [
    'price of', 'cost of', 'rate of', 'how much is', 'how much for',
    'price', 'cost', 'rate', 'how much', 'kitne ka', 'kitna hai', 'rupees', 'rs',
  ];

  public async detect(ctx: DetectorContext): Promise<RouteMatch> {
    const hasPriceWord = scoreKeywords(ctx.normalizedText, PriceDetector.PRICE_PHRASES);
    if (hasPriceWord > 0) {
      const match = this.fuzzyMatchMenuItem(ctx.normalizedText, ctx.menu);
      if (match) {
        return {
          route: 'ASK_PRICE',
          confidence: hasPriceWord,
          reason: `Matched price query for item "${match.item.name}"`,
          actions: [
            {
              type: 'ASK_PRICE',
              item: match.item.name,
              variant: match.variant?.variantName,
            },
          ],
        };
      }
    }
    return { route: 'UNKNOWN', confidence: 0.0, reason: 'No price match' };
  }

  private fuzzyMatchMenuItem(
    text: string,
    menu: MenuMappingItem[],
  ): { item: MenuMappingItem; variant?: { variantName: string } } | undefined {
    const q = text.toLowerCase();
    for (const item of menu) {
      const names = [item.name.toLowerCase(), ...item.aliases.map((a) => a.toLowerCase())];
      for (const name of names) {
        if (q.includes(name)) {
          const leftover = q.replace(name, '').trim();
          const matchedVariant = item.variants.find((v) =>
            leftover.includes(v.variantName.toLowerCase())
          );
          return { item, variant: matchedVariant };
        }
      }
    }
    return undefined;
  }
}

// ─── 6. Payment & Order Status Detector ──────────────────────────────────────
export class PaymentDetector implements Detector {
  public name = 'PaymentDetector';

  private static readonly STATUS_PHRASES = [
    'order status', 'payment status', 'where is my order',
    'order details', 'payment screenshot',
    'status',
  ];

  public async detect(ctx: DetectorContext): Promise<RouteMatch> {
    const score = scoreKeywords(ctx.normalizedText, PaymentDetector.STATUS_PHRASES);
    if (score > 0) {
      return {
        route: 'CHECK_PAYMENT_STATUS',
        confidence: score,
        reason: 'Matched status keyword',
        actions: [{ type: 'CHECK_PAYMENT_STATUS' }],
      };
    }
    return { route: 'UNKNOWN', confidence: 0.0, reason: 'No status query match' };
  }
}

// ─── Main Router ─────────────────────────────────────────────────────────────
export class ConversationRouterService {
  private readonly detectors: Detector[] = [];
  private readonly threshold: number;
  private readonly parser = new DeterministicParserService();

  constructor() {
    this.detectors.push(new GreetingDetector());
    this.detectors.push(new MenuDetector());
    this.detectors.push(new CheckoutDetector());
    this.detectors.push(new CartDetector());
    this.detectors.push(new PriceDetector());
    this.detectors.push(new PaymentDetector());

    const envThreshold = process.env.ROUTING_CONFIDENCE_THRESHOLD;
    this.threshold = envThreshold ? parseFloat(envThreshold) : 0.8;
  }

  public registerDetector(detector: Detector): void {
    this.detectors.push(detector);
  }

  public async route(
    message: string,
    menu: MenuMappingItem[],
    session: any,
  ): Promise<RouteMatch> {
    const normalizedText = message.toLowerCase().trim();

    // 1. Parser-first check: if parser fell back or has unmatched elements, return PLANNER immediately
    // unless it matches a deterministic price query or greeting/menu/checkout/cart view/clear keywords.
    const parseResult = this.parser.parseInput(message, menu);
    if (parseResult.isFallbackTriggered || parseResult.hasUnmatched) {
      const hasPrice = scoreKeywords(normalizedText, PriceDetector.PRICE_PHRASES) > 0;
      if (!hasPrice) {
        return {
          route: 'PLANNER',
          confidence: 0.0,
          reason: 'Deterministic parser fallback triggered',
        };
      }
    }

    const ctx: DetectorContext = { message, normalizedText, menu, session };

    let bestMatch: RouteMatch = {
      route: 'PLANNER',
      confidence: 0.0,
      reason: 'No detector triggered, falling back to Planner',
    };

    let matchedDetectorName = 'None';

    for (const detector of this.detectors) {
      try {
        const match = await detector.detect(ctx);
        if (match.confidence > bestMatch.confidence) {
          bestMatch = match;
          matchedDetectorName = detector.name;
        }
      } catch (err) {
        logger.error({ err, detectorName: detector.name }, 'Router: detector failed');
      }
    }

    if (bestMatch.confidence >= this.threshold) {
      return {
        ...bestMatch,
        reason: `${bestMatch.reason} (Detector: ${matchedDetectorName})`,
      };
    }

    return {
      route: 'PLANNER',
      confidence: 0.0,
      reason: `No deterministic match above threshold of ${this.threshold}. Highest was ${bestMatch.route} (${bestMatch.confidence}) from ${matchedDetectorName}`,
    };
  }
}
