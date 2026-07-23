// ─── ContextBuilderService ────────────────────────────────────────────────────
//
// Responsibility: assemble all conversation context needed by the AI Planner.
//
// CONTRACT:
//  - No business logic.
//  - No LLM calls.
//  - No action execution.
//  - Only reads: memory, session, cart, restaurant name.
//  - Returns a clean, typed BuiltContext object ready for prompt injection.
//

import { logger } from '../../../infrastructure/logger/logger';
import { conversationMemoryService, MemoryMessage } from './conversation-memory.service';
import { SessionRepository } from '../../conversations/repositories/session.repository';
import { RestaurantRepository } from '../../restaurants/repositories/restaurant.repository';
import { MenuRepository } from '../../menu/repositories/menu.repository';
import { getDisplayName } from '../../../shared/utils/display-name.util';
import { PlannerContext, PlannerMenuItem, PlannerCartItem } from '../types/planner.types';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * The full assembled context returned by ContextBuilderService.
 * Everything the Planner needs to build its prompt.
 */
export interface BuiltContext {
  /** Standard business context (menu, cart, restaurant, state). */
  plannerContext: PlannerContext;
  /**
   * Recent conversation messages in chronological order (oldest → newest).
   * Ready for direct injection as LLM message objects.
   * Empty array when no history exists — planner behaves exactly as before.
   */
  conversationHistory: MemoryMessage[];
  /** Number of history messages included (for observability logging). */
  historyMessagesInjected: number;
  /**
   * Rough token estimate for the injected history.
   * Approximation: 4 characters ≈ 1 token (standard heuristic).
   */
  historyTokenEstimate: number;
}

// ─── Configurable history depth ───────────────────────────────────────────────

const DEFAULT_HISTORY_LIMIT = Number(process.env.PLANNER_HISTORY_LIMIT || 10);

// ─── Service ──────────────────────────────────────────────────────────────────

export class ContextBuilderService {
  private readonly sessionRepository: SessionRepository;
  private readonly restaurantRepository: RestaurantRepository;
  private readonly menuRepository: MenuRepository;

  constructor() {
    this.sessionRepository = new SessionRepository();
    this.restaurantRepository = new RestaurantRepository();
    this.menuRepository = new MenuRepository();
  }

  private static readonly menuCache = new Map<string, { items: any; timestamp: number }>();
  private static readonly restaurantCache = new Map<string, { data: any; timestamp: number }>();
  private static readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache TTL

  public static invalidateCache(restaurantId: string): void {
    ContextBuilderService.menuCache.delete(restaurantId);
    ContextBuilderService.restaurantCache.delete(restaurantId);
  }

