import {
  BillingBreakdown,
  BillingCalculationInput,
  AppliedCharge,
  RestaurantCharge,
  RoundOffMode,
} from '../types/billing.types';

export const CURRENT_BILLING_ENGINE_VERSION = '1.0.0';

export class BillingService {
  /**
   * Pure Billing Calculation Engine
   * 
   * Deterministic pipeline:
   * Items Subtotal -> Discount -> Net Subtotal -> Fees -> Taxable Amount -> Taxes -> Round Off -> Grand Total
   * 
   * Completely PURE: No side effects, no database calls, no mutation of input.
   */
  public static calculate(input: BillingCalculationInput): BillingBreakdown {
    const orderType = input.orderType || 'takeaway';
    const roundOffMode: RoundOffMode = input.roundOffMode || 'nearest';
    const discountAmount = Math.max(0, Number(input.discountAmount || 0));

    // 1. Items Subtotal (Sum of item price * quantity)
    const itemsSubtotal = (input.items || []).reduce((sum, item) => {
      const price = Number(item.totalPrice ?? item.unitPrice * item.quantity);
      return sum + (isNaN(price) ? 0 : price);
    }, 0);

    // 2. Net Subtotal after discount
    const netSubtotal = Math.max(0, itemsSubtotal - discountAmount);

    // Filter charges applicable to this order type and enabled
    const applicableCharges = (input.charges || []).filter(
      (c) => c.enabled && Array.isArray(c.applyOn) && c.applyOn.includes(orderType)
    );

    // 3. Process Inclusive Taxes (e.g. Inclusive GST)
    // Extract tax portion included inside net subtotal
    const inclusiveTaxes: AppliedCharge[] = [];
    let totalInclusiveTaxAmount = 0;

    const inclusiveTaxCharges = applicableCharges.filter(
      (c) => c.type === 'tax' && c.pricingType === 'inclusive'
    );

    let totalInclusiveTaxRate = 0;
    for (const charge of inclusiveTaxCharges) {
      const rate = Number(charge.value) || 0;
      totalInclusiveTaxRate += rate;
      if (rate > 0) {
        // Formula: Tax = NetSubtotal - (NetSubtotal / (1 + Rate/100))
        const taxVal = netSubtotal - netSubtotal / (1 + rate / 100);
        const roundedTax = Number(taxVal.toFixed(2));
        totalInclusiveTaxAmount += roundedTax;

        inclusiveTaxes.push({
          chargeId: charge.id,
          name: charge.name,
          type: charge.type,
          calculationType: charge.calculationType,
          pricingType: charge.pricingType,
          scope: charge.scope || 'order',
          value: rate,
          calculatedAmount: roundedTax,
          showOnInvoice: charge.showOnInvoice,
        });
      }
    }

    // Compute exact item-level bases and taxes mathematically inside Pure Engine
    const itemBases = (input.items || []).map((item) => {
      const grossPrice = Number(item.totalPrice ?? item.unitPrice * item.quantity);
      let basePrice = grossPrice;
      let taxAmount = 0;

      if (totalInclusiveTaxRate > 0) {
        basePrice = Number((grossPrice / (1 + totalInclusiveTaxRate / 100)).toFixed(2));
        taxAmount = Number((grossPrice - basePrice).toFixed(2));
      }

      return {
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalGrossPrice: Number(grossPrice.toFixed(2)),
        itemBasePrice: basePrice,
        taxAmount: taxAmount,
      };
    });

    // 4. Process Fees (Exclusive & Fixed/Percentage)
    const feeCharges = applicableCharges.filter((c) => c.type === 'fee');
    const appliedFees: AppliedCharge[] = [];
    let totalFeeAmount = 0;
    let legacyPackingCharge = 0;
    let legacyDeliveryCharge = 0;

    for (const charge of feeCharges) {
      let amount = 0;
      const val = Number(charge.value) || 0;

      if (charge.calculationType === 'percentage') {
        amount = (netSubtotal * val) / 100;
      } else {
        amount = val;
      }

      const roundedFee = Number(amount.toFixed(2));
      totalFeeAmount += roundedFee;

      // Track legacy helper fields for backward compatibility
      if (charge.name.toLowerCase().includes('packing')) {
        legacyPackingCharge += roundedFee;
      } else if (charge.name.toLowerCase().includes('delivery')) {
        legacyDeliveryCharge += roundedFee;
      }

      appliedFees.push({
        chargeId: charge.id,
        name: charge.name,
        type: charge.type,
        calculationType: charge.calculationType,
        pricingType: charge.pricingType,
        scope: charge.scope || 'order',
        value: val,
        calculatedAmount: roundedFee,
        showOnInvoice: charge.showOnInvoice,
      });
    }

    // 5. Taxable Amount Calculation (Base amount for exclusive taxes)
    const taxableAmount = Number((netSubtotal + totalFeeAmount).toFixed(2));

    // 6. Process Exclusive Taxes (e.g. Exclusive GST)
    const exclusiveTaxCharges = applicableCharges.filter(
      (c) => c.type === 'tax' && c.pricingType === 'exclusive'
    );
    const exclusiveTaxes: AppliedCharge[] = [];
    let totalExclusiveTaxAmount = 0;

    for (const charge of exclusiveTaxCharges) {
      let amount = 0;
      const val = Number(charge.value) || 0;

      if (charge.calculationType === 'percentage') {
        amount = (taxableAmount * val) / 100;
      } else {
        amount = val;
      }

      const roundedTax = Number(amount.toFixed(2));
      totalExclusiveTaxAmount += roundedTax;

      exclusiveTaxes.push({
        chargeId: charge.id,
        name: charge.name,
        type: charge.type,
        calculationType: charge.calculationType,
        pricingType: charge.pricingType,
        scope: charge.scope || 'order',
        value: val,
        calculatedAmount: roundedTax,
        showOnInvoice: charge.showOnInvoice,
      });
    }

    const allTaxes = [...inclusiveTaxes, ...exclusiveTaxes];
    const totalTaxAmount = Number((totalInclusiveTaxAmount + totalExclusiveTaxAmount).toFixed(2));

    // 7. Unrounded Total
    const unroundedTotal = Number((netSubtotal + totalFeeAmount + totalExclusiveTaxAmount).toFixed(2));

    // 8. Round Off Pipeline
    let grandTotal = unroundedTotal;
    let roundOffAmount = 0;

    if (roundOffMode === 'round_up') {
      grandTotal = Math.ceil(unroundedTotal);
      roundOffAmount = Number((grandTotal - unroundedTotal).toFixed(2));
    } else if (roundOffMode === 'round_down') {
      grandTotal = Math.floor(unroundedTotal);
      roundOffAmount = Number((grandTotal - unroundedTotal).toFixed(2));
    } else if (roundOffMode === 'nearest') {
      grandTotal = Math.round(unroundedTotal);
      roundOffAmount = Number((grandTotal - unroundedTotal).toFixed(2));
    } else {
      // 'disabled'
      grandTotal = unroundedTotal;
      roundOffAmount = 0;
    }

    const roundedItemsSubtotal = Number(itemsSubtotal.toFixed(2));
    const roundedDiscountAmount = Number(discountAmount.toFixed(2));
    const roundedNetSubtotal = Number(netSubtotal.toFixed(2));
    const roundedTotalFeeAmount = Number(totalFeeAmount.toFixed(2));
    const roundedGrandTotal = Number(grandTotal.toFixed(2));

    return {
      billingEngineVersion: CURRENT_BILLING_ENGINE_VERSION,
      itemsSubtotal: roundedItemsSubtotal,
      discountAmount: roundedDiscountAmount,
      netSubtotal: roundedNetSubtotal,
      itemBases,
      fees: appliedFees,
      totalFeeAmount: roundedTotalFeeAmount,
      taxableAmount,
      taxes: allTaxes,
      totalTaxAmount,
      unroundedTotal,
      roundOffAmount,
      roundOffMode,
      grandTotal: roundedGrandTotal,

      // Legacy fallback properties for backward compatibility across existing services
      subtotal: roundedItemsSubtotal,
      packingCharge: Number(legacyPackingCharge.toFixed(2)),
      deliveryCharge: Number(legacyDeliveryCharge.toFixed(2)),
      taxAmount: totalTaxAmount,
      totalAmount: roundedGrandTotal,
    };
  }
}
