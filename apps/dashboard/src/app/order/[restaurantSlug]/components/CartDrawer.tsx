"use client";

// apps/dashboard/src/app/order/[restaurantSlug]/components/CartDrawer.tsx
// Ultra-fast slide-up cart drawer for mobile and desktop.

import React from "react";
import { CartItem } from "../types";

interface Props {
  items: CartItem[];
  subtotal: number;
  taxPercentage: number;
  primaryColor: string;
  onClose: () => void;
  onUpdateQuantity: (cartItemId: string, delta: number) => void;
  onCheckout: () => void;
}

export default function CartDrawer({
  items,
  subtotal,
  taxPercentage,
  primaryColor,
  onClose,
  onUpdateQuantity,
  onCheckout,
}: Props) {
  const tax = Math.round(subtotal * (taxPercentage / 100));
  const total = subtotal + tax;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Sheet / Drawer */}
      <div className="fixed bottom-0 right-0 left-0 sm:top-0 sm:left-auto sm:w-full sm:max-w-md h-[85vh] sm:h-full z-50 bg-white rounded-t-3xl sm:rounded-none shadow-2xl flex flex-col transition-all">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-xl">🛒</span>
            <h2 className="text-base font-extrabold text-slate-900">Your Cart</h2>
            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {items.reduce((sum, i) => sum + i.quantity, 0)} items
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 text-sm font-bold transition cursor-pointer"
            aria-label="Close cart"
          >
            ✕
          </button>
        </div>

        {/* Cart Item List */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-center py-12">
              <span className="text-5xl">🛍️</span>
              <p className="text-slate-700 font-bold text-sm">Your cart is empty</p>
              <p className="text-slate-400 text-xs">Add delicious food items from the menu.</p>
            </div>
          ) : (
            items.map((item) => {
              const modifiersTotal = item.selectedModifiers.reduce((s, m) => s + m.price, 0);
              const itemTotal = (item.unitPrice + modifiersTotal) * item.quantity;
              return (
                <div key={item.cartItemId} className="flex items-center gap-3 p-3 bg-slate-50/80 rounded-2xl border border-slate-100">
                  {/* Image */}
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-xl flex-shrink-0">🍲</div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <span className="text-xs font-extrabold text-slate-900 truncate leading-snug">
                        {item.name}
                        {item.variantName && <span className="text-slate-500 font-medium"> ({item.variantName})</span>}
                      </span>
                      <span className="text-xs font-black text-slate-900 flex-shrink-0">₹{itemTotal.toFixed(0)}</span>
                    </div>

                    {item.selectedModifiers.length > 0 && (
                      <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                        + {item.selectedModifiers.map((m) => m.optionName).join(", ")}
                      </p>
                    )}

                    {/* Stepper */}
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5">
                        <button
                          onClick={() => onUpdateQuantity(item.cartItemId, -1)}
                          className="w-6 h-6 rounded-md text-slate-700 flex items-center justify-center hover:bg-slate-100 font-black text-sm active:scale-95 cursor-pointer"
                        >−</button>
                        <span className="text-xs font-black text-slate-900 w-6 text-center">{item.quantity}</span>
                        <button
                          onClick={() => onUpdateQuantity(item.cartItemId, 1)}
                          className="w-6 h-6 rounded-md text-slate-700 flex items-center justify-center hover:bg-slate-100 font-black text-sm active:scale-95 cursor-pointer"
                        >+</button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Bill Itemization Footer */}
        {items.length > 0 && (
          <div className="flex-shrink-0 border-t border-slate-100 bg-white px-5 py-4 space-y-3">
            <div className="space-y-1.5 text-xs font-medium">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span><span className="font-bold text-slate-800">₹{subtotal.toFixed(0)}</span>
              </div>
              {taxPercentage > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>Taxes ({taxPercentage}%)</span><span className="font-bold text-slate-800">₹{tax.toFixed(0)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-black text-slate-900 border-t border-slate-100 pt-2">
                <span>To Pay</span><span className="text-emerald-600">₹{total.toFixed(0)}</span>
              </div>
            </div>

            <button
              id="proceed-to-checkout-btn"
              onClick={onCheckout}
              className="w-full py-3.5 rounded-xl text-white font-extrabold text-sm transition-all active:scale-98 shadow-md flex items-center justify-center gap-2 cursor-pointer"
              style={{ backgroundColor: primaryColor }}
            >
              <span>Proceed to Checkout</span>
              <span>→</span>
            </button>
          </div>
        )}
      </div>
    </>
  );
}

