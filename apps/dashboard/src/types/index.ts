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
  paidAt?: string | null;
  paymentVerifiedAt?: string | null;
  acceptedAt?: string | null;
  preparingStartedAt?: string | null;
  estimatedReadyAt?: string | null;
  readyAt?: string | null;
  collectedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  invoiceNumber?: string | null;
  createdAt: string;
  updatedAt: string;
  items?: OrderItemSnapshot[];
  customerId?: string | null;
  customerName?: string | null;
  payment?: Payment;
}

// ── Menu ─────────────────────────────────────────────────────────────────────

export interface Category {
  id: string;
  restaurantId: string;
  parentId?: string | null;
  name: string;
  description?: string | null;
  displayOrder: number;
  icon?: string | null;
  imageUrl?: string | null;
  isVisible: boolean;
  availableFrom?: string | null;
  availableTill?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MenuItemVariant {
  id: string;
  menuItemId: string;
  variantName: string;
  price: number;
  isAvailable: boolean;
  displayOrder: number;
}

export interface MenuCustomization {
  id: string;
  menuItemId: string;
  name: string;
  priceAdjustment: number;
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  name: string;
  /** Alias names used by the AI to match customer text to this item. */
  aliases: string[];
  basePrice: number | null;
  isAvailable: boolean;
  categoryId?: string | null;
  subcategoryId?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  vegType: 'veg' | 'non-veg';
  preparationTime: number;
  isPopular: boolean;
  isRecommended: boolean;
  displayOrder: number;
  variants: MenuItemVariant[];
  customizations?: MenuCustomization[];
  createdAt: string;
  updatedAt: string;
}

export interface VariantInputDto {
  variantName: string;
  price: number;
  displayOrder?: number;
}

export interface CreateMenuItemDto {
  name: string;
  basePrice?: number | null;
  aliases?: string[];
  variants?: VariantInputDto[];
  categoryId?: string;
  subcategoryId?: string;
  description?: string;
  imageUrl?: string;
  vegType?: 'veg' | 'non-veg';
  preparationTime?: number;
  isPopular?: boolean;
  isRecommended?: boolean;
  displayOrder?: number;
}

export interface UpdateMenuItemDto {
  name?: string;
  basePrice?: number | null;
  aliases?: string[];
  variants?: VariantInputDto[];
  categoryId?: string | null;
  subcategoryId?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  vegType?: 'veg' | 'non-veg';
  preparationTime?: number;
  isPopular?: boolean;
  isRecommended?: boolean;
  displayOrder?: number;
}

export interface CreateCategoryDto {
  name: string;
  parentId?: string;
  description?: string;
  displayOrder?: number;
  icon?: string;
  isVisible?: boolean;
}

export interface UpdateCategoryDto {
  name?: string;
  parentId?: string | null;
  description?: string | null;
  displayOrder?: number;
  icon?: string | null;
  isVisible?: boolean;
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
  providerType?: 'webjs' | 'cloud_api';
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

// ── Settings ─────────────────────────────────────────────────────────────────

/** Business profile fields stored on the restaurants table */
export interface BusinessProfile {
  logoUrl?: string;
  name: string;
  ownerName?: string;
  phoneNumber: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

/** Configuration fields stored on the restaurant_settings table */
export interface RestaurantSettingsConfig {
  id: string;
  restaurantId: string;
  // Tax & Billing
  gstEnabled: boolean;
  gstNumber?: string;
  gstPercentage: number;
  fssaiNumber?: string;
  // Payment Settings
  paymentMethods: string[];
  upiMerchantName?: string;
  upiId?: string;
  upiQrImageUrl?: string;
  codEnabled: boolean;
  manualUpiEnabled: boolean;
  onlinePaymentsEnabled: boolean;
  // Store Settings
  pickupAvailable: boolean;
  prepTime: number;
  pickupInstructions?: string;

