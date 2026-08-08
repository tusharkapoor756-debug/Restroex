"use client";

// apps/dashboard/src/app/dashboard/kitchen/page.tsx
// Fullscreen Kitchen Display System (KDS Station) — Operational queue for kitchen staff.
// Features: High-contrast cards, privacy-focused operational details, live prep timers,
// audio chime alerts with mute toggle, single-tap state progression, and manager cancellation overrides.

import React, { useState, useEffect, useRef } from "react";
import { useToast } from "../../../components/ui/ToastContainer";
import Button from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";
import Skeleton from "../../../components/ui/Skeleton";
import {
  ChefHat,
  Clock,
  Volume2,
  VolumeX,
  Play,
  CheckCircle,
  CheckCheck,
  XCircle,
  Store,
  ShoppingBag,
  RefreshCw,
  Maximize2,
  Minimize2,
  AlertTriangle,
  FileText,
} from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

interface KitchenOrderItem {
  id: string;
  name: string;
  quantity: number;
  variantName?: string;
  selectedModifiers?: { name: string; price: number }[];
}

interface KitchenOrder {
  id: string;
  humanReadableId: string;
  status: "received" | "accepted" | "preparing" | "ready" | "completed" | "cancelled";
  orderType: "takeaway" | "dining";
  tableNumber?: number;
  notes?: string;
  items: KitchenOrderItem[];
  createdAt: string;
  preparingStartedAt?: string;
}

