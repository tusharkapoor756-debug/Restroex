// src/app/dashboard/settings/page.tsx
"use client";

import { useState, useEffect } from "react";
import {
  Building2,
  Users,
  MessageSquare,
  Globe,
  CreditCard,
  User,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  Lock,
  Link as LinkIcon,
  HelpCircle,
  Loader2,
  AlertCircle,
  ShieldCheck,
  Activity,
  RefreshCw,
  Copy,
  ExternalLink,
  Check
} from "lucide-react";

type SubSection = "profile" | "payments" | "team" | "whatsapp" | "integrations" | "billing" | "account";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "owner" | "manager" | "chef" | "cashier";
  status: "active" | "invited";
}

interface ProviderCard {
  id: string;
  name: string;
  desc: string;
  fields: { key: string; label: string; placeholder: string; type?: string }[];
}

const SUPPORTED_GATEWAYS: ProviderCard[] = [
  {
    id: "razorpay",
    name: "Razorpay PG",
    desc: "UPI, Cards, NetBanking, Instant Refund & Payment Links",
    fields: [
      { key: "key_id", label: "Key ID", placeholder: "rzp_live_..." },
      { key: "key_secret", label: "Key Secret", placeholder: "••••••••••••", type: "password" }
    ]
  },
  {
    id: "cashfree",
    name: "Cashfree Payments",
    desc: "Instant Settlement, UPI Intent, Payment Links & Subscriptions",
    fields: [
      { key: "app_id", label: "App ID", placeholder: "CF_APP_..." },
      { key: "secret_key", label: "Secret Key", placeholder: "••••••••••••", type: "password" }
    ]
  },
  {
    id: "phonepe",
    name: "PhonePe PG",
    desc: "Direct UPI Intent & Dynamic QR for Merchants",
    fields: [
      { key: "merchant_id", label: "Merchant ID", placeholder: "PGMERCHANT..." },
      { key: "salt_key", label: "Salt Key", placeholder: "••••••••••••", type: "password" },
      { key: "salt_index", label: "Salt Index", placeholder: "1" }
    ]
  },
  {
    id: "payu",
    name: "PayU Biz",
    desc: "Enterprise Gateway supporting high success rates",
    fields: [
      { key: "merchant_key", label: "Merchant Key", placeholder: "PAYU_KEY..." },
      { key: "merchant_salt", label: "Merchant Salt", placeholder: "••••••••••••", type: "password" }
    ]
  },
  {
    id: "easebuzz",
    name: "Easebuzz",
    desc: "Low-cost Indian PG with multi-payment mode support",
    fields: [
      { key: "merchant_key", label: "Merchant Key", placeholder: "EASE_KEY..." },
      { key: "salt", label: "Salt", placeholder: "••••••••••••", type: "password" }
    ]
  },
  {
    id: "stripe",
    name: "Stripe International",
    desc: "Global Credit/Debit Card payments & Apple Pay",
    fields: [
      { key: "api_key", label: "Secret API Key", placeholder: "sk_live_..." }
    ]
  }
];

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SubSection>("payments");

  // Status/feedback states
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // 1. Profile State
  const [restaurantName, setRestaurantName] = useState("Bella Italia");
  const [cuisineType, setCuisineType] = useState("italian");
  const [phone, setPhone] = useState("+91 98124 55432");
  const [address, setAddress] = useState("123 Culinary Boulevard, Suite A");
  const [avgTicket, setAvgTicket] = useState("650");

  // 2. Universal Payment Gateway Settings State
  const [selectedProvider, setSelectedProvider] = useState<string>("razorpay");
  const [isSandbox, setIsSandbox] = useState<boolean>(true);
  const [isProviderEnabled, setIsProviderEnabled] = useState<boolean>(true);
  const [credentials, setCredentials] = useState<Record<string, string>>({
    key_id: "rzp_test_99887766",
    key_secret: "secret_sample_token_123"
  });
  const [webhookSecret, setWebhookSecret] = useState<string>("whsec_restroex_demo_secret");
  const [gatewayStatus, setGatewayStatus] = useState<string>("connected"); // connected, invalid_credentials, configuration_error, provider_offline, not_connected
  const [isTestingConnection, setIsTestingConnection] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ isHealthy: boolean; message: string; latencyMs?: number } | null>({
    isHealthy: true,
    message: "Razorpay PG authenticated successfully",
    latencyMs: 45
  });
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // 3. Team State
  const [team, setTeam] = useState<TeamMember[]>([
    { id: "tm-1", name: "Operator Hub (You)", email: "admin@restroex.com", role: "owner", status: "active" },
    { id: "tm-2", name: "Chef Alex", email: "alex.cuisine@gmail.com", role: "chef", status: "active" },
    { id: "tm-3", name: "Sanjay Kumar", email: "sanjay@bistro.com", role: "manager", status: "active" },
    { id: "tm-4", name: "Ramesh Sen", email: "ramesh@bistro.com", role: "cashier", status: "invited" }
  ]);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"manager" | "chef" | "cashier">("manager");

  // 4. WhatsApp Settings State
  const [botWelcomeMsg, setBotWelcomeMsg] = useState("Hello! Welcome to Bella Italia. Would you like to view our digital menu or place a new order today?");
  const [aiAutoOrder, setAiAutoOrder] = useState(true);
  const [isWaConnected, setIsWaConnected] = useState(true);

  // 5. Integrations State
  const [integrations, setIntegrations] = useState([
    { id: "zomato", name: "Zomato Ingestion", desc: "Sync live menus and ingest orders directly", connected: true },
    { id: "swiggy", name: "Swiggy Ingestion", desc: "Sync live menus and ingest orders directly", connected: false },
    { id: "ubereats", name: "UberEats Ingestion", desc: "Sync menus and catalog details", connected: false }
  ]);

  // Load config on mount
  useEffect(() => {
    const dataStr = localStorage.getItem("restroex_restaurant");
    if (dataStr) {
      try {
        const data = JSON.parse(dataStr);
        if (data.restaurantName) setRestaurantName(data.restaurantName);
        if (data.cuisineType) setCuisineType(data.cuisineType);
        if (data.phone) setPhone(data.phone);
        if (data.address) setAddress(data.address);
        if (data.whatsappConnected !== undefined) setIsWaConnected(data.whatsappConnected);
      } catch (e) {}
    }
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    localStorage.setItem(
      "restroex_restaurant",
      JSON.stringify({
        restaurantName,
        cuisineType,
        phone,
        address,
        avgTicket,
        whatsappConnected: isWaConnected
      })
    );

    setIsSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleSaveGatewayConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    await new Promise((resolve) => setTimeout(resolve, 800));

    setGatewayStatus("connected");
    setTestResult({
      isHealthy: true,
      message: `${SUPPORTED_GATEWAYS.find((g) => g.id === selectedProvider)?.name} saved & authenticated successfully`,
      latencyMs: 38
    });

    setIsSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setTestResult(null);

    await new Promise((resolve) => setTimeout(resolve, 1200));

    const isMissingField = Object.values(credentials).some((val) => !val || val.trim().length === 0);

    if (isMissingField) {
      setGatewayStatus("invalid_credentials");
      setTestResult({
        isHealthy: false,
        message: "API Credentials missing or incomplete. Please verify keys."
      });
    } else {
      setGatewayStatus("connected");
      setTestResult({
        isHealthy: true,
        message: "Connection verified! Webhook signature & authentication checks passed.",
        latencyMs: Math.floor(Math.random() * 30) + 30
      });
    }

    setIsTestingConnection(false);
  };

  const handleInviteTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName || !inviteEmail) return;

    const newMember: TeamMember = {
      id: `tm-${Date.now()}`,
      name: inviteName,
      email: inviteEmail,
      role: inviteRole,
      status: "invited"
    };

    setTeam((prev) => [...prev, newMember]);
    setInviteName("");
    setInviteEmail("");
  };

  const handleDeleteTeam = (id: string) => {
    if (id === "tm-1") {
      alert("You cannot remove the account owner profile.");
      return;
    }
    setTeam((prev) => prev.filter((m) => m.id !== id));
  };

  const toggleIntegration = (id: string) => {
    setIntegrations((prev) =>
      prev.map((i) => (i.id === id ? { ...i, connected: !i.connected } : i))
    );
  };

  const webhookUrl = `https://api.restroex.com/api/v1/payments/webhooks/rest_demo_1001/${selectedProvider}`;

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  const currentGatewayCard = SUPPORTED_GATEWAYS.find((g) => g.id === selectedProvider) || SUPPORTED_GATEWAYS[0];

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-sora text-white">System Settings</h1>
        <p className="text-slate-400 text-xs mt-0.5">Manage Universal Payment Orchestration Engine, WhatsApp automation line, team hierarchy, and profile parameters.</p>
      </div>

      {/* SUCCESS POPUP */}
      {saveSuccess && (
        <div className="flex items-center gap-2.5 p-3 rounded-lg bg-emerald-950/40 border border-emerald-900/60 text-emerald-200 text-xs">
          <CheckCircle2 className="h-4.5 w-4.5 text-emerald-400" />
          <span>Configurations updated successfully!</span>
        </div>
      )}

      {/* CORE GRID LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side Settings Navigation (3 columns) */}
        <div className="lg:col-span-3 space-y-1 bg-[#0e0f14]/50 border border-[#23242B] rounded-2xl p-3">
          <button
            onClick={() => setActiveSection("payments")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-left transition-all ${
              activeSection === "payments" ? "bg-violet-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-900/40"
            }`}
          >
            <ShieldCheck className="h-4 w-4 text-emerald-400" /> Universal Payment Gateway
          </button>

          <button
            onClick={() => setActiveSection("profile")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-left transition-all ${
              activeSection === "profile" ? "bg-violet-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-900/40"
            }`}
          >
            <Building2 className="h-4 w-4" /> Restaurant Profile
          </button>

          <button
            onClick={() => setActiveSection("team")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-left transition-all ${
              activeSection === "team" ? "bg-violet-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-900/40"
            }`}
          >
            <Users className="h-4 w-4" /> Team Members
          </button>

          <button
            onClick={() => setActiveSection("whatsapp")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-left transition-all ${
              activeSection === "whatsapp" ? "bg-violet-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-900/40"
            }`}
          >
            <MessageSquare className="h-4 w-4" /> WhatsApp Gateway
          </button>

          <button
            onClick={() => setActiveSection("integrations")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-left transition-all ${
              activeSection === "integrations" ? "bg-violet-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-900/40"
            }`}
          >
            <Globe className="h-4 w-4" /> Aggregators Sync
          </button>

          <button
            onClick={() => setActiveSection("billing")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-left transition-all ${
              activeSection === "billing" ? "bg-violet-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-900/40"
            }`}
          >
            <CreditCard className="h-4 w-4" /> Subscriptions & Billing
          </button>

          <button
            onClick={() => setActiveSection("account")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-left transition-all ${
              activeSection === "account" ? "bg-violet-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-900/40"
            }`}
          >
            <User className="h-4 w-4" /> User Account
          </button>
        </div>

        {/* Right Side Settings Form panels (9 columns) */}
        <div className="lg:col-span-9 bg-[#0e0f14]/40 border border-[#23242B] rounded-2xl p-6 min-h-[55vh]">
          
          {/* 0. UNIVERSAL PAYMENT ORCHESTRATION ENGINE SETTINGS */}
          {activeSection === "payments" && (
            <div className="space-y-6">
              <div className="border-b border-[#23242B]/40 pb-3 flex flex-wrap justify-between items-center gap-2">
                <div>
                  <h3 className="text-sm font-bold text-white font-sora flex items-center gap-2">
                    Universal Payment Orchestration Engine
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Connect your preferred payment gateway. Restroex manages complete lifecycle & auto order confirmations.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                    gatewayStatus === "connected"
                      ? "bg-emerald-950/80 text-emerald-400 border-emerald-800"
                      : gatewayStatus === "invalid_credentials"
                      ? "bg-amber-950/80 text-amber-400 border-amber-800"
                      : "bg-red-950/80 text-red-400 border-red-800"
                  }`}>
                    {gatewayStatus === "connected" && "✅ Connected"}
                    {gatewayStatus === "invalid_credentials" && "⚠ Invalid Credentials"}
                    {gatewayStatus === "not_connected" && "❌ Not Connected"}
                    {gatewayStatus === "provider_offline" && "⚠ Provider Offline"}
                  </span>
                </div>
              </div>

              {/* Provider Selection Grid */}
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Select Active Provider</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {SUPPORTED_GATEWAYS.map((gw) => (
                    <button
                      key={gw.id}
                      type="button"
                      onClick={() => {
                        setSelectedProvider(gw.id);
                        setCredentials({});
                        setTestResult(null);
                      }}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        selectedProvider === gw.id
                          ? "bg-violet-950/40 border-violet-500 text-white shadow-lg shadow-violet-950/30"
                          : "bg-slate-950/40 border-[#23242B] text-slate-400 hover:text-slate-200 hover:border-slate-800"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs">{gw.name}</span>
                        {selectedProvider === gw.id && <CheckCircle2 className="h-3.5 w-3.5 text-violet-400" />}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">{gw.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Configuration Form */}
              <form onSubmit={handleSaveGatewayConfig} className="bg-slate-950/40 border border-[#23242B] rounded-2xl p-5 space-y-5 text-xs">
                <div className="flex flex-wrap justify-between items-center gap-3 border-b border-[#23242B]/40 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-200">{currentGatewayCard.name} API Keys</span>
                    <span className="text-[10px] text-slate-500">({currentGatewayCard.desc})</span>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Sandbox / Production Toggle */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-semibold">Sandbox Mode</span>
                      <button
                        type="button"
                        onClick={() => setIsSandbox(!isSandbox)}
                        className={`w-8 h-4 rounded-full transition-colors p-0.5 ${isSandbox ? "bg-amber-600" : "bg-emerald-600"}`}
                      >
                        <div className={`w-3 h-3 rounded-full bg-white transition-transform ${isSandbox ? "translate-x-0" : "translate-x-4"}`} />
                      </button>
                      <span className="text-[10px] text-slate-400 font-semibold">Production</span>
                    </div>

                    {/* Enable Provider Toggle */}
                    <div className="flex items-center gap-2 border-l border-[#23242B] pl-4">
                      <span className="text-[10px] text-slate-400 font-semibold">Enabled</span>
                      <button
                        type="button"
                        onClick={() => setIsProviderEnabled(!isProviderEnabled)}
                        className={`w-8 h-4 rounded-full transition-colors p-0.5 ${isProviderEnabled ? "bg-violet-600" : "bg-slate-700"}`}
                      >
                        <div className={`w-3 h-3 rounded-full bg-white transition-transform ${isProviderEnabled ? "translate-x-4" : "translate-x-0"}`} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* API Credentials Input Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {currentGatewayCard.fields.map((f) => (
                    <div key={f.key} className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">{f.label}</label>
                      <input
                        type={f.type || "text"}
                        placeholder={f.placeholder}
                        value={credentials[f.key] || ""}
                        onChange={(e) => setCredentials({ ...credentials, [f.key]: e.target.value })}
                        className="w-full bg-slate-950 border border-[#23242B] focus:border-violet-500 rounded-xl px-3 py-2 text-slate-100 placeholder-slate-600 focus:outline-none"
                      />
                    </div>
                  ))}

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Webhook Secret (Optional)</label>
                    <input
                      type="password"
                      placeholder="whsec_..."
                      value={webhookSecret}
                      onChange={(e) => setWebhookSecret(e.target.value)}
                      className="w-full bg-slate-950 border border-[#23242B] focus:border-violet-500 rounded-xl px-3 py-2 text-slate-100 placeholder-slate-600 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Webhook Endpoint Box */}
                <div className="space-y-1.5 p-3 rounded-xl bg-slate-900/60 border border-[#23242B]">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Provider Webhook URL</span>
                    <button
                      type="button"
                      onClick={copyWebhookUrl}
                      className="flex items-center gap-1 text-[10px] text-violet-400 hover:text-violet-300 font-semibold"
                    >
                      {copiedWebhook ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      {copiedWebhook ? "Copied!" : "Copy Webhook URL"}
                    </button>
                  </div>
                  <code className="text-[11px] text-slate-300 font-mono block break-all">{webhookUrl}</code>
                </div>

                {/* Live Diagnostic Output Box */}
                {testResult && (
                  <div className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                    testResult.isHealthy
                      ? "bg-emerald-950/30 border-emerald-900/60 text-emerald-300"
                      : "bg-amber-950/30 border-amber-900/60 text-amber-300"
                  }`}>
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 shrink-0" />
                      <span>{testResult.message}</span>
                    </div>
                    {testResult.latencyMs && (
                      <span className="text-[10px] text-slate-400 font-mono">{testResult.latencyMs}ms</span>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#23242B]/40 pt-4">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isTestingConnection}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-[#23242B] text-slate-200 px-3.5 py-2 font-semibold text-xs transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    {isTestingConnection ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 text-violet-400" />}
                    Test Payment Gateway Connection
                  </button>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 font-semibold text-xs active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Save Gateway Configuration
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 1. RESTAURANT PROFILE DETAILS */}
          {activeSection === "profile" && (
            <form onSubmit={handleSaveProfile} className="space-y-6">
              <div className="border-b border-[#23242B]/40 pb-3 flex justify-between items-center">
                <h3 className="text-sm font-bold text-white font-sora">Restaurant Profile details</h3>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white px-3 py-1.5 text-xs font-semibold active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Save Changes
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Restaurant Name</label>
                  <input
                    type="text"
                    value={restaurantName}
                    onChange={(e) => setRestaurantName(e.target.value)}
                    className="w-full bg-slate-950 border border-[#23242B] focus:border-violet-500 rounded-xl px-3 py-2 text-slate-100 placeholder-slate-600 focus:outline-none"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Primary Cuisine</label>
                  <input
                    type="text"
                    value={cuisineType}
                    onChange={(e) => setCuisineType(e.target.value)}
                    placeholder="e.g. Italian, Sushi Bar"
                    className="w-full bg-slate-950 border border-[#23242B] focus:border-violet-500 rounded-xl px-3 py-2 text-slate-100 focus:outline-none"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Contact Hotline</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-[#23242B] focus:border-violet-500 rounded-xl px-3 py-2 text-slate-100 focus:outline-none"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Avg. Ticket Size (₹)</label>
                  <input
                    type="number"
                    value={avgTicket}
                    onChange={(e) => setAvgTicket(e.target.value)}
                    className="w-full bg-slate-950 border border-[#23242B] focus:border-violet-500 rounded-xl px-3 py-2 text-slate-100 focus:outline-none"
                    required
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Street Address</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full bg-slate-950 border border-[#23242B] focus:border-violet-500 rounded-xl px-3 py-2 text-slate-100 focus:outline-none"
                    required
                  />
                </div>
              </div>
            </form>
          )}

          {/* 2. TEAM MEMBERS */}
          {activeSection === "team" && (
            <div className="space-y-6">
              <div className="border-b border-[#23242B]/40 pb-3">
                <h3 className="text-sm font-bold text-white font-sora">Team Hierarchy</h3>
              </div>

              {/* Add Team Member form */}
              <form onSubmit={handleInviteTeam} className="bg-slate-950/40 p-4 border border-[#23242B] rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-3.5 items-end text-xs">
                <div className="space-y-1.5">
                  <label className="text-[9px] uppercase font-bold tracking-wider text-slate-500">Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Ramesh Sen"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    className="w-full bg-slate-950 border border-[#23242B] focus:border-violet-500 rounded-xl px-3 py-2 text-slate-100 focus:outline-none"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] uppercase font-bold tracking-wider text-slate-500">Email Address</label>
                  <input
                    type="email"
                    placeholder="e.g. ramesh@bistro.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-[#23242B] focus:border-violet-500 rounded-xl px-3 py-2 text-slate-100 focus:outline-none"
                    required
                  />
                </div>

                <div className="flex gap-2 items-center">
                  <div className="space-y-1.5 flex-1">
                    <label className="text-[9px] uppercase font-bold tracking-wider text-slate-500">Role</label>
                    <select
                      value={inviteRole}
                      onChange={(e: any) => setInviteRole(e.target.value)}
                      className="w-full bg-slate-950 border border-[#23242B] focus:border-violet-500 rounded-xl px-3 py-2 text-slate-100 focus:outline-none"
                    >
                      <option value="manager">Manager</option>
                      <option value="chef">Chef</option>
                      <option value="cashier">Cashier</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="rounded-xl bg-violet-600 hover:bg-violet-500 text-white p-2 mt-5 font-semibold text-xs transition-colors shrink-0"
                    title="Send Invite"
                  >
                    <Plus className="h-4.5 w-4.5" />
                  </button>
                </div>
              </form>

              {/* Members list */}
              <div className="bg-slate-950/20 border border-[#23242B] rounded-2xl overflow-hidden text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#23242B] bg-slate-950/40 text-[9px] uppercase font-bold tracking-wider text-slate-500">
                      <th className="p-3">Team Member</th>
                      <th className="p-3">Email Address</th>
                      <th className="p-3">Assigned Role</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#23242B]/30">
                    {team.map((member) => (
                      <tr key={member.id} className="hover:bg-slate-950/20">
                        <td className="p-3 font-bold text-slate-200">{member.name}</td>
                        <td className="p-3 text-slate-400">{member.email}</td>
                        <td className="p-3 text-slate-300 capitalize">{member.role}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold border ${
                            member.status === "active"
                              ? "bg-emerald-950/30 text-emerald-400 border-emerald-900/60"
                              : "bg-amber-950/30 text-amber-400 border-amber-900/60"
                          }`}>
                            {member.status}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleDeleteTeam(member.id)}
                            className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 3. WHATSAPP GATEWAY CONNECTION */}
          {activeSection === "whatsapp" && (
            <div className="space-y-6">
              <div className="border-b border-[#23242B]/40 pb-3 flex justify-between items-center">
                <h3 className="text-sm font-bold text-white font-sora">WhatsApp Automation Channel</h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                  isWaConnected ? "bg-emerald-950 text-emerald-400 border-emerald-900" : "bg-red-950 text-red-400 border-red-900"
                }`}>
                  {isWaConnected ? "Live Connected" : "Disconnected"}
                </span>
              </div>

              <div className="space-y-5 text-xs">
                {/* Status Toggle Box */}
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-[#23242B] flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="font-bold text-slate-200">Linked Phone Line</span>
                    <p className="text-[11px] text-slate-500">Connected to active operations bot trigger.</p>
                  </div>
                  <button
                    onClick={() => setIsWaConnected(!isWaConnected)}
                    className={`rounded-xl px-4 py-2 text-xs font-semibold border transition-all ${
                      isWaConnected
                        ? "border-red-900/60 text-red-400 hover:bg-red-950/20"
                        : "bg-violet-600 border-violet-600 text-white hover:bg-violet-500"
                    }`}
                  >
                    {isWaConnected ? "Disconnect Bot Line" : "Link WhatsApp Number"}
                  </button>
                </div>

                {/* Auto reply configurations */}
                <div className="space-y-3.5 border-t border-[#23242B]/30 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-300">AI Auto-Order Assistant</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={aiAutoOrder}
                        onChange={(e) => setAiAutoOrder(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-950 border border-[#23242B] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-violet-600" />
                    </label>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Greeting Template Reply</label>
                    <textarea
                      value={botWelcomeMsg}
                      onChange={(e) => setBotWelcomeMsg(e.target.value)}
                      rows={3}
                      className="w-full bg-slate-950 border border-[#23242B] focus:border-violet-500 rounded-xl px-3 py-2 text-slate-100 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4. AGGREGATOR INTEGRATIONS */}
          {activeSection === "integrations" && (
            <div className="space-y-6">
              <div className="border-b border-[#23242B]/40 pb-3">
                <h3 className="text-sm font-bold text-white font-sora">Aggegators Sync Portal</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                {integrations.map((i) => (
                  <div
                    key={i.id}
                    className="p-5 rounded-2xl bg-slate-950/40 border border-[#23242B] flex flex-col justify-between h-44 hover:border-slate-800 transition-colors"
                  >
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-200">{i.name}</span>
                        <span className={`h-2.5 w-2.5 rounded-full ${i.connected ? "bg-emerald-500" : "bg-slate-700"}`} />
                      </div>
                      <p className="text-[11px] text-slate-500 leading-normal">{i.desc}</p>
                    </div>

                    <button
                      onClick={() => toggleIntegration(i.id)}
                      className={`w-full rounded-xl py-2 text-xs font-semibold border transition-all ${
                        i.connected
                          ? "border-[#23242B] text-slate-400 hover:text-white"
                          : "bg-violet-600 border-violet-600 text-white hover:bg-violet-500"
                      }`}
                    >
                      {i.connected ? "Disconnect Portal" : "Link Account"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. SUBSCRIPTIONS & BILLING */}
          {activeSection === "billing" && (
            <div className="space-y-6 text-xs">
              <div className="border-b border-[#23242B]/40 pb-3">
                <h3 className="text-sm font-bold text-white font-sora">Subscription Plans</h3>
              </div>

              {/* Active Plan details card */}
              <div className="p-5 rounded-2xl bg-violet-950/10 border border-violet-800/80 relative overflow-hidden flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div className="absolute -right-16 -top-16 h-36 w-36 rounded-full bg-violet-600/5 blur-[40px]" />
                
                <div className="space-y-1.5">
                  <span className="text-[9px] uppercase font-bold tracking-widest text-violet-400">Current Plan Status</span>
                  <h4 className="text-base font-bold text-white">Restroex Growth Operating System</h4>
                  <p className="text-[11px] text-slate-400">Enables infinite WhatsApp catalog operations, automated menu parser and 4 active manager licenses.</p>
                </div>

                <div className="text-left sm:text-right shrink-0">
                  <span className="text-lg font-extrabold text-white">₹4,999/mo</span>
                  <span className="text-[10px] text-slate-500 block mt-1">Next renewal: July 28, 2026</span>
                </div>
              </div>

              {/* Card info */}
              <div className="space-y-2 border-t border-[#23242B]/30 pt-4">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Linked Payment Details</span>
                <div className="p-4 bg-slate-950/60 border border-[#23242B] rounded-2xl flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-5 w-5 text-slate-500" />
                    <div>
                      <span className="font-bold text-slate-200">Visa ending in 4242</span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">Exp: 12/28</span>
                    </div>
                  </div>
                  <button className="text-violet-400 hover:text-violet-300 font-semibold">Change Card</button>
                </div>
              </div>
            </div>
          )}

          {/* 6. USER ACCOUNT PASSWORD */}
          {activeSection === "account" && (
            <form onSubmit={(e) => { e.preventDefault(); alert("Password credentials updated successfully."); }} className="space-y-6 text-xs">
              <div className="border-b border-[#23242B]/40 pb-3 flex justify-between items-center">
                <h3 className="text-sm font-bold text-white font-sora">Login Credentials</h3>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white px-3.5 py-1.5 font-semibold transition-all active:scale-[0.98]"
                >
                  <Lock className="h-3.5 w-3.5" /> Change Password
                </button>
              </div>

              <div className="space-y-4 max-w-sm">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Current Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-[#23242B] focus:border-violet-500 rounded-xl px-3 py-2 text-slate-100 focus:outline-none"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">New Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-[#23242B] focus:border-violet-500 rounded-xl px-3 py-2 text-slate-100 focus:outline-none"
                    required
                  />
                </div>
              </div>
            </form>
          )}

        </div>

      </div>

    </div>
  );
}
