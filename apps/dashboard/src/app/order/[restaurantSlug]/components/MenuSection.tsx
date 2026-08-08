"use client";

// apps/dashboard/src/app/order/[restaurantSlug]/components/MenuSection.tsx
// Swiggy-tier lightweight food card component with Veg/Non-Veg icons & ADD button.

import React from "react";
import { MenuCategory, MenuItem } from "../types";

interface Props {
  category: MenuCategory;
  primaryColor: string;
  isOpen: boolean;
  cartQuantities?: Record<string, number>;
  onItemClick: (item: MenuItem) => void;
  onIncrement?: (item: MenuItem) => void;
  onDecrement?: (item: MenuItem) => void;
}

function VegBadge({ isVeg }: { isVeg: boolean }) {
  return (
    <span
      className={`inline-flex items-center justify-center w-4 h-4 rounded-xs border-2 flex-shrink-0 bg-white ${
        isVeg ? "border-emerald-600" : "border-rose-600"
      }`}
      title={isVeg ? "Vegetarian" : "Non-Vegetarian"}
    >
      <span className={`w-2 h-2 rounded-full ${isVeg ? "bg-emerald-600" : "bg-rose-600"}`} />
    </span>
  );
}

function MenuItemCard({
  item,
  primaryColor,
  isOpen,
  quantity = 0,
  onClick,
  onIncrement,
  onDecrement,
}: {
  item: MenuItem;
  primaryColor: string;
  isOpen: boolean;
  quantity?: number;
  onClick: () => void;
  onIncrement?: () => void;
  onDecrement?: () => void;
}) {
  const unavailable = !item.isAvailable || !isOpen;
  const hasVariantsOrAddons = item.variants.length > 0 || (item.modifierGroups && item.modifierGroups.length > 0);

  return (
    <div
      className={`flex gap-3 p-3.5 bg-white rounded-2xl border border-slate-100/90 shadow-2xs transition-all ${
        unavailable ? "opacity-45" : "hover:border-slate-300 cursor-pointer"
      }`}
      onClick={unavailable ? undefined : onClick}
      role={unavailable ? undefined : "button"}
      tabIndex={unavailable ? undefined : 0}
    >
      {/* Item Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
          <VegBadge isVeg={item.isVeg} />
          {item.isBestSeller && (
            <span className="text-[10px] bg-amber-50 text-amber-700 font-extrabold px-2 py-0.5 rounded-md border border-amber-200/80">
              🔥 Popular
            </span>
          )}
          {item.isSpicy && (
            <span className="text-[10px] bg-rose-50 text-rose-600 font-extrabold px-2 py-0.5 rounded-md border border-rose-100">
              🌶️ Spicy
            </span>
          )}
        </div>

        <h3 className="font-extrabold text-slate-900 text-sm leading-snug tracking-tight truncate">
          {item.name}
        </h3>

        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="text-sm font-black text-slate-900">
            ₹{item.variants.length > 0 ? `${Math.min(...item.variants.map((v) => v.price))}` : item.price}
          </span>
          {hasVariantsOrAddons && (
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Customizable</span>
          )}
        </div>

        {item.description && (
          <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed font-normal">
            {item.description}
          </p>
        )}

        {unavailable && (
          <span className="inline-block mt-1.5 text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
            {!isOpen ? "Store closed" : "Out of stock"}
          </span>
        )}
      </div>

      {/* Image & Interactive Stepper / ADD Button */}
      <div className="flex-shrink-0 relative w-24 sm:w-28 flex flex-col items-center justify-between pb-2">
        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200/80 shadow-2xs shrink-0 flex items-center justify-center relative">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.name}
              className="w-full h-full object-cover object-center rounded-2xl"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-3xl">
              🥘
            </div>
          )}
        </div>

        {!unavailable && (
          <div className="-mt-3.5 relative z-10">
            {quantity > 0 && !hasVariantsOrAddons ? (
              <div
                className="flex items-center justify-between min-w-[84px] h-8 px-1 rounded-xl bg-slate-900 text-white shadow-md text-xs font-black"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={onDecrement}
                  className="w-7 h-7 flex items-center justify-center hover:bg-white/20 rounded-lg active:scale-90 transition cursor-pointer text-sm"
                >
                  −
                </button>
                <span className="px-1 text-xs font-black">{quantity}</span>
                <button
                  onClick={onIncrement}
                  className="w-7 h-7 flex items-center justify-center hover:bg-white/20 rounded-lg active:scale-90 transition cursor-pointer text-sm"
                >
                  +
                </button>
              </div>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClick();
                }}
                className="px-4 py-1.5 min-w-[80px] h-8 rounded-xl bg-white border-2 border-emerald-600 text-emerald-700 text-xs font-black shadow-md hover:bg-emerald-50 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1"
              >
                <span>{hasVariantsOrAddons ? "ADD" : quantity > 0 ? `${quantity}` : "ADD"}</span>
                <span className="text-emerald-600 font-bold">+</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MenuSection({
  category,
  primaryColor,
  isOpen,
  cartQuantities = {},
  onItemClick,
  onIncrement,
  onDecrement,
}: Props) {
  return (
    <section id={`menu-section-${category.id}`} className="scroll-mt-28 mb-6">
      <div className="flex items-baseline justify-between border-b border-slate-200/80 pb-2 mb-3">
        <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <span>{category.name}</span>
        </h2>
        <span className="text-xs font-bold text-slate-400 font-mono">
          {category.items.length} {category.items.length === 1 ? "item" : "items"}
        </span>
      </div>

      <div className="space-y-3">
        {category.items.map((item) => (
          <MenuItemCard
            key={item.id}
            item={item}
            primaryColor={primaryColor}
            isOpen={isOpen}
            quantity={cartQuantities[item.id] || 0}
            onClick={() => onItemClick(item)}
            onIncrement={() => onIncrement && onIncrement(item)}
            onDecrement={() => onDecrement && onDecrement(item)}
          />
        ))}
      </div>
    </section>
  );
}

