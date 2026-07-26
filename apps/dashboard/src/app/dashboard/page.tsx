"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  TrendingUp,
  ShoppingBag,
  Clock,
  MessageSquare,
  DollarSign,
  Play,
  CheckCircle,
  Sparkles,
  Printer,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import { OrdersService } from "../../lib/services/orders.service";
import { AnalyticsService, RealDailyAnalytics } from "../../lib/services/analytics.service";
import { Order as BackendOrder, WorkflowOrderStatus } from "../../types";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import { CardSkeleton } from "../../components/ui/Skeleton";
import { EmptyState, ErrorState } from "../../components/ui/StateViews";

interface Activity {
  id: number;
  message: string;
  time: string;
  type: "ai" | "payment" | "alert" | "system";
}

export default function DashboardPage() {
  const [orders, setOrders] = useState<BackendOrder[]>([]);
  const [analytics, setAnalytics] = useState<RealDailyAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  const [activities, setActivities] = useState<Activity[]>([]);

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);
    try {
      const [activeOrders, dailyAnalytics] = await Promise.all([
        OrdersService.getActiveOrders().catch(() => []),
        AnalyticsService.getDailyOverview("7d").catch(() => null),
      ]);

      setOrders(activeOrders);
      setAnalytics(dailyAnalytics);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 15000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  const handleUpdateStatus = async (backendId: string, id: string, nextStatus: WorkflowOrderStatus) => {
    try {
      setOrders((prev) =>
        prev.map((order) => (order.id === backendId ? { ...order, status: nextStatus } : order))
      );

      await OrdersService.transitionOrder(backendId, nextStatus);

      const statusMap = {
        accepted: "accepted order ticket.",
        preparing: "moved order to cooking queue.",
        ready: "marked order ready for dispatch.",
        completed: "completed order ticket.",
        cancelled: "cancelled order.",
      };

      const newAct: Activity = {
        id: Date.now(),
        message: `Order #${id} ${statusMap[nextStatus as keyof typeof statusMap] || "updated."}`,
        time: "Just now",
        type: "system",
      };
      setActivities((prev) => [newAct, ...prev]);
    } catch (error) {
      console.error("Failed to update order status", error);
      fetchDashboardData();
    }
  };

  const activeTicketsCount = orders.filter((o) => o.status !== "completed" && o.status !== "cancelled").length;

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100">
            Restaurant Operations Hub
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time live ticket dispatch, active kitchen queue, and daily metrics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={fetchDashboardData} className="gap-2 font-semibold">
            <RefreshCw className="h-4 w-4" />
            <span>Refresh Hub</span>
          </Button>

          <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Live Sync Active</span>
          </div>
        </div>
      </div>

      {/* REAL METRICS ROW */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="space-y-2 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Today's Revenue</span>
              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 pt-1">
              <span className="font-heading text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                ₹{analytics?.totalRevenue || 0}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 block">Total paid sales</span>
          </Card>

          <Card className="space-y-2 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Active Orders</span>
              <div className="p-2 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400">
                <ShoppingBag className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 pt-1">
              <span className="font-heading text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                {activeTicketsCount}
              </span>
              <span className="text-xs font-semibold text-brand-600 dark:text-brand-400">Tickets active</span>
            </div>
            <span className="text-[11px] text-slate-400 block">Kitchen & preparing orders</span>
          </Card>

          <Card className="space-y-2 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Avg Order Value</span>
              <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 pt-1">
              <span className="font-heading text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                ₹{analytics?.avgOrderValue || 0}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 block">Average bill amount</span>
          </Card>

          <Card className="space-y-2 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">WhatsApp Conversations</span>
              <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                <MessageSquare className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 pt-1">
              <span className="font-heading text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                {analytics?.activeConversationsCount || 0}
              </span>
            </div>
              <span className="text-[11px] text-slate-400 block">Automated WhatsApp sessions</span>
          </Card>
        </div>
      )}

      {/* CORE WORKSPACE GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left Side: Live Order Dispatch List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-brand-600 dark:text-brand-400" />
              <h2 className="font-heading text-base font-bold text-slate-900 dark:text-slate-100">Live Orders Dispatch</h2>
            </div>
            <span className="text-xs font-semibold text-slate-500">{orders.length} orders total</span>
          </div>

          {orders.length === 0 ? (
            <EmptyState
              icon={<ShoppingBag className="h-8 w-8 text-brand-600" />}
              title="No Active Orders"
              description="New WhatsApp orders will appear here in real-time."
              actionLabel="Refresh Data"
              onAction={fetchDashboardData}
            />
          ) : (
            <div className="space-y-4">
              {orders.map((order) => {
                const orderId = order.humanReadableId || order.id.substring(0, 8);

                return (
                  <Card key={order.id} className="space-y-4 p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-extrabold text-base text-brand-600 dark:text-brand-400">{orderId}</span>
                          <span className="text-xs text-slate-400">•</span>
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {order.customerPhone || "Walk-in Customer"}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 block mt-0.5">
                          {new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>

                      <Badge
                        variant={
                          order.status === "completed"
                            ? "success"
                            : order.status === "preparing"
                            ? "warning"
                            : "info"
                        }
                      >
                        {order.status.toUpperCase()}
                      </Badge>
                    </div>

                    {/* Order Items */}
                    <div className="space-y-1.5 border-t border-slate-100 dark:border-slate-800 pt-3 text-xs">
                      {order.items?.map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center">
                          <span className="text-slate-700 dark:text-slate-300 font-semibold">
                            <span className="text-slate-400 font-bold mr-1.5">{item.quantity}x</span>
                            {item.itemNameSnapshot || item.variantName}
                          </span>
                          <span className="font-mono text-slate-500">₹{item.totalPrice}</span>
                        </div>
                      ))}
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3.5 text-xs">
                      <span className="font-heading font-extrabold text-base text-slate-900 dark:text-slate-100">
                        Total: ₹{order.totalAmount}
                      </span>

                      <div className="flex items-center gap-2">
                        {order.status === "accepted" && (
                          <Button
                            size="sm"
                            variant="warning"
                            onClick={() => handleUpdateStatus(order.id, orderId, "preparing")}
                            className="gap-1 font-bold"
                          >
                            <Play className="h-3.5 w-3.5" />
                            <span>Accept & Cook</span>
                          </Button>
                        )}

                        {order.status === "preparing" && (
                          <Button
                            size="sm"
                            variant="success"
                            onClick={() => handleUpdateStatus(order.id, orderId, "ready")}
                            className="gap-1 font-bold"
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            <span>Mark Ready</span>
                          </Button>
                        )}

                        {order.status === "ready" && (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => handleUpdateStatus(order.id, orderId, "completed")}
                            className="gap-1 font-bold"
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            <span>Mark Served</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side: Kitchen Queue & Recent Activity */}
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-200/80 dark:border-slate-800 pb-2">
              <Clock className="h-4.5 w-4.5 text-amber-500" />
              <h2 className="font-heading text-base font-bold text-slate-900 dark:text-slate-100">Active Kitchen Queue</h2>
            </div>

            <Card className="p-4 space-y-3">
              {orders.filter((o) => o.status === "preparing").length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500">
                  No tickets in preparation queue.
                </div>
              ) : (
                orders
                  .filter((o) => o.status === "preparing")
                  .map((order) => (
                    <div key={order.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-xs space-y-1">
                      <div className="flex items-center justify-between font-bold text-slate-900 dark:text-slate-100">
                        <span>{order.humanReadableId || order.id}</span>
                        <Badge variant="warning" size="sm">In Cooking</Badge>
                      </div>
                      <div className="text-slate-500 text-[11px]">
                        {order.items?.map((i: any) => `${i.quantity}x ${i.itemNameSnapshot}`).join(", ")}
                      </div>
                    </div>
                  ))
              )}
            </Card>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-200/80 dark:border-slate-800 pb-2">
              <Sparkles className="h-4.5 w-4.5 text-brand-600 dark:text-brand-400" />
              <h2 className="font-heading text-base font-bold text-slate-900 dark:text-slate-100">Recent Action Logs</h2>
            </div>

            {activities.length === 0 ? (
              <Card className="p-6 text-center text-xs text-slate-500">
                No recent ticket state transitions logged yet.
              </Card>
            ) : (
              <div className="space-y-2.5">
                {activities.map((act) => (
                  <div key={act.id} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-xs space-y-1">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{act.message}</p>
                    <span className="text-[10px] text-slate-400 block">{act.time}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
