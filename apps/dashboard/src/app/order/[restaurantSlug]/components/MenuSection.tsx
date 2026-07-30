"use client";

// apps/dashboard/src/app/order/[restaurantSlug]/components/MenuSection.tsx
// Swiggy-tier lightweight food card component with Veg/Non-Veg icons & ADD button.

import React from "react";
import { MenuCategory, MenuItem } from "../types";

interface Props {
  category: MenuCategory;
  primaryColor: string;
  isOpen: boolean;
  onItemClick: (item: MenuItem) => void;
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

function MenuItemCard({ item, primaryColor, isOpen, onClick }: {
  item: MenuItem;
  primaryColor: string;
  isOpen: boolean;
  onClick: () => void;
}) {
  const unavailable = !item.isAvailable || !isOpen;

  return (
    <div
      className={`flex gap-3 p-3.5 bg-white rounded-2xl border border-slate-100/90 shadow-2xs transition-all ${
        unavailable ? "opacity-50" : "hover:border-slate-300 active:scale-[0.99] cursor-pointer"
      }`}
      onClick={unavailable ? undefined : onClick}
      role={unavailable ? undefined : "button"}
      tabIndex={unavailable ? undefined : 0}
      onKeyDown={unavailable ? undefined : (e) => e.key === "Enter" && onClick()}
    >
      {/* Item Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
          <VegBadge isVeg={item.isVeg} />
          {item.isBestSeller && (
            <span className="text-[10px] bg-amber-50 text-amber-700 font-extrabold px-2 py-0.5 rounded-md border border-amber-200/80">
              🔥 Bestseller
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
          {item.variants.length > 0 && (
            <span className="text-[10px] text-slate-400 font-semibold">onwards</span>
          )}
        </div>

        {item.description && (
          <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed font-normal">
            {item.description}
          </p>
        )}

        {unavailable && (
          <span className="inline-block mt-1 text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
            {!isOpen ? "Store closed" : "Out of stock"}
          </span>
        )}
      </div>

      {/* Image & ADD Button */}
      <div className="flex-shrink-0 relative w-24 h-24">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            className="w-24 h-24 rounded-xl object-cover border border-slate-100 shadow-2xs"
            loading="lazy"
          />
        ) : (
          <div className="w-24 h-24 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-3xl">
            🥘
          </div>
        )}

        {!unavailable && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-xl bg-white border border-emerald-500 text-emerald-700 text-xs font-black shadow-md hover:bg-emerald-50 active:scale-95 transition-all cursor-pointer flex items-center gap-1"
          >
            <span>ADD</span>
            <span className="text-emerald-500 font-bold">+</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default function MenuSection({ category, primaryColor, isOpen, onItemClick }: Props) {
  return (
    <section id={`menu-section-${category.id}`} className="scroll-mt-28 mb-6">
      <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider px-1 mb-2.5 flex items-center gap-2">
        <span>{category.name}</span>
        <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
          {category.items.length}
        </span>
      </h2>
      <div className="space-y-2.5">
        {category.items.map((item) => (
          <MenuItemCard
            key={item.id}
            item={item}
            primaryColor={primaryColor}
            isOpen={isOpen}
            onClick={() => onItemClick(item)}
          />
        ))}
      </div>
    </section>
  );
}