export default function KitchenKdsPage() {
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [activeFilter, setActiveFilter] = useState<"all" | "accepted" | "preparing" | "ready">("all");
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Cancellation Modal State
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  // Web Audio Context & Reconnection
  const audioCtxRef = useRef<AudioContext | null>(null);
  const reconnectDelayRef = useRef(1000);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Load audio preference from localStorage
    const savedAudio = localStorage.getItem("restroex_kds_audio");
    if (savedAudio !== null) {
      setAudioEnabled(savedAudio === "true");
    }

    fetchKitchenOrders();
    connectWebSocket();

    const interval = setInterval(() => {
      // Force UI tick to update live prep timers
      setOrders((prev) => [...prev]);
    }, 1000);

    return () => {
      clearInterval(interval);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const playChime = () => {
    if (!audioEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.2); // A5
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (_) {}
  };

  const connectWebSocket = () => {
    const session = JSON.parse(localStorage.getItem("restroex_session") || "{}");
    if (!session.restaurantId) return;

    const wsUrl = BACKEND_URL.replace(/^http/, "ws");
    const ws = new WebSocket(`${wsUrl}/ws?restaurantId=${session.restaurantId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectDelayRef.current = 1000; // Reset delay on clean connection
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.event === "ORDER_CREATED" || msg.event === "ORDER_UPDATED" || msg.type === "NEW_ORDER") {
          playChime();
          fetchKitchenOrders();
        }
      } catch (_) {}
    };

    ws.onclose = () => {
      // Exponential backoff reconnection (max 15s)
      const nextDelay = Math.min(reconnectDelayRef.current * 2, 15000);
      reconnectDelayRef.current = nextDelay;
      setTimeout(connectWebSocket, nextDelay);
    };
  };

  const getAuthHeaders = () => {
    if (typeof window === "undefined") return { "Content-Type": "application/json" };
    const session = JSON.parse(localStorage.getItem("restroex_session") || localStorage.getItem("restroex_dashboard_session") || "{}");
    const restId = session.restaurantId || session.restaurant?.id || localStorage.getItem("restroex_restaurant_id") || "d004cddc-dc64-420f-8621-cdbbffd1be8b";
    return {
      "Content-Type": "application/json",
      ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
      "x-restaurant-id": restId,
    };
  };

  const fetchKitchenOrders = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/orders/active`, {
        headers: getAuthHeaders(),
      });

      const json = await res.json();
      if (res.ok && json.data) {
        const rawOrders = Array.isArray(json.data) ? json.data : json.data.orders || [];
        const formatted: KitchenOrder[] = rawOrders
          .filter((o: any) => ["paid", "accepted", "preparing", "ready"].includes(o.status))
          .map((o: any) => ({
            id: o.id,
            humanReadableId: o.humanReadableId || o.human_readable_id || (o.humanReadableId?.startsWith("#") ? o.humanReadableId : `#${o.id.substring(0, 5).toUpperCase()}`),
            status: o.status === "paid" ? "accepted" : o.status,
            orderType: o.orderType || o.order_type || "takeaway",
            tableNumber: o.tableNumber || o.table_number,
            notes: o.notes || o.kitchen_notes,
            items: (o.items && o.items.length > 0
              ? o.items
              : o.receiptSnapshot?.items || o.receipt_snapshot?.items || []
            ).map((it: any) => ({
              id: it.id || it.menuItemId || it.menu_item_id,
              name: it.itemNameSnapshot || it.item_name_snapshot || it.name || it.item_name || it.menu_item_name || it.itemName || "Item",
              quantity: Number(it.quantity || 1),
              variantName: it.variantNameSnapshot || it.variant_name_snapshot || it.variantName || it.variant_name || null,
              selectedModifiers: Array.isArray(it.selectedModifiers)
                ? it.selectedModifiers
                : Array.isArray(it.customizations)
                ? it.customizations
                : Array.isArray(it.modifiers)
                ? it.modifiers
                : [],
            })),
            createdAt: o.createdAt || o.created_at,
            preparingStartedAt: o.preparingStartedAt || o.preparing_started_at,
          }));

        setOrders(formatted);
      }
    } catch (err) {
      console.error("Failed to fetch kitchen orders:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusTransition = async (orderId: string, targetStatus: KitchenOrder["status"]) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/orders/${orderId}/status`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: targetStatus }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Status update failed");

      toast.success("Order Updated", `Order status transitioned to ${targetStatus.toUpperCase()}`);
      fetchKitchenOrders();
    } catch (err: any) {
      toast.error("Transition Error", err.message || "Failed to update order status");
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelOrderId || !cancelReason.trim()) {
      toast.warning("Reason Required", "Please provide a cancellation reason.");
      return;
    }

    setCancelling(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/orders/${cancelOrderId}/status`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: "cancelled", cancellationReason: cancelReason }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Cancellation failed");

      toast.success("Order Cancelled", "Manager cancellation override logged.");
      setCancelOrderId(null);
      setCancelReason("");
      fetchKitchenOrders();
    } catch (err: any) {
      toast.error("Cancellation Error", err.message || "Could not cancel order");
    } finally {
      setCancelling(false);
    }
  };

  const toggleAudio = () => {
    const next = !audioEnabled;
    setAudioEnabled(next);
    localStorage.setItem("restroex_kds_audio", String(next));
    toast.info(next ? "Audio Alerts Enabled" : "Audio Alerts Muted");
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const formatPrepTimer = (startTimeStr?: string) => {
    if (!startTimeStr) return "00:00";
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(startTimeStr).getTime()) / 1000));
    const mins = Math.floor(elapsedSeconds / 60);
    const secs = elapsedSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const filteredOrders = orders.filter((o) => activeFilter === "all" || o.status === activeFilter);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 space-y-6 flex flex-col">
      {/* Top KDS Control Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <ChefHat className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-xl font-extrabold font-heading text-white flex items-center gap-2">
              <span>Kitchen Display Station</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono font-bold border border-emerald-500/30">
                LIVE
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Operational order queue for kitchen staff · Privacy mode active
            </p>
          </div>
        </div>

        {/* Filter Controls & System Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-bold">
            <button
              onClick={() => setActiveFilter("all")}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                activeFilter === "all" ? "bg-brand-600 text-white shadow-xs" : "text-slate-400 hover:text-white"
              }`}
            >
              All ({orders.length})
            </button>
            <button
              onClick={() => setActiveFilter("accepted")}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                activeFilter === "accepted" ? "bg-amber-500 text-white shadow-xs" : "text-slate-400 hover:text-white"
              }`}
            >
              Accepted ({orders.filter((o) => o.status === "accepted").length})
            </button>
            <button
              onClick={() => setActiveFilter("preparing")}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                activeFilter === "preparing" ? "bg-blue-600 text-white shadow-xs" : "text-slate-400 hover:text-white"
              }`}
            >
              Preparing ({orders.filter((o) => o.status === "preparing").length})
            </button>
            <button
              onClick={() => setActiveFilter("ready")}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                activeFilter === "ready" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-400 hover:text-white"
              }`}
            >
              Ready ({orders.filter((o) => o.status === "ready").length})
            </button>
          </div>

          <button
            onClick={toggleAudio}
            className={`p-2.5 rounded-xl border transition cursor-pointer ${
              audioEnabled
                ? "bg-slate-900 border-slate-800 text-emerald-400 hover:bg-slate-800"
                : "bg-slate-900 border-slate-800 text-slate-500 hover:bg-slate-800"
            }`}
            title={audioEnabled ? "Mute Kitchen Chime" : "Enable Kitchen Chime"}
          >
            {audioEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 transition cursor-pointer"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>

          <button
            onClick={fetchKitchenOrders}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 transition cursor-pointer"
            title="Refresh KDS Queue"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main KDS Orders Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <Skeleton className="h-72 rounded-2xl bg-slate-900" />
          <Skeleton className="h-72 rounded-2xl bg-slate-900" />
          <Skeleton className="h-72 rounded-2xl bg-slate-900" />
        </div>
      ) : filteredOrders.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 flex-1 items-start">
          {filteredOrders.map((order) => {
            const isPreparing = order.status === "preparing";
            const isReady = order.status === "ready";
            const isAccepted = order.status === "accepted";

            return (
              <div
                key={order.id}
                className={`rounded-2xl border-2 overflow-hidden flex flex-col transition-all shadow-lg ${
                  isReady
                    ? "bg-slate-900 border-emerald-500/80 shadow-emerald-500/10"
                    : isPreparing
                    ? "bg-slate-900 border-blue-500/80 shadow-blue-500/10"
                    : "bg-slate-900 border-amber-500/80 shadow-amber-500/10"
                }`}
              >
                {/* Card Header Bar */}
                <div
                  className={`p-3 flex items-center justify-between border-b ${
                    isReady
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                      : isPreparing
                      ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                      : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base font-black font-mono tracking-tight text-white">
                      #{order.humanReadableId}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                        order.orderType === "dining"
                          ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                          : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      }`}
                    >
                      {order.orderType === "dining"
                        ? `Table #${order.tableNumber || 1}`
                        : "Takeaway Pickup"}
                    </span>
                  </div>

                  {/* Live Preparation Timer */}
                  {isPreparing && (
                    <div className="flex items-center gap-1 font-mono text-xs font-bold text-blue-400 bg-blue-950 px-2 py-1 rounded-lg border border-blue-800">
                      <Clock className="h-3.5 w-3.5 animate-spin" />
                      <span>{formatPrepTimer(order.preparingStartedAt)}</span>
                    </div>
                  )}
                </div>

                {/* Card Items List */}
                <div className="p-4 space-y-3 flex-1">
                  <div className="space-y-2">
                    {order.items.map((it, idx) => (
                      <div
                        key={idx}
                        className="flex items-start justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <span className="w-6 h-6 rounded-lg bg-slate-800 text-white font-extrabold font-mono flex items-center justify-center shrink-0">
                            {it.quantity}x
                          </span>
                          <div className="min-w-0">
                            <span className="font-extrabold text-slate-100 text-sm block truncate">
                              {it.name}
                            </span>
                            {it.variantName && (
                              <span className="text-[10px] font-bold text-amber-400 block">
                                Variant: {it.variantName}
                              </span>
                            )}
                            {it.selectedModifiers && it.selectedModifiers.length > 0 && (
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                Add-ons: {it.selectedModifiers.map((m) => m.name).join(", ")}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Cooking Notes */}
                  {order.notes && (
                    <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-800/40 text-amber-300 text-xs font-medium flex items-start gap-2">
                      <FileText className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
                      <div>
                        <span className="font-bold block text-[10px] uppercase text-amber-400">
                          Kitchen Instructions:
                        </span>
                        <span>{order.notes}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Action Buttons (Single-Tap Progression) */}
                <div className="p-3 border-t border-slate-800 bg-slate-950/40 space-y-2">
                  {isAccepted && (
                    <button
                      onClick={() => handleStatusTransition(order.id, "preparing")}
                      className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
                    >
                      <Play className="h-4 w-4 fill-white" />
                      <span>Start Cooking</span>
                    </button>
                  )}

                  {isPreparing && (
                    <button
                      onClick={() => handleStatusTransition(order.id, "ready")}
                      className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
                    >
                      <CheckCircle className="h-4 w-4" />
                      <span>Mark Ready</span>
                    </button>
                  )}

                  {isReady && (
                    <button
                      onClick={() => handleStatusTransition(order.id, "completed")}
                      className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition cursor-pointer"
                    >
                      <CheckCheck className="h-4 w-4 text-emerald-400" />
                      <span>Handed / Completed</span>
                    </button>
                  )}

                  {/* Manager Cancellation Button */}
                  <button
                    onClick={() => setCancelOrderId(order.id)}
                    className="w-full py-1.5 text-[10px] font-bold text-slate-500 hover:text-red-400 transition cursor-pointer flex items-center justify-center gap-1"
                  >
                    <XCircle className="h-3 w-3" />
                    <span>Cancel Order</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-slate-800 rounded-3xl">
          <ChefHat className="h-16 w-16 text-slate-700 mb-4" />
          <h3 className="text-lg font-extrabold text-slate-300 font-heading">
            Kitchen Queue Clear
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mt-1">
            No active orders in state ACCEPTED, PREPARING, or READY. New incoming orders will sound an audio chime automatically.
          </p>
        </div>
      )}

      {/* Post-Cooking Manager Cancellation Drawer */}
      {cancelOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 text-white p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <span className="p-2 rounded-xl bg-red-500/10 text-red-400">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-sm font-extrabold font-heading">
                  Cancel Active Order
                </h3>
                <p className="text-xs text-slate-400">
                  Post-cooking cancellation requires an audit reason.
                </p>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                Mandatory Cancellation Reason
              </label>
              <textarea
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Item out of stock / Customer requested cancellation"
                className="w-full p-3 rounded-xl border border-slate-800 bg-slate-950 text-xs font-medium text-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setCancelOrderId(null);
                  setCancelReason("");
                }}
                className="px-4 py-2 rounded-xl border border-slate-800 text-xs font-bold text-slate-400 hover:bg-slate-800 transition cursor-pointer"
              >
                Back
              </button>
              <Button
                onClick={handleConfirmCancel}
                isLoading={cancelling}
                className="bg-red-600 hover:bg-red-700 font-bold text-xs px-5"
              >
                Confirm Cancellation
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
