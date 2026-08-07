"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { OrdersService } from "../../../lib/services/orders.service";
import { PaymentsService } from "../../../lib/services/payments.service";
import { Order as BackendOrder, WorkflowOrderStatus, Payment } from "../../../types";
import { useToast } from "../../../components/ui/ToastContainer";
import Button from "../../../components/ui/Button";
import Badge from "../../../components/ui/Badge";
import Card from "../../../components/ui/Card";
import Skeleton, { CardSkeleton } from "../../../components/ui/Skeleton";
import { EmptyState, ErrorState } from "../../../components/ui/StateViews";
import { Modal, Sheet } from "../../../components/ui/Modal";
import {
  ShoppingBag,
  Clock,
  MessageSquare,
  CheckCircle,
  Play,
  CheckCircle2,
  Printer,
  BellRing,
  Volume2,
  VolumeX,
  Phone,
  User,
  Utensils,
  ChevronRight,
  Sparkles,
  AlertCircle,
  FileText,
  Eye,
  XCircle,
  RefreshCw,
  Search
} from "lucide-react";

interface OrderItem {
  name: string;
  variantName?: string;
  quantity: number;
  price: number;
}

interface KanbanOrder {
  id: string;
  backendId: string;
  customerPhone?: string;
  customerName?: string;
  customerAddress?: string;
  items: OrderItem[];
  totalAmount: number;
  status: WorkflowOrderStatus | "checkout_pending" | "paid" | "payment_pending";
  createdAt: string;
  createdAtTimestamp: number;
  minutesAgo: number;
  payment?: Payment;
  orderType?: string;
  tableNumber?: number | null;
  notes?: string | null;
}

const KANBAN_COLUMNS: { id: string; label: string; statuses: string[]; color: "info" | "warning" | "brand" | "success" }[] = [
  { id: "new", label: "🟡 New Tickets", statuses: ["paid", "checkout_pending", "payment_pending", "cart_active"], color: "info" },
  { id: "preparing", label: "🟠 Preparing", statuses: ["accepted", "preparing"], color: "warning" },
  { id: "ready", label: "🟢 Ready to Serve", statuses: ["ready"], color: "success" },
];

