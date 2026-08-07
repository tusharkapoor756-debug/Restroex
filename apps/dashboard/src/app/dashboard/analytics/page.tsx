"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  AnalyticsService,
  AnalyticsOverviewResponse,
  MenuPerformanceItem,
} from "../../../lib/services/analytics.service";
import Card from "../../../components/ui/Card";
import Badge from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";
import { EmptyState, ErrorState } from "../../../components/ui/StateViews";
import { CardSkeleton } from "../../../components/ui/Skeleton";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingBag,
  CheckCircle2,
  XCircle,
  Utensils,
  Users,
  Percent,
  ShieldCheck,
  RefreshCw,
  Award,
  Clock,
  MessageSquare,
  FileText,
  AlertTriangle,
  Download,
  Calendar,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  FileSpreadsheet,
  FileCode,
  Flame,
  AlertCircle,
  HelpCircle
} from "lucide-react";

import { Modal, Sheet } from "../../../components/ui/Modal";

export default function ProductionAnalyticsPage() {
  const [period, setPeriod] = useState<"today" | "yesterday" | "7d" | "30d" | "90d" | "custom">("7d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const [data, setData] = useState<AnalyticsOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  // Menu Performance Matrix Tab & Selected Item Drawer State
  const [menuTab, setMenuTab] = useState<"topSelling" | "highestRevenue" | "leastSelling" | "neverOrdered">("topSelling");
  const [selectedDish, setSelectedDish] = useState<MenuPerformanceItem | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);
    try {
      const res = await AnalyticsService.getOverview(
        period,
        period === "custom" ? customStart : undefined,
        period === "custom" ? customEnd : undefined
      );
      setData(res);
    } catch (err) {
      console.error("Failed to load production analytics:", err);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, [period, customStart, customEnd]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const formatCurrency = (amt: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amt);

  // ── EXPORT HANDLERS (CSV, PDF, Excel) ──
  const handleExportCSV = () => {
    if (!data) return;
    const rows = [
      ["Metric", "Value", "Previous Period", "Change %"],
      ["Total Revenue", data.businessOverview.totalRevenue.value, data.businessOverview.totalRevenue.prev, `${data.businessOverview.totalRevenue.pct}%`],
      ["Total Orders", data.businessOverview.totalOrders.value, data.businessOverview.totalOrders.prev, `${data.businessOverview.totalOrders.pct}%`],
      ["Completed Orders", data.businessOverview.completedOrders.value, data.businessOverview.completedOrders.prev, `${data.businessOverview.completedOrders.pct}%`],
      ["Cancelled Orders", data.businessOverview.cancelledOrders.value, data.businessOverview.cancelledOrders.prev, `${data.businessOverview.cancelledOrders.pct}%`],
      ["Average Order Value", data.businessOverview.avgOrderValue.value, data.businessOverview.avgOrderValue.prev, `${data.businessOverview.avgOrderValue.pct}%`],
      ["Total Customers", data.businessOverview.totalCustomers.value, data.businessOverview.totalCustomers.prev, `${data.businessOverview.totalCustomers.pct}%`],
      ["Repeat Customer %", `${data.businessOverview.repeatCustomerPct.value}%`, `${data.businessOverview.repeatCustomerPct.prev}%`, `${data.businessOverview.repeatCustomerPct.pct}%`],
      ["Payment Success %", `${data.businessOverview.paymentSuccessPct.value}%`, `${data.businessOverview.paymentSuccessPct.prev}%`, `${data.businessOverview.paymentSuccessPct.pct}%`],
      [],
      ["Menu Item", "Quantity Sold", "Revenue (INR)", "Orders Count", "AOV Per Item"],
      ...data.menuPerformance.all.map((item) => [item.name, item.quantity, item.revenue, item.ordersCount, item.avgRevenuePerItem]),
    ];

    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Restroex_Analytics_${period}_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPrintPDF = () => {
    window.print();
  };

  // Metric Trend Component
  const renderTrendBadge = (trend: { pct: number; isIncrease: boolean; diff: number }, invert: boolean = false) => {
    const isGood = invert ? !trend.isIncrease : trend.isIncrease;
    return (
      <div
        className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
          isGood
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
        }`}
      >
        {trend.isIncrease ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
        <span>{Math.abs(trend.pct)}% vs prev period</span>
      </div>
    );
  };

  return (
    <div className="space-y-8 text-slate-900 dark:text-slate-100 font-sans pb-12">
      {/* Header & Date Filters & Export */}
      <div className="flex flex-col xl:flex-row justify-between xl:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-heading text-xl sm:text-2xl font-extrabold tracking-tight flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-brand-600 dark:text-brand-400" />
              <span>Production Analytics & Operations Intelligence</span>
            </h1>
            <Badge variant="success" size="sm">
              LIVE SQL METRICS
            </Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time database metrics calculated strictly from orders, payments, customers, and kitchen operations.
          </p>
        </div>

        {/* Date Filter & Export Action Bar */}
        <div className="flex flex-wrap items-center gap-2.5 self-start xl:self-auto">
          {/* Preset Buttons */}
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80">
            {(
              [
                { label: "Today", value: "today" },
                { label: "Yesterday", value: "yesterday" },
                { label: "7 Days", value: "7d" },
                { label: "30 Days", value: "30d" },
                { label: "90 Days", value: "90d" },
                { label: "Custom", value: "custom" },
              ] as const
            ).map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  period === p.value
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom Date Picker Inputs */}
          {period === "custom" && (
            <div className="flex items-center gap-2 text-xs">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-medium"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-medium"
              />
            </div>
          )}

          <Button variant="outline" size="sm" onClick={fetchAnalytics} disabled={isLoading} className="gap-2 font-semibold">
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>

          {/* Export Dropdown / Action Buttons */}
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="outline" onClick={handleExportCSV} className="gap-1.5 font-bold text-xs">
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span>CSV</span>
            </Button>
            <Button size="sm" variant="outline" onClick={handleExportPrintPDF} className="gap-1.5 font-bold text-xs">
              <FileText className="h-4 w-4 text-brand-600" />
              <span>PDF Report</span>
            </Button>
          </div>
        </div>
      </div>

      {/* 4 MANDATORY UI STATES */}
      {isError ? (
        <ErrorState title="Analytics Query Fail" message="Could not fetch operational analytics metrics from database." onRetry={fetchAnalytics} />
      ) : isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : data ? (
        <>
          {/* ── SECTION 11: DETERMINISTIC BUSINESS ALERTS (ZERO LLM) ── */}
          {data.alerts && data.alerts.length > 0 && (
            <div className="space-y-2">
              {data.alerts.map((alert, idx) => (
                <div
                  key={idx}
                  className={`p-3.5 rounded-2xl border flex items-start gap-3 text-xs font-semibold ${
                    alert.type === "critical"
                      ? "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60 text-rose-900 dark:text-rose-200"
                      : alert.type === "warning"
                      ? "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200"
                      : "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/60 text-blue-900 dark:text-blue-200"
                  }`}
                >
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-extrabold uppercase tracking-wide mr-2">{alert.title}:</span>
                    <span>{alert.message}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── SECTION 1: 8 EXECUTIVE BUSINESS OVERVIEW CARDS ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Revenue */}
            <Card className="space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Total Revenue</span>
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                  <DollarSign className="h-4 w-4" />
                </div>
              </div>
              <div className="flex items-baseline justify-between pt-1">
                <span className="font-heading text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                  {formatCurrency(data.businessOverview.totalRevenue.value)}
                </span>
                {renderTrendBadge(data.businessOverview.totalRevenue)}
              </div>
              <span className="text-[11px] text-slate-400 block font-medium">
                Prev Period: {formatCurrency(data.businessOverview.totalRevenue.prev)}
              </span>
            </Card>

            {/* Card 2: Total Orders */}
            <Card className="space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Total Orders</span>
                <div className="p-2 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400">
                  <ShoppingBag className="h-4 w-4" />
                </div>
              </div>
              <div className="flex items-baseline justify-between pt-1">
                <span className="font-heading text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                  {data.businessOverview.totalOrders.value}
                </span>
                {renderTrendBadge(data.businessOverview.totalOrders)}
              </div>
              <span className="text-[11px] text-slate-400 block font-medium">
                Prev Period: {data.businessOverview.totalOrders.prev} orders
              </span>
            </Card>

            {/* Card 3: Completed Orders */}
            <Card className="space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Completed Orders</span>
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              </div>
              <div className="flex items-baseline justify-between pt-1">
                <span className="font-heading text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                  {data.businessOverview.completedOrders.value}
                </span>
                {renderTrendBadge(data.businessOverview.completedOrders)}
              </div>
              <span className="text-[11px] text-slate-400 block font-medium">
                Prev Period: {data.businessOverview.completedOrders.prev} completed
              </span>
            </Card>

            {/* Card 4: Cancelled Orders */}
            <Card className="space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Cancelled Orders</span>
                <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
                  <XCircle className="h-4 w-4" />
                </div>
              </div>
              <div className="flex items-baseline justify-between pt-1">
                <span className="font-heading text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                  {data.businessOverview.cancelledOrders.value}
                </span>
                {renderTrendBadge(data.businessOverview.cancelledOrders, true)}
              </div>
              <span className="text-[11px] text-slate-400 block font-medium">
                Prev Period: {data.businessOverview.cancelledOrders.prev} cancelled
              </span>
            </Card>

            {/* Card 5: Average Order Value (AOV) */}
            <Card className="space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Avg Order Value (AOV)</span>
                <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                  <Utensils className="h-4 w-4" />
                </div>
              </div>
              <div className="flex items-baseline justify-between pt-1">
                <span className="font-heading text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                  {formatCurrency(data.businessOverview.avgOrderValue.value)}
                </span>
                {renderTrendBadge(data.businessOverview.avgOrderValue)}
              </div>
              <span className="text-[11px] text-slate-400 block font-medium">
                Prev Period: {formatCurrency(data.businessOverview.avgOrderValue.prev)}
              </span>
            </Card>

            {/* Card 6: Total Customers */}
            <Card className="space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Total Customers</span>
                <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                  <Users className="h-4 w-4" />
                </div>
              </div>
              <div className="flex items-baseline justify-between pt-1">
                <span className="font-heading text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                  {data.businessOverview.totalCustomers.value}
                </span>
                {renderTrendBadge(data.businessOverview.totalCustomers)}
              </div>
              <span className="text-[11px] text-slate-400 block font-medium">
                Prev Period: {data.businessOverview.totalCustomers.prev} customers
              </span>
            </Card>

            {/* Card 7: Repeat Customer % */}
            <Card className="space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Repeat Customer %</span>
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  <Percent className="h-4 w-4" />
                </div>
              </div>
              <div className="flex items-baseline justify-between pt-1">
                <span className="font-heading text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                  {data.businessOverview.repeatCustomerPct.value}%
                </span>
                {renderTrendBadge(data.businessOverview.repeatCustomerPct)}
              </div>
              <span className="text-[11px] text-slate-400 block font-medium">
                Prev Period: {data.businessOverview.repeatCustomerPct.prev}%
              </span>
            </Card>

            {/* Card 8: Payment Success % */}
            <Card className="space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Payment Success %</span>
                <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400">
                  <ShieldCheck className="h-4 w-4" />
                </div>
              </div>
              <div className="flex items-baseline justify-between pt-1">
                <span className="font-heading text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                  {data.businessOverview.paymentSuccessPct.value}%
                </span>
                {renderTrendBadge(data.businessOverview.paymentSuccessPct)}
              </div>
              <span className="text-[11px] text-slate-400 block font-medium">
                Prev Period: {data.businessOverview.paymentSuccessPct.prev}%
              </span>
            </Card>
          </div>

          {/* ── SECTION 3: REVENUE TREND CHART & SECTION 4: ORDER STATUS DISTRIBUTION ── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 8 Cols: Daily Revenue Trend Bar Visualizer */}
            <Card className="lg:col-span-8 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <h3 className="font-heading font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                    <span>Daily Revenue & Order Volume Trend</span>
                  </h3>
                  <span className="text-[11px] text-slate-400">Filtered timeframe daily sales inflow</span>
                </div>
                <Badge variant="brand">SQL AGGREGATED</Badge>
              </div>

              {data.revenueTrend.length === 0 ? (
                <div className="text-center py-12 text-xs text-slate-500 font-semibold">No sales data recorded in this period.</div>
              ) : (
                <div className="space-y-3">
                  <div className="h-56 flex items-end gap-3 pt-8 pb-1 px-3 overflow-x-auto">
                    {(() => {
                      const maxRev = Math.max(...data.revenueTrend.map((r) => r.revenue), 1);
                      return data.revenueTrend.map((point) => {
                        const heightPct = point.revenue > 0 ? Math.max(18, Math.round((point.revenue / maxRev) * 100)) : 6;
                        return (
                          <div key={point.date} className="flex-1 min-w-[36px] h-full flex flex-col items-center justify-end gap-1.5 group relative">
                            {/* Hover Tooltip */}
                            <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center bg-slate-900 text-white text-[10px] p-2 rounded-xl shadow-2xl z-30 whitespace-nowrap pointer-events-none">
                              <span className="font-bold text-slate-200">{point.date}</span>
                              <span className="text-emerald-400 font-bold">Revenue: {formatCurrency(point.revenue)}</span>
                              <span className="text-brand-300 font-semibold">Total Orders: {point.orders}</span>
                            </div>

                            {/* Direct Amount Tag above bar (Standardized to Revenue ₹) */}
                            <span className="text-[10px] font-mono font-extrabold text-slate-700 dark:text-slate-300 truncate w-full text-center">
                              {`₹${point.revenue}`}
                            </span>

                            {/* Bar Container */}
                            <div className="w-full max-w-[26px] h-36 bg-slate-100 dark:bg-slate-800/40 rounded-t-xl overflow-hidden flex items-end p-0.5 border border-slate-200/50 dark:border-slate-800">
                              <div
                                className={`w-full rounded-t-lg transition-all duration-300 ${
                                  point.revenue > 0
                                    ? "bg-gradient-to-t from-brand-600 to-indigo-500 dark:from-brand-600 dark:to-indigo-400 group-hover:brightness-110 shadow-lg"
                                    : "bg-slate-300 dark:bg-slate-700/60"
                                }`}
                                style={{ height: `${heightPct}%` }}
                              />
                            </div>

                            {/* Date Label */}
                            <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 truncate w-full text-center">
                              {point.date.slice(5)}
                            </span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}
            </Card>

            {/* Right 4 Cols: Order Status Distribution */}
            <Card className="lg:col-span-4 space-y-4">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="font-heading font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-brand-500" />
                  <span>Order Status Breakdown</span>
                </h3>
              </div>

              <div className="space-y-2.5 text-xs">
                {(
                  [
                    { label: "Completed / Paid", count: data.orderStatusDistribution.completed, color: "bg-emerald-500" },
                    { label: "Preparing", count: data.orderStatusDistribution.preparing, color: "bg-amber-500" },
                    { label: "Ready for Pickup", count: data.orderStatusDistribution.ready, color: "bg-blue-500" },
                    { label: "Pending Checkout", count: data.orderStatusDistribution.pending, color: "bg-purple-500" },
                    { label: "Cancelled", count: data.orderStatusDistribution.cancelled, color: "bg-rose-500" },
                  ] as const
                ).map((status) => (
                  <div key={status.label} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between font-semibold">
                    <div className="flex items-center gap-2">
                      <div className={`h-2.5 w-2.5 rounded-full ${status.color}`} />
                      <span>{status.label}</span>
                    </div>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{status.count}</span>
                  </div>
                ))}

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-[11px] text-slate-500 font-semibold">
                  <span>Avg Orders / Day:</span>
                  <span className="font-extrabold text-slate-900 dark:text-slate-100">{data.avgOrdersPerDay}</span>
                </div>
              </div>
            </Card>
          </div>

          {/* ── SECTION 5: COMPLETE MENU PERFORMANCE MATRIX (WITH SORTING) ── */}
          <Card className="space-y-4 p-5">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-heading font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Award className="h-5 w-5 text-amber-500" />
                  <span>Menu Performance Analytics Matrix</span>
                </h3>
                <span className="text-xs text-slate-500">Dish velocity, revenue contribution %, and quantity metrics</span>
              </div>

              {/* Menu Section Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                {(
                  [
                    { label: "Top Selling", value: "topSelling" },
                    { label: "Highest Revenue", value: "highestRevenue" },
                    { label: "Least Selling", value: "leastSelling" },
                    { label: "Never Ordered", value: "neverOrdered" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.value}
                    onClick={() => setMenuTab(tab.value)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      menuTab === tab.value
                        ? "bg-brand-600 text-white shadow-sm"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Menu Items Table */}
            {menuTab === "neverOrdered" ? (
              <div className="p-4">
                {data.menuPerformance.neverOrdered.length === 0 ? (
                  <span className="text-xs text-slate-500 font-semibold">Great job! Every menu item has recorded sales in this period.</span>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                    {data.menuPerformance.neverOrdered.map((item, i) => (
                      <div key={i} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 font-semibold flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-sans">
                  <thead>
                    <tr className="border-b border-slate-200/80 dark:border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-bold">
                      <th className="py-2.5 px-3">Item Name</th>
                      <th className="py-2.5 px-3">Qty Sold</th>
                      <th className="py-2.5 px-3">Total Revenue</th>
                      <th className="py-2.5 px-3">Orders Count</th>
                      <th className="py-2.5 px-3">Avg Qty/Order</th>
                      <th className="py-2.5 px-3">Revenue Contribution</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {data.menuPerformance[menuTab].map((item, idx) => (
                      <tr
                        key={idx}
                        onClick={() => setSelectedDish(item)}
                        className="hover:bg-brand-50/60 dark:hover:bg-brand-950/20 cursor-pointer transition-colors group"
                      >
                        <td className="py-3 px-3 font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                          <span className="text-slate-400 font-mono text-[11px]">#{idx + 1}</span>
                          <span className="group-hover:text-brand-600 dark:group-hover:text-brand-400 underline-offset-2 group-hover:underline">
                            {item.name}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-semibold">{item.quantity} units</td>
                        <td className="py-3 px-3 font-heading font-extrabold text-brand-600 dark:text-brand-400">{formatCurrency(item.revenue)}</td>
                        <td className="py-3 px-3 font-semibold">{item.ordersCount} orders</td>
                        <td className="py-3 px-3 text-slate-500 font-semibold">{item.avgQtyPerOrder}</td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-16 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div className="h-full bg-brand-600 rounded-full" style={{ width: `${Math.min(100, item.revenueContributionPct)}%` }} />
                            </div>
                            <span className="font-bold text-slate-700 dark:text-slate-300">{item.revenueContributionPct}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* ── SECTION 7: PEAK HOURS & SECTION 10: KITCHEN VELOCITY ── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Peak Hours Matrix (Left 7 Cols) */}
            <Card className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="font-heading font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-purple-500" />
                  <span>Peak Hours & Order Velocity</span>
                </h3>
                <Badge variant="neutral">24 HOUR MATRIX</Badge>
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200/60 dark:border-purple-800/60">
                  <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase block">Peak Hour</span>
                  <span className="font-heading font-extrabold text-slate-900 dark:text-slate-100 text-sm block mt-0.5">{data.peakHoursData.peakHour}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Slowest Hour</span>
                  <span className="font-heading font-extrabold text-slate-900 dark:text-slate-100 text-sm block mt-0.5">{data.peakHoursData.slowestHour}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Avg Orders / Hour</span>
                  <span className="font-heading font-extrabold text-slate-900 dark:text-slate-100 text-sm block mt-0.5">{data.peakHoursData.avgOrdersPerHour}</span>
                </div>
              </div>

              {/* 24-Hour Velocity Heatmap Bars */}
              <div className="h-28 flex items-end gap-1 pt-2">
                {(() => {
                  const maxH = Math.max(...data.peakHoursData.hourly.map((h) => h.ordersCount), 1);
                  return data.peakHoursData.hourly.map((item) => {
                    const heightPct = Math.max(10, Math.round((item.ordersCount / maxH) * 100));
                    const isPeak = `${item.hour}:00` === data.peakHoursData.peakHour.split(" ")[0];
                    return (
                      <div key={item.hour} className="flex-1 flex flex-col items-center gap-1 group relative">
                        <div className="absolute bottom-full mb-1 hidden group-hover:flex flex-col items-center bg-slate-900 text-white text-[9px] p-1.5 rounded-lg z-20 whitespace-nowrap">
                          <span>{item.hour}:00 — {item.ordersCount} orders</span>
                        </div>
                        <div
                          className={`w-full rounded-t-sm transition-all ${isPeak ? "bg-purple-600 dark:bg-purple-500" : "bg-slate-200 dark:bg-slate-700"}`}
                          style={{ height: `${heightPct}%` }}
                        />
                        <span className="text-[8px] text-slate-400 font-mono">{item.hour}</span>
                      </div>
                    );
                  });
                })()}
              </div>
            </Card>

            {/* Operational Velocity (Right 5 Cols) */}
            <Card className="lg:col-span-5 space-y-4">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="font-heading font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  <span>Kitchen & Operational Velocity</span>
                </h3>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                  <span className="font-semibold">Avg Order Acceptance</span>
                  <span className="font-heading font-extrabold text-slate-900 dark:text-slate-100">{data.operationalAnalytics.avgAcceptanceTimeSec} sec</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                  <span className="font-semibold">Avg Kitchen Preparation</span>
                  <span className="font-heading font-extrabold text-brand-600 dark:text-brand-400">{data.operationalAnalytics.avgKitchenPrepTimeMin} min</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                  <span className="font-semibold">Fastest Completed Order</span>
                  <span className="font-heading font-extrabold text-emerald-600 dark:text-emerald-400">{data.operationalAnalytics.fastestCompletedOrderMin} min</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                  <span className="font-semibold">Slowest Completed Order</span>
                  <span className="font-heading font-extrabold text-rose-600 dark:text-rose-400">{data.operationalAnalytics.slowestCompletedOrderMin} min</span>
                </div>
              </div>
            </Card>
          </div>

          {/* ── SECTION 8: PAYMENTS & SECTION 9: WHATSAPP BOT ANALYTICS ── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Payments Analytics (Left 6 Cols) */}
            <Card className="lg:col-span-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="font-heading font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-teal-500" />
                  <span>Payment Gateway Inflow & Reliability</span>
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Successful Payments</span>
                  <span className="font-heading font-extrabold text-emerald-600 dark:text-emerald-400 text-sm block mt-0.5">{data.paymentAnalytics.successfulPayments}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Failed Payments</span>
                  <span className="font-heading font-extrabold text-rose-600 dark:text-rose-400 text-sm block mt-0.5">{data.paymentAnalytics.failedPayments}</span>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                {Object.entries(data.paymentAnalytics.gatewayBreakdown).map(([provider, pdata]) => (
                  <div key={provider} className="flex justify-between items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 font-semibold">
                    <span className="uppercase text-slate-700 dark:text-slate-300">{provider.replace("_", " ")}</span>
                    <div className="text-right">
                      <span className="font-heading font-extrabold text-slate-900 dark:text-slate-100 block">{formatCurrency(pdata.amount)}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{pdata.success} success / {pdata.failed} failed</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* WhatsApp Analytics (Right 6 Cols) */}
            <Card className="lg:col-span-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="font-heading font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-emerald-500" />
                  <span>WhatsApp Bot Automation Performance</span>
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60">
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase block">Active Conversations</span>
                  <span className="font-heading font-extrabold text-slate-900 dark:text-slate-100 text-sm block mt-0.5">{data.whatsappAnalytics.activeConversations}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Conversion Rate</span>
                  <span className="font-heading font-extrabold text-brand-600 dark:text-brand-400 text-sm block mt-0.5">{data.whatsappAnalytics.conversionRatePct}%</span>
                </div>
              </div>

              <div className="space-y-2 text-xs font-semibold">
                <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                  <span>Orders Generated Via WhatsApp</span>
                  <span className="font-extrabold text-slate-900 dark:text-slate-100">{data.whatsappAnalytics.ordersGenerated}</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                  <span>Invoice PDFs Delivered</span>
                  <span className="font-extrabold text-slate-900 dark:text-slate-100">{data.whatsappAnalytics.invoicePdfsSent} PDFs</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                  <span>Status Notifications Delivered</span>
                  <span className="font-extrabold text-slate-900 dark:text-slate-100">{data.whatsappAnalytics.notificationsSent} msgs</span>
                </div>
              </div>
            </Card>
          </div>
        </>
      ) : null}

      {/* ── DISH PERFORMANCE METRICS DETAIL DRAWER ── */}
      <Sheet
        isOpen={selectedDish !== null}
        onClose={() => setSelectedDish(null)}
        title={
          <div className="flex items-center gap-2">
            <Utensils className="h-5 w-5 text-brand-600 dark:text-brand-400" />
            <span>Dish Analytics Breakdown</span>
          </div>
        }
      >
        {selectedDish && (
          <div className="space-y-6 text-xs">
            {/* Header Info Banner */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-brand-500/10 via-brand-500/5 to-transparent border border-brand-500/20 space-y-1">
              <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider block">Menu Item</span>
              <h2 className="font-heading text-xl font-extrabold text-slate-900 dark:text-slate-100">{selectedDish.name}</h2>
              <span className="text-slate-500 block font-medium">Selected Timeframe Metrics ({period.toUpperCase()})</span>
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Revenue</span>
                <span className="font-heading font-extrabold text-brand-600 dark:text-brand-400 text-lg block">
                  {formatCurrency(selectedDish.revenue)}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Units Sold</span>
                <span className="font-heading font-extrabold text-slate-900 dark:text-slate-100 text-lg block">
                  {selectedDish.quantity} units
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Orders</span>
                <span className="font-heading font-extrabold text-slate-900 dark:text-slate-100 text-lg block">
                  {selectedDish.ordersCount} orders
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Avg Qty / Order</span>
                <span className="font-heading font-extrabold text-slate-900 dark:text-slate-100 text-lg block">
                  {selectedDish.avgQtyPerOrder}
                </span>
              </div>
            </div>

            {/* Revenue Contribution Progress */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 space-y-2">
              <div className="flex justify-between items-center font-bold">
                <span className="text-slate-700 dark:text-slate-300">Revenue Contribution %</span>
                <span className="text-brand-600 dark:text-brand-400 text-sm font-extrabold">{selectedDish.revenueContributionPct}%</span>
              </div>
              <div className="h-3 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-brand-600 to-indigo-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, selectedDish.revenueContributionPct)}%` }}
                />
              </div>
              <span className="text-[11px] text-slate-400 block">
                This item accounts for {selectedDish.revenueContributionPct}% of total restaurant sales in this period.
              </span>
            </div>

            <Button
              variant="outline"
              onClick={() => setSelectedDish(null)}
              className="w-full font-bold"
            >
              Close Details
            </Button>
          </div>
        )}
      </Sheet>
    </div>
  );
}
