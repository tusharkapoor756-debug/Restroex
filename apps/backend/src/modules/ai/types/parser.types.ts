export interface ParsedItem {
  itemName: string;
  quantity: number;
  variantName?: 'half' | 'full' | string;
  customization?: string;
  matchedMenuItemId?: string;
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
  basePrice: number;
}
