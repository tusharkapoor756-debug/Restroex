"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
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
  quantity: number;
  price: number;
}

interface KanbanOrder {
  id: string;
  backendId: string;
  customerPhone?: string;
  customerName?: string;
  items: OrderItem[];
  totalAmount: number;
  status: WorkflowOrderStatus | "checkout_pending" | "paid" | "payment_pending";
  createdAt: string;
  createdAtTimestamp: number;
  minutesAgo: number;
  payment?: Payment;
}

const KANBAN_COLUMNS: { id: string; label: string; statuses: string[]; color: "info" | "warning" | "brand" | "success" }[] = [
  { id: "new", label: "New Tickets", statuses: ["paid", "checkout_pending", "payment_pending", "cart_active"], color: "info" },
  { id: "confirmed", label: "Confirmed", statuses: ["accepted"], color: "brand" },
  { id: "preparing", label: "Preparing", statuses: ["preparing"], color: "warning" },
  { id: "ready", label: "Ready to Serve", statuses: ["ready"], color: "success" },
  { id: "completed", label: "Completed", statuses: ["completed", "delivered"], color: "info" },
];

export default function KanbanLiveOrdersPage() {
  const toast = useToast();
  const [orders, setOrders] = useState<KanbanOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<KanbanOrder | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [newOrderPulseId, setNewOrderPulseId] = useState<string | null>(null);
  const previousOrdersRef = useRef<string[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize Web Audio chime sound
  const playAlertChime = () => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
      console.warn("Audio chime playback error:", e);
    }
  };

  const fetchOrders = async (isInitial = false) => {
    try {
      if (isInitial) setIsLoading(true);
      setIsError(false);
      const data = await OrdersService.getActiveOrders();
      const now = Date.now();

      const mapped: KanbanOrder[] = data.map((o) => {
        const createdMs = new Date(o.createdAt).getTime();
        const minutesAgo = Math.max(0, Math.floor((now - createdMs) / 60000));
        return {
          id: o.humanReadableId || o.id.substring(0, 8),
          backendId: o.id,
          customerPhone: o.customerPhone,
          customerName: o.customerName,
          items: o.items?.map((i) => ({ name: i.itemNameSnapshot, quantity: i.quantity, price: i.unitPrice })) || [],
          totalAmount: o.totalAmount,
          status: o.status as any,
          createdAt: new Date(o.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          createdAtTimestamp: createdMs,
          minutesAgo,
          payment: o.payment,
        };
      });

      // Sound & Visual Alert trigger on new incoming order
      if (!isInitial && previousOrdersRef.current.length > 0) {
        const newIncoming = mapped.find((m) => !previousOrdersRef.current.includes(m.backendId));
        if (newIncoming) {
          playAlertChime();
          setNewOrderPulseId(newIncoming.backendId);
          toast.success(`New Order Arrived! #${newIncoming.id}`, `₹${newIncoming.totalAmount} • ${newIncoming.customerPhone || 'Customer'}`);
          
          // Browser Background Notification trigger
          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            new Notification(`Restroex: New Order #${newIncoming.id}`, {
              body: `Total: ₹${newIncoming.totalAmount} | ${newIncoming.items.length} items`,
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
    const interval = setInterval(() => fetchOrders(false), 8000); // 8s polling interval
    
    // Request Browser Notification permissions
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    return () => clearInterval(interval);
  }, []);

  // Transition Order status handler with Optimistic UI
  const handleTransition = async (backendId: string, orderId: string, nextStatus: WorkflowOrderStatus) => {
    // Optimistic state mutation
    setOrders((prev) =>
      prev.map((o) => (o.backendId === backendId ? { ...o, status: nextStatus } : o))
    );

    if (selectedOrder && selectedOrder.backendId === backendId) {
      setSelectedOrder((prev) => (prev ? { ...prev, status: nextStatus } : null));
    }

    try {
      await OrdersService.transitionOrder(backendId, nextStatus);
      toast.success(`Order #${orderId} Updated`, `Status changed to ${nextStatus}`);
    } catch (err: any) {
      toast.error("Status Change Failed", err.message || "Failed to update order status");
      fetchOrders(false); // Revert on failure
    }
  };

  const renderColumnContent = (colStatuses: string[]) => {
    const colOrders = orders.filter((o) => colStatuses.includes(o.status));

    if (colOrders.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center p-6 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 my-2">
          <ShoppingBag className="h-6 w-6 text-slate-400 dark:text-slate-600 mb-1.5" />
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">No Tickets</span>
        </div>
      );
    }

    return colOrders.map((order) => {
      const isPulsing = newOrderPulseId === order.backendId;

      return (
        <Card
          key={order.backendId}
          clickable
          onClick={() => {
            setSelectedOrder(order);
            setIsSheetOpen(true);
          }}
          className={`space-y-3 relative p-4 transition-all duration-200 ${
            isPulsing ? "ring-2 ring-brand-500 animate-pulse-glow" : ""
          }`}
        >
          {/* Top header line */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-heading font-extrabold text-sm text-slate-900 dark:text-slate-100">
                #{order.id}
              </span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {order.customerPhone || "WhatsApp Customer"}
              </span>
            </div>
            <Badge variant="neutral" size="sm">
              <Clock className="h-3 w-3 mr-1" />
              {order.minutesAgo === 0 ? "Abhi" : `${order.minutesAgo}m ago`}
            </Badge>
          </div>

          {/* Item breakdown preview */}
          <div className="space-y-1 py-1 border-y border-slate-100 dark:border-slate-800/80 text-xs">
            {order.items.slice(0, 3).map((item, i) => (
              <div key={i} className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                <span className="font-medium truncate max-w-[180px]">
                  <span className="font-bold text-slate-900 dark:text-slate-100 mr-1.5">{item.quantity}x</span>
                  {item.name}
                </span>
                <span className="font-semibold text-slate-500">₹{item.price * item.quantity}</span>
              </div>
            ))}
            {order.items.length > 3 && (
              <p className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 pt-0.5">
                +{order.items.length - 3} and items...
              </p>
            )}
          </div>

          {/* Card Footer Actions */}
          <div className="flex items-center justify-between pt-1">
            <div>
              <span className="text-[11px] text-slate-400 uppercase font-semibold block">Total</span>
              <span className="font-heading font-extrabold text-sm text-slate-900 dark:text-slate-100">
                ₹{order.totalAmount}
              </span>
            </div>

            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              {(order.status === "paid" || order.status === "checkout_pending" || order.status === "payment_pending") && (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => handleTransition(order.backendId, order.id, "accepted")}
                  className="gap-1 shadow-sm"
                >
                  <Play className="h-3 w-3 fill-white" />
                  <span>Accept</span>
                </Button>
              )}

              {order.status === "accepted" && (
                <Button
                  size="sm"
                  variant="warning"
                  onClick={() => handleTransition(order.backendId, order.id, "preparing")}
                  className="gap-1"
                >
                  <Clock className="h-3 w-3" />
                  <span>Cook</span>
                </Button>
              )}

              {order.status === "preparing" && (
                <Button
                  size="sm"
                  variant="success"
                  onClick={() => handleTransition(order.backendId, order.id, "ready")}
                  className="gap-1"
                >
                  <CheckCircle className="h-3 w-3" />
                  <span>Ready</span>
                </Button>
              )}

              {order.status === "ready" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleTransition(order.backendId, order.id, "completed")}
                  className="gap-1 text-emerald-600 dark:text-emerald-400"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  <span>Served</span>
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
          {/* Header Controls */}
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="font-heading text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                  Live KOT Kanban Board
                </h1>
                <Badge variant="success" pulse size="sm">
                  LIVE POLLED
                </Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Real-time WhatsApp & POS Kitchen Display System (KDS)
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Sound alert toggle */}
              <Button
                variant={soundEnabled ? "secondary" : "ghost"}
                size="sm"
                onClick={() => {
                  setSoundEnabled(!soundEnabled);
                  toast.info(soundEnabled ? "Audio Alert Muted" : "Audio Chime Enabled");
                }}
                className="gap-2"
              >
                {soundEnabled ? <Volume2 className="h-4 w-4 text-brand-600" /> : <VolumeX className="h-4 w-4 text-slate-400" />}
                <span className="text-xs">{soundEnabled ? "Sound ON" : "Sound Muted"}</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchOrders(false)}
                className="gap-2"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Refresh</span>
              </Button>
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
            /* STATE 4: SUCCESS / POPULATED STATE (Kanban Columns) */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-start">
              {KANBAN_COLUMNS.map((col) => {
                const count = orders.filter((o) => col.statuses.includes(o.status)).length;
                return (
                  <div
                    key={col.id}
                    className="flex flex-col rounded-2xl bg-slate-100/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 p-3 space-y-3 min-h-[70vh]"
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
            {/* Status & Customer Bar */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 block">Customer WhatsApp</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{selectedOrder.customerPhone || "N/A"}</span>
              </div>
              <Badge variant="brand" size="lg" className="uppercase">
                {selectedOrder.status}
              </Badge>
            </div>

            {/* Item Breakdown */}
            <div className="space-y-3">
              <h4 className="font-heading font-bold text-xs uppercase text-slate-500 tracking-wider">
                Itemized Order Bill
              </h4>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-950 p-4">
                {selectedOrder.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center py-2.5 first:pt-0 last:pb-0">
                    <div>
                      <span className="font-bold text-slate-900 dark:text-slate-100">{item.quantity}x</span>
                      <span className="ml-2 font-medium text-slate-700 dark:text-slate-300">{item.name}</span>
                    </div>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
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
              <Button
                variant="danger"
                className="w-full text-xs"
                onClick={() => {
                  handleTransition(selectedOrder.backendId, selectedOrder.id, "cancelled");
                  setIsSheetOpen(false);
                }}
              >
                Cancel Order
              </Button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
