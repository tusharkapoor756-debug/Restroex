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
  Check,
  Send,
  Cloud,
  Copy,
  Key,
  ShieldCheck,
  Globe,
  Radio,
  Zap,
  Building2,
  Lock,
  X
} from "lucide-react";
import { WhatsAppService } from "../../../lib/services/whatsapp.service";
import {
  WhatsAppSessionStatus,
  WhatsAppConnectionState,
} from "../../../types";

type UiPhase =
  | "disconnected"
  | "creating"
  | "generating_qr"
  | "qr_ready"
  | "authenticating"
  | "connected"
  | "disconnecting";

type ProviderType = "webjs" | "cloud_api";
type BillingMode = "restroex_managed" | "self_managed";
type NumberVerificationStatus = "pending" | "otp_sent" | "verified" | "failed";

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

  // Active Provider & Mode Selection State
  const [selectedProvider, setSelectedProvider] = useState<ProviderType>("webjs");
  const [billingMode, setBillingMode] = useState<BillingMode>("restroex_managed");
  const [verificationStatus, setVerificationStatus] = useState<NumberVerificationStatus>("pending");

  // Restroex Managed OTP Flow State
  const [managedNumber, setManagedNumber] = useState("");
  const [codeMethod, setCodeMethod] = useState<"SMS" | "VOICE">("SMS");
  const [otpCode, setOtpCode] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  // Disconnect Modal State
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [disconnectingManaged, setDisconnectingManaged] = useState(false);

  // Self Managed (BYO) Form State
  const [cloudPhoneNumberId, setCloudPhoneNumberId] = useState("");
  const [cloudAccessToken, setCloudAccessToken] = useState("");
  const [cloudWabaId, setCloudWabaId] = useState("");
  const [webhookVerifyToken, setWebhookVerifyToken] = useState("restroex_verify_secret");
  const [savingCloudApi, setSavingCloudApi] = useState(false);

  // Test Message Verification State
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("Hi Restroex, show me today's specials menu");
  const [isSendingTest, setIsSendingTest] = useState(false);

  // Bot Behavior Configuration States
  const [orderingMode, setOrderingMode] = useState<"ai_only" | "interactive_only" | "hybrid">("hybrid");
  const [homeScreenItems, setHomeScreenItems] = useState<string[]>([]);
  const [savingConfig, setSavingConfig] = useState(false);

  const phaseRef = useRef<UiPhase>("disconnected");
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Derive absolute Webhook Callback URL for current host
  const webhookCallbackUrl = typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.host}/api/v1/whatsapp/webhook`
    : "https://your-domain.com/api/v1/whatsapp/webhook";

  useEffect(() => {
    WhatsAppService.getWhatsAppConfig()
      .then((res) => {
        if (res) {
          setOrderingMode(res.orderingMode || "hybrid");
          setHomeScreenItems(res.homeScreenItems || ["browse_menu", "best_sellers", "offers", "track_order"]);
          if (res.providerType) setSelectedProvider(res.providerType);
          if (res.billingMode) setBillingMode(res.billingMode);
          if (res.numberVerificationStatus) setVerificationStatus(res.numberVerificationStatus);
          if (res.cloudPhoneNumberId) setCloudPhoneNumberId(res.cloudPhoneNumberId);
          if (res.cloudAccessToken) setCloudAccessToken(res.cloudAccessToken);
          if (res.cloudWabaId) setCloudWabaId(res.cloudWabaId);
          if (res.webhookVerifyToken) setWebhookVerifyToken(res.webhookVerifyToken);
        }
      })
      .catch((err) => console.error("Failed to load WhatsApp config:", err));
  }, []);

  const handleSaveConfig = async (providerOverride?: ProviderType, billingOverride?: BillingMode) => {
    setSavingConfig(true);
    const targetProvider = providerOverride || selectedProvider;
    const targetBilling = billingOverride || billingMode;
    try {
      await WhatsAppService.updateWhatsAppConfig({
        orderingMode,
        homeScreenItems,
        providerType: targetProvider,
        billingMode: targetBilling,
        numberVerificationStatus: verificationStatus,
        cloudPhoneNumberId,
        cloudAccessToken,
        cloudWabaId,
        webhookVerifyToken,
      });
      toast.success("WhatsApp Config Saved", "Configuration updated successfully.");
      await fetchAndApplyStatus();
    } catch (err) {
      toast.error("Save Failed", "Could not save configuration settings.");
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSendOtp = async () => {
    if (!managedNumber) {
      toast.warning("Missing Phone Number", "Please enter the WhatsApp number for your restaurant.");
      return;
    }
    setSendingOtp(true);
    try {
      const res = await WhatsAppService.registerRestroexManaged(managedNumber, codeMethod);
      setVerificationStatus("otp_sent");
      toast.success("OTP Sent Successfully", res?.data?.message || `6-digit code dispatched via ${codeMethod}.`);
    } catch (err: any) {
      toast.error("Failed to Send OTP", err?.response?.data?.error || err.message || "Meta number registration failed.");
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.trim().length < 6) {
      toast.warning("Invalid Code", "Please enter the 6-digit OTP received on your phone.");
      return;
    }
    setVerifyingOtp(true);
    try {
      const res = await WhatsAppService.verifyRestroexManaged(otpCode);
      setVerificationStatus("verified");
      setSelectedProvider("cloud_api");
      setBillingMode("restroex_managed");
      toast.success("WhatsApp Number Verified!", res?.data?.message || "Restroex-Managed Cloud API is now live.");
      await fetchAndApplyStatus();
    } catch (err: any) {
      setVerificationStatus("failed");
      toast.error("Verification Failed", err?.response?.data?.error || err.message || "Invalid or expired OTP code.");
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleDisconnectRestroexManaged = async () => {
    setDisconnectingManaged(true);
    try {
      await WhatsAppService.disconnectRestroexManaged();
      toast.warning("Number Disconnected", "WhatsApp number deregistered from Meta Cloud API successfully.");
      setVerificationStatus("pending");
      setManagedNumber("");
      setOtpCode("");
      setShowDisconnectModal(false);
      await fetchAndApplyStatus();
    } catch (err: any) {
      toast.error("Disconnect Failed", err?.response?.data?.error || err.message || "Could not deregister number from Meta API.");
    } finally {
      setDisconnectingManaged(false);
    }
  };

  const handleConnectSelfManagedCloudApi = async () => {
    if (!cloudPhoneNumberId || !cloudAccessToken) {
      toast.warning("Missing Fields", "Phone Number ID and Access Token are required for BYO Cloud API.");
      return;
    }
    setSavingCloudApi(true);
    try {
      await handleSaveConfig("cloud_api", "self_managed");
      setSelectedProvider("cloud_api");
      setBillingMode("self_managed");
      await WhatsAppService.connect();
      toast.success("Cloud API Connected", "Meta Graph API session verified successfully.");
      await fetchAndApplyStatus();
    } catch (err: any) {
      toast.error("Cloud API Connection Failed", err.message || "Failed to verify Meta Graph API credentials.");
    } finally {
      setSavingCloudApi(false);
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

  const handleConnectWebJs = async () => {
    setError(null);
    phaseRef.current = "creating";
    setPhase("creating");
    try {
      await handleSaveConfig("webjs", "self_managed");
      setSelectedProvider("webjs");
      await WhatsAppService.connect();
      toast.info("Connecting WhatsApp...", "Initializing Web.js browser session.");
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
      const res = await WhatsAppService.sendTestMessage(testPhone, testMessage);
      toast.success("Test Message Sent", res?.message || `Dispatched payload to +${testPhone}`);
    } catch (err: any) {
      toast.error("Test Message Failed", err?.response?.data?.error || err.message || "Could not dispatch message");
    } finally {
      setIsSendingTest(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.info("Copied to Clipboard", `${label} copied.`);
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
            Connect via Restroex-Managed Cloud API, Bring Your Own Meta Account, or WhatsApp Web.js (QR pairing).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={status?.state === "connected" ? "success" : status?.state === "disconnected" ? "danger" : "warning"} pulse size="lg">
            {status?.providerType ? `${status.providerType.toUpperCase()}: ${status.state.toUpperCase()}` : phase.toUpperCase()}
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

      {/* Provider Selector Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card A: WebJS QR */}
        <div
          onClick={() => setSelectedProvider("webjs")}
          className={`p-5 rounded-2xl border cursor-pointer transition-all ${
            selectedProvider === "webjs"
              ? "border-brand-500 bg-brand-50/40 dark:bg-brand-950/40 ring-2 ring-brand-500/20 shadow-md"
              : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-brand-100 dark:bg-brand-950 text-brand-600 dark:text-brand-400">
                <Smartphone className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-base text-slate-900 dark:text-slate-100">
                  WhatsApp Web.js (QR Code)
                </h3>
                <p className="text-xs text-slate-500">Pair via QR scan using staff phone</p>
              </div>
            </div>
            {selectedProvider === "webjs" && <Badge variant="brand">SELECTED</Badge>}
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Directly links with any existing WhatsApp phone number by scanning a secure QR code on phone.
          </p>
        </div>

        {/* Card B: Cloud API */}
        <div
          onClick={() => setSelectedProvider("cloud_api")}
          className={`p-5 rounded-2xl border cursor-pointer transition-all ${
            selectedProvider === "cloud_api"
              ? "border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20 shadow-md"
              : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                <Cloud className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-base text-slate-900 dark:text-slate-100">
                  WhatsApp Cloud API (Meta Official)
                </h3>
                <p className="text-xs text-slate-500">Restroex-Managed OTP or BYO Meta Account</p>
              </div>
            </div>
            {selectedProvider === "cloud_api" && <Badge variant="brand">SELECTED</Badge>}
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Official Meta Graph API engine. Choose Restroex-Managed 1-click OTP verification or Bring Your Own Meta account.
          </p>
        </div>
      </div>

      {/* Provider Details & Connection Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left 7 Cols: Active Provider Setup */}
        <Card className="lg:col-span-7 space-y-6">
          {selectedProvider === "webjs" ? (
            <>
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
              ) : phase === "connected" || status?.state === "connected" ? (
                <div className="flex flex-col items-center justify-center text-center py-8 space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-500">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <div>
                    <h4 className="font-heading font-bold text-base text-slate-900 dark:text-slate-100">WhatsApp Web.js Active & Connected</h4>
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
              ) : phase === "creating" || phase === "generating_qr" ? (
                <div className="flex flex-col items-center justify-center text-center py-12 space-y-4">
                  <Loader2 className="h-10 w-10 text-brand-600 animate-spin" />
                  <p className="font-heading font-bold text-sm text-slate-900 dark:text-slate-100">Generating Secure QR Code...</p>
                  <p className="text-xs text-slate-500">Launching isolated browser session.</p>
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
              ) : (
                <div className="flex flex-col items-center justify-center text-center py-10 space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 flex items-center justify-center text-red-500">
                    <WifiOff className="h-8 w-8" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-heading font-bold text-base text-slate-900 dark:text-slate-100">Web.js Session Disconnected</h4>
                    <p className="text-xs text-slate-500 max-w-sm">Click below to generate a fresh QR code and activate Web.js provider.</p>
                  </div>
                  <Button variant="success" size="lg" onClick={handleConnectWebJs} className="gap-2 font-bold shadow-md">
                    <Wifi className="h-5 w-5" />
                    <span>Connect Web.js Session</span>
                  </Button>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Cloud API Mode Selector Tabs */}
              <div className="flex border-b border-slate-100 dark:border-slate-800/80 pb-4 justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-heading font-bold text-base text-slate-900 dark:text-slate-100">
                      Step 1: Meta Cloud API Integration Mode
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Select Restroex-Managed 1-click verification or Bring Your Own Meta account
                    </p>
                  </div>
                </div>
              </div>

              {/* Mode Selector Toggle */}
              <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-100 dark:bg-slate-900 rounded-xl">
                <button
                  type="button"
                  onClick={() => setBillingMode("restroex_managed")}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                    billingMode === "restroex_managed"
                      ? "bg-white dark:bg-slate-950 text-indigo-600 dark:text-indigo-400 shadow-sm"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  <Zap className="h-4 w-4 text-amber-500" />
                  <span>Restroex Managed (Recommended)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBillingMode("self_managed")}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                    billingMode === "self_managed"
                      ? "bg-white dark:bg-slate-950 text-indigo-600 dark:text-indigo-400 shadow-sm"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  <Building2 className="h-4 w-4" />
                  <span>Bring Your Own Meta Account</span>
                </button>
              </div>

              {/* Mode A: Restroex Managed OTP Flow */}
              {billingMode === "restroex_managed" ? (
                <div className="space-y-5 text-xs">
                  {/* Warning Banner */}
                  <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-amber-800 dark:text-amber-300 leading-relaxed font-medium">
                      <strong>Important Notice:</strong> Registering this phone number for Meta Cloud API will disconnect it from the regular WhatsApp or WhatsApp Business mobile app on that device.
                    </p>
                  </div>

                  {/* Verification Status Stepper Badge & Disconnect Button */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Verification Status:</span>
                      <Badge variant={verificationStatus === "verified" ? "success" : verificationStatus === "otp_sent" ? "warning" : "neutral"} size="sm">
                        {verificationStatus.toUpperCase()}
                      </Badge>
                    </div>

                    {verificationStatus === "verified" && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setShowDisconnectModal(true)}
                        className="gap-1.5 font-bold"
                      >
                        <Power className="h-3.5 w-3.5" />
                        <span>Disconnect Number</span>
                      </Button>
                    )}
                  </div>

                  {/* Step 1: Input Phone & Request OTP (Shown if not verified) */}
                  {verificationStatus !== "verified" && (
                    <div className="space-y-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
                      <div className="space-y-1.5">
                        <label className="font-semibold text-slate-700 dark:text-slate-300">WhatsApp Phone Number (with Country Code)</label>
                        <input
                          type="text"
                          placeholder="e.g. 919876543210"
                          value={managedNumber}
                          onChange={(e) => setManagedNumber(e.target.value)}
                          className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="flex items-center gap-4">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">OTP Delivery Method:</span>
                        <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                          <input
                            type="radio"
                            name="codeMethod"
                            value="SMS"
                            checked={codeMethod === "SMS"}
                            onChange={() => setCodeMethod("SMS")}
                          />
                          <span>SMS</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                          <input
                            type="radio"
                            name="codeMethod"
                            value="VOICE"
                            checked={codeMethod === "VOICE"}
                            onChange={() => setCodeMethod("VOICE")}
                          />
                          <span>Voice Call</span>
                        </label>
                      </div>

                      <Button
                        variant="primary"
                        onClick={handleSendOtp}
                        isLoading={sendingOtp}
                        className="w-full font-bold gap-2 bg-indigo-600 hover:bg-indigo-700 mt-2"
                      >
                        <Send className="h-4 w-4" />
                        <span>{verificationStatus === "otp_sent" ? "Resend OTP Code" : "Send Verification OTP"}</span>
                      </Button>
                    </div>
                  )}

                  {/* Step 2: Input OTP & Verify */}
                  {verificationStatus !== "verified" && (verificationStatus === "otp_sent" || verificationStatus === "failed") && (
                    <div className="space-y-3 p-4 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/30 dark:bg-indigo-950/30">
                      <div className="space-y-1.5">
                        <label className="font-semibold text-slate-700 dark:text-slate-300">Enter 6-Digit Verification OTP Code</label>
                        <input
                          type="text"
                          maxLength={6}
                          placeholder="123456"
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value)}
                          className="w-full h-11 px-3 rounded-xl border border-indigo-300 dark:border-indigo-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono text-lg tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <Button
                        variant="success"
                        onClick={handleVerifyOtp}
                        isLoading={verifyingOtp}
                        className="w-full font-bold gap-2 shadow-md"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Verify OTP & Activate Cloud API</span>
                      </Button>
                    </div>
                  )}

                  {/* Active Verified State Banner */}
                  {verificationStatus === "verified" && (
                    <div className="p-5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex flex-col items-center text-center space-y-3">
                      <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300 flex items-center justify-center">
                        <CheckCircle2 className="h-7 w-7" />
                      </div>
                      <div>
                        <h4 className="font-heading font-extrabold text-base text-slate-900 dark:text-slate-100">
                          Restroex-Managed WhatsApp Active
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          Your bot is connected and actively processing orders via Meta Cloud API.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Mode B: Self-Managed BYO Credentials Form */
                <div className="space-y-4 text-xs">
                  <div className="space-y-1.5">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">Phone Number ID</label>
                    <input
                      type="text"
                      placeholder="e.g. 109283749283741"
                      value={cloudPhoneNumberId}
                      onChange={(e) => setCloudPhoneNumberId(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">System User Access Token (Bearer)</label>
                    <input
                      type="password"
                      placeholder="EAAG..."
                      value={cloudAccessToken}
                      onChange={(e) => setCloudAccessToken(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="font-semibold text-slate-700 dark:text-slate-300">WABA Account ID (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. 2938472938472"
                        value={cloudWabaId}
                        onChange={(e) => setCloudWabaId(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-semibold text-slate-700 dark:text-slate-300">Webhook Verify Token</label>
                      <input
                        type="text"
                        value={webhookVerifyToken}
                        onChange={(e) => setWebhookVerifyToken(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">Webhook Callback URL (Paste into Meta Portal)</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={webhookCallbackUrl}
                        className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 focus:outline-none font-mono text-[11px]"
                      />
                      <Button variant="outline" size="sm" onClick={() => copyToClipboard(webhookCallbackUrl, "Callback URL")}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="pt-2 flex gap-3">
                    <Button
                      variant="primary"
                      onClick={handleConnectSelfManagedCloudApi}
                      isLoading={savingCloudApi}
                      className="flex-1 font-bold gap-2 bg-indigo-600 hover:bg-indigo-700"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      <span>Save & Connect BYO Account</span>
                    </Button>

                    {status?.providerType === "cloud_api" && status?.state === "connected" && (
                      <Button variant="danger" onClick={handleDisconnect} className="gap-2">
                        <Power className="h-4 w-4" />
                        <span>Disconnect</span>
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
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
                Verify message delivery & bot response for active provider
              </p>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 dark:text-slate-300">Recipient WhatsApp Phone Number</label>
              <input
                type="text"
                placeholder="e.g. 919876543210"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 dark:text-slate-300">Test Message Payload</label>
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
            >
              <Send className="h-4 w-4" />
              <span>Send Test Message ({selectedProvider.toUpperCase()})</span>
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
                Step 3: Bot Behavior & Persona Toggles
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure deterministic menus vs AI conversation routing
              </p>
            </div>
          </div>

          <Button variant="primary" size="sm" onClick={() => handleSaveConfig()} isLoading={savingConfig} className="gap-2">
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

      {/* Confirmation Modal for Restroex-Managed Disconnect */}
      {showDisconnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/60">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h3 className="font-heading font-extrabold text-lg text-slate-900 dark:text-slate-100">
                Disconnect Restroex-Managed Number?
              </h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
              Disconnecting will <strong>stop your bot from sending and receiving messages immediately</strong> and deregister this phone number from Meta Cloud API. You can then register a different number or reuse this number on regular WhatsApp.
            </p>

            <div className="pt-2 flex justify-end gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDisconnectModal(false)}
                disabled={disconnectingManaged}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleDisconnectRestroexManaged}
                isLoading={disconnectingManaged}
                className="font-bold gap-2"
              >
                <Power className="h-4 w-4" />
                <span>Disconnect & Deregister Number</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
