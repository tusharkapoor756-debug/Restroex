"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Building2,
  CreditCard,
  Store,
  Receipt,
  Save,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ChevronRight,
  Smartphone,
  FileText,
  ToggleLeft,
  ToggleRight,
  Clock,
  PackageCheck,
  BadgeIndianRupee,
  Upload,
} from "lucide-react";
import { SettingsService } from "../../../lib/services/settings.service";
import { FullSettings, UpdateSettingsPayload } from "../../../types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

type SettingsTab = "profile" | "tax" | "payment" | "store";

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="border-b border-[#23242B]/60 pb-4 mb-6">
      <h3 className="text-sm font-bold text-white font-sora">{title}</h3>
      <p className="text-[11px] text-slate-500 mt-0.5">{description}</p>
    </div>
  );
}

function FieldGroup({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-slate-600">{hint}</p>}
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
  disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full bg-[#0a0b10] border border-[#23242B] focus:border-violet-500/70 rounded-xl px-3 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none transition-colors text-xs disabled:opacity-40"
    />
  );
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between p-4 rounded-xl bg-slate-950/50 border border-[#23242B] hover:border-slate-700 cursor-pointer transition-colors"
    >
      <div>
        <span className="text-xs font-semibold text-slate-200 block">{label}</span>
        {description && <span className="text-[10px] text-slate-500">{description}</span>}
      </div>
      <div className={`transition-colors ${checked ? "text-violet-400" : "text-slate-600"}`}>
        {checked ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6" />}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── Business Profile ──────────────────────────────────────────────────────
  const [logoUrl, setLogoUrl] = useState("");
  const [name, setName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");

  // ── Tax & Billing ─────────────────────────────────────────────────────────
  const [gstEnabled, setGstEnabled] = useState(false);
  const [gstNumber, setGstNumber] = useState("");
  const [gstPercentage, setGstPercentage] = useState("18");
  const [fssaiNumber, setFssaiNumber] = useState("");

  // ── Payment ───────────────────────────────────────────────────────────────
  const [codEnabled, setCodEnabled] = useState(false);
  const [manualUpiEnabled, setManualUpiEnabled] = useState(true);
  const [onlinePaymentsEnabled, setOnlinePaymentsEnabled] = useState(false);
  const [upiMerchantName, setUpiMerchantName] = useState("");
  const [upiId, setUpiId] = useState("");
  const [upiQrImageUrl, setUpiQrImageUrl] = useState("");

  // ── Store ─────────────────────────────────────────────────────────────────
  const [pickupAvailable, setPickupAvailable] = useState(true);
  const [prepTime, setPrepTime] = useState("15");
  const [pickupInstructions, setPickupInstructions] = useState("");

  // ── Payment Orchestrator State ──────────────────────────────────────────────
  const [gatewayConfigs, setGatewayConfigs] = useState<import("../../../types").RestaurantPaymentConfig[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>("razorpay");
  const [isSandboxMode, setIsSandboxMode] = useState<boolean>(true);
  const [isGwEnabled, setIsGwEnabled] = useState<boolean>(false); // Strict default: Disabled / Not Connected until loaded from DB
  const [gwCredentials, setGwCredentials] = useState<Record<string, string>>({});
  const [gwWebhookSecret, setGwWebhookSecret] = useState<string>("");
  const [isTestingGw, setIsTestingGw] = useState<boolean>(false);
  const [gwTestResult, setGwTestResult] = useState<{ isHealthy: boolean; message: string; latencyMs?: number } | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  const [currentRestaurantId, setCurrentRestaurantId] = useState<string>("rest_demo_1001");

  // ── Load settings & gateway configs ───────────────────────────────────────
  const loadGatewayConfigs = useCallback(async (restaurantId: string, targetProviderId?: string) => {
    try {
      const { PaymentsService } = require("../../../lib/services/payments.service");
      const configs = await PaymentsService.getGatewayConfigs(restaurantId);
      setGatewayConfigs(configs || []);

      setSelectedProviderId((currentSelectedId) => {
        const activeId = targetProviderId || currentSelectedId || "razorpay";
        const existingCfg = (configs || []).find((c: any) => c.providerName === activeId);

        setIsGwEnabled(Boolean(existingCfg?.isEnabled ?? false));
        setIsSandboxMode(Boolean(existingCfg?.isSandbox ?? true));
        setGwCredentials(existingCfg?.credentials || {});
        setGwWebhookSecret(existingCfg?.webhookSecret || "");
        setHasUnsavedChanges(false);

        return activeId;
      });
    } catch (err) {
      // Backend handles unconfigured fallback cleanly
    }
  }, []);

  const hydrate = useCallback((data: FullSettings) => {
    const { profile, settings } = data;
    if (settings.restaurantId) {
      setCurrentRestaurantId(settings.restaurantId);
    }
    setLogoUrl(profile.logoUrl ?? "");
    setName(profile.name ?? "");
    setOwnerName(profile.ownerName ?? "");
    setPhoneNumber(profile.phoneNumber ?? "");
    setEmail(profile.email ?? "");
    setAddress(profile.address ?? "");
    setCity(profile.city ?? "");
    setState(profile.state ?? "");
    setPincode(profile.pincode ?? "");

    setGstEnabled(settings.gstEnabled);
    setGstNumber(settings.gstNumber ?? "");
    setGstPercentage(String(settings.gstPercentage ?? 18));
    setFssaiNumber(settings.fssaiNumber ?? "");

    setUpiMerchantName(settings.upiMerchantName ?? "");
    setUpiId(settings.upiId ?? "");
    setUpiQrImageUrl(settings.upiQrImageUrl ?? "");
    setCodEnabled(settings.codEnabled ?? false);
    setManualUpiEnabled(settings.manualUpiEnabled ?? true);
    setOnlinePaymentsEnabled(settings.onlinePaymentsEnabled ?? false);

    setPickupAvailable(settings.pickupAvailable);
    setPrepTime(String(settings.prepTime ?? 15));
    setPickupInstructions(settings.pickupInstructions ?? "");

    if (settings.restaurantId) {
      loadGatewayConfigs(settings.restaurantId);
    }
  }, [loadGatewayConfigs]);

  useEffect(() => {
    (async () => {
      try {
        setIsLoading(true);
        setLoadError(null);
        const data = await SettingsService.getSettings();
        hydrate(data);
      } catch (err: any) {
        setLoadError(err?.message || "Failed to load settings");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [hydrate]);

  // ── Save handler ──────────────────────────────────────────────────────────
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const payload: UpdateSettingsPayload = {
      name: name || undefined,
      logoUrl: logoUrl || undefined,
      ownerName: ownerName || undefined,
      phoneNumber: phoneNumber || undefined,
      email: email || undefined,
      address: address || undefined,
      city: city || undefined,
      state: state || undefined,
      pincode: pincode || undefined,
      gstEnabled,
      gstNumber: gstEnabled ? (gstNumber || undefined) : undefined,
      gstPercentage: gstEnabled ? Number(gstPercentage) : 0,
      fssaiNumber: fssaiNumber || undefined,
      paymentMethods: ["manual_upi"],
      upiMerchantName: upiMerchantName || undefined,
      upiId: upiId || undefined,
      upiQrImageUrl: upiQrImageUrl || undefined,
      codEnabled,
      manualUpiEnabled,
      onlinePaymentsEnabled,
      pickupAvailable,
      prepTime: Number(prepTime) || 15,
      pickupInstructions: pickupInstructions || undefined,
    };

    if (manualUpiEnabled) {
      if (!upiId?.trim() || !upiMerchantName?.trim() || !upiQrImageUrl?.trim()) {
        setSaveError("Merchant Name, UPI ID, and QR Code Image are mandatory when Manual UPI is enabled.");
        setIsSaving(false);
        return;
      }
    }

    try {
      const updated = await SettingsService.updateSettings(payload);
      hydrate(updated);

      // Also persist the current selected payment gateway configuration if credentials exist or enabled
      if (currentRestaurantId && selectedProviderId) {
        try {
          const { PaymentsService } = require("../../../lib/services/payments.service");
          await PaymentsService.saveGatewayConfig({
            restaurantId: currentRestaurantId,
            providerName: selectedProviderId,
            credentials: gwCredentials,
            isEnabled: isGwEnabled,
            isSandbox: isSandboxMode,
            webhookSecret: gwWebhookSecret
          });
          await loadGatewayConfigs(currentRestaurantId, selectedProviderId);
        } catch (gwErr) {
          // General settings saved cleanly
        }
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      setSaveError(err?.message || "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: "profile", label: "Business Profile", icon: <Building2 className="h-4 w-4" /> },
    { id: "tax", label: "Tax & Billing", icon: <Receipt className="h-4 w-4" /> },
    { id: "payment", label: "Payment Settings", icon: <CreditCard className="h-4 w-4" /> },
    { id: "store", label: "Store Settings", icon: <Store className="h-4 w-4" /> },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-7 w-7 animate-spin text-violet-400" />
          <span className="text-xs text-slate-500">Loading settings…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-sora text-white">Restaurant Settings</h1>
          <p className="text-slate-400 text-xs mt-0.5">
            Central configuration for your restaurant — profile, taxes, payments, and store behaviour.
          </p>
        </div>
        <button
          form="settings-form"
          type="submit"
          disabled={isSaving}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 active:scale-95 text-white px-4 py-2.5 text-xs font-semibold shadow-lg shadow-violet-950/40 disabled:opacity-50 transition-all"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Changes
        </button>
      </div>

      {/* ── Status toasts ───────────────────────────────────────────────── */}
      {saveSuccess && (
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-950/40 border border-emerald-900/60 text-emerald-200 text-xs">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>Settings saved successfully.</span>
        </div>
      )}
      {(saveError || loadError) && (
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-red-950/40 border border-red-900/60 text-red-200 text-xs">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
          <span>{saveError || loadError}</span>
        </div>
      )}

      {/* ── Layout ──────────────────────────────────────────────────────── */}
      <form id="settings-form" onSubmit={handleSave}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* Left nav */}
          <div className="lg:col-span-3 bg-[#0e0f14]/60 border border-[#23242B] rounded-2xl p-2 space-y-0.5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition-all ${
                  activeTab === tab.id
                    ? "bg-violet-600/90 text-white shadow-md shadow-violet-950/50"
                    : "text-slate-400 hover:text-white hover:bg-slate-900/50"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {tab.icon}
                  {tab.label}
                </div>
                {activeTab === tab.id && <ChevronRight className="h-3.5 w-3.5 opacity-70" />}
              </button>
            ))}
          </div>

          {/* Right panel */}
          <div className="lg:col-span-9 bg-[#0e0f14]/40 border border-[#23242B] rounded-2xl p-6 min-h-[56vh]">

            {/* ══ TAB 1: BUSINESS PROFILE ══ */}
            {activeTab === "profile" && (
              <div className="space-y-5">
                <SectionHeader
                  title="Business Profile"
                  description="Your restaurant's public identity. Used in WhatsApp greetings, receipts, and invoices."
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <FieldGroup label="Restaurant Logo URL" hint="Direct link to your logo image (JPG, PNG, WebP)">
                    <Input value={logoUrl} onChange={setLogoUrl} placeholder="https://example.com/logo.png" />
                  </FieldGroup>

                  <FieldGroup label="Restaurant Name">
                    <Input value={name} onChange={setName} placeholder="e.g. Spice Garden" />
                  </FieldGroup>

                  <FieldGroup label="Owner / Manager Name">
                    <Input value={ownerName} onChange={setOwnerName} placeholder="e.g. Rajesh Sharma" />
                  </FieldGroup>

                  <FieldGroup label="Business Phone">
                    <Input value={phoneNumber} onChange={setPhoneNumber} placeholder="+91 98765 43210" type="tel" />
                  </FieldGroup>

                  <FieldGroup label="Business Email">
                    <Input value={email} onChange={setEmail} placeholder="info@spicegarden.in" type="email" />
                  </FieldGroup>

                  <FieldGroup label="Pincode">
                    <Input value={pincode} onChange={setPincode} placeholder="400001" />
                  </FieldGroup>

                  <FieldGroup label="Address" hint="Used for receipt printing and GST invoices">
                    <Input value={address} onChange={setAddress} placeholder="e.g. 12/B, MG Road" />
                  </FieldGroup>

                  <FieldGroup label="City">
                    <Input value={city} onChange={setCity} placeholder="e.g. Mumbai" />
                  </FieldGroup>

                  <FieldGroup label="State">
                    <Input value={state} onChange={setState} placeholder="e.g. Maharashtra" />
                  </FieldGroup>
                </div>
              </div>
            )}

            {/* ══ TAB 2: TAX & BILLING ══ */}
            {activeTab === "tax" && (
              <div className="space-y-5">
                <SectionHeader
                  title="Tax & Billing"
                  description="GST configuration is used by the invoice generator and checkout billing."
                />

                <Toggle
                  checked={gstEnabled}
                  onChange={setGstEnabled}
                  label="GST Enabled"
                  description="Enable Goods & Services Tax on customer orders"
                />

                {/* GST fields — only shown when GST is enabled */}
                <div
                  className={`overflow-hidden transition-all duration-300 ${
                    gstEnabled ? "max-h-96 opacity-100" : "max-h-0 opacity-0 pointer-events-none"
                  }`}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
                    <FieldGroup
                      label="GST Number"
                      hint="15-character GSTIN (e.g. 27AAAAA0000A1Z5)"
                    >
                      <Input
                        value={gstNumber}
                        onChange={setGstNumber}
                        placeholder="27AAAAA0000A1Z5"
                      />
                    </FieldGroup>

                    <FieldGroup label="GST Percentage (%)" hint="Applied to every taxable order">
                      <Input
                        value={gstPercentage}
                        onChange={setGstPercentage}
                        placeholder="18"
                        type="number"
                      />
                    </FieldGroup>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-[#23242B]/50 pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="h-4 w-4 text-slate-500" />
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                      FSSAI Registration
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <FieldGroup
                      label="FSSAI License Number"
                      hint="Optional — shown on receipts if provided"
                    >
                      <Input
                        value={fssaiNumber}
                        onChange={setFssaiNumber}
                        placeholder="10012345000123"
                      />
                    </FieldGroup>
                  </div>
                </div>

                {/* Future compatibility note */}
                <div className="flex items-start gap-3 p-4 rounded-xl bg-violet-950/10 border border-violet-800/30 text-xs text-violet-300/80">
                  <BadgeIndianRupee className="h-4 w-4 mt-0.5 shrink-0 text-violet-400" />
                  <div>
                    <span className="font-semibold text-violet-300 block mb-0.5">Invoice Ready</span>
                    These fields are used directly by the Invoice Generator module. Ensure accuracy before enabling GST billing for customers.
                  </div>
                </div>
              </div>
            )}

            {/* ══ TAB 3: PAYMENT SETTINGS ══ */}
            {activeTab === "payment" && (
              <div className="space-y-6">
                <SectionHeader
                  title="Payment Orchestration & Gateway Settings"
                  description="Connect preferred automated payment gateways or configure Manual UPI and Cash on Delivery."
                />

                {/* ── 1. UNIVERSAL PAYMENT ORCHESTRATION ENGINE ── */}
                <div className="space-y-4 bg-[#0a0b10] border border-[#23242B] rounded-2xl p-5">
                  <div className="flex flex-wrap justify-between items-center gap-2 border-b border-[#23242B]/60 pb-3">
                    <div>
                      <span className="text-xs font-bold text-white font-sora block">Automated Payment Gateways</span>
                      <span className="text-[10px] text-slate-400">Restroex manages complete payment lifecycle & auto order confirmations.</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Master Online Gateways</span>
                      <Toggle
                        checked={onlinePaymentsEnabled}
                        onChange={setOnlinePaymentsEnabled}
                        label=""
                        description=""
                      />
                    </div>
                  </div>

                  {/* Provider Selection Cards */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Select Gateway to Connect / Configure</span>
                      {hasUnsavedChanges && (
                        <span className="text-[10px] text-amber-400 font-semibold bg-amber-950/60 border border-amber-800/80 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                          <AlertCircle className="w-3 h-3" /> Unsaved Changes
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {[
                        { id: "razorpay", name: "Razorpay PG", desc: "UPI, Cards, NetBanking", fields: [{ key: "key_id", label: "Key ID", placeholder: "rzp_live_..." }, { key: "key_secret", label: "Key Secret", placeholder: "••••••••••••", secret: true }] },
                        { id: "cashfree", name: "Cashfree", desc: "Instant Settlement & UPI Links", fields: [{ key: "app_id", label: "App ID", placeholder: "CF_APP_..." }, { key: "secret_key", label: "Secret Key", placeholder: "••••••••••••", secret: true }] },
                        { id: "phonepe", name: "PhonePe PG", desc: "Dynamic QR & UPI Intent", fields: [{ key: "merchant_id", label: "Merchant ID", placeholder: "PGMERCHANT..." }, { key: "salt_key", label: "Salt Key", placeholder: "••••••••••••", secret: true }] },
                        { id: "payu", name: "PayU Biz", desc: "Enterprise Gateway", fields: [{ key: "merchant_key", label: "Merchant Key", placeholder: "PAYU_KEY..." }, { key: "merchant_salt", label: "Merchant Salt", placeholder: "••••••••••••", secret: true }] },
                        { id: "easebuzz", name: "Easebuzz", desc: "Low-cost Indian PG", fields: [{ key: "merchant_key", label: "Merchant Key", placeholder: "EASE_KEY..." }, { key: "salt", label: "Salt", placeholder: "••••••••••••", secret: true }] },
                        { id: "stripe", name: "Stripe", desc: "International Cards", fields: [{ key: "api_key", label: "Secret API Key", placeholder: "sk_live_...", secret: true }] },
                      ].map((gw) => {
                        const existingCfg = gatewayConfigs.find((c) => c.providerName === gw.id);
                        const isEnabledInDb = existingCfg?.isEnabled ?? false;
                        const status = isEnabledInDb ? (existingCfg?.status ?? "not_connected") : "not_connected";
                        const isSelected = selectedProviderId === gw.id;

                        return (
                          <button
                            key={gw.id}
                            type="button"
                            onClick={() => {
                              setSelectedProviderId(gw.id);
                              setIsGwEnabled(existingCfg?.isEnabled ?? false);
                              setIsSandboxMode(existingCfg?.isSandbox ?? true);
                              setGwCredentials(existingCfg?.credentials || {});
                              setGwWebhookSecret(existingCfg?.webhookSecret || "");
                              setGwTestResult(null);
                              setHasUnsavedChanges(false);
                              setSaveError(null);
                            }}
                            className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden ${
                              isSelected
                                ? "bg-violet-950/40 border-violet-500 text-white shadow-lg shadow-violet-950/30"
                                : "bg-[#0e0f14] border-[#23242B] text-slate-300 hover:border-slate-700"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs">{gw.name}</span>
                              <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${
                                isEnabledInDb && status === "connected"
                                  ? "bg-emerald-950/80 text-emerald-400 border-emerald-800"
                                  : isEnabledInDb && status === "invalid_credentials"
                                  ? "bg-amber-950/80 text-amber-400 border-amber-800"
                                  : isEnabledInDb && (status === "configuration_error" || status === "provider_offline")
                                  ? "bg-red-950/80 text-red-400 border-red-800"
                                  : "bg-slate-900 text-slate-400 border-slate-700"
                              }`}>
                                {isEnabledInDb && status === "connected" && "Enabled"}
                                {isEnabledInDb && status === "invalid_credentials" && "Invalid Keys"}
                                {(!isEnabledInDb || status === "not_connected") && "Disabled"}
                                {isEnabledInDb && status === "provider_offline" && "Offline"}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-500 block mt-1 line-clamp-1">{gw.desc}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Active Selected Provider Form */}
                  {(() => {
                    const activeGwCard = [
                      { id: "razorpay", name: "Razorpay PG", desc: "UPI, Cards, NetBanking", fields: [{ key: "key_id", label: "Key ID", placeholder: "rzp_live_..." }, { key: "key_secret", label: "Key Secret", placeholder: "••••••••••••", secret: true }] },
                      { id: "cashfree", name: "Cashfree", desc: "Instant Settlement & UPI Links", fields: [{ key: "app_id", label: "App ID", placeholder: "CF_APP_..." }, { key: "secret_key", label: "Secret Key", placeholder: "••••••••••••", secret: true }] },
                      { id: "phonepe", name: "PhonePe PG", desc: "Dynamic QR & UPI Intent", fields: [{ key: "merchant_id", label: "Merchant ID", placeholder: "PGMERCHANT..." }, { key: "salt_key", label: "Salt Key", placeholder: "••••••••••••", secret: true }] },
                      { id: "payu", name: "PayU Biz", desc: "Enterprise Gateway", fields: [{ key: "merchant_key", label: "Merchant Key", placeholder: "PAYU_KEY..." }, { key: "merchant_salt", label: "Merchant Salt", placeholder: "••••••••••••", secret: true }] },
                      { id: "easebuzz", name: "Easebuzz", desc: "Low-cost Indian PG", fields: [{ key: "merchant_key", label: "Merchant Key", placeholder: "EASE_KEY..." }, { key: "salt", label: "Salt", placeholder: "••••••••••••", secret: true }] },
                      { id: "stripe", name: "Stripe", desc: "International Cards", fields: [{ key: "api_key", label: "Secret API Key", placeholder: "sk_live_...", secret: true }] },
                    ].find((g) => g.id === selectedProviderId) || { id: "razorpay", name: "Razorpay PG", desc: "", fields: [] };

                    return (
                      <div className="p-4 rounded-xl bg-slate-950/60 border border-[#23242B] space-y-4 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#23242B]/60 pb-3">
                          <div>
                            <span className="font-bold text-white font-sora text-sm">{activeGwCard.name} Configuration</span>
                            <span className="text-[10px] text-slate-500 block">({activeGwCard.desc})</span>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-slate-400 font-semibold">Sandbox</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsSandboxMode(!isSandboxMode);
                                  setHasUnsavedChanges(true);
                                }}
                                className={`w-8 h-4 rounded-full transition-colors p-0.5 ${isSandboxMode ? "bg-amber-600" : "bg-emerald-600"}`}
                              >
                                <div className={`w-3 h-3 rounded-full bg-white transition-transform ${isSandboxMode ? "translate-x-0" : "translate-x-4"}`} />
                              </button>
                              <span className="text-[10px] text-slate-400 font-semibold">Production</span>
                            </div>

                            <div className="flex items-center gap-2 border-l border-[#23242B] pl-4">
                              <span className="text-[10px] text-slate-400 font-semibold">Enable Provider</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsGwEnabled(!isGwEnabled);
                                  setHasUnsavedChanges(true);
                                }}
                                className={`w-8 h-4 rounded-full transition-colors p-0.5 ${isGwEnabled ? "bg-emerald-600" : "bg-slate-700"}`}
                              >
                                <div className={`w-3 h-3 rounded-full bg-white transition-transform ${isGwEnabled ? "translate-x-4" : "translate-x-0"}`} />
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {activeGwCard.fields.map((f) => (
                            <FieldGroup key={f.key} label={f.label}>
                              <Input
                                type={f.secret ? "password" : "text"}
                                value={gwCredentials[f.key] || ""}
                                onChange={(val) => {
                                  setGwCredentials({ ...gwCredentials, [f.key]: val });
                                  setGwTestResult(null);
                                  setHasUnsavedChanges(true);
                                }}
                                placeholder={f.placeholder}
                              />
                            </FieldGroup>
                          ))}

                          <FieldGroup label="Webhook Signing Secret (Optional)">
                            <Input
                              type="password"
                              value={gwWebhookSecret}
                              onChange={(val) => {
                                setGwWebhookSecret(val);
                                setHasUnsavedChanges(true);
                              }}
                              placeholder="whsec_..."
                            />
                          </FieldGroup>
                        </div>

                        {gwTestResult && (
                          <div className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                            gwTestResult.isHealthy
                              ? "bg-emerald-950/30 border-emerald-900/60 text-emerald-300"
                              : "bg-amber-950/30 border-amber-900/60 text-amber-300"
                          }`}>
                            <span>{gwTestResult.message}</span>
                            {gwTestResult.latencyMs && (
                              <span className="text-[10px] font-mono text-slate-400">{gwTestResult.latencyMs}ms</span>
                            )}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#23242B]/60 pt-3">
                          <button
                            type="button"
                            disabled={isTestingGw}
                            onClick={async () => {
                              try {
                                setIsTestingGw(true);
                                setGwTestResult(null);
                                setSaveError(null);
                                const { PaymentsService } = require("../../../lib/services/payments.service");
                                const res = await PaymentsService.testGatewayConnection({
                                  restaurantId: currentRestaurantId,
                                  providerName: selectedProviderId,
                                  credentials: gwCredentials
                                });
                                setGwTestResult(res);
                              } catch (err: any) {
                                setSaveError(err.message || "Test connection failed");
                              } finally {
                                setIsTestingGw(false);
                              }
                            }}
                            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-[#23242B] text-slate-200 text-xs font-semibold transition-all active:scale-95 disabled:opacity-50"
                          >
                            {isTestingGw ? "Testing Connection..." : "⚡ Test Gateway Connection (Backend API)"}
                          </button>

                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                setIsSaving(true);
                                setSaveError(null);
                                const { PaymentsService } = require("../../../lib/services/payments.service");
                                await PaymentsService.saveGatewayConfig({
                                  restaurantId: currentRestaurantId,
                                  providerName: selectedProviderId,
                                  credentials: gwCredentials,
                                  isEnabled: isGwEnabled,
                                  isSandbox: isSandboxMode,
                                  webhookSecret: gwWebhookSecret
                                });
                                setSaveSuccess(true);
                                await loadGatewayConfigs(currentRestaurantId, selectedProviderId);
                                setTimeout(() => setSaveSuccess(false), 3000);
                              } catch (err: any) {
                                setSaveError(err.message || "Failed to save gateway config");
                              } finally {
                                setIsSaving(false);
                              }
                            }}
                            className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-all active:scale-95 flex items-center gap-1.5"
                          >
                            <Save className="w-3.5 h-3.5" /> Save Configuration
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* ── 2. MANUAL METHODS (MANUAL UPI & COD) ── */}
                <div className="space-y-3 border-t border-[#23242B]/60 pt-5">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Manual Payment Fallbacks</p>
                  <Toggle
                    checked={manualUpiEnabled}
                    onChange={setManualUpiEnabled}
                    label="Manual UPI (Prepaid)"
                    description="Customer pays via UPI and sends screenshot for verification"
                  />
                  <Toggle
                    checked={codEnabled}
                    onChange={setCodEnabled}
                    label="Cash on Delivery (COD)"
                    description="Order is confirmed immediately without prepayment"
                  />
                </div>

                {/* UPI Config — visible only when Manual UPI is enabled */}
                <div
                  className={`overflow-hidden transition-all duration-300 ${
                    manualUpiEnabled ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0 pointer-events-none"
                  }`}
                >
                  <div className="border-t border-[#23242B]/50 pt-4 space-y-4">
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-4 w-4 text-slate-500" />
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Manual UPI Details</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <FieldGroup
                        label="Merchant Name"
                        hint="Displayed on the UPI payment screen"
                      >
                        <Input
                          value={upiMerchantName}
                          onChange={setUpiMerchantName}
                          placeholder="e.g. Spice Garden"
                        />
                      </FieldGroup>

                      <FieldGroup
                        label="UPI ID"
                        hint="e.g. spicegarden@okicici"
                      >
                        <Input
                          value={upiId}
                          onChange={setUpiId}
                          placeholder="merchant@bank"
                        />
                      </FieldGroup>

                      <div className="sm:col-span-2">
                        <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1.5">UPI QR Code Image</label>
                        <div className="flex flex-col sm:flex-row gap-4 items-start">
                          {upiQrImageUrl ? (
                            <div className="relative group rounded-xl overflow-hidden border border-[#23242B] bg-[#0A0B10] w-36 h-36 flex items-center justify-center shrink-0">
                              <img src={upiQrImageUrl} alt="UPI QR" className="max-w-full max-h-full object-contain p-2" />
                              <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setUpiQrImageUrl("")}
                                  className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors text-xs font-semibold"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          ) : null}
                          <div className="flex-1 w-full">
                            <label className="flex flex-col items-center justify-center w-full h-36 border border-dashed border-[#23242B] rounded-xl cursor-pointer hover:bg-white/5 transition-colors">
                              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <Upload className="w-6 h-6 text-slate-500 mb-2" />
                                <p className="text-xs text-slate-400"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                                <p className="text-[10px] text-slate-500 mt-1">PNG, JPG, JPEG (Max. 5MB)</p>
                              </div>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    try {
                                      setSaveError(null);
                                      const { UploadService } = require("../../../lib/services/upload.service");
                                      const res = await UploadService.uploadFile(file);
                                      setUpiQrImageUrl(res.url);
                                    } catch (err: any) {
                                      setSaveError(err.message || "Failed to upload image");
                                    }
                                  }
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Live preview */}
                    {(upiId || upiMerchantName) && (
                      <div className="flex items-start gap-3 p-4 rounded-xl bg-violet-950/10 border border-violet-800/30 text-xs text-violet-300/80">
                        <Smartphone className="h-4 w-4 mt-0.5 shrink-0 text-violet-400" />
                        <div>
                          <span className="font-semibold text-violet-300 block mb-1">Payment Preview</span>
                          <span className="block text-slate-400">Merchant: <span className="text-white">{upiMerchantName || '—'}</span></span>
                          <span className="block text-slate-400">UPI ID: <span className="text-white font-mono">{upiId || '—'}</span></span>
                          {upiQrImageUrl && <span className="block text-emerald-400 mt-1">✓ QR Image configured</span>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Policy note */}
                {!codEnabled && !manualUpiEnabled && (
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-950/20 border border-amber-800/30 text-xs text-amber-300/80">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-amber-400" />
                    <div>
                      <span className="font-semibold text-amber-300 block mb-0.5">No Payment Method Enabled</span>
                      Enable at least one payment method. Manual UPI will be used as fallback if both are disabled.
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ══ TAB 4: STORE SETTINGS ══ */}
            {activeTab === "store" && (
              <div className="space-y-5">
                <SectionHeader
                  title="Store Settings"
                  description="These values are used by the WhatsApp bot at checkout — preparation time, pickup mode, and instructions."
                />

                <Toggle
                  checked={pickupAvailable}
                  onChange={setPickupAvailable}
                  label="Pickup Available"
                  description="Allow customers to pick up their orders directly from the restaurant"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <FieldGroup
                    label="Estimated Prep Time (minutes)"
                    hint="Communicated to the customer after order confirmation"
                  >
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-600" />
                      <input
                        type="number"
                        min="0"
                        value={prepTime}
                        onChange={(e) => setPrepTime(e.target.value)}
                        placeholder="15"
                        className="w-full bg-[#0a0b10] border border-[#23242B] focus:border-violet-500/70 rounded-xl pl-9 pr-3 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none transition-colors text-xs"
                      />
                    </div>
                  </FieldGroup>
                </div>

                <FieldGroup
                  label="Pickup Instructions"
                  hint="Shown to customers who choose pickup — location, parking, counter number, etc."
                >
                  <textarea
                    value={pickupInstructions}
                    onChange={(e) => setPickupInstructions(e.target.value)}
                    rows={3}
                    placeholder="e.g. Please collect your order from Counter 3, near the main entrance."
                    className="w-full bg-[#0a0b10] border border-[#23242B] focus:border-violet-500/70 rounded-xl px-3 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none transition-colors text-xs resize-none"
                  />
                </FieldGroup>

                {/* WhatsApp bot integration note */}
                <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-950/10 border border-emerald-800/30 text-xs text-emerald-300/80">
                  <PackageCheck className="h-4 w-4 mt-0.5 shrink-0 text-emerald-400" />
                  <div>
                    <span className="font-semibold text-emerald-300 block mb-0.5">WhatsApp Integration</span>
                    The preparation time and pickup instructions are sent to customers automatically at checkout via the WhatsApp bot.
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </form>
    </div>
  );
}
