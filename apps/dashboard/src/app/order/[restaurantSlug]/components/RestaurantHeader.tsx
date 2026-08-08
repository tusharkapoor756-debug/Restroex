"use client";

// apps/dashboard/src/app/order/[restaurantSlug]/components/RestaurantHeader.tsx
// Ultra-fast, lightweight branded header with quick filter tags and search.

import React, { useState } from "react";
import { Theme, RestaurantInfo, OperationalStatus, Capabilities, ActiveCoupon } from "../types";

interface Props {
  restaurant: RestaurantInfo;
  theme: Theme;
  operationalStatus: OperationalStatus;
  capabilities?: Capabilities;
  activeCoupons?: ActiveCoupon[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filterMode: "all" | "veg" | "nonveg" | "popular";
  setFilterMode: (mode: "all" | "veg" | "nonveg" | "popular") => void;
}

export default function RestaurantHeader({
  restaurant,
  theme,
  operationalStatus,
  capabilities,
  activeCoupons,
  searchQuery,
  setSearchQuery,
  filterMode,
  setFilterMode,
}: Props) {
  const primaryColor = theme.primaryColor || "#f97316";

  const [activePhotoModal, setActivePhotoModal] = useState<string | null>(null);

  return (
    <header className="relative w-full bg-slate-50 border-b border-slate-200/80" role="banner">
      {/* Lightbox Photo Modal */}
      {activePhotoModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setActivePhotoModal(null)}
        >
          <div className="relative max-w-2xl w-full max-h-[85vh] flex items-center justify-center">
            <button
              onClick={() => setActivePhotoModal(null)}
              className="absolute -top-10 right-0 w-8 h-8 rounded-full bg-white/20 text-white font-bold flex items-center justify-center hover:bg-white/30 text-sm cursor-pointer"
            >
              ✕
            </button>
            <img
              src={activePhotoModal}
              alt="Full size ambiance photo"
              className="max-w-full max-h-[80vh] rounded-2xl object-contain shadow-2xl border border-white/20"
            />
          </div>
        </div>
      )}

      {/* Visual Cover Banner */}
      <div
        className="relative h-36 sm:h-48 w-full overflow-hidden bg-slate-900"
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
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/10" />

