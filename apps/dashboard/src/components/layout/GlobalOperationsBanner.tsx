"use client";

import React, { useState, useEffect, useCallback } from "react";
import { SettingsService } from "../../lib/services/settings.service";
import { OrdersService } from "../../lib/services/orders.service";
import { useToast } from "../ui/ToastContainer";
import Button from "../ui/Button";
import { AlertCircle, AlertTriangle, CheckCircle, RefreshCw } from "lucide-react";

export default function GlobalOperationsBanner() {
  const toast = useToast();

  const [isOpen, setIsOpen] = useState<boolean | null>(null);
  const [maxActiveOrders, setMaxActiveOrders] = useState<number>(20);
  const [activeOrdersCount, setActiveOrdersCount] = useState<number>(0);
  const [isReopening, setIsReopening] = useState<boolean>(false);

  const fetchStatus = useCallback(async () => {
    try {
      // 1. Fetch restaurant store settings (isOpen, maxActiveOrders)
      const settingsData = await SettingsService.getSettings();
      const rawSettings = settingsData?.settings;
      
      if (rawSettings) {
        setIsOpen(rawSettings.isOpen !== false);
        setMaxActiveOrders(rawSettings.maxActiveOrders || 20);
      }

      // 2. Fetch live active orders to calculate current capacity usage
      const activeOrders = await OrdersService.getActiveOrders();
      // Count orders that are active in kitchen / pending fulfillment
      const activeCount = Array.isArray(activeOrders) ? activeOrders.length : 0;
      setActiveOrdersCount(activeCount);
    } catch (err) {
      console.warn("⚠️ [GlobalOperationsBanner] Failed to fetch operations status:", err);
    }
  }, []);

  useEffect(() => {
    fetchStatus();

    // Live polling interval (every 5 seconds) to catch WhatsApp updates & state changes
    const interval = setInterval(fetchStatus, 5000);

    // Listen for custom event if status is changed elsewhere in DashboardShell
    const handleStatusEvent = () => fetchStatus();
    window.addEventListener("store-status-changed", handleStatusEvent);

    return () => {
      clearInterval(interval);
      window.removeEventListener("store-status-changed", handleStatusEvent);
    };
  }, [fetchStatus]);

  // Handler to immediately reopen restaurant
  const handleReopen = async () => {
    setIsReopening(true);
    try {
      await SettingsService.updateSettings({ isOpen: true });
      setIsOpen(true);
      toast.success("Restaurant Reopened 🟢", "Your store is now open and receiving WhatsApp orders.");
      // Broadcast event so other UI controls sync immediately
      window.dispatchEvent(new Event("store-status-changed"));
    } catch (err: any) {
      toast.error("Reopen Failed", err?.message || "Could not update restaurant status.");
    } finally {
      setIsReopening(false);
    }
  };

  // If loading or state not resolved yet, return null
  if (isOpen === null) return null;

  // STATE 1: Restaurant Closed (Red Banner)
  if (!isOpen) {
    return (
      <div className="w-full rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200/80 dark:border-red-900/60 p-4 sm:p-5 shadow-sm transition-all duration-300">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 text-lg">
              🚫
            </span>
            <div className="space-y-1">
              <h3 className="font-heading font-extrabold text-base text-red-950 dark:text-red-100 flex items-center gap-2">
                Restaurant Closed
              </h3>
              <p className="text-xs text-red-800 dark:text-red-200/90 leading-relaxed max-w-3xl">
                Your restaurant is currently not accepting new orders. Customers messaging on WhatsApp will automatically receive a
                <span className="font-semibold italic"> &quot;We&apos;re currently closed&quot;</span> response.
              </p>
            </div>
          </div>

          <Button
            variant="success"
            size="sm"
            onClick={handleReopen}
            disabled={isReopening}
            className="w-full sm:w-auto shrink-0 gap-2 font-bold shadow-md shadow-emerald-600/20"
          >
            {isReopening ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <span>🟢 Open Restaurant</span>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // STATE 2: Restaurant Busy (Capacity Reached - Orange Banner)
  if (isOpen && activeOrdersCount >= maxActiveOrders) {
    return (
      <div className="w-full rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 p-4 sm:p-5 shadow-sm transition-all duration-300">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 text-lg">
              🟠
            </span>
            <div className="space-y-1">
              <h3 className="font-heading font-extrabold text-base text-amber-950 dark:text-amber-100 flex items-center gap-2">
                Restaurant Busy
              </h3>
              <p className="text-xs text-amber-800 dark:text-amber-200/90 leading-relaxed max-w-3xl">
                Maximum active order capacity has been reached. New WhatsApp orders are temporarily paused until active orders decrease.
              </p>
            </div>
          </div>

          <div className="w-full sm:w-auto shrink-0 bg-white/80 dark:bg-slate-900/80 border border-amber-200 dark:border-amber-800/80 rounded-xl px-4 py-2.5 text-center">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400 block">
              Capacity Utilization
            </span>
            <span className="font-heading font-extrabold text-sm text-slate-900 dark:text-slate-100">
              Current Active Orders: <span className="text-amber-600 dark:text-amber-400">{activeOrdersCount}</span> / {maxActiveOrders}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // STATE 3: Restaurant Open and Capacity Available (Show nothing)
  return null;
}
