// apps/dashboard/src/app/order/[restaurantSlug]/types.ts
// Canonical type definitions for the Customer Ordering Platform.
// These mirror the Bootstrap API contract from the backend.

export interface RestaurantInfo {
  id: string;
  slug: string;
  name: string;
  phone: string;
  address: string | null;
  city: string | null;
}

export interface Theme {
  logoUrl: string | null;
  coverImageUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  borderRadius: string;
  buttonStyle: "rounded" | "square" | "pill";
}

export interface OperationalStatus {
  isOpen: boolean;
  isBusy: boolean;
  maxActiveOrders: number;
  statusMessage: string;
}

export interface Capabilities {
  dineIn: { enabled: boolean; totalTables: number };
  takeaway: { enabled: boolean };
  paymentMethods: string[];
  taxes: { taxPercentage: number };
}

export interface MenuVariant {
  id: string;
  name: string;
  price: number;
}

export interface ModifierOption {
  id: string;
  name: string;
  price: number;
}

export interface ModifierGroup {
  id: string;
  name: string;
  minSelection: number;
  maxSelection: number;
  options: ModifierOption[];
}

export interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  isAvailable: boolean;
  isVeg: boolean;
  isSpicy: boolean;
  isBestSeller: boolean;
  allowInstructions?: boolean;
  variants: MenuVariant[];
  modifierGroups: ModifierGroup[];
}

export interface MenuCategory {
  id: string;
  name: string;
  sortOrder: number;
  items: MenuItem[];
}

export interface BootstrapData {
  restaurant: RestaurantInfo;
  theme: Theme;
  operationalStatus: OperationalStatus;
  capabilities: Capabilities;
  menu: { categories: MenuCategory[] };
}

// Cart types
export interface CartItemModifier {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  price: number;
}

export interface CartItem {
  cartItemId: string; // client-side unique ID
  menuItemId: string;
  variantId?: string;
  name: string;
  variantName?: string;
  unitPrice: number;
  quantity: number;
  selectedModifiers: CartItemModifier[];
  specialInstructions?: string;
  imageUrl: string | null;
  isVeg: boolean;
}

export type OrderMode = "dining" | "takeaway";