  /**
   * Assembles all context the Planner/AI Employee needs for a single inbound message.
   * Leverages parallelized execution and caching for high-scale environments.
   */
  public async buildContext(
    restaurantId: string,
    customerPhone: string,
    customerMessage: string,
    historyLimit: number = DEFAULT_HISTORY_LIMIT,
  ): Promise<BuiltContext> {
    const dbStart = Date.now();
    let cacheHits = 0;
    let cacheMisses = 0;

    // 1. Prepare async tasks for parallel execution
    const restaurantPromise = (async () => {
      const cached = ContextBuilderService.restaurantCache.get(restaurantId);
      if (cached && (Date.now() - cached.timestamp < ContextBuilderService.CACHE_TTL_MS)) {
        cacheHits++;
        return cached.data;
      }
      cacheMisses++;
      const data = await this.restaurantRepository.findById(restaurantId);
      ContextBuilderService.restaurantCache.set(restaurantId, { data, timestamp: Date.now() });
      return data;
    })();

    const menuPromise = (async () => {
      const cached = ContextBuilderService.menuCache.get(restaurantId);
      if (cached && (Date.now() - cached.timestamp < ContextBuilderService.CACHE_TTL_MS)) {
        cacheHits++;
        return cached.items;
      }
      cacheMisses++;
      const items = await this.menuRepository.listByRestaurantWithVariants(restaurantId);
      ContextBuilderService.menuCache.set(restaurantId, { items, timestamp: Date.now() });
      return items;
    })();

    // 2. Fetch all components in a single Promise.all concurrent sweep
    const [restaurant, menuItems, session, conversationHistory] = await Promise.all([
      restaurantPromise,
      menuPromise,
      this.sessionRepository.findSession(restaurantId, customerPhone),
      conversationMemoryService.getRecentConversation(restaurantId, customerPhone, historyLimit),
    ]);

    const dbDuration = Date.now() - dbStart;

    // 3. Adaptive History Selection: Adjust message count based on context clues
    let processedHistory = conversationHistory;
    const historyCount = conversationHistory.length;
    // Simple heuristic: checkout/payment states inject up to 10 history points; idle/greetings restrict to 3-5
    const isCartActive = session && session.cart && session.cart.items && session.cart.items.length > 0;
    const activeLimit = isCartActive ? 10 : 3;
    if (historyCount > activeLimit) {
      processedHistory = conversationHistory.slice(-activeLimit);
    }

    // 4. Dynamically optimize menu context injection depending on customer message intent.
    // If the message is a simple greeting (e.g. "hi", "hello"), we DO NOT inject any menu items to save token budget.
    // If the message mentions specific items or is ordering, we filter the menu to items matching the text or inject the full menu if unclear.
    const greetingPhrases = ['hi', 'hello', 'hey', 'namaste', 'start', 'ram ram', 'yo', 'good morning', 'good evening', 'good afternoon', 'hanji', 'haan', 'theek hai'];
    const isGreeting = greetingPhrases.some(phrase => customerMessage.toLowerCase().trim() === phrase);

    let filteredMenuItems = menuItems;
    if (isGreeting) {
      filteredMenuItems = []; // Inject zero menu items for simple greetings!
    } else {
      // Fuzzy filter: only inject menu items that match words in the customer message, or recently discussed ones.
      // If the message is generic (e.g. "menu", "cart", "checkout"), keep full menu.
      const words = customerMessage.toLowerCase().split(/\s+/);
      const isGeneric = words.some(w => ['menu', 'cart', 'checkout', 'bill', 'order', 'hata', 'remove', 'delete', 'clear', 'price', 'rate', 'cost', 'rupees', 'rs'].includes(w));
      if (!isGeneric) {
        filteredMenuItems = menuItems.filter((item: any) => {
          const nameLower = item.name.toLowerCase();
          const matchMessage = words.some(word => word.length > 2 && (nameLower.includes(word) || (item.aliases && item.aliases.some((al: string) => al.toLowerCase().includes(word)))));
          return matchMessage;
        });
        // Fallback to full menu if no matches to prevent empty menu false negatives
        if (filteredMenuItems.length === 0) {
          filteredMenuItems = menuItems;
        }
      }
    }

    const menu: PlannerMenuItem[] = filteredMenuItems.map((item: any) => ({
      id: item.id,
      name: item.name,
      variants: item.variants.map((v: any) => ({ id: v.id, variantName: v.variantName, price: v.price })),
      available: item.isAvailable,
      basePrice: item.basePrice,
    }));

    // 5. Build optimized cart snapshot (utilizing preloaded menuItems cache mapping)
    const cart: PlannerCartItem[] = [];
    const rawCart = session?.cart;

    if (rawCart?.items && rawCart.items.length > 0) {
      for (const cartItem of rawCart.items) {
        const itemName = getDisplayName(cartItem, menuItems);
        const variantName = cartItem.variantId
          ? menuItems
              .find((m: any) => m.id === cartItem.menuItemId)
              ?.variants?.find((v: any) => v.id === cartItem.variantId)?.variantName
          : undefined;

        cart.push({
          itemName,
          variantName,
          quantity: cartItem.quantity,
          unitPrice: cartItem.unitPrice,
        });
      }
    }

    // 6. Compute tokens (rough estimation)
    const historyText = processedHistory.map(m => m.message).join(' ');
    const historyTokenEstimate = Math.ceil(historyText.length / 4);

    const plannerContext: PlannerContext = {
      restaurantName: restaurant?.name || 'Restaurant',
      menu,
      cart,
      conversationState: session?.state || 'IDLE',
    };

    logger.info(
      {
        restaurantId,
        customerPhone,
        dbDurationMs: dbDuration,
        cacheHits,
        cacheMisses,
        historyInjected: processedHistory.length,
        historyTokenEstimate,
      },
      'ContextBuilderService: Parallelized context loading assembled'
    );

    return {
      plannerContext,
      conversationHistory: processedHistory,
      historyMessagesInjected: processedHistory.length,
      historyTokenEstimate,
    };
  }
}