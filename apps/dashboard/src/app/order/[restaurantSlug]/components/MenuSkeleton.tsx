"use client";

// apps/dashboard/src/app/order/[restaurantSlug]/components/MenuSkeleton.tsx
// Shimmer skeleton screen for instant perceived load paint of the Customer Ordering App.

import React from "react";

export default function MenuSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 animate-pulse pb-28 text-slate-900 font-sans">
      {/* Header Skeleton */}
      <div className="h-32 sm:h-44 bg-slate-200 w-full" />
      <div className="max-w-3xl mx-auto px-4 -mt-8 relative z-10 space-y-3">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-3">
          <div className="w-14 h-14 rounded-xl bg-slate-200 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-slate-200 rounded-md w-1/2" />
            <div className="h-3 bg-slate-200 rounded-md w-1/3" />
          </div>
        </div>

        {/* Search & Filter Pills Skeleton */}
        <div className="h-10 bg-white border border-slate-200 rounded-xl w-full" />
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 w-20 bg-slate-200 rounded-xl shrink-0" />
          ))}
        </div>
      </div>

      {/* Menu Cards Skeleton */}
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <div className="h-4 bg-slate-200 rounded-md w-1/4 mb-3" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-4 bg-white rounded-2xl border border-slate-100 flex justify-between items-center gap-4">
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-200 rounded-md w-3/4" />
              <div className="h-3 bg-slate-200 rounded-md w-1/4" />
              <div className="h-3 bg-slate-200 rounded-md w-full" />
            </div>
            <div className="w-24 h-24 bg-slate-200 rounded-2xl shrink-0" />
          </div>
        ))}
      </main>
    </div>
  );
}
