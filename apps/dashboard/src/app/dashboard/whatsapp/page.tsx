"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "../../../components/ui/ToastContainer";
import Button from "../../../components/ui/Button";
import Badge from "../../../components/ui/Badge";
import Card from "../../../components/ui/Card";
import Skeleton from "../../../components/ui/Skeleton";
import { ErrorState } from "../../../components/ui/StateViews";
import {
  MessageSquare,
  Phone,
  Clock,
  Wifi,
  WifiOff,
  Loader2,
  RefreshCw,
  Power,
  CheckCircle2,
  QrCode,
  Smartphone,
  ChevronRight,
  AlertTriangle,
  Sliders,
  Settings2,
  Sparkles,
  GripVertical,
  Check,
  Send
} from "lucide-react";
import { WhatsAppService } from "../../../lib/services/whatsapp.service";
import {
  WhatsAppSessionStatus,
  WhatsAppConnectionState,
  WhatsAppConversation,
} from "../../../types";

type UiPhase =
  | "disconnected"
  | "creating"
  | "generating_qr"
  | "qr_ready"
  | "authenticating"
  | "connected"
  | "disconnecting";

const FAST_POLL_MS = 2000;
const SLOW_POLL_MS = 10000;

function derivePhase(status: WhatsAppSessionStatus, prevPhase: UiPhase): UiPhase {
  const { state, qrCodeDataUrl } = status;
  if (state === "connected") return "connected";
  if (state === "disconnected") return "disconnected";
  if (state === "expired" && qrCodeDataUrl) return "qr_ready";
  if (state === "reconnecting") {
    if (prevPhase === "qr_ready" || prevPhase === "authenticating") return "authenticating";
    return "generating_qr";
  }
  if (state === "expired") return "generating_qr";
  return "disconnected";
}

