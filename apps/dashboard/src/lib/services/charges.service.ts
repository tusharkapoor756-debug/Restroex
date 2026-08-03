import { api } from '../api';

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

export interface CalculatedItemBase {
  name: string;
  quantity: number;
  unitPrice: number;
  totalGrossPrice: number;
  itemBasePrice: number;
  taxAmount: number;
}

export interface BillingBreakdown {
  billingEngineVersion: string;
  itemsSubtotal: number;
  discountAmount: number;
  netSubtotal: number;
  itemBases?: CalculatedItemBase[];
  fees: AppliedCharge[];
  totalFeeAmount: number;
  taxableAmount: number;
  taxes: AppliedCharge[];
  totalTaxAmount: number;
  unroundedTotal: number;
  roundOffAmount: number;
  roundOffMode: RoundOffMode;
  grandTotal: number;
}

export class ChargesService {
  /**
   * Fetch all charges and round-off configuration for a restaurant session
   */
  static async getCharges(restaurantId?: string): Promise<{ charges: RestaurantCharge[]; roundOffMode: RoundOffMode }> {
    const res = await api.get<any>('/billing/charges');
    const rawCharges = res?.charges ?? res?.data?.charges ?? [];
    const roundOffMode = res?.roundOffMode ?? res?.data?.roundOffMode ?? 'nearest';
    return {
      charges: Array.isArray(rawCharges) ? rawCharges : [],
      roundOffMode: roundOffMode || 'nearest',
    };
  }

  /**
   * Create a new custom charge
   */
  static async createCharge(payload: Partial<RestaurantCharge> & { name: string }): Promise<RestaurantCharge> {
    const res = await api.post<any>('/billing/charges', payload);
    return res?.id ? res : res?.data;
  }

  /**
   * Update an existing charge
   */
  static async updateCharge(chargeId: string, restaurantId: string, updates: Partial<RestaurantCharge>): Promise<RestaurantCharge> {
    const res = await api.put<any>(`/billing/charges/${chargeId}`, updates);
    return res?.id ? res : res?.data;
  }

  /**
   * Delete a custom charge
   */
  static async deleteCharge(chargeId: string, restaurantId?: string): Promise<boolean> {
    await api.delete(`/billing/charges/${chargeId}`);
    return true;
  }

  /**
   * Request live pure calculation breakdown for preview
   */
  static async calculateBreakdown(payload: {
    restaurantId?: string;
    items: { name: string; quantity: number; unitPrice: number; totalPrice?: number }[];
    orderType?: string;
    discountAmount?: number;
    customCharges?: RestaurantCharge[];
    roundOffMode?: RoundOffMode;
  }): Promise<BillingBreakdown> {
    const res = await api.post<any>('/billing/calculate', payload);
    return res?.grandTotal !== undefined ? res : res?.data;
  }
}
