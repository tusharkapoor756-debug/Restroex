"use client";

import React, { useState } from "react";
import Card from "../../../components/ui/Card";
import Badge from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/StateViews";
import {
  BarChart3,
  TrendingUp,
  Clock,
  MessageSquare,
  ShoppingBag,
  DollarSign,
  Utensils,
  ArrowUpRight,
  TrendingDown,
  Percent,
  Calendar,
  AlertCircle
} from "lucide-react";

export default function ProductionAnalyticsPage() {
  const [timeframe, setTimeframe] = useState<"7d" | "30d" | "90d">("7d");

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-heading text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100">
              Analytics & Business Insights
            </h1>
            <Badge variant="warning" size="sm">
              BACKEND ENDPOINT PENDING
            </Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time revenue performance, peak order hours, and popular menu dish analytics.
          </p>
        </div>

        <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 self-start sm:self-auto">
          {(["7d", "30d", "90d"] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                timeframe === tf
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
              }`}
            >
              {tf.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* 4 Metric Cards (Matching Dashboard & Payments Layout Style) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Today's Revenue</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 pt-1">
            <span className="font-heading text-2xl font-extrabold text-slate-900 dark:text-slate-100">--</span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center">
              <TrendingUp className="h-3 w-3 mr-0.5" />
              ↑ --%
            </span>
          </div>
          <span className="text-[11px] text-slate-400 block">vs. yesterday comparison</span>
        </Card>

        <Card className="space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Today's Orders</span>
            <div className="p-2 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400">
              <ShoppingBag className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 pt-1">
            <span className="font-heading text-2xl font-extrabold text-slate-900 dark:text-slate-100">--</span>
          </div>
          <span className="text-[11px] text-slate-400 block">WhatsApp + Table Dine-in</span>
        </Card>

        <Card className="space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Avg Order Value</span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
              <Utensils className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 pt-1">
            <span className="font-heading text-2xl font-extrabold text-slate-900 dark:text-slate-100">--</span>
          </div>
          <span className="text-[11px] text-slate-400 block">Average bill amount</span>
        </Card>

        <Card className="space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Active Conversations</span>
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <MessageSquare className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 pt-1">
            <span className="font-heading text-2xl font-extrabold text-slate-900 dark:text-slate-100">--</span>
          </div>
          <span className="text-[11px] text-slate-400 block">WhatsApp live sessions</span>
        </Card>
      </div>

      {/* Revenue Trend & Peak Hours Heatmap Placeholder Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left 8 Cols: Revenue Trend Chart Placeholder */}
        <Card className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="font-heading font-bold text-sm text-slate-900 dark:text-slate-100">Revenue Trend (Last {timeframe.toUpperCase()})</h3>
            <Badge variant="neutral">LINE CHART</Badge>
          </div>

          <div className="h-56 w-full rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center p-6 text-center space-y-2">
            <BarChart3 className="h-8 w-8 text-slate-400" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Revenue Graph View Placeholder</span>
            <p className="text-[11px] text-slate-500 max-w-sm">Chart will render daily sales trends automatically when analytics endpoint is connected.</p>
          </div>
        </Card>

        {/* Right 4 Cols: Channel Inflow Share */}
        <Card className="lg:col-span-4 space-y-4">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="font-heading font-bold text-sm text-slate-900 dark:text-slate-100">Order Channel Share</h3>
          </div>

          <div className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <div className="flex justify-between font-bold text-slate-900 dark:text-slate-100">
                <span>WhatsApp Bot Ordering</span>
                <span>--%</span>
              </div>
              <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-brand-600 rounded-full" style={{ width: "60%" }} />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between font-bold text-slate-900 dark:text-slate-100">
                <span>Table Dine-in QR</span>
                <span>--%</span>
              </div>
              <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: "40%" }} />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* SINGLE CLEAN UN-TRUNCATED "COMING SOON" STATE CARD (Fixes duplicate cut-off issue) */}
      <Card className="p-8 text-center flex flex-col items-center justify-center space-y-3 border-dashed bg-slate-50/50 dark:bg-slate-900/50">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-500">
          <AlertCircle className="h-7 w-7" />
        </div>
        <div className="max-w-md space-y-1.5">
          <h3 className="font-heading text-base font-bold text-slate-900 dark:text-slate-100">
            Analytics Module Pending Backend Integration
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Backend endpoint <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-brand-600 dark:text-brand-400 font-mono">/api/v1/analytics/daily</code> is under construction. Real sales data will automatically populate these charts upon server deployment.
          </p>
        </div>
        <Badge variant="warning" size="default">
          Feature Coming Soon
        </Badge>
      </Card>
    </div>
  );
}