        {/* Top Floating Status Pills */}
        <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
          <span className="bg-black/50 backdrop-blur-md text-white text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1 border border-white/20 shadow-sm">
            ⚡ 15-20 min
          </span>
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold shadow-sm ${
              operationalStatus.isOpen ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${operationalStatus.isOpen ? "bg-white animate-pulse" : "bg-white"}`} />
            {operationalStatus.isOpen ? "Open" : "Closed"}
          </span>
        </div>
      </div>

      {/* Brand Header Stack (Native Mobile Layout) */}
      <div className="max-w-3xl mx-auto px-4 pb-4">
        {/* Logo Avatar Overlapping Cover */}
        <div className="-mt-10 mb-3 relative z-10 flex items-end justify-between">
          {theme.logoUrl ? (
            <img
              src={theme.logoUrl}
              alt={`${restaurant.name} logo`}
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border-4 border-white shadow-md shrink-0 bg-white"
            />
          ) : (
            <div
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl flex items-center justify-center shrink-0 shadow-md border-4 border-white text-white text-3xl font-black"
              style={{ background: primaryColor }}
            >
              {restaurant.name.charAt(0).toUpperCase()}
            </div>
          )}

          {/* Rating Badge Floating Next to Logo */}
          <div className="mb-1">
            {theme.googleReviewUrl ? (
              <a
                href={theme.googleReviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-amber-50 text-amber-900 text-xs font-extrabold px-3 py-1.5 rounded-xl border border-amber-200 hover:bg-amber-100 flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <span className="text-amber-500 text-sm">⭐</span>
                <span>4.8</span>
                <span className="text-[10px] text-amber-700 underline font-bold">Reviews</span>
              </a>
            ) : (
              <div className="bg-amber-50 text-amber-900 text-xs font-extrabold px-3 py-1.5 rounded-xl border border-amber-200 flex items-center gap-1.5 shadow-2xs">
                <span className="text-amber-500 text-sm">⭐</span>
                <span>4.8 Rating</span>
              </div>
            )}
          </div>
        </div>

        {/* Restaurant Name & Location */}
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight">
            {restaurant.name}
          </h1>
          <p className="text-xs text-slate-500 font-semibold flex items-center gap-1">
            <span>📍</span>
            <span>{[restaurant.address, restaurant.city].filter(Boolean).join(", ") || "Main Outlet"}</span>
          </p>
        </div>

        {/* Trust Badges Wrap Row */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span className="bg-emerald-50 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-lg border border-emerald-200/80 flex items-center gap-1">
            🛡️ FSSAI Verified
          </span>
          {(capabilities?.takeaway?.enabled ?? true) && (
            <span className="bg-orange-50 text-orange-800 text-xs font-bold px-2.5 py-1 rounded-lg border border-orange-200/80 flex items-center gap-1">
              🛍️ Takeaway
            </span>
          )}
          {(capabilities?.dineIn?.enabled ?? true) && (
            <span className="bg-blue-50 text-blue-800 text-xs font-bold px-2.5 py-1 rounded-lg border border-blue-200/80 flex items-center gap-1">
              🍽️ Dine-In
            </span>
          )}
        </div>

        {/* Restaurant Story Banner (if defined) */}
        {theme.restaurantStory && (
          <div className="mt-3 p-3 text-xs text-amber-950 bg-amber-50/90 rounded-2xl border border-amber-200/80 font-medium leading-relaxed shadow-2xs">
            📖 <span className="font-semibold">{theme.restaurantStory}</span>
          </div>
        )}

        {/* Ambiance Photo Gallery Reel (if uploaded) */}
        {theme.galleryImages && theme.galleryImages.length > 0 && (
          <div className="mt-4 space-y-1.5">
            <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider block">
              📸 Ambiance & Food Gallery
            </span>
            <div className="flex gap-2.5 overflow-x-auto pb-1 no-scrollbar">
              {theme.galleryImages.map((img, idx) => (
                <img
                  key={idx}
                  src={img}
                  alt={`${restaurant.name} ambiance ${idx + 1}`}
                  onClick={() => setActivePhotoModal(img)}
                  className="w-24 h-16 rounded-xl object-cover border border-slate-200 shrink-0 shadow-2xs cursor-pointer hover:opacity-90 active:scale-95 transition"
                  title="Click to view full photo"
                />
              ))}
            </div>
          </div>
        )}

        {/* Full-width Search Bar */}
        <div className="mt-4 space-y-2.5">
          <div className="relative">
            <input
              type="text"
              placeholder="🔍 Search dishes, paneer, drinks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition shadow-xs font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold bg-slate-100 w-6 h-6 rounded-full flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {[
              { id: "all", label: "All Items" },
              { id: "veg", label: "Veg 🌱" },
              { id: "nonveg", label: "Non-Veg 🍖" },
              { id: "popular", label: "🔥 Popular" },
            ].map((f) => {
              const active = filterMode === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setFilterMode(f.id as any)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold shrink-0 transition-all cursor-pointer ${
                    active
                      ? "bg-slate-900 text-white shadow-xs"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          {/* Dynamic Active Offers Banner Bar (Positioned right below category & filter pills) */}
          {activeCoupons && activeCoupons.length > 0 && (
            <div className="mt-3 p-3 rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-rose-500 text-white shadow-md flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="p-1.5 rounded-xl bg-white/20 text-white font-extrabold text-sm shrink-0">
                  🏷️
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-black tracking-wide truncate flex items-center gap-1.5">
                    <span>SPECIAL OFFER: Use Code</span>
                    <span className="font-mono bg-white text-orange-600 px-2 py-0.5 rounded-lg uppercase font-extrabold shadow-xs text-xs">
                      {activeCoupons[0].code}
                    </span>
                  </div>
                  <div className="text-[11px] text-amber-100 font-semibold truncate mt-0.5">
                    {activeCoupons[0].discountType === "percentage"
                      ? `Get ${activeCoupons[0].discountValue}% OFF`
                      : `Get Flat ₹${activeCoupons[0].discountValue} OFF`}
                    {activeCoupons[0].minOrderAmount > 0
                      ? ` on orders above ₹${activeCoupons[0].minOrderAmount}`
                      : ""}
                  </div>
                </div>
              </div>
              <span className="hidden sm:inline-block px-2.5 py-1 rounded-xl bg-white/20 text-white font-bold text-[10px] uppercase tracking-wider shrink-0">
                {activeCoupons.length} Active Offer{activeCoupons.length > 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

