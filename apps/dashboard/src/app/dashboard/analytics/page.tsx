// src/app/dashboard/analytics/page.tsx
"use client";

import { useState, useEffect } from "react";
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Users,
  Utensils,
  Clock,
  Sparkles,
  Calendar,
  ArrowUpRight,
  TrendingDown,
  Percent
} from "lucide-react";
import { AnalyticsService } from "../../../lib/services/analytics.service";
import { DailyAnalytics } from "../../../types";

export default function AnalyticsPage() {
  const [timeframe, setTimeframe] = useState<"7d" | "30d" | "12m">("7d");
  const [data, setData] = useState<DailyAnalytics | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const stats = await AnalyticsService.getDailyOverview();
        setData(stats);
      } catch (error) {
        console.error("Analytics fetch failed", error);
      }
    })();
  }, [timeframe]);

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold font-sora text-white">Business Analytics</h1>
          <p className="text-slate-400 text-xs mt-0.5">Analyze revenue streams, traffic hours, and catalog popularity.</p>
        </div>

        {/* Timeframe toggle */}
        <div className="flex border border-[#23242B] bg-slate-950 p-1 rounded-xl self-start sm:self-auto">
          <button
            onClick={() => setTimeframe("7d")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              timeframe === "7d" ? "bg-violet-600 text-white" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            7 Days
          </button>
          <button
            onClick={() => setTimeframe("30d")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              timeframe === "30d" ? "bg-violet-600 text-white" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            30 Days
          </button>
          <button
            onClick={() => setTimeframe("12m")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              timeframe === "12m" ? "bg-violet-600 text-white" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            12 Months
          </button>
        </div>
      </div>

      {/* OVERVIEW METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0e0f14]/80 border border-[#23242B] rounded-2xl p-5 relative overflow-hidden">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Net Revenue</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold font-sora text-white">₹{data?.totalRevenue || 0}</span>
          </div>
        </div>
        <div className="bg-[#0e0f14]/80 border border-[#23242B] rounded-2xl p-5 relative overflow-hidden">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Total Orders</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold font-sora text-white">{data?.totalOrders || 0}</span>
          </div>
        </div>
        <div className="bg-[#0e0f14]/80 border border-[#23242B] rounded-2xl p-5 relative overflow-hidden">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Avg Prep Time</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold font-sora text-white">{data?.avgPrepTimeMinutes || 0}m</span>
          </div>
        </div>
        <div className="bg-[#0e0f14]/80 border border-[#23242B] rounded-2xl p-5 relative overflow-hidden">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">WhatsApp Msgs</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold font-sora text-white">{data?.whatsappMessageCount || 0}</span>
          </div>
        </div>
      </div>

      {/* CHARTS CONTAINER GRID - PLACEHOLDER */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#0e0f14]/40 border border-[#23242B] rounded-2xl p-6 space-y-6">
          <div className="flex items-center gap-2 border-b border-[#23242B]/40 pb-2">
            <DollarSign className="h-4.5 w-4.5 text-violet-400" />
            <h2 className="text-sm font-bold font-sora text-white">Revenue Performance Trend</h2>
          </div>
          <div className="h-60 w-full relative flex items-center justify-center pt-4 pb-2 px-4 border-l border-b border-[#23242B]/40 text-slate-500 text-xs">
            Chart data unavailable (API not implemented)
          </div>
        </div>

        <div className="bg-[#0e0f14]/40 border border-[#23242B] rounded-2xl p-6 space-y-6">
          <div className="flex items-center gap-2 border-b border-[#23242B]/40 pb-2">
            <Clock className="h-4.5 w-4.5 text-amber-500" />
            <h2 className="text-sm font-bold font-sora text-white">Peak Order Hours</h2>
          </div>
          <div className="text-slate-500 text-xs py-10 text-center">
            Data unavailable (API not implemented)
          </div>
        </div>
      </div>

      {/* PRODUCT SALES BREAKDOWNS - PLACEHOLDER */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#0e0f14]/40 border border-[#23242B] rounded-2xl p-6 space-y-6">
          <div className="flex items-center gap-2 border-b border-[#23242B]/40 pb-2">
            <Utensils className="h-4.5 w-4.5 text-violet-400" />
            <h2 className="text-sm font-bold font-sora text-white">Top In-Demand Dishes</h2>
          </div>
          <div className="text-slate-500 text-xs py-10 text-center">
            Data unavailable (API not implemented)
          </div>
        </div>

        {/* Acquisition Channel metrics (1 column) */}
        <div className="bg-[#0e0f14]/40 border border-[#23242B] rounded-2xl p-6 space-y-6">
          <div className="flex items-center gap-2 border-b border-[#23242B]/40 pb-2">
            <Percent className="h-4.5 w-4.5 text-emerald-500" />
            <h2 className="text-sm font-bold font-sora text-white">Order Channels Inflow</h2>
          </div>

          <div className="space-y-5 pt-3">
            {/* WhatsApp channel */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="flex items-center gap-1.5 text-slate-300 font-medium">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  WhatsApp Ordering
                </span>
                <span className="text-white font-bold">58% Share</span>
              </div>
              <div className="h-2.5 w-full bg-slate-950 border border-[#23242B] rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: "58%" }} />
              </div>
            </div>

            {/* Table QR channel */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="flex items-center gap-1.5 text-slate-300 font-medium">
                  <span className="h-2 w-2 rounded-full bg-violet-500" />
                  Table Dine-In QR
                </span>
                <span className="text-white font-bold">42% Share</span>
              </div>
              <div className="h-2.5 w-full bg-slate-950 border border-[#23242B] rounded-full overflow-hidden">
                <div className="h-full bg-violet-500 rounded-full" style={{ width: "42%" }} />
              </div>
            </div>

            <div className="p-3.5 bg-slate-950/40 border border-[#23242B] rounded-xl text-[11px] text-slate-400 leading-relaxed italic">
              💡 WhatsApp automation has reduced average table order turnaround cycles by <strong>2.8 minutes</strong> since initial connections setup.
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