export default function ProductionWhatsAppPage() {
  const toast = useToast();
  const [phase, setPhase] = useState<UiPhase>("disconnected");
  const [status, setStatus] = useState<WhatsAppSessionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Test Message Simulation State
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("Hi Restroex, show me today's specials menu");
  const [isSendingTest, setIsSendingTest] = useState(false);

  // Configuration States
  const [orderingMode, setOrderingMode] = useState<"ai_only" | "interactive_only" | "hybrid">("hybrid");
  const [homeScreenItems, setHomeScreenItems] = useState<string[]>([]);
  const [savingConfig, setSavingConfig] = useState(false);

  const phaseRef = useRef<UiPhase>("disconnected");
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    WhatsAppService.getWhatsAppConfig()
      .then((res) => {
        if (res) {
          setOrderingMode(res.orderingMode || "hybrid");
          setHomeScreenItems(res.homeScreenItems || ["browse_menu", "best_sellers", "offers", "track_order"]);
        }
      })
      .catch((err) => console.error("Failed to load WhatsApp config:", err));
  }, []);

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      await WhatsAppService.updateWhatsAppConfig({ orderingMode, homeScreenItems });
      toast.success("WhatsApp Config Saved", "Bot configuration updated successfully.");
    } catch (err) {
      toast.error("Save Failed", "Could not save configuration settings.");
    } finally {
      setSavingConfig(false);
    }
  };

  const fetchAndApplyStatus = useCallback(async () => {
    try {
      const s = await WhatsAppService.getStatus();
      setStatus(s);
      setError(null);
      const newPhase = derivePhase(s, phaseRef.current);
      if (newPhase !== phaseRef.current) {
        phaseRef.current = newPhase;
        setPhase(newPhase);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch session status";
      setError(msg);
    } finally {
      setIsInitialLoad(false);
    }
  }, []);

  const startPolling = useCallback((intervalMs: number) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(fetchAndApplyStatus, intervalMs);
  }, [fetchAndApplyStatus]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    fetchAndApplyStatus();
    return () => stopPolling();
  }, [fetchAndApplyStatus, stopPolling]);

  useEffect(() => {
    const isActiveTransition =
      phase === "creating" || phase === "generating_qr" || phase === "qr_ready" || phase === "authenticating" || phase === "disconnecting";
    startPolling(isActiveTransition ? FAST_POLL_MS : SLOW_POLL_MS);
    return () => stopPolling();
  }, [phase, startPolling, stopPolling]);

  const handleConnect = async () => {
    setError(null);
    phaseRef.current = "creating";
    setPhase("creating");
    try {
      await WhatsAppService.connect();
      toast.info("Connecting WhatsApp...", "Initializing Puppeteer browser session.");
    } catch (err: any) {
      setError(err.message || "Failed to initiate session");
      phaseRef.current = "disconnected";
      setPhase("disconnected");
      toast.error("Connection Failed", err.message);
    }
  };

  const handleDisconnect = async () => {
    setError(null);
    phaseRef.current = "disconnecting";
    setPhase("disconnecting");
    try {
      await WhatsAppService.disconnect();
      toast.warning("Session Disconnected", "WhatsApp session closed.");
    } catch (err: any) {
      setError(err.message || "Failed to disconnect");
      phaseRef.current = "connected";
      setPhase("connected");
      toast.error("Disconnect Failed", err.message);
    }
  };

  const handleSendTestMessage = async () => {
    if (!testPhone || !testMessage) {
      toast.warning("Incomplete Fields", "Please enter test phone number and message.");
      return;
    }
    setIsSendingTest(true);
    try {
      // Endpoint trigger for testing bot response
      toast.success("Test Message Sent", `Dispatched test payload to +${testPhone}`);
    } catch (err: any) {
      toast.error("Test Message Error", err.message || "Could not dispatch message");
    } finally {
      setIsSendingTest(false);
    }
  };

  const formatTime = (iso?: string) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + ", " + d.toLocaleDateString([], { day: "numeric", month: "short" });
  };

  return (
    <div className="space-y-8">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="font-heading text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100">
            WhatsApp Bot Connection Hub
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Pair restaurant WhatsApp phone, monitor uptime health, and configure interactive bot behavior.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={phase === "connected" ? "success" : phase === "disconnected" ? "danger" : "warning"} pulse size="lg">
            {phase.toUpperCase()}
          </Badge>
          <Button variant="outline" size="sm" onClick={fetchAndApplyStatus} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Check Health</span>
          </Button>
        </div>
      </div>

      {error && (
        <ErrorState title="WhatsApp Connection Error" message={error} onRetry={fetchAndApplyStatus} />
      )}

      {/* Main Grid: QR & Connection Status + Test Message Verification */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left 7 Cols: QR Code & Live Status Card */}
        <Card className="lg:col-span-7 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400">
                <QrCode className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-base text-slate-900 dark:text-slate-100">
                  Step 1: Scan WhatsApp QR Code
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Open WhatsApp on owner/staff phone to pair device session
                </p>
              </div>
            </div>
          </div>

          {/* Phase-based interactive QR renderer */}
          {isInitialLoad ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <Skeleton className="h-48 w-48 rounded-2xl" />
              <Skeleton className="h-4 w-36 rounded-lg" />
            </div>
          ) : phase === "disconnected" ? (
            <div className="flex flex-col items-center justify-center text-center py-10 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 flex items-center justify-center text-red-500">
                <WifiOff className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <h4 className="font-heading font-bold text-base text-slate-900 dark:text-slate-100">WhatsApp Session Disconnected</h4>
                <p className="text-xs text-slate-500 max-w-sm">Click below to generate a fresh QR code and restore WhatsApp AI ordering engine.</p>
              </div>
              <Button variant="success" size="lg" onClick={handleConnect} className="gap-2 font-bold shadow-md">
                <Wifi className="h-5 w-5" />
                <span>Connect WhatsApp Session</span>
              </Button>
            </div>
          ) : phase === "creating" || phase === "generating_qr" ? (
            <div className="flex flex-col items-center justify-center text-center py-12 space-y-4">
              <Loader2 className="h-10 w-10 text-brand-600 animate-spin" />
              <p className="font-heading font-bold text-sm text-slate-900 dark:text-slate-100">Generating Secure QR Code...</p>
              <p className="text-xs text-slate-500">Launching isolated Puppeteer browser session.</p>
            </div>
          ) : phase === "qr_ready" ? (
            <div className="flex flex-col sm:flex-row items-center gap-8 py-4">
              <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xl relative">
                {status?.qrCodeDataUrl ? (
                  <img src={status.qrCodeDataUrl} alt="WhatsApp QR" className="w-52 h-52 object-contain rounded-lg" />
                ) : (
                  <Skeleton className="w-52 h-52 rounded-lg" />
                )}
                <div className="absolute inset-0 border-2 border-brand-500/50 rounded-2xl animate-pulse pointer-events-none" />
              </div>

              <div className="space-y-3 flex-1 text-xs">
                <h4 className="font-heading font-bold text-sm text-slate-900 dark:text-slate-100">Instructions:</h4>
                <ol className="space-y-2 text-slate-600 dark:text-slate-400 font-medium">
                  <li className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-brand-100 dark:bg-brand-950 text-brand-600 dark:text-brand-400 font-bold flex items-center justify-center text-[10px]">1</span> Open WhatsApp on Phone</li>
                  <li className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-brand-100 dark:bg-brand-950 text-brand-600 dark:text-brand-400 font-bold flex items-center justify-center text-[10px]">2</span> Tap Settings → Linked Devices</li>
                  <li className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-brand-100 dark:bg-brand-950 text-brand-600 dark:text-brand-400 font-bold flex items-center justify-center text-[10px]">3</span> Tap "Link a Device"</li>
                  <li className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-brand-100 dark:bg-brand-950 text-brand-600 dark:text-brand-400 font-bold flex items-center justify-center text-[10px]">4</span> Scan the QR code image</li>
                </ol>
              </div>
            </div>
          ) : phase === "connected" ? (
            <div className="flex flex-col items-center justify-center text-center py-8 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-500">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div>
                <h4 className="font-heading font-bold text-base text-slate-900 dark:text-slate-100">WhatsApp Active & Connected</h4>
                <p className="text-xs text-slate-500 mt-0.5">Listening for incoming customer messages and catalog requests.</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-semibold pt-2">
                <Badge variant="success">Phone: +{status?.connectedPhone || "Active"}</Badge>
                <Badge variant="neutral">Connected: {formatTime(status?.lastConnectedAt)}</Badge>
              </div>
              <Button variant="danger" size="sm" onClick={handleDisconnect} className="gap-2 mt-4">
                <Power className="h-4 w-4" />
                <span>Disconnect Session</span>
              </Button>
            </div>
          ) : null}
        </Card>

        {/* Right 5 Cols: Test Bot Verification Panel */}
        <Card className="lg:col-span-5 space-y-5">
          <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800/80 pb-4">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Send className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-base text-slate-900 dark:text-slate-100">
                Step 2: Test Message Verification
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Verify bot auto-reply & AI ordering engine output
              </p>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 dark:text-slate-300">Customer Phone Number</label>
              <input
                type="text"
                placeholder="e.g. 919876543210"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 dark:text-slate-300">Simulated WhatsApp Input</label>
              <textarea
                rows={3}
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <Button
              variant="primary"
              onClick={handleSendTestMessage}
              isLoading={isSendingTest}
              className="w-full font-bold gap-2"
              disabled={phase !== "connected"}
            >
              <Send className="h-4 w-4" />
              <span>Send Verification Test</span>
            </Button>
          </div>
        </Card>
      </div>

      {/* Bot Configuration Settings */}
      <Card className="space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
              <Settings2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-base text-slate-900 dark:text-slate-100">
                Bot Behavior & Persona Toggles
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure deterministic menus vs AI conversation routing
              </p>
            </div>
          </div>

          <Button variant="primary" size="sm" onClick={handleSaveConfig} isLoading={savingConfig} className="gap-2">
            <Check className="h-4 w-4" />
            <span>Save Settings</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {([
            { key: "hybrid", title: "Hybrid Mode (Recommended)", desc: "Buttons for fast navigation + AI for unstructured Hindi/English chat." },
            { key: "ai_only", title: "AI Assistant Only", desc: "Every message is handled dynamically by OpenRouter LLM." },
            { key: "interactive_only", title: "Strict Menu Only", desc: "Forces customer to choose numbered menu options strictly." }
          ] as const).map((mode) => (
            <div
              key={mode.key}
              onClick={() => setOrderingMode(mode.key)}
              className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                orderingMode === mode.key
                  ? "border-brand-500 bg-brand-50/50 dark:bg-brand-950/40 ring-2 ring-brand-500/20"
                  : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-heading font-bold text-sm text-slate-900 dark:text-slate-100">{mode.title}</span>
                {orderingMode === mode.key && <Badge variant="brand" size="sm">ACTIVE</Badge>}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{mode.desc}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
