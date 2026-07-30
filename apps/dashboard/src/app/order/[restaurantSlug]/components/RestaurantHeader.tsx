"use client";

// apps/dashboard/src/app/order/[restaurantSlug]/components/RestaurantHeader.tsx
// Ultra-fast, lightweight branded header with quick filter tags and search.

import React from "react";
import { Theme, RestaurantInfo, OperationalStatus } from "../types";

interface Props {
  restaurant: RestaurantInfo;
  theme: Theme;
  operationalStatus: OperationalStatus;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  vegOnly: boolean;
  setVegOnly: (veg: boolean) => void;
  onlyBestsellers: boolean;
  setOnlyBestsellers: (bestsellers: boolean) => void;
}

export default function RestaurantHeader({
  restaurant,
  theme,
  operationalStatus,
  searchQuery,
  setSearchQuery,
  vegOnly,
  setVegOnly,
  onlyBestsellers,
  setOnlyBestsellers,
}: Props) {
  const primaryColor = theme.primaryColor || "#f97316";

  return (
    <header className="relative w-full bg-slate-50 border-b border-slate-200/80" role="banner">
      {/* Visual Cover Banner */}
      <div
        className="relative h-32 sm:h-44 w-full overflow-hidden"
        style={{
          background: theme.coverImageUrl
            ? undefined
            : `linear-gradient(135deg, ${primaryColor} 0%, ${theme.secondaryColor || "#ea580c"} 100%)`,
        }}
      >
        {theme.coverImageUrl && (
          <img
            src={theme.coverImageUrl}
            alt={`${restaurant.name} cover`}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />

        {/* Top Badges (Open/Closed + Est Prep Time) */}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          <span className="bg-black/40 backdrop-blur-xs text-white/90 text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1 border border-white/10">
            ⚡ 15-20 min
          </span>
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold shadow-xs ${
              operationalStatus.isOpen ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${operationalStatus.isOpen ? "bg-white animate-pulse" : "bg-white"}`} />
            {operationalStatus.isOpen ? "Open" : "Closed"}
          </span>
        </div>
      </div>

      {/* Main Info Card */}
      <div className="max-w-3xl mx-auto px-4 -mt-8 relative z-10 pb-3">
        <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-100 flex items-center gap-3">
          {theme.logoUrl ? (
            <img
              src={theme.logoUrl}
              alt={`${restaurant.name} logo`}
              className="w-13 h-13 rounded-xl object-cover border-2 border-white shadow-xs flex-shrink-0 bg-slate-100"
            />
          ) : (
            <div
              className="w-13 h-13 rounded-xl flex items-center justify-center flex-shrink-0 shadow-xs border-2 border-white text-white text-2xl font-black"
              style={{ background: primaryColor }}
            >
              {restaurant.name.charAt(0).toUpperCase()}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h1 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight truncate">
              {restaurant.name}
            </h1>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 font-medium">
              <span className="truncate">📍 {[restaurant.address, restaurant.city].filter(Boolean).join(", ") || "Main Outlet"}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="bg-orange-50 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded-md border border-orange-100">
                🛍️ Takeaway
              </span>
              <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-md border border-blue-100">
                🍽️ Dine-In
              </span>
            </div>
          </div>
        </div>

        {/* Quick Search & Filter Bar */}
        <div className="mt-3 space-y-2">
          {/* Search Input */}
          <div className="relative">
            <input
              type="text"
              placeholder="🔍 Search dishes, paneer, drinks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200/90 rounded-xl px-4 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition shadow-2xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold bg-slate-100 w-5 h-5 rounded-full flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5 no-scrollbar">
            <button
              onClick={() => setVegOnly(!vegOnly)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 flex-shrink-0 cursor-pointer ${
                vegOnly
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Veg Only 🌱
            </button>

            <button
              onClick={() => setOnlyBestsellers(!onlyBestsellers)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 flex-shrink-0 cursor-pointer ${
                onlyBestsellers
                  ? "bg-amber-500 text-white shadow-xs"
                  : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              <span>🔥 Bestsellers</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

