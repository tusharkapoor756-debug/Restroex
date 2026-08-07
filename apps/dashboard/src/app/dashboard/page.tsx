"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  OperationsService,
  OperationsHubResponse,
} from "../../lib/services/operations.service";
import { WorkflowOrderStatus } from "../../types";
import { OrdersService } from "../../lib/services/orders.service";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import { CardSkeleton } from "../../components/ui/Skeleton";
import { EmptyState, ErrorState } from "../../components/ui/StateViews";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  DollarSign,
  Play,
  RefreshCw,
  ShoppingBag,
  Store,
  MessageSquare,
  XCircle,
  Zap,
  ArrowRight,
  Database,
  Server,
  Layers,
  ChefHat,
  Bell,
  Utensils,
  CreditCard,
  UserPlus,
  Users,
  ExternalLink,
  ShieldAlert,
  Flame,
  AlertCircle
} from "lucide-react";

export default function ProductionOperationsHubPage() {
  const router = useRouter();
  const [data, setData] = useState<OperationsHubResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null);

  const previousOrdersRef = React.useRef<string[]>([]);
  const audioContextRef = React.useRef<AudioContext | null>(null);

  // Initialize & unlock Web Audio API on first user gesture
  useEffect(() => {
    const unlockAudio = () => {
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (audioContextRef.current.state === "suspended") {
          audioContextRef.current.resume();
        }
      } catch (err) {
        console.warn("[Restroex Audio] Could not unlock AudioContext:", err);
      }
    };

    window.addEventListener("click", unlockAudio, { once: true });
    window.addEventListener("touchstart", unlockAudio, { once: true });
    return () => {
      window.removeEventListener("click", unlockAudio);
      window.removeEventListener("touchstart", unlockAudio);
    };
  }, []);

  // Guaranteed Audio Siren Sound Player (HTML5 Audio + Web Audio API Synthesis)
  const playAlertChime = useCallback(() => {
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

  const fetchHubData = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);
    try {
      const res = await OperationsService.getHubData();
      
      // ── CONTINUOUS ALARM LOOP FOR UNACCEPTED NEW ORDERS ──
      if (res && res.activeOrders) {
        const unacceptedOrders = res.activeOrders.filter((o) =>
          ["checkout_pending", "paid", "payment_pending", "cart_active"].includes(o.status)
        );

        if (unacceptedOrders.length > 0) {
          playAlertChime();
        }

        previousOrdersRef.current = res.activeOrders.map((o) => o.id);
      }

      setData(res);
    } catch (err) {
      console.error("Failed to load operations hub data:", err);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, [playAlertChime]);

  useEffect(() => {
    fetchHubData();
    // Auto polling every 10 seconds for real-time operational sync
    const interval = setInterval(fetchHubData, 10000);
    return () => clearInterval(interval);
  }, [fetchHubData]);

  const handleUpdateOrderStatus = async (orderId: string, nextStatus: WorkflowOrderStatus) => {
    setIsUpdatingStatus(orderId);
    try {
      await OrdersService.transitionOrder(orderId, nextStatus);
      await fetchHubData();
    } catch (err) {
      console.error("Failed to update order status:", err);
    } finally {
      setIsUpdatingStatus(null);
    }
  };

  const formatCurrency = (amt: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amt);

  const renderHealthBadge = (status: "HEALTHY" | "WARNING" | "OFFLINE" | "ERROR") => {
    if (status === "HEALTHY") {
      return (
        <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> HEALTHY
        </span>
      );
    }
    if (status === "WARNING") {
      return (
        <span className="flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> WARNING
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> {status}
      </span>
    );
  };

  return (
    <div className="space-y-8 text-slate-900 dark:text-slate-100 font-sans pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-heading text-xl sm:text-2xl font-extrabold tracking-tight flex items-center gap-2">
              <Zap className="h-6 w-6 text-brand-600 dark:text-brand-400" />
              <span>Real-Time Operations Hub</span>
            </h1>
            <Badge variant="success" size="sm">
              LIVE SYNC ACTIVE
            </Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time live ticket dispatch, active kitchen queue, and daily operational health center.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={fetchHubData} disabled={isLoading} className="gap-2 font-semibold">
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh Operations</span>
          </Button>

          <Link href="/dashboard/analytics">
            <Button size="sm" variant="secondary" className="gap-1.5 font-bold">
              <span>View Analytics</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* 4 MANDATORY UI STATES */}
      {isError ? (
        <ErrorState title="Operations Sync Error" message="Could not fetch operational status from server." onRetry={fetchHubData} />
      ) : isLoading && !data ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : data ? (
        <>
          {/* ── SECTION 1: RESTAURANT INFRASTRUCTURE HEALTH BAR ── */}
          <Card className="p-4 bg-slate-900 text-white dark:bg-slate-950 border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Store className="h-4 w-4 text-brand-400" />
                <span>Restaurant System Health Matrix — {data.systemHealth.store.name}</span>
              </span>
              <span className="text-[11px] text-slate-400 font-mono">Synced {new Date(data.timestamp).toLocaleTimeString()}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-300 font-medium">Store</span>
                {renderHealthBadge(data.systemHealth.store.status)}
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-300 font-medium">WhatsApp</span>
                {renderHealthBadge(data.systemHealth.whatsApp.status)}
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-300 font-medium">Payments</span>
                {renderHealthBadge(data.systemHealth.paymentGateway.status)}
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-300 font-medium">Database</span>
                {renderHealthBadge(data.systemHealth.database.status)}
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-300 font-medium">API Server</span>
                {renderHealthBadge(data.systemHealth.apiBackend.status)}
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-300 font-medium">Realtime Sync</span>
                {renderHealthBadge(data.systemHealth.realtimeSync.status)}
              </div>
            </div>
          </Card>

          {/* ── SECTION 3: NEEDS IMMEDIATE ATTENTION (DISAPPEARS WHEN NO ISSUES EXIST) ── */}
          {data.immediateAttention.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                <ShieldAlert className="h-4 w-4" />
                <span>Needs Immediate Attention ({data.immediateAttention.length})</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.immediateAttention.map((item) => (
                  <div
                    key={item.id}
                    className={`p-4 rounded-2xl border flex items-start justify-between gap-3 text-xs ${
                      item.severity === "critical"
                        ? "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60 text-rose-900 dark:text-rose-200"
                        : "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <span className="font-extrabold block text-sm">{item.title}</span>
                        <p className="text-xs opacity-90">{item.message}</p>
                      </div>
                    </div>
                    {item.actionLabel && item.actionTarget && (
                      <Button
                        size="sm"
                        variant={item.severity === "critical" ? "danger" : "warning"}
                        onClick={() => router.push(item.actionTarget!)}
                        className="shrink-0 font-bold text-[11px] px-3 py-1"
                      >
                        {item.actionLabel}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── SECTION 2: TODAY'S LIVE OPERATIONAL KPIS ── */}
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
                  {formatCurrency(data.todayKpis.todayRevenue)}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 block font-medium">From paid orders today</span>
            </Card>

            <Card className="space-y-2 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Today's Total Orders</span>
                <div className="p-2 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400">
                  <ShoppingBag className="h-4 w-4" />
                </div>
              </div>
              <div className="flex items-baseline justify-between pt-1">
                <span className="font-heading text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                  {data.todayKpis.todayTotalOrders}
                </span>
                <span className="text-xs font-bold text-brand-600 dark:text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded-full">
                  {data.todayKpis.completedOrders} completed
                </span>
              </div>
              <span className="text-[11px] text-slate-400 block font-medium">Total tickets created today</span>
            </Card>

            <Card className="space-y-2 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Kitchen Active Tickets</span>
                <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                  <ChefHat className="h-4 w-4" />
                </div>
              </div>
              <div className="flex items-baseline justify-between pt-1">
                <span className="font-heading text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                  {data.todayKpis.preparingOrders}
                </span>
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                  {data.todayKpis.readyOrders} ready
                </span>
              </div>
              <span className="text-[11px] text-slate-400 block font-medium">Cooking in kitchen queue</span>
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
                  {data.todayKpis.activeConversations}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 block font-medium">WhatsApp active chats</span>
            </Card>
          </div>

          {/* ── SECTION 7: QUICK OPERATIONAL ACTION BAR ── */}
          <Card className="p-4 space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Quick Operational Actions</span>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              <Link href="/dashboard/orders">
                <Button size="sm" variant="outline" className="gap-1.5 text-xs font-bold whitespace-nowrap">
                  <ShoppingBag className="h-3.5 w-3.5 text-brand-600" /> View Live Orders
                </Button>
              </Link>
              <Link href="/dashboard/menu">
                <Button size="sm" variant="outline" className="gap-1.5 text-xs font-bold whitespace-nowrap">
                  <Utensils className="h-3.5 w-3.5 text-amber-600" /> Menu Catalog
                </Button>
              </Link>
              <Link href="/dashboard/payments">
                <Button size="sm" variant="outline" className="gap-1.5 text-xs font-bold whitespace-nowrap">
                  <CreditCard className="h-3.5 w-3.5 text-emerald-600" /> Payments
                </Button>
              </Link>
              <Link href="/dashboard/customers">
                <Button size="sm" variant="outline" className="gap-1.5 text-xs font-bold whitespace-nowrap">
                  <Users className="h-3.5 w-3.5 text-purple-600" /> Customers
                </Button>
              </Link>
              <Link href="/dashboard/whatsapp">
                <Button size="sm" variant="outline" className="gap-1.5 text-xs font-bold whitespace-nowrap">
                  <MessageSquare className="h-3.5 w-3.5 text-indigo-600" /> WhatsApp Settings
                </Button>
              </Link>
              <Link href="/dashboard/analytics">
                <Button size="sm" variant="outline" className="gap-1.5 text-xs font-bold whitespace-nowrap">
                  <BarChart3 className="h-3.5 w-3.5 text-teal-600" /> Analytics Hub
                </Button>
              </Link>
            </div>
          </Card>

          {/* ── SECTION 4 & 5: LIVE ORDER DISPATCH & KITCHEN KDS QUEUE ── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left 7 Cols: Live Orders Dispatch */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5 text-brand-600 dark:text-brand-400" />
                  <h2 className="font-heading text-base font-bold text-slate-900 dark:text-slate-100">Live Active Orders</h2>
                </div>
                <span className="text-xs font-semibold text-slate-500">{data.activeOrders.length} active tickets</span>
              </div>

              {data.activeOrders.length === 0 ? (
                <EmptyState
                  icon={<ShoppingBag className="h-8 w-8 text-brand-600" />}
                  title="No Active Orders Right Now"
                  description="New incoming WhatsApp orders will appear here automatically."
                  actionLabel="Refresh Status"
                  onAction={fetchHubData}
                />
              ) : (
                <div className="space-y-4">
                  {data.activeOrders.map((order) => (
                    <Card key={order.id} className={`space-y-4 p-5 ${order.isDelayed ? "border-rose-500/80 dark:border-rose-500/80 bg-rose-50/20 dark:bg-rose-950/10" : ""}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-extrabold text-base text-brand-600 dark:text-brand-400">{order.humanReadableId}</span>
                            <span className="text-xs text-slate-400">•</span>
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{order.customerName} ({order.customerPhone})</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[11px]">
                            <span className="text-slate-500 flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {order.elapsedMins} mins ago
                            </span>
                            {order.isDelayed && (
                              <span className="font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" /> KITCHEN DELAYED (&gt;20m)
                              </span>
                            )}
                          </div>
                        </div>

                        <Badge
                          variant={
                            order.status === "ready"
                              ? "success"
                              : order.status === "preparing"
                              ? "warning"
                              : "info"
                          }
                        >
                          {order.status.toUpperCase()}
                        </Badge>
                      </div>

                      {/* Items */}
                      <div className="space-y-1.5 border-t border-slate-100 dark:border-slate-800 pt-3 text-xs">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center">
                            <span className="text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1.5 flex-wrap">
                              <span className="text-slate-400 font-bold">{item.quantity}x</span>
                              <span>{item.name}</span>
                              {item.variantName && (
                                <span className="px-1.5 py-0.2 text-[10px] font-extrabold bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/25 rounded-md uppercase tracking-wider">
                                  ({item.variantName})
                                </span>
                              )}
                            </span>
                            <span className="font-mono text-slate-500">{formatCurrency(item.price)}</span>
                          </div>
                        ))}
                      </div>

                      {/* Footer & Transition Buttons */}
                      <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3.5 text-xs">
                        <span className="font-heading font-extrabold text-base text-slate-900 dark:text-slate-100">
                          Total: {formatCurrency(order.totalAmount)}
                        </span>

                        <div className="flex items-center gap-2">
                          {(order.status === "checkout_pending" || order.status === "accepted") && (
                            <Button
                              size="sm"
                              variant="warning"
                              disabled={isUpdatingStatus === order.id}
                              onClick={() => handleUpdateOrderStatus(order.id, "preparing")}
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
                              disabled={isUpdatingStatus === order.id}
                              onClick={() => handleUpdateOrderStatus(order.id, "ready")}
                              className="gap-1 font-bold"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Mark Ready</span>
                            </Button>
                          )}

                          {order.status === "ready" && (
                            <Button
                              size="sm"
                              variant="primary"
                              disabled={isUpdatingStatus === order.id}
                              onClick={() => handleUpdateOrderStatus(order.id, "completed")}
                              className="gap-1 font-bold"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Mark Served</span>
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Right 5 Cols: Kitchen KDS Lanes & Activity Feed */}
            <div className="lg:col-span-5 space-y-6">
              {/* Kitchen KDS Queue Lanes */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-200/80 dark:border-slate-800 pb-2">
                  <ChefHat className="h-4.5 w-4.5 text-amber-500" />
                  <h2 className="font-heading text-base font-bold text-slate-900 dark:text-slate-100">Kitchen KDS Queues</h2>
                </div>

                <div className="space-y-3">
                  {/* Lane 1: Preparing Lane */}
                  <Card className="p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                      <span className="font-bold text-xs text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Flame className="h-3.5 w-3.5" /> In Preparation ({data.kitchenQueue.preparing.length})
                      </span>
                    </div>
                    {data.kitchenQueue.preparing.length === 0 ? (
                      <span className="text-xs text-slate-400 font-semibold block py-2">No tickets currently cooking.</span>
                    ) : (
                      <div className="space-y-2">
                        {data.kitchenQueue.preparing.map((ticket) => (
                          <div key={ticket.id} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-xs space-y-1">
                            <div className="flex justify-between font-bold">
                              <span>{ticket.humanReadableId}</span>
                              <span className="text-amber-600 dark:text-amber-400 font-mono text-[11px]">{ticket.elapsedMins}m cooking</span>
                            </div>
                            <p className="text-slate-500 text-[11px]">
                              {ticket.items.map((i) => `${i.quantity}x ${i.name}`).join(", ")}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>

                  {/* Lane 2: Ready Lane */}
                  <Card className="p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                      <span className="font-bold text-xs text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Ready for Pickup ({data.kitchenQueue.ready.length})
                      </span>
                    </div>
                    {data.kitchenQueue.ready.length === 0 ? (
                      <span className="text-xs text-slate-400 font-semibold block py-2">No ready tickets awaiting pickup.</span>
                    ) : (
                      <div className="space-y-2">
                        {data.kitchenQueue.ready.map((ticket) => (
                          <div key={ticket.id} className="p-2.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/60 text-xs space-y-1">
                            <div className="flex justify-between font-bold">
                              <span>{ticket.humanReadableId}</span>
                              <span className="text-emerald-600 dark:text-emerald-400 font-mono text-[11px]">Ready</span>
                            </div>
                            <p className="text-slate-500 text-[11px]">
                              {ticket.items.map((i) => `${i.quantity}x ${i.name}`).join(", ")}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </div>
              </div>

              {/* Recent Activity Timeline Feed */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-200/80 dark:border-slate-800 pb-2">
                  <Activity className="h-4.5 w-4.5 text-brand-600 dark:text-brand-400" />
                  <h2 className="font-heading text-base font-bold text-slate-900 dark:text-slate-100">Live Activity Feed</h2>
                </div>

                {data.recentActivityFeed.length === 0 ? (
                  <Card className="p-4 text-center text-xs text-slate-400">No activity events logged today.</Card>
                ) : (
                  <div className="space-y-2">
                    {data.recentActivityFeed.map((act) => (
                      <div key={act.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-xs space-y-0.5">
                        <div className="flex justify-between font-semibold text-slate-900 dark:text-slate-100">
                          <span>{act.message}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{act.time}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── SECTION 9, 10, 11: TODAY'S SNAPSHOTS (TOP SELLING, PAYMENTS, CUSTOMERS) ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {/* Section 9: Today's Top Selling Items */}
            <Card className="space-y-4 p-5">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-2">
                <Flame className="h-4 w-4 text-amber-500" />
                <h3 className="font-heading font-bold text-sm text-slate-900 dark:text-slate-100">Today's Top Dishes</h3>
              </div>
              {data.todayTopSellingItems.length === 0 ? (
                <span className="text-xs text-slate-400 font-semibold">No item sales recorded today yet.</span>
              ) : (
                <div className="space-y-2.5 text-xs">
                  {data.todayTopSellingItems.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 font-semibold">
                      <span>#{idx + 1} {item.name}</span>
                      <span className="font-mono font-bold text-brand-600 dark:text-brand-400">{item.quantity} sold</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Section 10: Today's Payment Snapshot */}
            <Card className="space-y-4 p-5">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-emerald-500" />
                <h3 className="font-heading font-bold text-sm text-slate-900 dark:text-slate-100">Today's Payment Snapshot</h3>
              </div>
              {Object.keys(data.paymentSnapshotByGateway).length === 0 ? (
                <span className="text-xs text-slate-400 font-semibold">No payment transactions recorded today.</span>
              ) : (
                <div className="space-y-2.5 text-xs">
                  {Object.entries(data.paymentSnapshotByGateway).map(([gw, snap]) => (
                    <div key={gw} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 space-y-1 font-semibold">
                      <div className="flex justify-between uppercase text-[11px] text-slate-500">
                        <span>{gw.replace("_", " ")}</span>
                        <span className="font-bold text-emerald-600">{formatCurrency(snap.collected)}</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                        <span>Failed: {formatCurrency(snap.failed)}</span>
                        <span>Pending: {formatCurrency(snap.pending)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Section 11: Today's Customer Snapshot */}
            <Card className="space-y-4 p-5">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-500" />
                <h3 className="font-heading font-bold text-sm text-slate-900 dark:text-slate-100">Today's Customer Breakdown</h3>
              </div>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 font-semibold">
                  <span>Today's New Customers</span>
                  <span className="font-heading font-extrabold text-brand-600 dark:text-brand-400 text-sm">{data.customerSnapshot.todayNewCustomers}</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 font-semibold">
                  <span>Today's Returning Customers</span>
                  <span className="font-heading font-extrabold text-purple-600 dark:text-purple-400 text-sm">{data.customerSnapshot.todayReturningCustomers}</span>
                </div>
              </div>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
