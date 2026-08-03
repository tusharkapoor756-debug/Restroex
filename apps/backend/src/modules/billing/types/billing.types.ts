export type ChargeType = 'tax' | 'fee';
export type CalculationType = 'fixed' | 'percentage';
export type PricingType = 'exclusive' | 'inclusive';
export type ChargeScope = 'order' | 'item';
export type RoundOffMode = 'disabled' | 'round_up' | 'round_down' | 'nearest';

export interface RestaurantCharge {
  id: string;
  restaurantId: string;
  name: string;
  type: ChargeType;
  calculationType: CalculationType;
  value: number;
  pricingType: PricingType;
  scope: ChargeScope;
  applyOn: string[];
  showOnInvoice: boolean;
  enabled: boolean;
  isSystem: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AppliedCharge {
  chargeId: string;
  name: string;
  type: ChargeType;
  calculationType: CalculationType;
  pricingType: PricingType;
  scope: ChargeScope;
  value: number;
  calculatedAmount: number;
  showOnInvoice: boolean;
}

export interface BillingInputItem {
  menuItemId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice?: number;
}

export interface BillingCalculationInput {
  items: BillingInputItem[];
  charges: RestaurantCharge[];
  discountAmount?: number;
  orderType?: 'dining' | 'takeaway' | 'delivery' | string;
  roundOffMode?: RoundOffMode;
}

export interface CalculatedItemBase {
  name: string;
  quantity: number;
  unitPrice: number;
  totalGrossPrice: number;
  itemBasePrice: number;
  taxAmount: number;
}

export interface BillingBreakdown {
  billingEngineVersion: string; // e.g. "1.0.0"
  itemsSubtotal: number;
  discountAmount: number;
  netSubtotal: number;
  itemBases: CalculatedItemBase[];
  fees: AppliedCharge[];
  totalFeeAmount: number;
  taxableAmount: number;
  taxes: AppliedCharge[];
  totalTaxAmount: number;
  unroundedTotal: number;
  roundOffAmount: number;
  roundOffMode: RoundOffMode;
  grandTotal: number;
  // Backward compatibility fields for legacy consumers
  subtotal: number;
  packingCharge: number;
  deliveryCharge: number;
  taxAmount: number;
  totalAmount: number;
}
