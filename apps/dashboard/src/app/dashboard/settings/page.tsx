"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useToast } from "../../../components/ui/ToastContainer";
import Button from "../../../components/ui/Button";
import Badge from "../../../components/ui/Badge";
import Card from "../../../components/ui/Card";
import { Input, Select } from "../../../components/ui/Input";
import { Modal } from "../../../components/ui/Modal";
import TaxesAndChargesTab from "./components/TaxesAndChargesTab";
import {
  Building2,
  Receipt,
  CreditCard,
  Store,
  Save,
  Users,
  Shield,
  Upload,
  QrCode,
  Smartphone,
  CheckCircle2,
  UserPlus,
  Trash2,
  Zap,
  AlertCircle,
  Loader2,
  Globe
} from "lucide-react";
import { SettingsService } from "../../../lib/services/settings.service";
import { PaymentsService } from "../../../lib/services/payments.service";
import { RestaurantPaymentConfig } from "../../../types";

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: "admin" | "manager" | "staff";
}

export default function ProductionSettingsPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<"profile" | "charges" | "tax" | "gateway" | "payment" | "bot" | "team">("profile");
  const [isSaving, setIsSaving] = useState(false);
  const [restaurantId, setRestaurantId] = useState<string>("rest_demo_1001");

  // Restaurant Profile State
  const [restaurantName, setRestaurantName] = useState("Restroex Outlet");
  const [ownerName, setOwnerName] = useState("Restaurant Owner");
  const [phone, setPhone] = useState("+91 9876543210");
  const [address, setAddress] = useState("12/B MG Road, Bangalore");
  const [upiId, setUpiId] = useState("restroex@upi");
  const [upiQrImage, setUpiQrImage] = useState("");

  // V1 Operations Engine Settings State
  const [takeawayEnabled, setTakeawayEnabled] = useState(true);
  const [diningEnabled, setDiningEnabled] = useState(true);
  const [maxActiveOrders, setMaxActiveOrders] = useState(20);
  const [totalTables, setTotalTables] = useState(25);

  // Payment Method Toggles
  const [codEnabled, setCodEnabled] = useState(false);
  const [manualUpiEnabled, setManualUpiEnabled] = useState(true);
  const [onlinePaymentsEnabled, setOnlinePaymentsEnabled] = useState(false);

  // Payment Gateway Orchestrator State
  const [gatewayConfigs, setGatewayConfigs] = useState<RestaurantPaymentConfig[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>("razorpay");
  const [isSandboxMode, setIsSandboxMode] = useState<boolean>(true);
  const [isGwEnabled, setIsGwEnabled] = useState<boolean>(false);
  const [gwCredentials, setGwCredentials] = useState<Record<string, string>>({});
  const [gwWebhookSecret, setGwWebhookSecret] = useState<string>("");
  const [isTestingGw, setIsTestingGw] = useState<boolean>(false);
  const [gwTestResult, setGwTestResult] = useState<{ isHealthy: boolean; message: string; latencyMs?: number } | null>(null);

  // WhatsApp Bot Persona State
  const [autoReply, setAutoReply] = useState(true);
  const [botTone, setBotTone] = useState<"polite" | "urgent" | "hinglish">("hinglish");

  // Team Management State
  const [staffList, setStaffList] = useState<StaffMember[]>([
    { id: "1", name: "Ramesh Kumar", email: "ramesh@restroex.in", role: "admin" },
    { id: "2", name: "Suresh Staff", email: "suresh@restroex.in", role: "staff" },
  ]);
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffEmail, setNewStaffEmail] = useState("");
  const [newStaffRole, setNewStaffRole] = useState<"admin" | "manager" | "staff">("staff");

  // Load Saved Gateway Configurations
  const loadGatewayConfigs = useCallback(async (targetRestaurantId: string, targetProviderId?: string) => {
    try {
      const configs = await PaymentsService.getGatewayConfigs(targetRestaurantId);
      setGatewayConfigs(configs || []);
      const activeId = targetProviderId || selectedProviderId || "razorpay";
      const existingCfg = (configs || []).find((c: any) => c.providerName === activeId);

      setIsGwEnabled(Boolean(existingCfg?.isEnabled ?? false));
      setIsSandboxMode(Boolean(existingCfg?.isSandbox ?? true));
      setGwCredentials(existingCfg?.credentials || {});
      setGwWebhookSecret(existingCfg?.webhookSecret || "");
    } catch (err) {
      console.warn("Failed to load gateway configs:", err);
    }
  }, [selectedProviderId]);

  useEffect(() => {
    SettingsService.getSettings()
      .then((data) => {
        if (data.settings?.restaurantId) {
          setRestaurantId(data.settings.restaurantId);
          loadGatewayConfigs(data.settings.restaurantId);
        }
        if (data.profile) {
          setRestaurantName(data.profile.name || "");
          setOwnerName(data.profile.ownerName || "");
          setPhone(data.profile.phoneNumber || "");
          setAddress(data.profile.address || "");
        }
        if (data.settings) {
          setUpiId(data.settings.upiId || "");
          setUpiQrImage(data.settings.upiQrImageUrl || "");
          setCodEnabled(data.settings.codEnabled ?? false);
          setManualUpiEnabled(data.settings.manualUpiEnabled ?? true);
          setOnlinePaymentsEnabled(data.settings.onlinePaymentsEnabled ?? false);
          if (Array.isArray(data.settings.supportedOrderModes)) {
            setTakeawayEnabled(data.settings.supportedOrderModes.includes('takeaway'));
            setDiningEnabled(data.settings.supportedOrderModes.includes('dining'));
          }
          if (data.settings.maxActiveOrders !== undefined) setMaxActiveOrders(data.settings.maxActiveOrders);
          if (data.settings.totalTables !== undefined) setTotalTables(data.settings.totalTables);
        }
      })
      .catch((err) => console.error("Failed to load settings:", err));
  }, [loadGatewayConfigs]);

  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    // REVISION 2 VALIDATION: At least one order mode must remain enabled!
    if (!takeawayEnabled && !diningEnabled) {
      toast.error("Validation Error", "At least one order mode (Takeaway or Dining) must remain enabled.");
      return;
    }
    if (maxActiveOrders < 1) {
      toast.error("Validation Error", "Maximum active orders capacity must be at least 1.");
      return;
    }
    if (totalTables < 1) {
      toast.error("Validation Error", "Total tables count must be at least 1.");
      return;
    }

    setIsSaving(true);
    try {
      const modes: string[] = [];
      if (takeawayEnabled) modes.push('takeaway');
      if (diningEnabled) modes.push('dining');

      await SettingsService.updateSettings({
        name: restaurantName,
        ownerName,
        phoneNumber: phone,
        address,
        upiId,
        upiQrImageUrl: upiQrImage,
        codEnabled,
        manualUpiEnabled,
        onlinePaymentsEnabled,
        supportedOrderModes: modes,
        maxActiveOrders,
        totalTables,
      });

      if (restaurantId && selectedProviderId) {
        await PaymentsService.saveGatewayConfig({
          restaurantId,
          providerName: selectedProviderId,
          credentials: gwCredentials,
          isEnabled: isGwEnabled,
          isSandbox: isSandboxMode,
          webhookSecret: gwWebhookSecret,
        });
        await loadGatewayConfigs(restaurantId, selectedProviderId);
      }

      toast.success("Settings Saved", "All restaurant and payment gateway settings updated successfully.");
    } catch (err: any) {
      toast.error("Save Error", err.message || "Failed to update settings.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestGateway = async () => {
    setIsTestingGw(true);
    setGwTestResult(null);
    try {
      const res = await PaymentsService.testGatewayConnection({
        restaurantId,
        providerName: selectedProviderId,
        credentials: gwCredentials,
      });
      setGwTestResult(res);
      if (res.isHealthy) {
        toast.success("Connection Successful", `Gateway latency: ${res.latencyMs || 0}ms`);
      } else {
        toast.error("Gateway Health Failure", res.message);
      }
    } catch (err: any) {
      toast.error("Test Failed", err.message || "Could not test gateway connection.");
    } finally {
      setIsTestingGw(false);
    }
  };

  const handleAddStaff = () => {
    if (!newStaffName || !newStaffEmail) return;
    const newMember: StaffMember = {
      id: Date.now().toString(),
      name: newStaffName,
      email: newStaffEmail,
      role: newStaffRole,
    };
    setStaffList([...staffList, newMember]);
    setIsAddStaffOpen(false);
    setNewStaffName("");
    setNewStaffEmail("");
    toast.success("Staff Added", `${newMember.name} added as ${newMember.role}.`);
  };

  const handleRemoveStaff = (id: string, name: string) => {
    setStaffList(staffList.filter((s) => s.id !== id));
    toast.warning("Staff Removed", `Removed ${name} from team.`);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="font-heading text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100">
            Restaurant & Payment Settings
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Configure business details, Razorpay & online payment gateways, and UPI QR codes.
          </p>
        </div>

        <Button variant="primary" size="sm" onClick={handleSaveSettings} isLoading={isSaving} className="gap-2 font-bold shadow-md">
          <Save className="h-4 w-4" />
          <span>Save All Settings</span>
        </Button>
      </div>

      {/* Tabs Row */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-px overflow-x-auto w-full">
        {[
          { id: "profile", label: "Store Profile", icon: Building2 },
          { id: "charges", label: "Taxes & Charges", icon: Receipt },
          { id: "gateway", label: "Payment Gateway Integration", icon: Zap },
          { id: "payment", label: "UPI & QR Upload", icon: CreditCard },
          { id: "bot", label: "WhatsApp Bot Persona", icon: Smartphone },
        ].map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? "bg-white dark:bg-slate-900 border-x border-t border-slate-200/80 dark:border-slate-800 text-brand-600 dark:text-brand-400"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT 1: Store Profile */}
      {activeTab === "profile" && (
        <Card className="space-y-6">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="font-heading font-bold text-base text-slate-900 dark:text-slate-100">Restaurant Profile Information</h3>
            <p className="text-xs text-slate-500">Public restaurant details sent on WhatsApp order receipts</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <Input label="Restaurant Name" value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)} />
            <Input label="Owner / Manager Name" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
            <Input label="WhatsApp Support Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Input label="Store Address" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
        </Card>
      )}

      {/* TAB CONTENT 2: Payment Gateway Integration (FIX 1 IMPLEMENTATION) */}
      {activeTab === "gateway" && (
        <Card className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="font-heading font-bold text-base text-slate-900 dark:text-slate-100">Online Payment Gateway Integration</h3>
              <p className="text-xs text-slate-500">Configure Razorpay or preferred online payment gateways for automated checkout</p>
            </div>

            <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Accept Online Payments:</span>
              <button
                type="button"
                onClick={() => setOnlinePaymentsEnabled(!onlinePaymentsEnabled)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  onlinePaymentsEnabled ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"
                }`}
              >
                <span className={`inline-block h-5 w-5 rounded-full bg-white transition-transform ${onlinePaymentsEnabled ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>
          </div>

          {/* Accepted Payment Methods Checkboxes */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">Accepted Payment Methods</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer bg-slate-50/50 dark:bg-slate-950/50">
                <input
                  type="checkbox"
                  checked={manualUpiEnabled}
                  onChange={(e) => setManualUpiEnabled(e.target.checked)}
                  className="rounded text-brand-600 focus:ring-brand-500 h-4 w-4"
                />
                <span className="font-semibold text-slate-900 dark:text-slate-100">UPI Manual / OCR Verification</span>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer bg-slate-50/50 dark:bg-slate-950/50">
                <input
                  type="checkbox"
                  checked={onlinePaymentsEnabled}
                  onChange={(e) => setOnlinePaymentsEnabled(e.target.checked)}
                  className="rounded text-brand-600 focus:ring-brand-500 h-4 w-4"
                />
                <span className="font-semibold text-slate-900 dark:text-slate-100">Razorpay / Online Gateways</span>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer bg-slate-50/50 dark:bg-slate-950/50">
                <input
                  type="checkbox"
                  checked={codEnabled}
                  onChange={(e) => setCodEnabled(e.target.checked)}
                  className="rounded text-brand-600 focus:ring-brand-500 h-4 w-4"
                />
                <span className="font-semibold text-slate-900 dark:text-slate-100">Cash on Delivery (COD)</span>
              </label>
            </div>
          </div>

          {/* Gateway Provider Cards Selector */}
          <div className="space-y-3 pt-2">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">Gateway Credentials Config</span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              {[
                { id: "razorpay", name: "Razorpay PG", desc: "UPI, Cards, NetBanking" },
                { id: "cashfree", name: "Cashfree", desc: "Instant Settlement" },
                { id: "phonepe", name: "PhonePe PG", desc: "Dynamic QR & Intent" },
              ].map((gw) => {
                const existingCfg = gatewayConfigs.find((c) => c.providerName === gw.id);
                const isSelected = selectedProviderId === gw.id;
                const isConn = existingCfg?.isEnabled && existingCfg?.status === "connected";

                return (
                  <button
                    key={gw.id}
                    type="button"
                    onClick={() => {
                      setSelectedProviderId(gw.id);
                      loadGatewayConfigs(restaurantId, gw.id);
                    }}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? "border-brand-500 bg-brand-50/40 dark:bg-brand-950/40 shadow-sm"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 dark:text-slate-100">{gw.name}</span>
                      <Badge variant={isConn ? "success" : "neutral"} size="sm">
                        {isConn ? "Connected" : "Not Set"}
                      </Badge>
                    </div>
                    <span className="text-[11px] text-slate-500 block mt-1">{gw.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Credentials Form for Selected Provider */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800 pb-3">
              <span className="font-heading font-bold text-sm text-slate-900 dark:text-slate-100 capitalize">
                {selectedProviderId} API Keys & Webhook Settings
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500 font-semibold">Mode:</span>
                <Button
                  size="sm"
                  variant={isSandboxMode ? "warning" : "success"}
                  onClick={() => setIsSandboxMode(!isSandboxMode)}
                  className="h-7 text-[10px] uppercase font-bold"
                >
                  {isSandboxMode ? "Sandbox Test" : "Production Live"}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="API Key ID / Merchant ID"
                placeholder="rzp_live_..."
                value={gwCredentials["key_id"] || gwCredentials["merchant_id"] || ""}
                onChange={(e) => setGwCredentials({ ...gwCredentials, key_id: e.target.value, merchant_id: e.target.value })}
              />
              <Input
                label="API Key Secret"
                type="password"
                placeholder="••••••••••••••••"
                value={gwCredentials["key_secret"] || gwCredentials["secret_key"] || ""}
                onChange={(e) => setGwCredentials({ ...gwCredentials, key_secret: e.target.value, secret_key: e.target.value })}
              />
            </div>

            <Input
              label="Webhook Signing Secret"
              type="password"
              placeholder="whsec_..."
              value={gwWebhookSecret}
              onChange={(e) => setGwWebhookSecret(e.target.value)}
            />

            {gwTestResult && (
              <div className={`p-3 rounded-xl border flex items-center justify-between ${
                gwTestResult.isHealthy ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-700" : "bg-red-50 dark:bg-red-950/40 border-red-300 text-red-700"
              }`}>
                <span>{gwTestResult.message}</span>
                {gwTestResult.latencyMs && <span className="font-mono">{gwTestResult.latencyMs}ms</span>}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <Button variant="secondary" size="sm" onClick={handleTestGateway} isLoading={isTestingGw} className="gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                <span>Test Gateway Connection</span>
              </Button>
              <Button variant="primary" size="sm" onClick={handleSaveSettings} isLoading={isSaving} className="gap-2">
                <Save className="h-4 w-4" />
                <span>Save Gateway Keys</span>
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* TAB CONTENT 3: UPI & QR Upload */}
      {activeTab === "payment" && (
        <Card className="space-y-6">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="font-heading font-bold text-base text-slate-900 dark:text-slate-100">UPI Payment & QR Code</h3>
            <p className="text-xs text-slate-500">UPI VPA ID and QR code image sent to customer for payment OCR verification</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start text-xs">
            <div className="space-y-4">
              <Input label="UPI ID (VPA)" value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="e.g. restaurant@okicici" />
              <Input label="UPI QR Image URL" value={upiQrImage} onChange={(e) => setUpiQrImage(e.target.value)} placeholder="https://example.com/qr.png" />
            </div>

            <div className="p-5 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-center space-y-3">
              <QrCode className="h-12 w-12 text-brand-600 mx-auto" />
              <div className="space-y-1">
                <span className="font-bold text-slate-900 dark:text-slate-100 text-xs block">UPI QR Code Preview</span>
                <p className="text-[11px] text-slate-500">Customer receives this image on WhatsApp checkout.</p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* TAB CONTENT 4: WhatsApp Bot Persona */}
      {activeTab === "bot" && (
        <Card className="space-y-6">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="font-heading font-bold text-base text-slate-900 dark:text-slate-100">WhatsApp Bot Persona & Tone</h3>
            <p className="text-xs text-slate-500">Configure language style for OpenRouter LLM text responses</p>
          </div>

          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
              <div>
                <span className="font-bold text-slate-900 dark:text-slate-100 block">WhatsApp Auto-Reply</span>
                <span className="text-slate-500 text-[11px]">Automatically respond to customer greeting messages</span>
              </div>
              <button
                type="button"
                onClick={() => setAutoReply(!autoReply)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  autoReply ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"
                }`}
              >
                <span className={`inline-block h-5 w-5 rounded-full bg-white transition-transform ${autoReply ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>

            <div className="space-y-2">
              <label className="font-bold text-slate-700 dark:text-slate-300 block">AI Bot Tone Selector</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {([
                  { id: "hinglish", label: "Hinglish Conversational", desc: "Friendly Indian conversational style" },
                  { id: "polite", label: "Formal English", desc: "Professional e.g. 'Welcome to Restroex. How may I serve you today?'" },
                  { id: "urgent", label: "Express Direct", desc: "Short concise e.g. 'Menu: 1. Butter Chicken 2. Naan. Reply number.'" },
                ] as const).map((t) => (
                  <div
                    key={t.id}
                    onClick={() => setBotTone(t.id)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      botTone === t.id
                        ? "border-brand-500 bg-brand-50/50 dark:bg-brand-950/40"
                        : "border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    <span className="font-bold text-slate-900 dark:text-slate-100 block text-xs mb-1">{t.label}</span>
                    <p className="text-[11px] text-slate-500 leading-relaxed">{t.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* TAB CONTENT 2: Taxes & Charges Module */}
      {activeTab === "charges" && (
        <TaxesAndChargesTab restaurantId={restaurantId} />
      )}

      {/* Add Staff Modal */}
      <Modal
        isOpen={isAddStaffOpen}
        onClose={() => setIsAddStaffOpen(false)}
        title="Add Staff Member"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsAddStaffOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleAddStaff}>Add Member</Button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <Input label="Staff Name" value={newStaffName} onChange={(e) => setNewStaffName(e.target.value)} placeholder="e.g. Rahul Verma" />
          <Input label="Email Address" type="email" value={newStaffEmail} onChange={(e) => setNewStaffEmail(e.target.value)} placeholder="rahul@restroex.in" />
          <Select
            label="Role Permission"
            value={newStaffRole}
            onChange={(e: any) => setNewStaffRole(e.target.value)}
            options={[
              { value: "staff", label: "Staff (KOT & Live Orders)" },
              { value: "manager", label: "Manager (Menu & Refunds)" },
              { value: "admin", label: "Admin (Full Access)" },
            ]}
          />
        </div>
      </Modal>
    </div>
  );
}
