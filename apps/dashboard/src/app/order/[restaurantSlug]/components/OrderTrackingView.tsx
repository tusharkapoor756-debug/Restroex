"use client";

// apps/dashboard/src/app/order/[restaurantSlug]/components/OrderTrackingView.tsx
// Real-time order tracking component with visual 5-step progress timeline,
// live countdown timer, store pickup anchor, downloadable receipt link, and Google Review prompt.

import React, { useState, useEffect, useCallback, useRef } from "react";

interface Props {
  orderId: string;
  restaurantName: string;
  restaurantPhone?: string | null;
  restaurantAddress?: string | null;
  googleReviewUrl?: string | null;
  primaryColor: string;
  onOrderAgain: () => void;
}

interface OrderDetails {
  id: string;
  humanReadableId: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  orderType: string;
  tableNumber?: number | null;
  createdAt: string;
  cancellationReason?: string | null;
  items?: Array<{ name: string; variantName?: string; quantity: number; price: number }>;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

const STAGES = [
  { key: "received", label: "Order Received", desc: "Order received by restaurant." },
  { key: "accepted", label: "Accepted", desc: "Restaurant accepted your order." },
  { key: "preparing", label: "Kitchen Preparing", desc: "Chef has started preparing your food." },
  { key: "ready", label: "Ready for Pickup", desc: "Your food is ready for pickup!" },
  { key: "completed", label: "Completed", desc: "Order completed. Thank you!" },
];

export default function OrderTrackingView({
  orderId,
  restaurantName,
  restaurantPhone,
  restaurantAddress,
  googleReviewUrl,
  primaryColor,
  onOrderAgain,
}: Props) {
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastSynced, setLastSynced] = useState<string>("");
  const prevStatusRef = useRef<string>("");

  // Live Countdown State (20 mins prep window)
  const [minsLeft, setMinsLeft] = useState<number>(15);
  const [readyClockTime, setReadyClockTime] = useState<string>("");

  useEffect(() => {
    const readyDate = new Date(Date.now() + 15 * 60 * 1000);
    setReadyClockTime(
      readyDate.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })
    );

    const timerInterval = setInterval(() => {
      setMinsLeft((prev) => (prev > 1 ? prev - 1 : 1));
    }, 60000);

