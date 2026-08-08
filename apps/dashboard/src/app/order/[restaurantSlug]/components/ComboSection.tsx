"use client";

import React from "react";
import { ActiveCombo, CartItem } from "../types";

interface Props {
  combos: ActiveCombo[];
  onAddComboToCart: (item: CartItem) => void;
}

export default function ComboSection({ combos, onAddComboToCart }: Props) {
  if (!combos || combos.length === 0) return null;

  return (
    <div id="combo-offers-section" className="mb-6 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-orange-600 font-extrabold text-sm">
            🎁
          </span>
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-wide">
              Special Combos & Value Meals
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              Bundled meal packages at special discounted prices
            </p>
          </div>
        </div>
        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200">
          BEST VALUE
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {combos.map((combo) => {
          const discountPercent = combo.originalPrice > combo.comboPrice
            ? Math.round(((combo.originalPrice - combo.comboPrice) / combo.originalPrice) * 100)
            : 0;

          return (
            <div
              key={combo.id}
              className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-3.5 shadow-sm hover:shadow-md transition relative flex flex-col justify-between overflow-hidden group"
            >
              {/* Savings Badge */}
              {combo.savingsAmount > 0 && (
                <div className="absolute top-3 right-3 bg-gradient-to-r from-rose-500 to-amber-500 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-xs uppercase tracking-wider">
                  SAVE ₹{combo.savingsAmount} ({discountPercent}% OFF)
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  {combo.imageUrl ? (
                    <img
                      src={combo.imageUrl}
                      alt={combo.name}
                      className="w-16 h-16 rounded-xl object-cover border border-slate-100 shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/50 flex items-center justify-center text-2xl shrink-0">
                      🍱
                    </div>
                  )}

                  <div className="min-w-0 pr-16">
                    <h4 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 truncate">
                      {combo.name}
                    </h4>
                    {combo.description && (
                      <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 font-medium leading-tight">
                        {combo.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Items Included Pills List */}
                {combo.itemsIncluded && combo.itemsIncluded.length > 0 && (
                  <div className="pt-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Package Includes:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {combo.itemsIncluded.map((item, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md border border-slate-200/60 dark:border-slate-700"
                        >
                          {item.quantity}x {item.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Price & Add Button Bar */}
              <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-base font-black text-slate-900 dark:text-slate-100 font-mono">
                    ₹{combo.comboPrice}
                  </span>
                  {combo.originalPrice > combo.comboPrice && (
                    <span className="text-xs text-slate-400 line-through font-mono">
                      ₹{combo.originalPrice}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => {
                    const cartItem: CartItem = {
                      cartItemId: `combo-${combo.id}-${Date.now()}`,
                      menuItemId: combo.id,
                      name: `🎁 ${combo.name}`,
                      unitPrice: combo.comboPrice,
                      quantity: 1,
                      selectedModifiers: (combo.itemsIncluded || []).map((inc, i) => ({
                        groupId: `inc-${i}`,
                        groupName: "Included Items",
                        optionId: `opt-${i}`,
                        optionName: `${inc.quantity}x ${inc.name}`,
                        price: 0,
                      })),
                      imageUrl: combo.imageUrl,
                      isVeg: true,
                    };
                    onAddComboToCart(cartItem);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-4 py-2 rounded-xl transition shadow-xs active:scale-95 cursor-pointer flex items-center gap-1"
                >
                  <span>ADD</span>
                  <span className="text-sm">+</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