export default function KanbanLiveOrdersPage() {
  const toast = useToast();
  const [orders, setOrders] = useState<KanbanOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<KanbanOrder | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const soundEnabledRef = useRef(true);
  const [newOrderPulseId, setNewOrderPulseId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [filterQuery, setFilterQuery] = useState<string>("");
  // Cancel reason modal state
  const [cancelTargetOrder, setCancelTargetOrder] = useState<KanbanOrder | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState<string>("");
  const [isCancelling, setIsCancelling] = useState(false);
  const previousOrdersRef = useRef<string[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Sync soundEnabled state with ref
  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  // Guaranteed Audio Siren Sound Player (HTML5 Audio + Web Audio API Synthesis)
  const playAlertChime = useCallback(() => {
    if (!soundEnabledRef.current) {
      console.log("[Restroex Audio] Alert siren suppressed (sound is OFF)");
      return;
    }

    // Method 1: HTML5 Audio Notification Element Fallback
    try {
      const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
      audio.volume = 1.0;
      audio.play().catch((err) => {
        console.warn("[Restroex Audio] HTML5 Audio play deferred:", err);
      });
    } catch (e) {
      console.warn("[Restroex Audio] HTML5 Audio init error:", e);
    }

    // Method 2: Web Audio API Synthesized Siren
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = audioContextRef.current || new AudioCtx();
        if (ctx.state === "suspended") {
          ctx.resume();
        }

        const playBeep = (freq1: number, freq2: number, startTime: number, duration: number) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(freq1, startTime);
          osc.frequency.exponentialRampToValueAtTime(freq2, startTime + duration);

          gain.gain.setValueAtTime(1.0, startTime);
          gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(startTime);
          osc.stop(startTime + duration);
        };

        const now = ctx.currentTime;
        playBeep(659.25, 880, now, 0.3);
        playBeep(659.25, 880, now + 0.35, 0.3);
        playBeep(880, 1174.66, now + 0.7, 0.5);
      }
    } catch (e) {
      console.warn("[Restroex Audio] Web Audio siren error:", e);
    }
  }, []);

  const toggleSound = () => {
    const nextState = !soundEnabled;
    setSoundEnabled(nextState);
    soundEnabledRef.current = nextState;
    if (nextState) {
      playAlertChime();
      toast.info("Sound Alert Enabled", "Test chime played. New orders will play sound.");
    } else {
      toast.warning("Sound Muted", "Audio chime turned off.");
    }
  };

  const fetchOrders = async (isInitial = false) => {
    try {
      if (isInitial) setIsLoading(true);
      setIsError(false);
      const data = await OrdersService.getActiveOrders();
      const now = Date.now();

      /**
       * Supabase returns timestamps WITHOUT the Z suffix
       * e.g. "2026-08-05T02:17:58.969" instead of "2026-08-05T02:17:58.969Z"
       * Without Z, JS Date() parses it as LOCAL time (IST = UTC+5:30),
       * inflating minutesAgo by 330 minutes for IST users.
       * Fix: append Z if no timezone info is present.
       */
      const toUtcMs = (ts: string): number => {
        if (!ts) return now;
        const normalized = ts.endsWith("Z") || ts.includes("+") || (ts.includes("-") && ts.lastIndexOf("-") > 7)
          ? ts
          : ts + "Z";
        return new Date(normalized).getTime();
      };

      const mapped: KanbanOrder[] = data.map((o) => {
        const createdMs = toUtcMs(o.createdAt);
        const minutesAgo = Math.max(0, Math.floor((now - createdMs) / 60000));
        return {
          id: o.humanReadableId || o.id.substring(0, 8),
          backendId: o.id,
          customerPhone: o.customerPhone,
          customerName: o.customerName || undefined,
          customerAddress: o.customerAddress || undefined,
          items: o.items?.map((i) => ({
            name: i.itemNameSnapshot,
            variantName: i.variantNameSnapshot,
            quantity: i.quantity,
            price: i.unitPrice,
          })) || [],
          totalAmount: o.totalAmount,
          status: o.status as any,
          createdAt: new Date(o.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          createdAtTimestamp: createdMs,
          minutesAgo,
          payment: o.payment,
          orderType: o.orderType || "takeaway",
          tableNumber: o.tableNumber,
          notes: (o as any).notes || null,
        };
      });

      // ── CONTINUOUS ALARM LOOP FOR UNACCEPTED NEW ORDERS ──
      // Checks if any order is waiting in NEW status ('checkout_pending', 'paid', 'payment_pending', 'cart_active')
      const hasUnacceptedOrders = mapped.some((o) =>
        ["checkout_pending", "paid", "payment_pending", "cart_active"].includes(o.status)
      );

      if (hasUnacceptedOrders && soundEnabled) {
        // Trigger alert beep for unaccepted tickets
        playAlertChime();

        const newUnaccepted = mapped.find((m) =>
          ["checkout_pending", "paid", "payment_pending"].includes(m.status) &&
          !previousOrdersRef.current.includes(m.backendId)
        );

        if (newUnaccepted) {
          setNewOrderPulseId(newUnaccepted.backendId);
          toast.success(`New Unaccepted Order #${newUnaccepted.id}`, `Accept now to silence siren! Total: ₹${newUnaccepted.totalAmount}`);
          
          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            new Notification(`Restroex Siren Alert: Order #${newUnaccepted.id}`, {
              body: `Total: ₹${newUnaccepted.totalAmount} | Awaiting Staff Acceptance`,
              icon: "/favicon.ico",
            });
          }
        }
      }

      previousOrdersRef.current = mapped.map((m) => m.backendId);
      setOrders(mapped);
    } catch (err) {
      console.error("Failed to load Kanban live orders:", err);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders(true);
    // Poll every 3 seconds to check unaccepted queue and keep ringing siren until accepted
    const interval = setInterval(() => fetchOrders(false), 3000);
    
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    return () => clearInterval(interval);
  }, []);

  // Transition Order status handler with Optimistic UI
  const handleTransition = async (backendId: string, orderId: string, nextStatus: WorkflowOrderStatus, cancellationReason?: string) => {
    // Optimistic state mutation
    setOrders((prev) =>
      prev.map((o) => (o.backendId === backendId ? { ...o, status: nextStatus } : o))
    );

    if (selectedOrder && selectedOrder.backendId === backendId) {
      setSelectedOrder((prev) => (prev ? { ...prev, status: nextStatus } : null));
    }

    try {
      await OrdersService.transitionOrder(backendId, nextStatus, cancellationReason);
      toast.success(`Order #${orderId} Updated`, `Status changed to ${nextStatus}`);
    } catch (err: any) {
      toast.error("Status Change Failed", err.message || "Failed to update order status");
      fetchOrders(false); // Revert on failure
    }
  };

  // Opens the cancel reason modal (never cancels directly)
  const openCancelModal = (order: KanbanOrder) => {
    setCancelTargetOrder(order);
    setCancelReason("");
    setIsCancelModalOpen(true);
  };

  // Executes the cancel after reason is selected
  const confirmCancel = async () => {
    if (!cancelTargetOrder) return;
    if (!cancelReason.trim()) {
      toast.error("Reason Required", "Please select a cancellation reason.");
      return;
    }
    setIsCancelling(true);
    try {
      await handleTransition(cancelTargetOrder.backendId, cancelTargetOrder.id, "cancelled", cancelReason);
      setIsCancelModalOpen(false);
      setIsSheetOpen(false);
      toast.warning(`Order #${cancelTargetOrder.id} Cancelled`, `Reason: ${cancelReason}`);
    } finally {
      setIsCancelling(false);
      setCancelTargetOrder(null);
    }
  };

  const renderColumnContent = (colStatuses: string[]) => {
    let colOrders = orders.filter((o) => colStatuses.includes(o.status));

    if (filterQuery.trim()) {
      const q = filterQuery.toLowerCase();
      colOrders = colOrders.filter((o) => {
        const idMatch = o.id.toLowerCase().includes(q);
        const phoneMatch = o.customerPhone?.toLowerCase().includes(q);
        const nameMatch = o.customerName?.toLowerCase().includes(q);
        const tableMatch = o.tableNumber ? String(o.tableNumber).includes(q) : false;
        const notesMatch = o.notes?.toLowerCase().includes(q);
        const itemMatch = o.items.some((i) => i.name.toLowerCase().includes(q));
        return idMatch || phoneMatch || nameMatch || tableMatch || notesMatch || itemMatch;
      });
    }

    // Sort oldest-first so most urgent orders surface to the top
    colOrders = [...colOrders].sort((a, b) => a.createdAtTimestamp - b.createdAtTimestamp);

    if (colOrders.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center p-6 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 my-2">
          <ShoppingBag className="h-6 w-6 text-slate-400 dark:text-slate-600 mb-1.5" />
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">No Matching Tickets</span>
        </div>
      );
    }

    return colOrders.map((order) => {
      const isPulsing = newOrderPulseId === order.backendId;
      const isPaid = order.status === "paid" || String(order.payment?.paymentStatus) === "verified" || String(order.payment?.paymentStatus) === "captured";
      const isUrgent = order.minutesAgo >= 10; // 10+ min threshold for red alert
      const isNewTicket = ["checkout_pending", "paid", "payment_pending", "cart_active"].includes(order.status);

      return (
        <Card
          key={order.backendId}
          clickable
          onClick={() => {
            setSelectedOrder(order);
            setIsSheetOpen(true);
          }}
          className={`space-y-3 relative p-4 transition-all duration-300 border-l-4 ${
            isUrgent
              ? "border-l-red-500 bg-red-50/20 dark:bg-red-950/10"
              : isPaid
              ? "border-l-emerald-500"
              : "border-l-amber-500"
          } ${
            isNewTicket
              ? "animate-ticket-float animate-ticket-glow bg-gradient-to-b from-brand-50/40 to-transparent dark:from-brand-950/20 dark:to-transparent"
              : "hover:-translate-y-1 hover:shadow-md"
          } ${
            isPulsing ? "ring-2 ring-brand-500 animate-pulse-glow" : ""
          } ${
            isUrgent ? "ring-1 ring-red-400/40 dark:ring-red-500/30" : ""
          }`}
        >
          {/* Card Header: Order ID, Dining/Takeaway Tag, Timer & Payment Status */}
          <div className="space-y-2">
            {isNewTicket && (
              <div className="flex items-center justify-between bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider animate-beacon">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                  🚨 ACTION REQUIRED: ACCEPT TICKET
                </span>
                <span className="font-mono text-amber-600 dark:text-amber-400">UNACCEPTED</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="font-heading font-black text-base text-slate-900 dark:text-slate-100 tracking-tight">
                #{order.id}
              </span>
              <div className="flex items-center gap-1.5">
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider ${
                  isPaid 
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30" 
                    : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                }`}>
                  {isPaid ? "PAID ✓" : "UNPAID"}
                </span>
                {/* Time-pending badge: red + ⚠️ if 10+ min, neutral otherwise */}
                <span className={`text-[11px] font-bold flex items-center gap-0.5 px-1.5 py-0.5 rounded-full ${
                  isUrgent
                    ? "bg-red-500/15 text-red-600 dark:text-red-400 border border-red-400/40 animate-pulse"
                    : "text-slate-400 dark:text-slate-500"
                }`}>
                  {isUrgent ? <AlertCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                  {order.minutesAgo === 0 ? "Just now" : `${order.minutesAgo}m`}
                </span>
              </div>
            </div>

            {/* Sub-Header: Order Type & Table Pill */}
            <div className="flex items-center gap-2">
              {order.orderType === "dining" ? (
                <span className="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center gap-1">
                  🍽️ Table #{order.tableNumber || "?"}
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center gap-1">
                  🥡 TAKEAWAY
                </span>
              )}
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                {order.customerPhone ? order.customerPhone.split('@')[0] : "Customer"}
              </span>
            </div>

            {/* Live Preparation Timer for Preparing Tickets */}
            {(order.status === "preparing" || order.status === "accepted") && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Kitchen Prep Timer:</span>
                <span className={`text-xs font-mono font-black px-2 py-0.5 rounded-md flex items-center gap-1 ${
                  order.minutesAgo < 10
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                    : order.minutesAgo < 20
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                    : "bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/40 animate-pulse"
                }`}>
                  <Clock className="h-3 w-3" />
                  <span>⏱ {String(Math.floor(order.minutesAgo)).padStart(2, '0')}:00 ({order.minutesAgo}m)</span>
                </span>
              </div>
            )}
          </div>

          {/* Item Breakdown List */}
          <div className="space-y-1.5 py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800 text-xs">
            {order.items && order.items.length > 0 ? (
              order.items.map((item, i) => (
                <div key={i} className="flex justify-between items-center text-slate-800 dark:text-slate-200 py-0.5">
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <span className="font-black text-xs text-brand-600 dark:text-brand-400 bg-brand-500/10 px-1.5 py-0.5 rounded-md shrink-0">
                      {item.quantity}x
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap truncate">
                      <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                        {item.name}
                      </span>
                      {item.variantName && (
                        <span className="px-1.5 py-0.2 text-[10px] font-extrabold bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/25 rounded-md uppercase tracking-wider">
                          ({item.variantName})
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="font-semibold text-slate-500 dark:text-slate-400 text-xs shrink-0">
                    ₹{item.price * item.quantity}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-[11px] italic text-slate-400 py-1 text-center">Loading item details...</div>
            )}
          </div>

          {/* Customer Special Cooking Instructions (Only shown if provided) */}
          {order.notes && order.notes.trim() ? (
            <div className="text-xs p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 space-y-0.5">
              <span className="font-black uppercase tracking-wider text-[10px] text-amber-600 dark:text-amber-400 block">
                📝 Kitchen Note:
              </span>
              <p className="font-semibold text-xs leading-snug">{order.notes}</p>
            </div>
          ) : null}

          {/* Card Footer: Total Amount & Action Button */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Total Amount</span>
              <span className="font-heading font-black text-base text-slate-900 dark:text-slate-100">
                ₹{order.totalAmount}
              </span>
            </div>

            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              {/* ACTION 1: Accept Order (Jumps directly NEW → PREPARING) */}
              {(order.status === "paid" || order.status === "checkout_pending" || order.status === "payment_pending" || (order.status as string) === "cart_active") && (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => handleTransition(order.backendId, order.id, "preparing")}
                  className="gap-1.5 px-4 py-2 font-extrabold shadow-lg bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white animate-pulse border-0"
                >
                  <CheckCircle2 className="h-4 w-4 fill-white text-emerald-600" />
                  <span>✅ ACCEPT ORDER</span>
                </Button>
              )}

              {/* ACTION 2: Mark Ready (PREPARING → READY) */}
              {(order.status === "preparing" || order.status === "accepted") && (
                <Button
                  size="sm"
                  variant="success"
                  onClick={() => handleTransition(order.backendId, order.id, "ready")}
                  className="gap-1 px-4 font-bold"
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  <span>✅ Ready</span>
                </Button>
              )}

              {/* Auto-Archived Action when Ready */}
              {order.status === "ready" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleTransition(order.backendId, order.id, "completed")}
                  className="gap-1 px-4 font-bold text-emerald-600 dark:text-emerald-400"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Handover / Serve</span>
                </Button>
              )}

              {/* Cancel button — always visible on non-completed orders */}
              {!["completed", "cancelled"].includes(order.status) && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => { e.stopPropagation(); openCancelModal(order); }}
                  className="h-7 w-7 p-0 text-red-500 hover:bg-red-500/10 rounded-lg"
                  title="Cancel Order"
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </Card>
      );
    });
  };

  return (
    <div className="space-y-6">
      
      {/* 4 STATES HANDLING MANDATORY RULE */}
      {/* STATE 3: ERROR STATE */}
      {isError && (
        <ErrorState
          title="Live Orders Load Fail Ho Gaya"
          message="Server connect nahi ho pa raha hai. Please connection check karein."
          onRetry={() => fetchOrders(true)}
        />
      )}

      {/* STATE 1: INITIAL LOADING STATE (Content Shaped Skeletons) */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-4">
              <Skeleton className="h-8 w-full rounded-xl" />
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Header Controls & Live Search */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="font-heading text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                    Live Kitchen KOT Board
                  </h1>
                  <Badge variant="success" pulse size="sm" className="font-bold">
                    LIVE POLLED
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Real-time POS & WhatsApp Kitchen Display System (KDS)
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* Search Bar */}
                <div className="relative flex-1 sm:w-56">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={filterQuery}
                    onChange={(e) => setFilterQuery(e.target.value)}
                    placeholder="Search #ORD, item, table..."
                    className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>

                {/* Sound alert toggle */}
                <Button
                  variant={soundEnabled ? "secondary" : "ghost"}
                  size="sm"
                  onClick={toggleSound}
                  className="gap-1.5 font-semibold text-xs h-8 px-2.5"
                >
                  {soundEnabled ? <Volume2 className="h-3.5 w-3.5 text-emerald-500" /> : <VolumeX className="h-3.5 w-3.5 text-slate-400" />}
                  <span className="hidden xs:inline">{soundEnabled ? "Sound ON" : "Sound OFF"}</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchOrders(false)}
                  className="gap-1 h-8 px-2.5"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span className="hidden xs:inline">Refresh</span>
                </Button>
              </div>
            </div>

            {/* Mobile & Tablet Responsive Status Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none lg:hidden">
              <button
                onClick={() => setActiveTab("all")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                  activeTab === "all"
                    ? "bg-brand-600 text-white shadow-sm"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                }`}
              >
                All Orders ({orders.length})
              </button>
              {KANBAN_COLUMNS.map((col) => {
                const count = orders.filter((o) => col.statuses.includes(o.status)).length;
                return (
                  <button
                    key={col.id}
                    onClick={() => setActiveTab(col.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer ${
                      activeTab === col.id
                        ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                    }`}
                  >
                    <span>{col.label}</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/10 dark:bg-white/20">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* STATE 2: EMPTY STATE (If zero orders across system) */}
          {orders.length === 0 ? (
            <EmptyState
              icon={<ShoppingBag className="h-8 w-8 text-brand-600" />}
              title="No Active Orders"
              description="New orders will appear here automatically with sound chime alerts as soon as a customer places one on WhatsApp."
              actionLabel="Refresh Board"
              onAction={() => fetchOrders(true)}
            />
          ) : (
            /* STATE 4: POPULATED STATE (Responsive Kanban — 3 Column Layout) */
            <div className="w-full overflow-x-auto pb-4 lg:overflow-x-visible">
              <div className="flex gap-4 lg:grid lg:grid-cols-3 items-start min-w-max lg:min-w-0">
              {KANBAN_COLUMNS.filter((col) => activeTab === "all" || activeTab === col.id).map((col) => {
                const count = orders.filter((o) => col.statuses.includes(o.status)).length;
                return (
                  <div
                    key={col.id}
                    className="flex flex-col rounded-2xl bg-slate-100/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 p-3 space-y-3 min-h-[70vh] w-80 lg:w-auto shrink-0 lg:shrink"
                  >
                    {/* Column Header */}
                    <div className="flex items-center justify-between px-1 pb-1">
                      <span className="font-heading font-extrabold text-xs text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                        {col.label}
                      </span>
                      <Badge variant={col.color} size="sm">
                        {count}
                      </Badge>
                    </div>

                    {/* Column Cards */}
                    <div className="space-y-3 flex-1 overflow-y-auto max-h-[75vh]">
                      {renderColumnContent(col.statuses)}
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Order Detail Slide-Over Sheet (Click on Card) */}
      <Sheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        title={selectedOrder ? `Order #${selectedOrder.id}` : "Order Details"}
      >
        {selectedOrder && (
          <div className="space-y-6 text-sm">
            {/* Order Mode & Status Bar */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-brand-50/50 dark:bg-brand-950/30 border border-brand-200/80 dark:border-brand-800/80">
              <div>
                <span className="text-xs text-brand-600 dark:text-brand-400 font-semibold block uppercase tracking-wider">
                  Order Type & Location
                </span>
                <span className="font-heading font-extrabold text-base text-slate-900 dark:text-slate-100 flex items-center gap-1.5 mt-0.5">
                  {selectedOrder.orderType === "dining" ? (
                    <>🍽️ DINING — Table #{selectedOrder.tableNumber || "N/A"}</>
                  ) : (
                    <>🥡 TAKEAWAY / PACK</>
                  )}
                </span>
              </div>
              <Badge variant="brand" size="lg" className="uppercase font-bold">
                {selectedOrder.status}
              </Badge>
            </div>

            {/* Customer Details Box */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2">
              <h4 className="font-heading font-bold text-xs uppercase text-slate-500 tracking-wider">
                Customer Information
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block">Name</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {selectedOrder.customerName || "WhatsApp Customer"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Phone</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {selectedOrder.customerPhone || "N/A"}
                  </span>
                </div>
                {selectedOrder.customerAddress && (
                  <div className="col-span-2">
                    <span className="text-slate-400 block">Delivery Address</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {selectedOrder.customerAddress}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Special Instructions / Cooking Notes */}
            <div className="p-4 rounded-2xl bg-amber-500/10 dark:bg-amber-950/20 border border-amber-500/30 text-xs space-y-1">
              <h4 className="font-heading font-bold text-xs uppercase text-amber-600 dark:text-amber-400 tracking-wider flex items-center gap-1.5">
                <span>📝 Special Cooking Instructions</span>
              </h4>
              <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm pt-0.5">
                {selectedOrder.notes && selectedOrder.notes.trim() ? selectedOrder.notes : "No special instructions"}
              </p>
            </div>

            {/* Item Breakdown */}
            <div className="space-y-3">
              <h4 className="font-heading font-bold text-xs uppercase text-slate-500 tracking-wider">
                Itemized Order Bill
              </h4>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-950 p-4">
                {selectedOrder.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center py-2.5 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-slate-900 dark:text-slate-100">{item.quantity}x</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{item.name}</span>
                      {item.variantName && (
                        <span className="px-2 py-0.5 text-xs font-black bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30 rounded-md uppercase tracking-wider">
                          ({item.variantName})
                        </span>
                      )}
                    </div>
                    <span className="font-extrabold text-slate-900 dark:text-slate-100">
                      ₹{item.price * item.quantity}
                    </span>
                  </div>
                ))}
                <div className="pt-3 mt-2 flex justify-between font-heading font-extrabold text-base text-slate-900 dark:text-slate-100">
                  <span>Grand Total</span>
                  <span>₹{selectedOrder.totalAmount}</span>
                </div>
              </div>
            </div>

            {/* Quick Action Button Contextual to Status */}
            <div className="space-y-2 pt-2">
              <Button
                variant="primary"
                className="w-full h-12 text-sm font-bold"
                onClick={() => {
                  const nextMap: Record<string, WorkflowOrderStatus> = {
                    paid: "accepted",
                    checkout_pending: "accepted",
                    accepted: "preparing",
                    preparing: "ready",
                    ready: "completed",
                  };
                  const next = nextMap[selectedOrder.status] || "completed";
                  handleTransition(selectedOrder.backendId, selectedOrder.id, next);
                  setIsSheetOpen(false);
                }}
              >
                Progress Order State →
              </Button>
              {!["completed", "cancelled"].includes(selectedOrder.status) && (
                <Button
                  variant="danger"
                  className="w-full text-xs"
                  onClick={() => openCancelModal(selectedOrder)}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Cancel Order
                </Button>
              )}
            </div>
          </div>
        )}
      </Sheet>

      {/* ═══════════════════════════════════════════════════
           CANCEL REASON MODAL
           Staff must pick a reason before cancelling.
           Reason is forwarded to customer via WhatsApp.
      ═══════════════════════════════════════════════════ */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => { setIsCancelModalOpen(false); setCancelTargetOrder(null); }}
        title={`Cancel Order #${cancelTargetOrder?.id ?? ""}`}
      >
        <div className="space-y-5 pt-1">
          {/* Warning Banner */}
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-400/30">
            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-bold text-red-600 dark:text-red-400">This will cancel the order.</p>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                The customer will receive a WhatsApp message with your selected reason.
              </p>
            </div>
          </div>

          {/* Reason Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Cancellation Reason <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {[
                "Item out of stock",
                "Kitchen is too busy",
                "Restaurant closing soon",
                "Customer requested cancellation",
                "Incorrect order details",
                "Other",
              ].map((reason) => (
                <button
                  key={reason}
                  onClick={() => setCancelReason(reason)}
                  className={`w-full text-left px-4 py-3 rounded-xl text-sm font-semibold border transition-all ${
                    cancelReason === reason
                      ? "bg-red-500/10 border-red-400/60 text-red-600 dark:text-red-400 ring-1 ring-red-400/40"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  {cancelReason === reason ? "✓ " : ""}{reason}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-1">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => { setIsCancelModalOpen(false); setCancelTargetOrder(null); }}
            >
              Keep Order
            </Button>
            <Button
              variant="danger"
              className="flex-1 font-bold"
              onClick={confirmCancel}
              disabled={isCancelling || !cancelReason}
            >
              {isCancelling ? "Cancelling..." : "Confirm Cancel"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
