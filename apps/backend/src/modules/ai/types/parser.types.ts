export interface MenuVariantMappingItem {
  id: string;
  variantName: string;
  price: number;
}

export interface ParsedItem {
  itemName: string;
  quantity: number;
  variantName?: string;
  customization?: string;
  matchedMenuItemId?: string;
  matchedVariantId?: string;
  variantPrice?: number;
  /** True when the item has variants but customer did not specify one */
  needsVariant?: boolean;
  confidence: number; // 0.0 to 1.0
}

export interface ParseResult {
  items: ParsedItem[];
  intent: 'add_to_cart' | 'checkout' | 'cancel' | 'view_menu' | 'unknown';
  overallConfidence: number;
  isFallbackTriggered: boolean;
  rawInput: string;
}

export interface MenuMappingItem {
  id: string;
  name: string;
  aliases: string[];
  basePrice: number | null;
  variants: MenuVariantMappingItem[];
}

export interface MenuMatchResult {
  status:
  | 'matched'
  | 'multiple_matches'
  | 'not_found';

  matchedItem?: MenuMappingItem;

  candidates?: MenuMappingItem[];

  confidence: number;
}

export interface ClarificationRequest {
  type:
  | 'item'
  | 'variant'
  | 'quantity';

  message: string;

  candidates?: string[];
}