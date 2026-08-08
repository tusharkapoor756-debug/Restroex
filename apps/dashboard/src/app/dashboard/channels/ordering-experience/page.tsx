"use client";

// apps/dashboard/src/app/dashboard/channels/ordering-experience/page.tsx
// Ordering Experience Module — Controls ordering URL, QR codes (Restaurant, Counter, Table-wise),
// GST tax rules, and Pickup configuration. Consumes Brand Identity dataset without duplication.

import React, { useState, useEffect } from "react";
import { SettingsService } from "../../../../lib/services/settings.service";
import { useToast } from "../../../../components/ui/ToastContainer";
import Button from "../../../../components/ui/Button";
import Card from "../../../../components/ui/Card";
import Skeleton from "../../../../components/ui/Skeleton";
import {
  Globe,
  QrCode,
  Receipt,
  ShoppingBag,
  Copy,
  Download,
  ExternalLink,
  CheckCircle2,
  Sparkles,
  Store,
  Layers,
  Clock,
  FileText,
  Percent,
} from "lucide-react";

import { encodeTableToken } from "../../../../lib/utils/tableToken";

export default function OrderingExperiencePage() {
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Store & Settings State
  const [slug, setSlug] = useState<string>("demo");
  const [restaurantName, setRestaurantName] = useState<string>("Restroex Kitchen");
  const [supportedOrderModes, setSupportedOrderModes] = useState<string[]>(["takeaway", "dining"]);
  const [totalTables, setTotalTables] = useState<number>(20);
  const [maxActiveOrders, setMaxActiveOrders] = useState<number>(20);
  const [selectedTableForQr, setSelectedTableForQr] = useState<number>(1);

  // Pickup State
  const [pickupAvailable, setPickupAvailable] = useState<boolean>(true);
  const [prepTime, setPrepTime] = useState<number>(15);
  const [pickupInstructions, setPickupInstructions] = useState<string>("");

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const fullSettings = await SettingsService.getSettings();
      const s = fullSettings.settings;
      const p = fullSettings.profile;

      if (p.name) setRestaurantName(p.name);
      if (s.supportedOrderModes) setSupportedOrderModes(s.supportedOrderModes);
      if (s.totalTables) setTotalTables(s.totalTables);
      if (s.maxActiveOrders) setMaxActiveOrders(s.maxActiveOrders);

      setPickupAvailable(s.pickupAvailable ?? true);
      setPrepTime(s.prepTime ?? 15);
      if (s.pickupInstructions) setPickupInstructions(s.pickupInstructions);

      // Resolve exact restaurant tenant ID or slug
      const session = JSON.parse(localStorage.getItem("restroex_session") || "{}");
      const activeTenantId = s.restaurantId || session.restaurantId || p.slug || session.slug;
      if (activeTenantId) {
        setSlug(activeTenantId);
      }
    } catch (err: any) {
      toast.error("Failed to load settings", err.message || "Could not fetch store configuration");
    } finally {
      setLoading(false);
    }
  };

  const getPublicOrderUrl = (table?: number) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://restroex.com";
    const baseUrl = `${origin}/order/${slug || "demo"}`;
    if (table) {
      const secureToken = encodeTableToken(table);
      return `${baseUrl}?t=${secureToken}`;
    }
    return baseUrl;
  };

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("Link Copied!", "Ordering URL copied to clipboard.");
  };

  const handleOrderModeToggle = (mode: "takeaway" | "dining") => {
    setSupportedOrderModes((prev) => {
      if (prev.includes(mode)) {
        if (prev.length === 1) {
          toast.warning("Mode Required", "At least one order mode must remain enabled.");
          return prev;
        }
        return prev.filter((m) => m !== mode);
      } else {
        return [...prev, mode];
      }
    });
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await SettingsService.updateSettings({
        supportedOrderModes,
        totalTables,
        maxActiveOrders,
        pickupAvailable,
        prepTime,
        pickupInstructions,
      });
      toast.success("Experience Saved", "Ordering experience rules updated successfully!");
    } catch (err: any) {
      toast.error("Save Failed", err.message || "Failed to update configuration");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  const masterUrl = getPublicOrderUrl();

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
              <Globe className="h-5 w-5" />
            </span>
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 font-heading">
              WhatsApp Store Link & Settings
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage your store's digital catalog link (sent in WhatsApp bot greetings), tax rules, and pickup preferences.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href={masterUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Open Ordering App</span>
          </a>

          <Button
            onClick={handleSaveSettings}
            isLoading={saving}
            className="font-bold gap-2 px-6"
          >
            <Sparkles className="h-4 w-4" />
            <span>Save Settings</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: LINKS & QR GENERATOR (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. Official Ordering Link Card */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-brand-600" />
                <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                  Official Store Ordering Link
                </h2>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-bold">
                Active & Shareable
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Share this link in your WhatsApp bio, auto-reply messages, or social media pages to let customers order directly.
            </p>

            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <input
                type="text"
                readOnly
                value={masterUrl}
                className="flex-1 bg-transparent text-xs font-mono font-bold text-slate-800 dark:text-slate-200 focus:outline-none"
              />
              <button
                onClick={() => handleCopyLink(masterUrl)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-bold hover:bg-brand-700 transition cursor-pointer shadow-xs"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>Copy Link</span>
              </button>
            </div>
          </Card>

          {/* 2. Dining Table QR Code Generator Card */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <QrCode className="h-4 w-4 text-brand-600" />
                <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                  🍽️ Dining Table QR Code Generator
                </h2>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 text-[10px] font-bold">
                Auto-Locks Table Number
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select a table number to generate its custom QR code. Scanning it automatically locks the order to that table for your waiters and kitchen staff!
            </p>

            {/* Table Selection Dropdown */}
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                Select Restaurant Table:
              </label>
              <select
                value={selectedTableForQr}
                onChange={(e) => setSelectedTableForQr(parseInt(e.target.value, 10) || 1)}
                className="flex-1 p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer focus:outline-none focus:border-brand-500"
              >
                {Array.from({ length: totalTables || 20 }, (_, i) => i + 1).map((num) => (
                  <option key={num} value={num}>
                    Table #{num} (Dine-In)
                  </option>
                ))}
              </select>
            </div>

            {/* Table QR Code & Unique Link Preview */}
            {(() => {
              const tableUrl = getPublicOrderUrl(selectedTableForQr);
              const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(tableUrl)}`;

              return (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center gap-4">
                  <div className="p-2 bg-white rounded-xl shadow-xs shrink-0 border border-slate-200">
                    <img
                      src={qrImageUrl}
                      alt={`Table #${selectedTableForQr} QR Code`}
                      className="w-28 h-28 object-contain"
                    />
                  </div>

                  <div className="space-y-2 text-center sm:text-left flex-1 min-w-0">
                    <div className="font-extrabold text-slate-800 dark:text-slate-100 text-xs flex items-center justify-center sm:justify-start gap-1.5">
                      <span>🍽️ Table #{selectedTableForQr} Order Link</span>
                    </div>
                    <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                      {tableUrl}
                    </p>

                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                      <button
                        onClick={() => handleCopyLink(tableUrl)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-bold hover:bg-slate-700 transition cursor-pointer"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy Table Link</span>
                      </button>

                      <a
                        href={qrImageUrl}
                        download={`Table_${selectedTableForQr}_QR.png`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-bold hover:bg-brand-700 transition cursor-pointer"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Download QR Image</span>
                      </a>
                    </div>
                  </div>
                </div>
              );
            })()}
          </Card>
        </div>

        {/* RIGHT COLUMN: TAX RULES & PICKUP CONFIG (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* 3. Order Modes Selector */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Layers className="h-4 w-4 text-brand-600" />
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                Enabled Order Modes
              </h2>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => handleOrderModeToggle("takeaway")}
                className={`w-full p-3 rounded-xl border-2 text-left flex items-center justify-between transition cursor-pointer ${
                  supportedOrderModes.includes("takeaway")
                    ? "border-emerald-500 bg-emerald-50/40 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-200"
                    : "border-slate-200 dark:border-slate-800 text-slate-500"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <ShoppingBag className="h-4 w-4 text-emerald-600" />
                  <span className="text-xs font-extrabold">Takeaway (Pickup)</span>
                </div>
                {supportedOrderModes.includes("takeaway") && (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                )}
              </button>

              <button
                type="button"
                onClick={() => handleOrderModeToggle("dining")}
                className={`w-full p-3 rounded-xl border-2 text-left flex items-center justify-between transition cursor-pointer ${
                  supportedOrderModes.includes("dining")
                    ? "border-blue-500 bg-blue-50/40 text-blue-950 dark:bg-blue-950/30 dark:text-blue-200"
                    : "border-slate-200 dark:border-slate-800 text-slate-500"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Store className="h-4 w-4 text-blue-600" />
                  <span className="text-xs font-extrabold">Dine-In (Table Order)</span>
                </div>
                {supportedOrderModes.includes("dining") && (
                  <CheckCircle2 className="h-4 w-4 text-blue-600" />
                )}
              </button>
            </div>
          </Card>

          {/* 4. Restaurant Operations & Capacity */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Store className="h-4 w-4 text-brand-600" />
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                Restaurant Capacity & Tables
              </h2>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Total Dining Tables
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={totalTables}
                  onChange={(e) => setTotalTables(parseInt(e.target.value, 10) || 1)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-extrabold text-slate-800 dark:text-slate-200"
                />
                <p className="text-[10px] text-slate-500 mt-1">Valid table numbers allowed during Dine-In QR checkout</p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Max Active Orders Capacity (Kitchen Limit)
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={maxActiveOrders}
                  onChange={(e) => setMaxActiveOrders(parseInt(e.target.value, 10) || 1)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-extrabold text-slate-800 dark:text-slate-200"
                />
                <p className="text-[10px] text-slate-500 mt-1">Only counts active orders in received, accepted, or preparing status</p>
              </div>
            </div>
          </Card>

          {/* 5. Pickup Preferences */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Clock className="h-4 w-4 text-brand-600" />
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                Pickup Preparation Settings
              </h2>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Default Preparation Time (Minutes)
                </label>
                <input
                  type="number"
                  min={5}
                  max={120}
                  value={prepTime}
                  onChange={(e) => setPrepTime(parseInt(e.target.value) || 15)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-extrabold text-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Pickup Counter Instructions
                </label>
                <textarea
                  rows={2}
                  value={pickupInstructions}
                  onChange={(e) => setPickupInstructions(e.target.value)}
                  placeholder="e.g. Please show order confirmation on your phone at Counter #2"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
