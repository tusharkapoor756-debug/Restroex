"use client";

// apps/dashboard/src/app/order/[restaurantSlug]/components/CategoryNav.tsx
// Ultra-fast sticky horizontal category navigation bar.

import React from "react";
import { MenuCategory } from "../types";

interface Props {
  categories: MenuCategory[];
  activeCategory: string | null;
  onSelect: (id: string) => void;
  primaryColor: string;
}

export default function CategoryNav({ categories, activeCategory, onSelect, primaryColor }: Props) {
  if (!categories.length) return null;

  return (
    <nav
      id="category-nav"
      className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-2xs overflow-x-auto no-scrollbar"
      aria-label="Menu categories"
    >
      <div className="flex items-center gap-2 px-4 py-2.5 max-w-3xl mx-auto min-w-max">
        {categories.map((cat) => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              id={`cat-nav-${cat.id}`}
              onClick={() => onSelect(cat.id)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-extrabold transition-all duration-150 cursor-pointer active:scale-95 ${
                isActive
                  ? "text-white shadow-xs"
                  : "text-slate-600 bg-slate-100/90 hover:bg-slate-200/80"
              }`}
              style={isActive ? { backgroundColor: primaryColor } : undefined}
            >
              {cat.name}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

