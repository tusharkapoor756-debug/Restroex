// src/app/dashboard/page.tsx
"use client";

import { useState, useEffect } from "react";
import {
  TrendingUp,
  ShoppingBag,
  Clock,
  MessageSquare,
  DollarSign,
  AlertTriangle,
  Play,
  CheckCircle,
  ChevronRight,
  Sparkles,
  Printer,
  Search,
  BellRing
} from "lucide-react";
import { OrdersService } from "../../lib/services/orders.service";
import { Order as BackendOrder, WorkflowOrderStatus } from "../../types";

interface UiOrder {
  id: string;
  backendId: string;
  source: "whatsapp" | "table";
  tableNo?: string;
  customerPhone?: string;
  items: { name: string; quantity: number }[];
  total: number;
  status: WorkflowOrderStatus | "checkout_pending" | "paid" | "cart_active" | "payment_pending" | "refunded";
  time: string;
  timestamp: Date;
}

interface Activity {
  id: number;
  message: string;
  time: string;
  type: "ai" | "payment" | "alert" | "system";
}

export default function DashboardPage() {
  const [orders, setOrders] = useState<UiOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [activities, setActivities] = useState<Activity[]>([
    { id: 1, message: "AI Engine matched WhatsApp order request to #484.", time: "2 min ago", type: "ai" },
    { id: 2, message: "KOT printed successfully for Table 5.", time: "8 min ago", type: "system" },
    { id: 3, message: "Payment of ₹820 settled for Table 8.", time: "18 min ago", type: "payment" },
    { id: 4, message: "Low stock alert: Fresh Mint Leaves (< 0.5 kg).", time: "30 min ago", type: "alert" }
  ]);

  const fetchOrders = async () => {
    try {
      const data = await OrdersService.getActiveOrders();
      const mapped: UiOrder[] = data.map((o) => ({
        id: o.humanReadableId || o.id.substring(0, 8),
        backendId: o.id,
        source: "whatsapp", // default to whatsapp for now
        customerPhone: o.customerPhone,
        items: o.items?.map(i => ({ name: i.itemNameSnapshot, quantity: i.quantity })) || [],
        total: o.totalAmount,
        status: o.status,
        time: new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: new Date(o.createdAt)
      }));
      setOrders(mapped);
    } catch (error) {
      console.error("Failed to load orders:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    // Poll every 30 seconds
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, []);

  // Update order status
  const handleUpdateStatus = async (backendId: string, id: string, nextStatus: WorkflowOrderStatus) => {
    try {
      // Optimistic update
      setOrders((prev) =>
        prev.map((order) => {
          if (order.backendId === backendId) {
            return { ...order, status: nextStatus };
          }
          return order;
        })
      );

      await OrdersService.transitionOrder(backendId, nextStatus);

      const statusMap = {
        accepted: "accepted ticket.",
        preparing: "moved to cooking queue.",
        ready: "marked ready for dispatch.",
        completed: "marked as served/delivered.",
        cancelled: "cancelled."
      };
      const newAct: Activity = {
        id: Date.now(),
        message: `Order ${id} ${statusMap[nextStatus as keyof typeof statusMap] || 'updated.'}`,
        time: "Just now",
        type: "system"
      };
      setActivities(prev => [newAct, ...prev]);
    } catch (error) {
      console.error("Failed to update status", error);
      // Revert optimism on error
      fetchOrders();
    }
  };

  // Status Badge Helper
  const renderStatus = (status: UiOrder["status"]) => {
    if (status === "paid" || status === "accepted" || status === "checkout_pending" || status === "cart_active" || status === "payment_pending") {
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-950 text-violet-300 border border-violet-800 animate-pulse">New Ticket</span>;
    }
    switch (status) {
      case "preparing":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">Preparing</span>;
      case "ready":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">Ready</span>;
      case "completed":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-900 text-slate-400 border border-slate-800">Completed</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-900 text-slate-400 border border-slate-800">{status}</span>;
    }
  };

  return (
    <div className="space-y-8">
      {/* Welcome banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-sora text-white">Operations Hub</h1>
          <p className="text-slate-400 text-sm mt-1">Live restaurant monitoring and order processing center.</p>
        </div>

        <div className="flex items-center gap-2 bg-slate-900/40 border border-[#23242B] rounded-xl px-3.5 py-1.5 text-xs text-slate-300">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Live Channel Active
        </div>
      </div>

      {/* METRICS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-[#0e0f14]/80 border border-[#23242B] rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3 text-slate-700">
            <DollarSign className="h-10 w-10 opacity-10" />
          </div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Today's Revenue</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold font-sora text-white">₹38,240</span>
            <span className="text-xs font-semibold text-emerald-400 flex items-center">
              <TrendingUp className="h-3 w-3 mr-0.5" />
              +14.2%
            </span>
          </div>
          <span className="text-[10px] text-slate-500 block mt-1">vs. last Sunday</span>
        </div>

        {/* Metric 2 */}
        <div className="bg-[#0e0f14]/80 border border-[#23242B] rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3 text-slate-700">
            <ShoppingBag className="h-10 w-10 opacity-10" />
          </div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Active Orders</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold font-sora text-white">
              {orders.filter(o => o.status !== "completed" && o.status !== "cancelled").length}
            </span>
            <span className="text-xs font-semibold text-violet-400">Tickets active</span>
          </div>
          <span className="text-[10px] text-slate-500 block mt-1">4 preparing, 1 pending</span>
        </div>

        {/* Metric 3 */}
        <div className="bg-[#0e0f14]/80 border border-[#23242B] rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3 text-slate-700">
            <Clock className="h-10 w-10 opacity-10" />
          </div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Avg. Preparation Time</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold font-sora text-white">14.8m</span>
            <span className="text-xs font-semibold text-emerald-400">-1.2m</span>
          </div>
          <span className="text-[10px] text-slate-500 block mt-1">Target is 15 minutes</span>
        </div>

        {/* Metric 4 */}
        <div className="bg-[#0e0f14]/80 border border-[#23242B] rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3 text-slate-700">
            <MessageSquare className="h-10 w-10 opacity-10" />
          </div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">WhatsApp Messages</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold font-sora text-white">184</span>
            <span className="text-xs font-semibold text-violet-400">92% AI Hit</span>
          </div>
          <span className="text-[10px] text-slate-500 block mt-1">0 manual interventions</span>
        </div>
      </div>

      {/* CORE WORKSPACE GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Live Order Queue List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-[#23242B]/40 pb-2">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-4.5 w-4.5 text-violet-400" />
              <h2 className="text-base font-bold font-sora text-white">Live Orders Dispatch</h2>
            </div>
            <span className="text-xs text-slate-500">{orders.length} orders total</span>
          </div>

          <div className="space-y-3.5">
            {orders.map((order) => (
              <div
                key={order.id}
                className="bg-[#0e0f14]/70 border border-[#23242B] rounded-2xl p-5 space-y-4 relative hover:border-slate-800 transition-all"
              >
                {/* Header of Order Card */}
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{order.id}</span>
                      <span className="text-xs text-slate-500">•</span>
                      <span className="text-xs text-slate-400 font-medium">
                        {order.source === "table" ? order.tableNo : order.customerPhone}
                      </span>
                      {order.source === "whatsapp" && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-950/40 text-emerald-400 text-[8px] font-bold uppercase tracking-wider border border-emerald-900/60">
                          WhatsApp
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 block">{order.time}</span>
                  </div>
                  {renderStatus(order.status)}
                </div>

                {/* Items and quantities */}
                <div className="space-y-2 border-t border-[#23242B]/30 pt-3">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs">
                      <span className="text-slate-300 font-medium">
                        <span className="text-slate-500 text-xs font-semibold mr-1.5">{item.quantity}x</span>
                        {item.name}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Footer of Order Card */}
                <div className="flex items-center justify-between border-t border-[#23242B]/30 pt-3.5">
                  <div className="text-xs text-slate-400">
                    Total: <span className="font-bold text-slate-200">₹{order.total}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button className="p-1.5 rounded-lg border border-[#23242B] text-slate-400 hover:text-white hover:bg-slate-900 transition-colors" title="Print KOT">
                      <Printer className="h-4.5 w-4.5" />
                    </button>
                    
                    {/* "pending" maps to paid or accepted in backend terms */}
                    {(order.status === "paid" || order.status === "accepted") && (
                      <button
                        onClick={() => handleUpdateStatus(order.backendId, order.id, "preparing")}
                        className="flex items-center gap-1 bg-violet-600 hover:bg-violet-500 text-white rounded-lg px-3 py-1.5 text-xs font-semibold"
                      >
                        <Play className="h-3 w-3 fill-white" />
                        Accept & Cook
                      </button>
                    )}

                    {order.status === "preparing" && (
                      <button
                        onClick={() => handleUpdateStatus(order.backendId, order.id, "ready")}
                        className="flex items-center gap-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg px-3 py-1.5 text-xs font-semibold"
                      >
                        <CheckCircle className="h-3 w-3" />
                        Mark Ready
                      </button>
                    )}

                    {order.status === "ready" && (
                      <button
                        onClick={() => handleUpdateStatus(order.backendId, order.id, "completed")}
                        className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg px-3 py-1.5 text-xs font-semibold"
                      >
                        <CheckCircle className="h-3 w-3" />
                        Mark Served
                      </button>
                    )}

                    {order.status === "completed" && (
                      <span className="text-xs text-slate-500 font-semibold px-2 py-1">Settled & Completed</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Side: Kitchen Queue & Recent Activity Log */}
        <div className="space-y-6">
          {/* Section 1: Kitchen Queue */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-[#23242B]/40 pb-2">
              <Clock className="h-4.5 w-4.5 text-amber-500" />
              <h2 className="text-base font-bold font-sora text-white">Active Kitchen Queue</h2>
            </div>
            
            <div className="bg-[#0e0f14]/60 border border-[#23242B] rounded-2xl p-4 divide-y divide-[#23242B]/40">
              {orders.filter(o => o.status === "preparing").length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500">
                  No items in preparation. Click "Accept & Cook" on pending orders.
                </div>
              ) : (
                orders
                  .filter(o => o.status === "preparing")
                  .map((order) => (
                    <div key={order.id} className="py-2.5 first:pt-0 last:pb-0 text-xs">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-slate-200">{order.id} ({order.tableNo || "WhatsApp"})</span>
                        <span className="text-[10px] text-slate-500">In cooking</span>
                      </div>
                      <div className="space-y-0.5">
                        {order.items.map((i, idx) => (
                          <div key={idx} className="text-slate-400 font-medium">
                            {i.quantity}x {i.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>

          {/* Section 2: Recent Activity log */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-[#23242B]/40 pb-2">
              <Sparkles className="h-4.5 w-4.5 text-violet-400" />
              <h2 className="text-base font-bold font-sora text-white">Automated AI Logs</h2>
            </div>

            <div className="space-y-2.5">
              {activities.map((act) => (
                <div
                  key={act.id}
                  className="bg-[#0e0f14]/40 border border-[#23242B]/30 rounded-xl p-3.5 text-xs flex items-start gap-2.5"
                >
                  <div
                    className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${
                      act.type === "ai"
                        ? "bg-violet-400"
                        : act.type === "payment"
                        ? "bg-emerald-400"
                        : act.type === "alert"
                        ? "bg-red-400 animate-pulse"
                        : "bg-slate-400"
                    }`}
                  />
                  <div className="space-y-1">
                    <p className="text-slate-300 font-medium leading-relaxed">{act.message}</p>
                    <span className="text-[10px] text-slate-500 block">{act.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
