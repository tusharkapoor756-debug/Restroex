"use client";

import React from "react";
import { BillingBreakdown, AppliedCharge } from "../../lib/services/charges.service";
import { Receipt, CheckCircle, ShieldCheck } from "lucide-react";

export interface CustomerInvoiceItem {
  name: string;
  variantName?: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface CustomerInvoiceProps {
  invoiceNumber?: string;
  restaurantName?: string;
  customerPhone?: string;
  orderMode?: string;
  tableNumber?: number | null;
  createdAt?: string;
  items: CustomerInvoiceItem[];
  breakdown: BillingBreakdown;
  isThermalView?: boolean;
}

export default function CustomerInvoice({
  invoiceNumber = "ORD-PREVIEW",
  restaurantName = "Restroex Outlet",
  customerPhone = "+91 9876543210",
  orderMode = "takeaway",
  tableNumber = null,
  createdAt,
  items,
  breakdown,
  isThermalView = false,
}: CustomerInvoiceProps) {
  const formattedDate = createdAt || new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

  // Compute item level base breakdown if inclusive GST is active
  const inclusiveTax = breakdown.taxes?.find((t) => t.pricingType === "inclusive");
  const hasInclusiveTax = Boolean(inclusiveTax && inclusiveTax.value > 0);
  const taxRate = inclusiveTax ? inclusiveTax.value : 0;

  return (
    <div
      className={`w-full rounded-2xl shadow-xl border overflow-hidden font-sans transition-all ${
        isThermalView
          ? "bg-white text-black font-mono border-slate-300 p-4 max-w-xs mx-auto"
          : "bg-slate-950 text-slate-100 border-slate-800 p-5 sm:p-6"
      }`}
    >
      {/* Header */}
      <div className="text-center border-b border-slate-800 pb-4 space-y-1">
        <div className="flex items-center justify-center gap-1.5 text-emerald-400 font-extrabold text-xs uppercase tracking-wider">
          <ShieldCheck className="h-4 w-4" />
          <span>TAX INVOICE</span>
        </div>
        <h2 className="text-lg font-black tracking-tight text-white">{restaurantName}</h2>
        <p className="text-[11px] text-slate-400">
          {orderMode === "dining" ? `🍽️ DINE IN — Table #${tableNumber || "?"}` : `🥡 TAKEAWAY ORDER`}
        </p>
        <p className="text-[10px] text-slate-500 font-mono">{formattedDate} • #{invoiceNumber}</p>
      </div>

      {/* Items Section */}
      <div className="py-4 space-y-2 border-b border-slate-800 text-xs">
        <div className="flex justify-between font-bold text-slate-400 text-[10px] uppercase tracking-wider pb-1">
          <span>Item</span>
          <span>Amount</span>
        </div>

        {items.map((item, idx) => {
          // Read pre-calculated itemBase from Pure Engine snapshot or fall back to gross price
          const engineItemBase = breakdown.itemBases?.[idx];
          const rawTotal = item.totalPrice || item.unitPrice * item.quantity;
          const displayBasePrice = engineItemBase ? engineItemBase.itemBasePrice : rawTotal;

          return (
            <div key={idx} className="flex justify-between items-start pt-1">
              <div className="space-y-0.5 max-w-[70%]">
                <div className="font-bold text-slate-100 flex items-center gap-1.5">
                  <span className="text-emerald-400 font-extrabold">{item.quantity}x</span>
                  <span>{item.name}</span>
                </div>
                {item.variantName && <p className="text-[10px] text-slate-400 pl-5">{item.variantName}</p>}
                {hasInclusiveTax && (
                  <p className="text-[9.5px] text-slate-500 pl-5 font-mono">
                    Base: ₹{displayBasePrice.toFixed(2)} (incl. {taxRate}% GST)
                  </p>
                )}
              </div>
              <div className="text-right font-mono font-bold text-slate-200">
                ₹{displayBasePrice.toFixed(2)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pure Engine Breakdown Section */}
      <div className="py-4 space-y-2 text-xs font-mono border-b border-slate-800">
        {/* Net Items Base Subtotal */}
        <div className="flex justify-between text-slate-400">
          <span>Items Base (Subtotal)</span>
          <span>₹{breakdown.netSubtotal.toFixed(2)}</span>
        </div>

        {/* Applied Fees */}
        {breakdown.fees?.map((fee, idx) => (
          <div key={`fee_${idx}`} className="flex justify-between text-slate-300">
            <span>{fee.name} ({fee.calculationType === "percentage" ? `${fee.value}%` : "Fixed"})</span>
            <span>+₹{fee.calculatedAmount.toFixed(2)}</span>
          </div>
        ))}

        {/* Taxable Base Amount */}
        <div className="flex justify-between text-slate-400 text-[10px] pt-1 border-t border-slate-800/60">
          <span>Taxable Amount</span>
          <span>₹{breakdown.taxableAmount.toFixed(2)}</span>
        </div>

        {/* Applied Taxes (GST) */}
        {breakdown.taxes?.map((tax, idx) => (
          <div key={`tax_${idx}`} className="flex justify-between text-emerald-400 font-semibold">
            <span>{tax.name} ({tax.value}% {tax.pricingType.toUpperCase()})</span>
            <span>+₹{tax.calculatedAmount.toFixed(2)}</span>
          </div>
        ))}

        {/* Round Off */}
        {breakdown.roundOffAmount !== 0 && (
          <div className="flex justify-between text-indigo-400 text-[10px]">
            <span>Round Off ({breakdown.roundOffMode})</span>
            <span>
              {breakdown.roundOffAmount > 0 ? `+₹${breakdown.roundOffAmount.toFixed(2)}` : `-₹${Math.abs(breakdown.roundOffAmount).toFixed(2)}`}
            </span>
          </div>
        )}
      </div>

      {/* Grand Total */}
      <div className="pt-4 flex justify-between items-center text-sm font-extrabold">
        <span className="text-slate-300 uppercase tracking-wider text-xs">Total Payable</span>
        <span className="text-emerald-400 text-base font-mono font-black">
          ₹{breakdown.grandTotal.toFixed(2)}
        </span>
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-slate-800/80 text-center space-y-1 text-[10px] text-slate-500">
        <p className="font-semibold text-slate-400">Thank you for dining with us!</p>
        <p className="font-mono">Engine Version v{breakdown.billingEngineVersion} • Powered by Restroex</p>
      </div>
    </div>
  );
}