  // New Settings Fields
  invoicePrefix?: string;
  receiptFooter?: string;
  supportPhone?: string;
  supportEmail?: string;
  website?: string;
  instagram?: string;
  invoiceNotes?: string;
  termsAndConditions?: string;
  autoAcceptPaidOrders: boolean;

  createdAt: string;
  updatedAt: string;
}

/** Full settings response from GET /restaurants/settings */
export interface FullSettings {
  profile: BusinessProfile;
  settings: RestaurantSettingsConfig;
}

/** Payload for PATCH /restaurants/settings */
export interface UpdateSettingsPayload {
  // Business Profile
  logoUrl?: string;
  name?: string;
  ownerName?: string;
  phoneNumber?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  // Tax & Billing
  gstEnabled?: boolean;
  gstNumber?: string;
  gstPercentage?: number;
  fssaiNumber?: string;
  // Payment Settings
  paymentMethods?: string[];
  upiMerchantName?: string;
  upiId?: string;
  upiQrImageUrl?: string;
  codEnabled?: boolean;
  manualUpiEnabled?: boolean;
  onlinePaymentsEnabled?: boolean;
  // Store Settings
  pickupAvailable?: boolean;
  prepTime?: number;
  pickupInstructions?: string;

  // New Settings Fields
  invoicePrefix?: string;
  receiptFooter?: string;
  supportPhone?: string;
  supportEmail?: string;
  website?: string;
  instagram?: string;
  invoiceNotes?: string;
  termsAndConditions?: string;
  autoAcceptPaidOrders?: boolean;
}

/** @deprecated Use FullSettings instead */
export interface RestaurantSettings {
  name: string;
  phoneNumber: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
}

// ── Payments ──────────────────────────────────────────────────────────────────

export type PaymentStatus =
  | 'pending'
  | 'screenshot_uploaded'
  | 'pending_verification'
  | 'verified'
  | 'rejected'
  | 'failed'
  | 'refunded'
  | 'expired';

export type PaymentMethod =
  | 'manual_upi'
  | 'razorpay'
  | 'phonepe'
  | 'stripe'
  | 'cash'
  | 'card'
  | string;

export interface Payment {
  id: string;
  orderId: string;
  restaurantId: string;
  customerPhone: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  providerName: string;
  amount: number;
  currency: string;
  paymentAttempt: number;
  gatewayData?: Record<string, any>;
  metadata?: Record<string, any>;
  verifiedBy?: string | null;
  verificationNotes?: string | null;
  verifiedAmount?: number | null;
  verifiedTransactionReference?: string | null;
  rejectedReason?: string | null;
  failureReason?: string | null;
  idempotencyKey?: string | null;
  expiresAt?: string | null;
  initiatedAt?: string | null;
  verifiedAt?: string | null;
  completedAt?: string | null;
  failedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type GatewayConfigStatus =
  | 'connected'
  | 'not_connected'
  | 'configuration_error'
  | 'invalid_credentials'
  | 'webhook_missing'
  | 'provider_offline';

export interface RestaurantPaymentConfig {
  id: string;
  restaurantId: string;
  providerName: string;
  isEnabled: boolean;
  isSandbox: boolean;
  credentials: Record<string, any>;
  status: GatewayConfigStatus;
  statusMessage?: string | null;
  lastHealthCheckAt?: string | null;
  lastHealthCheckResponse?: Record<string, any> | null;
  webhookSecret?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaveProviderConfigPayload {
  restaurantId: string;
  providerName: string;
  credentials: Record<string, any>;
  isEnabled: boolean;
  isSandbox: boolean;
  webhookSecret?: string;
}

export interface TestGatewayPayload {
  restaurantId: string;
  providerName: string;
  credentials?: Record<string, any>;
}

export interface ProviderHealthCheckResult {
  isHealthy: boolean;
  status: GatewayConfigStatus;
  message: string;
  latencyMs?: number;
  details?: Record<string, any>;
}
