// src/app/dashboard/whatsapp/page.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
} from "lucide-react";
import { WhatsAppService } from "../../../lib/services/whatsapp.service";
import {
  WhatsAppSessionStatus,
  WhatsAppConnectionState,
  WhatsAppConversation,
} from "../../../types";

// ─── UI Phase ─────────────────────────────────────────────────────────────────
// Derived from backend state. This is what drives the UI — never guess the state.

type UiPhase =
  | "disconnected"
  | "creating"      // user clicked Connect — awaiting first status update
  | "generating_qr" // backend is reconnecting and no QR yet
  | "qr_ready"      // backend has an expired state + qrCodeDataUrl
  | "authenticating"// QR was scanned — reconnecting without a QR
  | "connected"
  | "disconnecting";

// Polling intervals (ms)
const FAST_POLL_MS = 2000;  // during active transitions
const SLOW_POLL_MS = 10000; // when idle (connected / disconnected)

// ─── State Derivation ─────────────────────────────────────────────────────────

function derivePhase(
  status: WhatsAppSessionStatus,
  prevPhase: UiPhase
): UiPhase {
  const { state, qrCodeDataUrl } = status;

  if (state === "connected") return "connected";

  if (state === "disconnected") {
    // Only go to disconnected if we weren't in a transient state just clicked
    if (prevPhase === "disconnecting") return "disconnected";
    return "disconnected";
  }

  if (state === "expired" && qrCodeDataUrl) return "qr_ready";

  if (state === "reconnecting") {
    // If we were previously showing a QR and now QR is gone → phone scanned
    if (prevPhase === "qr_ready") return "authenticating";
    // If we were authenticating, keep showing authenticating until connected
    if (prevPhase === "authenticating") return "authenticating";
    // Otherwise we are generating the QR
    return "generating_qr";
  }

  // Fallback: expired without a data URL yet means generating
  if (state === "expired") return "generating_qr";

  return "disconnected";
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WhatsAppPage() {
  const [phase, setPhase] = useState<UiPhase>("disconnected");
  const [status, setStatus] = useState<WhatsAppSessionStatus | null>(null);
  const [conversations] = useState<WhatsAppConversation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Track previous phase in a ref so derivePhase can use it without stale closure
  const phaseRef = useRef<UiPhase>("disconnected");
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // ─── Debug logger ────────────────────────────────────────────────────────
  const logTransition = useCallback((from: UiPhase, to: UiPhase, backendState: WhatsAppConnectionState) => {
    if (process.env.NODE_ENV !== "production") {
      console.log(
        `%c[WhatsApp] ${from} → ${to}%c (backend: ${backendState})`,
        "color: #7c3aed; font-weight: bold;",
        "color: #94a3b8;"
      );
    }
  }, []);

  // ─── Status polling ──────────────────────────────────────────────────────
  const fetchAndApplyStatus = useCallback(async () => {
    try {
      const s = await WhatsAppService.getStatus();
      setStatus(s);
      setError(null);

      const newPhase = derivePhase(s, phaseRef.current);

      if (newPhase !== phaseRef.current) {
        logTransition(phaseRef.current, newPhase, s.state);
        phaseRef.current = newPhase;
        setPhase(newPhase);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch status";
      setError(msg);
      console.error("[WhatsApp] Status poll failed:", msg);
    } finally {
      setIsInitialLoad(false);
    }
  }, [logTransition]);

  // ─── Poll interval management ────────────────────────────────────────────
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

  // On mount: immediately fetch, then poll based on phase
  useEffect(() => {
    fetchAndApplyStatus();
    return () => stopPolling();
  }, [fetchAndApplyStatus, stopPolling]);

  // Adjust poll speed based on current phase
  useEffect(() => {
    const isActiveTransition =
      phase === "creating" ||
      phase === "generating_qr" ||
      phase === "qr_ready" ||
      phase === "authenticating" ||
      phase === "disconnecting";

    startPolling(isActiveTransition ? FAST_POLL_MS : SLOW_POLL_MS);

    return () => stopPolling();
  }, [phase, startPolling, stopPolling]);

  // ─── Actions ─────────────────────────────────────────────────────────────
  const handleConnect = async () => {
    setError(null);
    logTransition(phaseRef.current, "creating", "reconnecting");
    phaseRef.current = "creating";
    setPhase("creating");

    try {
      await WhatsAppService.connect();
      // Don't change phase here — let polling detect backend state
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to connect";
      setError(msg);
      phaseRef.current = "disconnected";
      setPhase("disconnected");
    }
  };

  const handleDisconnect = async () => {
    setError(null);
    logTransition(phaseRef.current, "disconnecting", "connected");
    phaseRef.current = "disconnecting";
    setPhase("disconnecting");

    try {
      await WhatsAppService.disconnect();
      // Let polling confirm the disconnected state
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to disconnect";
      setError(msg);
      // Revert to connected if disconnect failed
      phaseRef.current = "connected";
      setPhase("connected");
    }
  };

  // ─── Helpers ─────────────────────────────────────────────────────────────
  const formatTime = (iso?: string) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) +
      ", " + d.toLocaleDateString([], { day: "numeric", month: "short" });
  };

  // ─── Phase-based UI content ───────────────────────────────────────────────

  const renderConnectionPanel = () => {
    switch (phase) {
      // ── 1. Disconnected ─────────────────────────────────────────────────
      case "disconnected":
        return (
          <div className="flex flex-col items-center gap-6 py-10">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
                <WifiOff className="h-9 w-9 text-rose-400" />
              </div>
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-rose-500 border-2 border-[#0e0f14]" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-white font-semibold text-base">WhatsApp not connected</p>
              <p className="text-slate-500 text-xs max-w-xs">
                Connect your WhatsApp to start receiving and responding to orders automatically.
              </p>
              {status?.lastError && (
                <p className="text-amber-400 text-xs mt-2 flex items-center justify-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                  {status.lastError}
                </p>
              )}
            </div>
            <button
              id="whatsapp-connect-btn"
              onClick={handleConnect}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-all duration-200 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Wifi className="h-4 w-4" />
              Connect WhatsApp
            </button>
          </div>
        );

      // ── 2. Creating Session ──────────────────────────────────────────────
      case "creating":
        return (
          <div className="flex flex-col items-center gap-5 py-10">
            <div className="w-20 h-20 rounded-full bg-violet-500/10 border border-violet-500/30 flex items-center justify-center">
              <Loader2 className="h-9 w-9 text-violet-400 animate-spin" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-white font-semibold text-base">Creating secure WhatsApp session...</p>
              <p className="text-slate-500 text-xs">Initializing browser engine. This may take a moment.</p>
            </div>
          </div>
        );

      // ── 3. Generating QR ─────────────────────────────────────────────────
      case "generating_qr":
        return (
          <div className="flex flex-col items-center gap-5 py-10">
            <div className="relative w-20 h-20 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
              <QrCode className="h-9 w-9 text-blue-400" />
              <div className="absolute inset-0 rounded-full border-2 border-blue-400/40 animate-ping" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-white font-semibold text-base">Generating QR Code...</p>
              <p className="text-slate-500 text-xs">WhatsApp is preparing your unique QR code.</p>
            </div>
            <div className="w-48 h-1 bg-[#1a1b23] rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full animate-pulse" style={{ width: "60%" }} />
            </div>
          </div>
        );

      // ── 4. QR Ready ──────────────────────────────────────────────────────
      case "qr_ready":
        return (
          <div className="flex flex-col items-center gap-6 py-6">
            <div className="text-center space-y-1">
              <p className="text-white font-semibold text-base">Scan QR to connect</p>
              <p className="text-slate-500 text-xs">Open WhatsApp on your phone to scan</p>
            </div>

            {/* QR Image */}
            <div className="relative">
              <div className="p-3 bg-white rounded-2xl shadow-2xl shadow-black/50">
                {status?.qrCodeDataUrl ? (
                  <img
                    src={status.qrCodeDataUrl}
                    alt="WhatsApp QR Code"
                    className="w-56 h-56 object-contain rounded-lg"
                  />
                ) : (
                  <div className="w-56 h-56 flex items-center justify-center bg-slate-100 rounded-lg">
                    <Loader2 className="h-8 w-8 text-slate-400 animate-spin" />
                  </div>
                )}
              </div>
              {/* Scanning pulse border */}
              <div className="absolute inset-0 rounded-2xl border-2 border-emerald-400/50 animate-pulse pointer-events-none" />
            </div>

            {/* Instructions */}
            <div className="w-full max-w-xs bg-[#0e0f14]/60 border border-[#23242B] rounded-xl p-4 space-y-2">
              {[
                "Open WhatsApp on your phone",
                "Tap ⋮ → Linked Devices",
                "Tap 'Link a Device'",
                "Point your phone at this QR code",
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-2.5 text-xs text-slate-400">
                  <div className="w-5 h-5 rounded-full bg-violet-500/20 border border-violet-500/40 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-violet-400">
                    {i + 1}
                  </div>
                  <span>{step}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-1.5 text-amber-400 text-xs">
                <Clock className="h-3.5 w-3.5" />
                QR expires automatically
              </div>
              <p className="text-slate-600 text-xs">Waiting for phone scan...</p>
            </div>
          </div>
        );

      // ── 5. Authenticating (QR Scanned) ───────────────────────────────────
      case "authenticating":
        return (
          <div className="flex flex-col items-center gap-6 py-10">
            <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center relative">
              <Smartphone className="h-9 w-9 text-emerald-400" />
              <div className="absolute inset-0 rounded-full border-2 border-emerald-400/30 animate-ping" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-white font-semibold text-base">QR Scanned — Authenticating...</p>
              <p className="text-slate-500 text-xs">Please wait while WhatsApp verifies your device.</p>
            </div>

            {/* Progress steps */}
            <div className="w-full max-w-xs space-y-2">
              {[
                "Authenticating device",
                "Syncing WhatsApp",
                "Preparing messaging engine",
                "Loading recent conversations",
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <Loader2 className={`h-3.5 w-3.5 flex-shrink-0 ${i === 0 ? "text-emerald-400 animate-spin" : "text-slate-600 animate-spin"}`} style={{ animationDelay: `${i * 300}ms` }} />
                  <span className={`text-xs ${i === 0 ? "text-slate-300" : "text-slate-600"}`}>{step}...</span>
                </div>
              ))}
            </div>
          </div>
        );

      // ── 6. Connected ─────────────────────────────────────────────────────
      case "connected":
        return (
          <div className="flex flex-col items-center gap-6 py-8">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                <CheckCircle2 className="h-9 w-9 text-emerald-400" />
              </div>
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#0e0f14] animate-pulse" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-emerald-400 font-bold text-lg">Connected</p>
              <p className="text-slate-500 text-xs">WhatsApp is active and receiving messages.</p>
            </div>

            {/* Info cards */}
            <div className="w-full max-w-xs space-y-2">
              {status?.connectedPhone && (
                <div className="flex items-center gap-3 px-4 py-3 bg-[#0e0f14]/60 border border-[#23242B] rounded-xl">
                  <Phone className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Phone</p>
                    <p className="text-sm text-white font-semibold">+{status.connectedPhone}</p>
                  </div>
                </div>
              )}
              {status?.lastConnectedAt && (
                <div className="flex items-center gap-3 px-4 py-3 bg-[#0e0f14]/60 border border-[#23242B] rounded-xl">
                  <Clock className="h-4 w-4 text-slate-400 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Connected since</p>
                    <p className="text-sm text-slate-300">{formatTime(status.lastConnectedAt)}</p>
                  </div>
                </div>
              )}
            </div>

            <button
              id="whatsapp-disconnect-btn"
              onClick={handleDisconnect}
              className="flex items-center gap-2 px-5 py-2 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 font-semibold text-sm transition-all duration-200"
            >
              <Power className="h-4 w-4" />
              Disconnect
            </button>
          </div>
        );

      // ── 7. Disconnecting ─────────────────────────────────────────────────
      case "disconnecting":
        return (
          <div className="flex flex-col items-center gap-5 py-10">
            <div className="w-20 h-20 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
              <Loader2 className="h-9 w-9 text-rose-400 animate-spin" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-white font-semibold text-base">Disconnecting WhatsApp...</p>
              <p className="text-slate-500 text-xs">Ending session and cleaning up browser.</p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // ─── Status indicator dot ─────────────────────────────────────────────────
  const statusDot = () => {
    if (phase === "connected") return <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />;
    if (phase === "disconnected") return <span className="w-2 h-2 rounded-full bg-rose-500" />;
    return <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />;
  };

  const statusLabel = () => {
    const labels: Record<UiPhase, string> = {
      disconnected: "Disconnected",
      creating: "Connecting...",
      generating_qr: "Generating QR...",
      qr_ready: "Awaiting Scan",
      authenticating: "Authenticating...",
      connected: "Connected",
      disconnecting: "Disconnecting...",
    };
    return labels[phase];
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-sora text-white">WhatsApp Integration</h1>
          <p className="text-slate-400 text-xs mt-0.5">
            Connect your WhatsApp number to receive and respond to orders automatically.
          </p>
        </div>
        {/* Live status badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0e0f14]/60 border border-[#23242B] self-start sm:self-auto">
          {statusDot()}
          <span className="text-xs font-semibold text-slate-300">{statusLabel()}</span>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2.5 px-4 py-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ── Connection Panel ──────────────────────────────────────────── */}
        <div className="lg:col-span-2 bg-[#0e0f14]/50 border border-[#23242B] rounded-2xl">
          <div className="px-5 py-4 border-b border-[#23242B] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-violet-400" />
              <span className="text-sm font-semibold text-white">Connection</span>
            </div>
            {!isInitialLoad && (
              <button
                onClick={fetchAndApplyStatus}
                title="Refresh status"
                className="text-slate-600 hover:text-slate-400 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {isInitialLoad ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 text-slate-600 animate-spin" />
            </div>
          ) : (
            renderConnectionPanel()
          )}
        </div>

        {/* ── Conversations Panel ───────────────────────────────────────── */}
        <div className="lg:col-span-3 bg-[#0e0f14]/50 border border-[#23242B] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#23242B] flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-violet-400" />
            <span className="text-sm font-semibold text-white">Recent Conversations</span>
          </div>

          {phase !== "connected" ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center px-6">
              <WifiOff className="h-8 w-8 text-slate-700" />
              <p className="text-slate-500 text-sm font-medium">WhatsApp not connected</p>
              <p className="text-slate-600 text-xs max-w-xs">
                Connect your WhatsApp to see incoming conversations and orders here.
              </p>
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center px-6">
              <MessageSquare className="h-8 w-8 text-slate-700" />
              <p className="text-slate-500 text-sm font-medium">No conversations yet</p>
              <p className="text-slate-600 text-xs max-w-xs">
                Conversations will appear here when customers message your WhatsApp number.
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0e0f14]/80 text-[10px] uppercase font-bold tracking-wider text-slate-500 border-b border-[#23242B]">
                <tr>
                  <th className="p-4 w-40">Phone</th>
                  <th className="p-4">Last Message</th>
                  <th className="p-4 w-32">Updated</th>
                  <th className="p-4 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#23242B]/40">
                {conversations.map((conv) => (
                  <tr key={conv.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 text-slate-500" />
                        <span className="font-bold text-slate-300">{conv.customerPhone}</span>
                      </div>
                    </td>
                    <td className="p-4 text-slate-400 truncate max-w-xs">{conv.lastMessage}</td>
                    <td className="p-4 text-slate-600">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTime(conv.updatedAt)}
                      </div>
                    </td>
                    <td className="p-4">
                      <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
