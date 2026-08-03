"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ChargesService, RestaurantCharge, BillingBreakdown, RoundOffMode } from "../../../../lib/services/charges.service";
import { SettingsService } from "../../../../lib/services/settings.service";
import { useToast } from "../../../../components/ui/ToastContainer";
import CustomerInvoice from "../../../../components/shared/CustomerInvoice";
import Button from "../../../../components/ui/Button";
import Badge from "../../../../components/ui/Badge";
import Card from "../../../../components/ui/Card";
import { Modal } from "../../../../components/ui/Modal";
import {
  Receipt,
  Plus,
  Trash2,
  Lock,
  Percent,
  DollarSign,
  Info,
  Check,
  RefreshCw,
  Sliders,
  ShieldCheck,
  Calculator
} from "lucide-react";

interface Props {
  restaurantId: string;
}

export default function TaxesAndChargesTab({ restaurantId }: Props) {
  const toast = useToast();
  const [charges, setCharges] = useState<RestaurantCharge[]>([]);
  const [roundOffMode, setRoundOffMode] = useState<RoundOffMode>("nearest");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [previewBreakdown, setPreviewBreakdown] = useState<BillingBreakdown | null>(null);

  // Custom Charge Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customType, setCustomType] = useState<"tax" | "fee">("fee");
  const [customCalcType, setCustomCalcType] = useState<"fixed" | "percentage">("fixed");
  const [customValue, setCustomValue] = useState<number>(10);
  const [customPricingType, setCustomPricingType] = useState<"exclusive" | "inclusive">("exclusive");
  const [customScope, setCustomScope] = useState<"order" | "item">("order");
  const [customApplyOn, setCustomApplyOn] = useState<string[]>(["dining", "takeaway", "delivery"]);
  const [customShowInvoice, setCustomShowInvoice] = useState(true);

  // Load Charges & Settings
  const loadChargesData = useCallback(async () => {
    if (!restaurantId) return;
    try {
      setIsLoading(true);
      const data = await ChargesService.getCharges(restaurantId);
      const safeCharges = Array.isArray(data?.charges) ? data.charges : [];
      setCharges(safeCharges);
      if (data?.roundOffMode) setRoundOffMode(data.roundOffMode);
    } catch (err: any) {
      toast.error("Failed to Load Charges", err.message || "Could not load settings");
      setCharges([]);
    } finally {
      setIsLoading(false);
    }
  }, [restaurantId, toast]);

  useEffect(() => {
    loadChargesData();
  }, [restaurantId]);

  // Recalculate Live Receipt Preview
  const updateLivePreview = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const sampleItems = [
        { name: "Paneer Tikka", quantity: 1, unitPrice: 200, totalPrice: 200 },
        { name: "Butter Naan", quantity: 2, unitPrice: 40, totalPrice: 80 },
      ];
      const res = await ChargesService.calculateBreakdown({
        restaurantId,
        items: sampleItems,
        orderType: "takeaway",
        customCharges: Array.isArray(charges) ? charges : [],
        roundOffMode,
      });
      if (res) setPreviewBreakdown(res);
    } catch (err) {
      console.warn("Live Preview Error:", err);
    }
  }, [restaurantId, charges, roundOffMode]);

  useEffect(() => {
    if (Array.isArray(charges) && charges.length > 0) {
      updateLivePreview();
    }
  }, [charges, roundOffMode]);

  // Handle Toggle Charge Enabled
  const handleToggleCharge = async (charge: RestaurantCharge) => {
    const updated = !charge.enabled;
    setCharges((prev) => prev.map((c) => (c.id === charge.id ? { ...c, enabled: updated } : c)));

    try {
      await ChargesService.updateCharge(charge.id, restaurantId, { enabled: updated });
      toast.success(`${charge.name} Updated`, updated ? "Enabled charge" : "Disabled charge");
    } catch (err: any) {
      toast.error("Update Failed", err.message);
      loadChargesData();
    }
  };

  // Handle Update System Charge Field (GST rate, pricing type, etc.)
  const handleUpdateChargeField = async (chargeId: string, updates: Partial<RestaurantCharge>) => {
    setCharges((prev) => prev.map((c) => (c.id === chargeId ? { ...c, ...updates } : c)));

    try {
      await ChargesService.updateCharge(chargeId, restaurantId, updates);
      toast.success("Settings Saved", "Charge configuration updated.");
    } catch (err: any) {
      toast.error("Save Failed", err.message);
      loadChargesData();
    }
  };

  // Handle Round Off Mode Change
  const handleRoundOffChange = async (mode: RoundOffMode) => {
    setRoundOffMode(mode);
    try {
      await SettingsService.updateSettings({ roundOffMode: mode } as any);
      toast.success("Round Off Updated", `Set to ${mode.toUpperCase().replace('_', ' ')}`);
    } catch (err: any) {
      toast.error("Update Failed", err.message);
    }
  };

  // Handle Delete Custom Charge
  const handleDeleteCustomCharge = async (charge: RestaurantCharge) => {
    if (charge.isSystem) {
      toast.error("Action Prohibited", "System protected charges cannot be deleted.");
      return;
    }

    try {
      await ChargesService.deleteCharge(charge.id, restaurantId);
      setCharges((prev) => prev.filter((c) => c.id !== charge.id));
      toast.success("Charge Deleted", `${charge.name} removed successfully.`);
    } catch (err: any) {
      toast.error("Delete Failed", err.message);
    }
  };

  // Handle Add Custom Charge Submit
  const handleAddCustomCharge = async () => {
    if (!customName.trim()) {
      toast.error("Validation Error", "Please enter a charge name");
      return;
    }

    try {
      setIsSaving(true);
      const created = await ChargesService.createCharge({
        restaurantId,
        name: customName.trim(),
        type: customType,
        calculationType: customCalcType,
        value: Number(customValue),
        pricingType: customPricingType,
        scope: customScope,
        applyOn: customApplyOn,
        showOnInvoice: customShowInvoice,
        enabled: true,
      });

      setCharges((prev) => [...prev, created]);
      toast.success("Custom Charge Created", `${created.name} added to billing engine.`);
      setIsModalOpen(false);
      setCustomName("");
    } catch (err: any) {
      toast.error("Creation Failed", err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const safeChargesList = Array.isArray(charges) ? charges : [];
  const gstCharge = safeChargesList.find((c) => c?.name === "GST" && c?.isSystem);
  const packagingCharge = safeChargesList.find((c) => c?.name === "Packaging Charge" && c?.isSystem);
  const serviceCharge = safeChargesList.find((c) => c?.name === "Service Charge" && c?.isSystem);
  const deliveryCharge = safeChargesList.find((c) => c?.name === "Delivery Charge" && c?.isSystem);
  const customChargesList = safeChargesList.filter((c) => c && !c.isSystem);

  if (isLoading) {
    return (
      <div className="p-8 text-center text-xs font-semibold text-slate-500 flex items-center justify-center gap-2">
        <RefreshCw className="h-4 w-4 animate-spin text-brand-600" />
        <span>Loading Taxes & Billing Engine...</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Column: Settings & Configuration (2 Cols) */}
      <div className="lg:col-span-2 space-y-6">

        {/* 1. GST System Module (Protected) */}
        <Card className="space-y-4 border-l-4 border-l-brand-500">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="h-5 w-5 text-brand-600 dark:text-brand-400" />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-heading font-extrabold text-sm text-slate-900 dark:text-slate-100">
                    Goods & Services Tax (GST)
                  </h3>
                  <Badge variant="brand" size="sm" className="font-bold text-[10px]">
                    PROTECTED SYSTEM MODULE
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Configure tax percentage & inclusive/exclusive billing rules.
                </p>
              </div>
            </div>

            {gstCharge && (
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={gstCharge.enabled}
                  onChange={() => handleToggleCharge(gstCharge)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600" />
              </label>
            )}
          </div>

          {gstCharge && gstCharge.enabled && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1">
              {/* GST Rate Selection */}
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  GST Rate Percentage
                </label>
                <div className="flex items-center gap-2">
                  {[0, 5, 12, 18, 28].map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => handleUpdateChargeField(gstCharge.id, { value: rate })}
                      className={`px-3 py-1.5 rounded-xl font-extrabold text-xs border transition cursor-pointer ${
                        gstCharge.value === rate
                          ? "bg-brand-600 text-white border-brand-600 shadow-xs"
                          : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                      }`}
                    >
                      {rate}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Pricing Type (Inclusive vs Exclusive) */}
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Tax Calculation Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleUpdateChargeField(gstCharge.id, { pricingType: "exclusive" })}
                    className={`p-2 rounded-xl border text-left transition cursor-pointer ${
                      gstCharge.pricingType === "exclusive"
                        ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-300 font-bold"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                    }`}
                  >
                    <span className="block font-bold text-xs">EXCLUSIVE</span>
                    <span className="text-[10px] text-slate-500 block font-normal">₹100 + ₹5 GST = ₹105</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleUpdateChargeField(gstCharge.id, { pricingType: "inclusive" })}
                    className={`p-2 rounded-xl border text-left transition cursor-pointer ${
                      gstCharge.pricingType === "inclusive"
                        ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 text-blue-950 dark:text-blue-300 font-bold"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                    }`}
                  >
                    <span className="block font-bold text-xs">INCLUSIVE</span>
                    <span className="text-[10px] text-slate-500 block font-normal">₹100 (incl. ₹4.76 GST)</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* 2. Built-in System Charges (Packaging, Service, Delivery) */}
        <Card className="space-y-4">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="font-heading font-extrabold text-sm text-slate-900 dark:text-slate-100">
              Built-in System Charges
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Manage core restaurant fees (Packaging, Service, and Delivery).
            </p>
          </div>

          <div className="space-y-3 text-xs">
            {[packagingCharge, serviceCharge, deliveryCharge].filter(Boolean).map((ch) => {
              const charge = ch!;
              return (
                <div
                  key={charge.id}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-slate-900 dark:text-slate-100">{charge.name}</span>
                      <Badge variant="neutral" size="sm" className="text-[10px]">
                        SYSTEM
                      </Badge>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={charge.enabled}
                        onChange={() => handleToggleCharge(charge)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-brand-600" />
                    </label>
                  </div>

                  {charge.enabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                      <div>
                        <span className="text-[11px] text-slate-500 block mb-1">Calculation Type</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleUpdateChargeField(charge.id, { calculationType: "fixed" })}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                              charge.calculationType === "fixed" ? "bg-brand-600 text-white border-brand-600" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                            }`}
                          >
                            Fixed (₹)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateChargeField(charge.id, { calculationType: "percentage" })}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                              charge.calculationType === "percentage" ? "bg-brand-600 text-white border-brand-600" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                            }`}
                          >
                            Percent (%)
                          </button>
                        </div>
                      </div>

                      <div>
                        <span className="text-[11px] text-slate-500 block mb-1">Charge Value</span>
                        <input
                          type="number"
                          value={charge.value}
                          onChange={(e) => handleUpdateChargeField(charge.id, { value: Number(e.target.value) })}
                          className="w-full px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-slate-100"
                          placeholder="0.00"
                        />
                      </div>

                      <div>
                        <span className="text-[11px] text-slate-500 block mb-1">Apply On Orders</span>
                        <div className="flex items-center gap-1.5 pt-1">
                          {["dining", "takeaway", "delivery"].map((mode) => {
                            const active = charge.applyOn.includes(mode);
                            return (
                              <button
                                key={mode}
                                type="button"
                                onClick={() => {
                                  const nextApply = active
                                    ? charge.applyOn.filter((m) => m !== mode)
                                    : [...charge.applyOn, mode];
                                  handleUpdateChargeField(charge.id, { applyOn: nextApply });
                                }}
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase transition cursor-pointer ${
                                  active ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30" : "bg-slate-200/60 dark:bg-slate-800 text-slate-400"
                                }`}
                              >
                                {mode}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* 3. Custom Charges Section */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="font-heading font-extrabold text-sm text-slate-900 dark:text-slate-100">
                Custom Taxes & Fees
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Add unlimited custom fees (Eco Packaging, Municipality Tax, Night Charge).
              </p>
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsModalOpen(true)}
              className="gap-1.5 font-bold"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Custom Charge</span>
            </Button>
          </div>

          <div className="space-y-2 text-xs">
            {customChargesList.length === 0 ? (
              <div className="p-4 text-center text-slate-400 italic bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                No custom charges created yet. Click "+ Add Custom Charge" above to add rules like Eco Fee, Weekend Charge, etc.
              </div>
            ) : (
              customChargesList.map((charge) => (
                <div
                  key={charge.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <span className="font-bold text-slate-900 dark:text-slate-100 block">{charge.name}</span>
                      <span className="text-[11px] text-slate-500">
                        {charge.calculationType === "percentage" ? `${charge.value}%` : `₹${charge.value}`} • {charge.type.toUpperCase()} • {charge.applyOn.join(", ")}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={charge.enabled}
                        onChange={() => handleToggleCharge(charge)}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600" />
                    </label>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteCustomCharge(charge)}
                      className="text-rose-500 p-1 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* 4. Round Off Settings Card */}
        <Card className="space-y-3 border-l-4 border-l-indigo-500">
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-indigo-500" />
            <div>
              <h3 className="font-heading font-extrabold text-sm text-slate-900 dark:text-slate-100">
                Invoice Round Off Pipeline
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Automatically round off total payable bill amount before checkout.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
            {[
              { id: "nearest", label: "Nearest (Default)", sub: "₹102.4 -> ₹102" },
              { id: "round_up", label: "Round Up (Ceil)", sub: "₹102.1 -> ₹103" },
              { id: "round_down", label: "Round Down (Floor)", sub: "₹102.9 -> ₹102" },
              { id: "disabled", label: "Disabled", sub: "Exact decimal ₹102.45" },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => handleRoundOffChange(m.id as RoundOffMode)}
                className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                  roundOffMode === m.id
                    ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-950 dark:text-indigo-200 font-bold"
                    : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                }`}
              >
                <span className="block font-bold text-xs">{m.label}</span>
                <span className="text-[10px] text-slate-400 block font-normal mt-0.5">{m.sub}</span>
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* Right Column: Live Customer Invoice Preview */}
      <div className="space-y-4">
        <div className="sticky top-6">
          {previewBreakdown ? (
            <CustomerInvoice
              invoiceNumber="ORD-PREVIEW"
              restaurantName="Restroex Outlet"
              orderMode="takeaway"
              items={[
                { name: "Paneer Tikka", quantity: 1, unitPrice: 200, totalPrice: 200 },
                { name: "Butter Naan", quantity: 2, unitPrice: 40, totalPrice: 80 },
              ]}
              breakdown={previewBreakdown}
            />
          ) : (
            <div className="p-8 text-center text-xs text-slate-400 italic bg-slate-950 rounded-2xl border border-slate-800">
              Calculating Invoice Preview...
            </div>
          )}
        </div>
      </div>

      {/* Add Custom Charge Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Custom Tax / Fee Charge"
      >
        <div className="space-y-3 text-xs py-1">
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Charge Name</label>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="e.g. Eco Packaging Fee, Night Charge"
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Charge Category</label>
              <select
                value={customType}
                onChange={(e: any) => setCustomType(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl font-medium"
              >
                <option value="fee">Fee / Charge</option>
                <option value="tax">Tax</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Calculation Type</label>
              <select
                value={customCalcType}
                onChange={(e: any) => setCustomCalcType(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl font-medium"
              >
                <option value="fixed">Fixed Amount (₹)</option>
                <option value="percentage">Percentage (%)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Value</label>
              <input
                type="number"
                value={customValue}
                onChange={(e) => setCustomValue(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl font-medium"
                placeholder="10.00"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Charge Scope</label>
              <select
                value={customScope}
                onChange={(e: any) => setCustomScope(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl font-medium"
              >
                <option value="order">Order Level</option>
                <option value="item">Item Level</option>
              </select>
            </div>
          </div>

          <div className="pt-3 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleAddCustomCharge} isLoading={isSaving}>
              Create Charge
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
