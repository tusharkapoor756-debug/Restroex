"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AnalyticsService, RealDailyAnalytics } from "../../../lib/services/analytics.service";
import Card from "../../../components/ui/Card";
import Badge from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";
import { EmptyState, ErrorState } from "../../../components/ui/StateViews";
import Skeleton, { CardSkeleton } from "../../../components/ui/Skeleton";
import {
  BarChart3,
  TrendingUp,
  Clock,
  MessageSquare,
  ShoppingBag,
  DollarSign,
  Utensils,
  RefreshCw,
  Award,
  Zap
} from "lucide-react";

export default function ProductionAnalyticsPage() {
  const [timeframe, setTimeframe] = useState<"7d" | "30d" | "90d">("7d");
  const [data, setData] = useState<RealDailyAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);
    try {
      const res = await AnalyticsService.getDailyOverview(timeframe);
      setData(res);
    } catch (err) {
      console.error("Failed to load analytics:", err);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, [timeframe]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const maxItemQty = data?.topSellingItems?.[0]?.quantity || 1;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-heading text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100">
              Analytics & Real-time Insights
            </h1>
            <Badge variant="success" size="sm">
              LIVE DATA CONNECTED
            </Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real database metrics calculated from order transactions, item quantities, and payment providers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={fetchAnalytics} className="gap-2 font-semibold">
            <RefreshCw className="h-4 w-4" />
            <span>Refresh Data</span>
          </Button>

          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80">
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
      </div>

      {/* 4 STATES MANDATORY IMPLEMENTATION */}
      {isError ? (
        <ErrorState title="Analytics Error" message="Failed to query database analytics server." onRetry={fetchAnalytics} />
      ) : isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <>
          {/* 4 Real Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="space-y-2 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Total Revenue</span>
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                  <DollarSign className="h-4 w-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2 pt-1">
                <span className="font-heading text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                  ₹{data?.totalRevenue || 0}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 block">Total paid & completed sales</span>
            </Card>

            <Card className="space-y-2 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Total Orders</span>
                <div className="p-2 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400">
                  <ShoppingBag className="h-4 w-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2 pt-1">
                <span className="font-heading text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                  {data?.totalOrdersCount || 0}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 block">Orders in {timeframe.toUpperCase()} period</span>
            </Card>

            <Card className="space-y-2 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Avg Order Value</span>
                <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                  <Utensils className="h-4 w-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2 pt-1">
                <span className="font-heading text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                  ₹{data?.avgOrderValue || 0}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 block">Revenue ÷ Order count</span>
            </Card>

            <Card className="space-y-2 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Active Conversations</span>
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  <MessageSquare className="h-4 w-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2 pt-1">
                <span className="font-heading text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                  {data?.activeConversationsCount || 0}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 block">WhatsApp automated chats</span>
            </Card>
          </div>

          {/* Top Selling Items & Payment Methods Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left 7 Cols: Top 5 Selling Dishes */}
            <Card className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="font-heading font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Award className="h-4 w-4 text-amber-500" />
                  <span>Top 5 Selling Items</span>
                </h3>
                <Badge variant="neutral">BY QUANTITY</Badge>
              </div>

              {data?.topSellingItems?.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">No items sold yet in this timeframe.</div>
              ) : (
                <div className="space-y-3 text-xs">
                  {data?.topSellingItems?.map((item, idx) => {
                    const percentage = Math.round((item.quantity / maxItemQty) * 100);
                    return (
                      <div key={idx} className="space-y-1.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                        <div className="flex justify-between font-bold text-slate-900 dark:text-slate-100">
                          <span className="flex items-center gap-2">
                            <span className="text-slate-400 font-mono">#{idx + 1}</span>
                            <span>{item.name}</span>
                          </span>
                          <span>{item.quantity} sold (₹{item.revenue})</span>
                        </div>
                        <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-brand-600 rounded-full transition-all duration-500" style={{ width: `${percentage}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Right 5 Cols: Payment Provider Breakdown */}
            <Card className="lg:col-span-5 space-y-4">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="font-heading font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-emerald-500" />
                  <span>Payment Provider Inflow</span>
                </h3>
              </div>

              <div className="space-y-3 text-xs">
                {Object.entries(data?.paymentBreakdown || {}).length === 0 ? (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-slate-500 font-semibold text-center">
                    No payment breakdown transactions yet.
                  </div>
                ) : (
                  Object.entries(data?.paymentBreakdown || {}).map(([provider, amount]) => (
                    <div key={provider} className="flex justify-between items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 font-semibold">
                      <span className="uppercase text-slate-700 dark:text-slate-300">{provider.replace("_", " ")}</span>
                      <span className="font-heading font-extrabold text-slate-900 dark:text-slate-100">₹{amount}</span>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
