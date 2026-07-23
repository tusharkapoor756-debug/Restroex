/**
 * OrderingIntentClassifier
 *
 * Deterministically detects ordering intent from incoming customer messages.
 * This runs BEFORE the AI Employee, ensuring ordering messages always enter
 * the Interactive Ordering Engine first.
 *
 * Rules:
 * - Returns a CompactPayload if the message is ordering-related.
 * - Returns null if the message is conversational and should go to AI Employee.
 * - Zero LLM calls. Zero network calls. Pure regex + keyword matching.
 */

import { CompactPayload } from '../interactive/interactive-action.types';

// ─── Ordering trigger keywords ────────────────────────────────────────────────

const BROWSE_TRIGGERS = new Set([
  'menu', 'show menu', 'menu dikhao', 'menu dikhana', 'browse', 'browse menu',
  'food', 'kya hai', 'kya hai menu mein', 'khana', 'order karna hai', 'order',
  'order karo', 'order lagao', 'kuch khaana', 'khana chahiye', 'items',
  'dishes', 'aaj kya hai', 'special', 'what do you have', 'what can i order',
  'show me the menu',
]);

const CART_TRIGGERS = new Set([
  'cart', 'mera cart', 'meri cart', 'cart dikhao', 'show cart', 'my cart',
  'view cart', 'cart dekhna hai',
]);

const CHECKOUT_TRIGGERS = new Set([
  'checkout', 'bill bana do', 'bill please', 'bill', 'pay karna hai', 'pay',
  'place order', 'order karo', 'order confirm karo', 'order lagao',
  'payment karna hai',
]);

const OFFER_TRIGGERS = new Set([
  'offers', 'offer', 'discount', 'deals', 'today special', 'special offer',
]);

const BEST_SELLERS_TRIGGERS = new Set([
  'best seller', 'best sellers', 'popular', 'popular items', 'trending',
  'recommended', 'must try', 'kya achha hai', 'best dish',
]);

const TRACKING_TRIGGERS = new Set([
  'track order', 'track my order', 'where is my order', 'status', 'status?', 'order status', 'order update', 'order update?', 'mera order', 'order kahan hai'
]);

const PROFILE_TRIGGERS = new Set([
  'address change', 'change address', 'address update', 'update address', 'address badalna hai', 'profile update', 'edit profile'
]);

const PAYMENT_CONFIRM_TRIGGERS = new Set([
  'payment kar diya', 'payment done', 'paid', 'screenshot sent', 'done payment', 'paise de diye'
]);

const SUPPORT_TRIGGERS = new Set([
  'support', 'need support', 'help', 'talk to staff', 'staff', 'agent', 'help please'
]);

// Regex for item-name ordering patterns (covers: "1 pizza", "paneer do", "ek paneer", etc.)
const ITEM_ORDER_PATTERNS: RegExp[] = [
  /^\d+\s+\w+/i,                           // "2 pizza"
  /^ek\s+\w+/i,                            // "ek paneer"
  /^do\s+\w+/i,                            // "do burger"
  /^teen\s+\w+/i,                          // "teen chaap"
  /\border\b.{0,30}/i,                     // "order paneer tikka"
  /\bchahiye\b/i,                          // "paneer chahiye"
  /\bde do\b/i,                            // "paneer de do"
  /\badd\b.{1,40}/i,                       // "add chicken burger"
  /\bcart mein\b/i,                        // "cart mein dal do"
  /\bdal do\b/i,                           // "paneer dal do"
];

// ─── Classifier function ──────────────────────────────────────────────────────

export function classifyOrderingIntent(message: string): CompactPayload | null {
  const clean = message.trim().toLowerCase();
  const normalized = clean.replace(/[?.,!]/g, '').trim();

  // Robust trigger check helper
  const matchesTrigger = (triggersSet: Set<string>) => {
    return Array.from(triggersSet).some(trigger => {
      const cleanTrigger = trigger.replace(/[?.,!]/g, '').trim();
      return normalized === cleanTrigger || normalized.includes(cleanTrigger);
    });
  };

  // Smart Priority Actions (Part 1 & Part 7)
  if (matchesTrigger(TRACKING_TRIGGERS)) return { a: 'track_order' as any };
  if (matchesTrigger(PROFILE_TRIGGERS)) return { a: 'profile_update' as any };
  if (matchesTrigger(PAYMENT_CONFIRM_TRIGGERS)) return { a: 'payment_confirm_intent' as any };
  if (matchesTrigger(SUPPORT_TRIGGERS)) return { a: 'talk_to_staff' as any };

  // ── 1. Cart shortcuts
  if (CART_TRIGGERS.has(clean)) return { a: 'cart_view' };

  // ── 2. Checkout shortcuts
  if (CHECKOUT_TRIGGERS.has(clean)) return { a: 'checkout' };

  // ── 3. Offers
  if (OFFER_TRIGGERS.has(clean)) return { a: 'offers' };

  // ── 4. Best sellers
  if (BEST_SELLERS_TRIGGERS.has(clean)) return { a: 'best_sellers' };

  // ── 5. Menu browse
  if (BROWSE_TRIGGERS.has(clean)) return { a: 'browse', p: 1 };

  // ── 6. Item ordering patterns (regex)
  for (const pattern of ITEM_ORDER_PATTERNS) {
    if (pattern.test(clean)) return { a: 'browse', p: 1 };
  }

  // ── 7. Home/restart shortcuts
  if (['home', 'start', 'restart', 'reset', 'shuru', 'firse shuru'].includes(clean)) {
    return { a: 'home' };
  }

  // ── 8. Not an ordering message — route to AI Employee
  return null;
}