    return () => clearInterval(timerInterval);
  }, []);

  // Web Audio Chime Notification
  const playReadyChime = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch {}
  }, []);

  // 3-Second Status Polling
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/public/orders/${encodeURIComponent(orderId)}/status`);
      const json = await res.json();

      if (res.ok && json.data) {
        setOrder(json.data);
        setLastSynced(new Date().toLocaleTimeString());

        // Play chime if status transitions to ready
        if (json.data.status === "ready" && prevStatusRef.current !== "ready") {
          playReadyChime();
        }
        prevStatusRef.current = json.data.status;
      }
    } catch {
      // Gracefully preserve UI on network flicker
    } finally {
      setLoading(false);
    }
  }, [orderId, playReadyChime]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  if (loading && !order) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3">
        <div
          className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin"
          style={{ borderColor: `${primaryColor} transparent transparent transparent` }}
        />
        <p className="text-slate-400 text-xs font-semibold">Connecting live tracking…</p>
      </div>
    );
  }

  const currentStatus = order?.status || "received";
  const isCancelled = currentStatus === "cancelled";
  const isReady = currentStatus === "ready";
  const isCompleted = currentStatus === "completed";

  // Calculate active step index for timeline
  const stageKeys = STAGES.map((s) => s.key);
  const currentStepIdx = stageKeys.indexOf(currentStatus);

  const getStageDescription = () => {
    const stage = STAGES.find((s) => s.key === currentStatus);
    return stage ? stage.desc : "Your order is being processed.";
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-16 text-slate-900 font-sans">
      {/* Top Banner Header */}
      <div className="bg-slate-900 text-white px-4 pt-10 sm:pt-8 pb-8 text-center space-y-2 relative overflow-hidden">
        <div className="max-w-md mx-auto space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
            {restaurantName}
          </span>
          <h1 className="text-2xl font-black font-heading tracking-tight text-white">
            Order #{order?.humanReadableId || orderId.slice(0, 8).toUpperCase()}
          </h1>
          {lastSynced && (
            <p className="text-[11px] text-slate-400 font-medium">
              Synced {lastSynced} · Live Tracking Active
            </p>
          )}
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 pt-4 space-y-4">
        {/* WhatsApp Notification Notice */}
        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs font-bold flex items-center gap-2 shadow-sm">
          <span>💬</span>
          <span>Live status updates are also being sent to your WhatsApp.</span>
        </div>

        {/* Cancelled State Card */}
        {isCancelled ? (
          <div className="p-5 rounded-3xl bg-white border-2 border-rose-300 shadow-md text-center space-y-3">
            <span className="text-4xl block">🔴</span>
            <h2 className="text-lg font-black text-rose-900 font-heading">Order Cancelled</h2>
            <p className="text-xs text-rose-700 font-medium">
              {order?.cancellationReason || "The restaurant was unable to fulfill this order. If paid, your refund will be processed automatically."}
            </p>
            {restaurantPhone && (
              <a
                href={`tel:${restaurantPhone}`}
                className="inline-block px-5 py-2.5 rounded-xl bg-rose-600 text-white font-extrabold text-xs shadow-xs"
              >
                📞 Call Restaurant
              </a>
            )}
          </div>
        ) : (
          <>
            {/* Live Countdown & Clock Time Card (Hides when Completed) */}
            {!isCompleted && (
              <div className="p-5 rounded-3xl bg-white border border-slate-200/90 shadow-md text-center space-y-2">
                <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider">
                  Estimated Ready Time
                </span>
                <div className="text-2xl font-black text-slate-900 font-mono">
                  {readyClockTime || "Calculating..."}
                </div>
                {!isReady && (
                  <span className="inline-block px-3 py-1 rounded-full bg-brand-50 text-brand-700 text-xs font-extrabold border border-brand-200 animate-pulse">
                    ⏱️ ~{minsLeft} mins remaining
                  </span>
                )}
                {isReady && (
                  <span className="inline-block px-3 py-1 rounded-full bg-emerald-500 text-white text-xs font-extrabold shadow-xs">
                    🎉 Food is Ready for Pickup!
                  </span>
                )}
              </div>
            )}

            {/* Ready Celebration Banner */}
            {isReady && (
              <div className="p-5 rounded-3xl bg-emerald-500 text-white shadow-xl text-center space-y-2 animate-bounce">
                <span className="text-4xl block">🎉</span>
                <h2 className="text-xl font-black font-heading">Your Food is Ready!</h2>
                <p className="text-xs opacity-90 font-medium">
                  Please collect your order from the main restaurant counter.
                </p>
              </div>
            )}

            {/* Deterministic Visual Progress Timeline */}
            {!isCompleted && (
              <div className="p-5 rounded-3xl bg-white border border-slate-200/90 shadow-md space-y-4">
                <h2 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                  Order Status Progress
                </h2>

                <div className="space-y-4 relative pl-3">
                  {STAGES.map((stage, idx) => {
                    const isDone = currentStepIdx > idx;
                    const isCurrent = currentStepIdx === idx;

                    return (
                      <div key={stage.key} className="flex items-start gap-3.5 relative">
                        {/* Connecting Line */}
                        {idx < STAGES.length - 1 && (
                          <div
                            className={`absolute left-3.5 top-7 bottom-0 w-0.5 -ml-px ${
                              isDone ? "bg-emerald-500" : "bg-slate-200"
                            }`}
                          />
                        )}

                        {/* Stage Circle Icon */}
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 z-10 ${
                            isDone
                              ? "bg-emerald-500 text-white shadow-xs"
                              : isCurrent
                              ? "bg-brand-500 text-white ring-4 ring-brand-100 shadow-md"
                              : "bg-slate-100 text-slate-400 border border-slate-200"
                          }`}
                        >
                          {isDone ? "✓" : idx + 1}
                        </div>

                        {/* Stage Label & Context Message */}
                        <div className="min-w-0 pb-1">
                          <h3
                            className={`text-xs font-extrabold ${
                              isCurrent ? "text-brand-600 dark:text-brand-400" : isDone ? "text-slate-900" : "text-slate-400"
                            }`}
                          >
                            {stage.label}
                          </h3>
                          <p className={`text-[11px] ${isCurrent ? "text-slate-700 font-semibold" : "text-slate-400 font-medium"}`}>
                            {isCurrent ? getStageDescription() : stage.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Completed Screen Polish */}
            {isCompleted && (
              <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-lg text-center space-y-4">
                <span className="text-5xl block">🏁</span>
                <h2 className="text-xl font-black text-slate-900 font-heading">Thank You! Order Completed</h2>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  We hope you enjoyed your food from {restaurantName}.
                </p>

                {/* Google Review Prompt (Only shown when completed) */}
                {googleReviewUrl && (
                  <a
                    href={googleReviewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full py-3 rounded-2xl bg-amber-500 text-white font-extrabold text-xs shadow-md hover:bg-amber-600 transition"
                  >
                    ⭐ Rate Experience on Google Reviews
                  </a>
                )}

                {/* Download Thermal Receipt Button */}
                <a
                  href={`${BACKEND_URL}/api/v1/receipts/${encodeURIComponent(orderId)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-xs font-bold text-slate-600 hover:text-slate-900 underline"
                >
                  📄 Download Thermal Tax Receipt
                </a>
              </div>
            )}

            {/* Store Pickup Location Anchor */}
            <div className="p-4 rounded-3xl bg-white border border-slate-200/90 shadow-xs space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Pickup Location & Support
              </span>
              <div className="font-extrabold text-slate-800 text-xs">{restaurantName}</div>
              <div className="text-xs text-slate-500 font-medium">{restaurantAddress || "Main Outlet"}</div>

              <div className="flex gap-2 pt-1">
                {restaurantAddress && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${restaurantName} ${restaurantAddress}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2 px-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 text-[11px] font-bold text-center hover:bg-slate-100"
                  >
                    📍 Google Maps
                  </a>
                )}
                {restaurantPhone && (
                  <a
                    href={`tel:${restaurantPhone}`}
                    className="flex-1 py-2 px-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 text-[11px] font-bold text-center hover:bg-slate-100"
                  >
                    📞 Call Store
                  </a>
                )}
              </div>
            </div>

            {/* Reorder CTA Button */}
            <button
              onClick={onOrderAgain}
              className="w-full py-3.5 rounded-2xl text-white font-extrabold text-sm shadow-md transition active:scale-98 cursor-pointer"
              style={{ backgroundColor: primaryColor }}
            >
              Order Again 🍽️
            </button>
          </>
        )}
      </div>
    </div>
  );
}
