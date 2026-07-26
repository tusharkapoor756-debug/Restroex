export type InteractiveActionType =
  | 'home'
  | 'browse'
  | 'category'
  | 'item'
  | 'variant'
  | 'customization'
  | 'quantity'
  | 'cart_view'
  | 'cart_add'
  | 'cart_clear'
  | 'checkout'
  | 'best_sellers'
  | 'offers'
  | 'track_order'
  | 'talk_to_staff'
  | 'back';

export interface CompactPayload {
  a: string; // Action Type abbreviation
  id?: string; // Entity ID (Category ID / Item ID)
  vid?: string; // Variant ID
  cids?: string[]; // Selected Customization IDs
  q?: number; // Quantity
  p?: number; // Page index for pagination
}

export interface InteractiveScreen {
  id: string;
  title: string;
  body: string;
  buttons?: Array<{
    id: string; // CompactPayload JSON stringified
    title: string;
  }>;
  list?: {
    buttonTitle: string;
    sections: Array<{
      title?: string;
      rows: Array<{
        id: string; // CompactPayload JSON stringified
        title: string;
        description?: string;
      }>;
    }>;
  };
  nextAction?: string;
  previousScreenId?: string;
  inputPrompt?: boolean;
  metadata?: Record<string, any>;
}
