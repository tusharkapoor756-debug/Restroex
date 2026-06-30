// ─────────────────────────────────────────────────────────────────────────────
// Restroex — Shared Frontend Types
// Mirrors backend domain models exactly. Do NOT diverge without backend change.
// ─────────────────────────────────────────────────────────────────────────────

// ── Restaurant ───────────────────────────────────────────────────────────────

export interface Restaurant {
  id: string;
  name: string;
  phoneNumber: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RestaurantSession {
  restaurant: Restaurant;
  token: string;
  expiresAt: string;
}

export interface RestaurantSetupResponse {
  restaurant: Restaurant;
  currentStep: 1 | 2 | 3;
  isComplete: boolean;
}

export interface RestaurantSetupUpdate {
  name?: string;
  phoneNumber?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

// ── Orders ───────────────────────────────────────────────────────────────────

export type OrderStatus =
  | 'cart_active'
  | 'checkout_pending'
  | 'payment_pending'
  | 'paid'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'completed'
  | 'cancelled'
  | 'refunded';

/** Statuses that the restaurant dashboard can transition orders TO. */
export type WorkflowOrderStatus = 'accepted' | 'preparing' | 'ready' | 'completed' | 'cancelled';

export interface OrderItemSnapshot {
  menuItemId: string;
  itemNameSnapshot: string;
  variantNameSnapshot?: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Order {
  id: string;
  restaurantId: string;
  customerPhone: string;
  status: OrderStatus;
  totalAmount: number;
  idempotencyKey: string;
  humanReadableId: string;
  createdAt: string;
  updatedAt: string;
  items?: OrderItemSnapshot[];
}

// ── Menu ─────────────────────────────────────────────────────────────────────

export interface MenuItemVariant {
  id: string;
  menuItemId: string;
  variantName: string;
  price: number;
  isAvailable: boolean;
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  name: string;
  /** Alias names used by the AI to match customer text to this item. */
  aliases: string[];
  basePrice: number | null;
  isAvailable: boolean;
  variants: MenuItemVariant[];
  createdAt: string;
  updatedAt: string;
}

export interface VariantInputDto {
  variantName: string;
  price: number;
}

export interface CreateMenuItemDto {
  name: string;
  basePrice: number | null;
  aliases?: string[];
  variants?: VariantInputDto[];
}

export interface UpdateMenuItemDto {
  name?: string;
  basePrice?: number | null;
  aliases?: string[];
  variants?: VariantInputDto[];
}

// ── Analytics (placeholder — no backend endpoint yet) ─────────────────────

export interface DailyAnalytics {
  totalRevenue: number;
  totalOrders: number;
  avgPrepTimeMinutes: number;
  whatsappMessageCount: number;
  aiHitRate: number;
}

// ── Customers (placeholder — no backend endpoint yet) ─────────────────────

export interface Customer {
  id: string;
  phone: string;
  name?: string;
  totalOrders: number;
  totalSpend: number;
  lastOrderAt: string;
}

// ── Inventory (placeholder — no backend endpoint yet) ─────────────────────

export interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
  minimumThreshold: number;
  isLow: boolean;
}

// ── WhatsApp (mirrors backend WhatsAppSessionStatus exactly) ─────────────────

export type WhatsAppConnectionState = 'connected' | 'disconnected' | 'reconnecting' | 'expired';

export interface WhatsAppSessionStatus {
  restaurantId: string;
  state: WhatsAppConnectionState;
  qrCode?: string;
  qrCodeDataUrl?: string;
  connectedPhone?: string;
  lastConnectedAt?: string;
  lastDisconnectedAt?: string;
  lastError?: string;
}

export interface WhatsAppConversation {
  id: string;
  customerPhone: string;
  lastMessage: string;
  updatedAt: string;
}

// ── AI (placeholder — no backend endpoint yet) ────────────────────────────

export interface AiLog {
  id: string;
  type: 'intent' | 'order' | 'error';
  message: string;
  createdAt: string;
}

// ── Settings (placeholder — partial backend support) ─────────────────────

export interface RestaurantSettings {
  name: string;
  phoneNumber: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
}
