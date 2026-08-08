"use client";

// apps/dashboard/src/app/order/[restaurantSlug]/components/CheckoutModal.tsx
// Redesigned single-screen prepaid Razorpay checkout sheet with clock-time pickup estimates,
// explicit payment verification states, duplicate payment protection, and 1-tap failure retry.

import React, { useState, useEffect } from "react";
import { Capabilities, OrderMode } from "../types";
import { CartState } from "../hooks/useCart";

interface Props {
  cart: CartState;
  capabilities: Capabilities;
  primaryColor: string;
  restaurantSlug: string;
  restaurantInfo?: { name: string; address?: string | null; phone?: string | null };
  onClose: () => void;
  onSuccess: (orderId: string) => void;
  onSetOrderMode: (mode: OrderMode) => void;
  onSetTableNumber: (n: number | null) => void;
  onSetCustomerInfo: (name: string, phone: string) => void;
}

type PaymentState = "idle" | "launching" | "processing" | "verifying" | "failed";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

export default function CheckoutModal({
  cart,
  capabilities,
  primaryColor,
  restaurantSlug,
  restaurantInfo,
  onClose,
  onSuccess,
  onSetOrderMode,
  onSetTableNumber,
  onSetCustomerInfo,
}: Props) {
  // Capabilities resolution from Restaurant Settings
  const isTakeawayEnabled = capabilities?.takeaway?.enabled ?? true;
  const isDineInEnabled = capabilities?.dineIn?.enabled ?? true;
  const totalTablesConfigured = capabilities?.dineIn?.totalTables || 0;
  const effectiveTableCount = totalTablesConfigured > 0 ? totalTablesConfigured : (isDineInEnabled ? 10 : 0);

  // Auto-resolve order mode based on restaurant capabilities
  const [orderMode, setOrderModeLocal] = useState<OrderMode>(() => {
    if (cart.tableNumber && isDineInEnabled) return "dining";
    if (!isTakeawayEnabled && isDineInEnabled) return "dining";
    if (!isDineInEnabled && isTakeawayEnabled) return "takeaway";
    return cart.orderMode || "takeaway";
  });
  const [tableNumber, setTableNumberLocal] = useState<number | null>(cart.tableNumber);

  // Form State
  const [name, setName] = useState(cart.customerName);
  const whatsappJid = cart.whatsappJid || (cart.customerPhone?.includes("@") ? cart.customerPhone : undefined);
  const [phone, setPhone] = useState<string>(() => {
    if (cart.customerPhone?.includes("@")) return "";
    return cart.customerPhone || "";
  });
  const [notes, setNotes] = useState<string>("");

  // Payment Status Pipeline
  const [paymentState, setPaymentState] = useState<PaymentState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Calculate Clock-Time Pickup Estimate (current time + 20 mins)
  const [readyClockTime, setReadyClockTime] = useState<string>("");
  useEffect(() => {
    const readyDate = new Date(Date.now() + 20 * 60 * 1000);
    setReadyClockTime(
      readyDate.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })
    );
  }, []);

  const subtotal = cart.items.reduce(
    (sum, i) => sum + (i.unitPrice + i.selectedModifiers.reduce((ms, m) => ms + m.price, 0)) * i.quantity,
    0
  );
  const tax = capabilities.taxes.taxPercentage > 0 ? Math.round(subtotal * (capabilities.taxes.taxPercentage / 100)) : 0;
  const total = subtotal + tax;

  const handlePlaceOrderAndPay = async () => {
    if (!name.trim()) {
      setErrorMessage("Please enter your name.");
      return;
    }
    if (!phone.trim() && !whatsappJid) {
      setErrorMessage("Please enter a valid mobile phone number.");
      return;
    }

    setErrorMessage(null);
    setPaymentState("launching");

    try {
      const targetPhone = phone.trim() || whatsappJid || "";

      onSetOrderMode(orderMode);
      onSetTableNumber(tableNumber);
      onSetCustomerInfo(name.trim(), targetPhone);

      const body = {
        restaurantSlug,
        orderMode,
        tableNumber: orderMode === "dining" ? tableNumber : undefined,
        customerName: name.trim(),
        customerPhone: targetPhone,
        contactPhone: targetPhone,
        paymentMethod: "razorpay",
        notes: notes.trim() || undefined,
        instructions: notes.trim() || undefined,
        items: cart.items.map((i) => ({
          menuItemId: i.menuItemId,
          variantId: i.variantId,
          quantity: i.quantity,
          selectedModifiers: i.selectedModifiers.map((m) => ({
            groupId: m.groupId,
            optionId: m.optionId,
          })),
          specialInstructions: i.specialInstructions,
        })),
      };

      setPaymentState("processing");

      const res = await fetch(`${BACKEND_URL}/api/v1/public/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok) {
        const errorMsg = typeof json.error === "string" ? json.error : json.error?.message || json.message || "Payment initiation failed";
        throw new Error(errorMsg);
      }

      setPaymentState("verifying");

      // Redirect if backend returned a payment link URL
      const paymentLink = json.data?.payment?.paymentLink;
      if (paymentLink) {
        window.location.href = paymentLink;
        return;
      }

      onSuccess(json.data.orderId);
    } catch (err: any) {
      setPaymentState("failed");
      const extractedMsg = typeof err === "string" ? err : err?.message && typeof err.message === "string" ? err.message : "Payment was not completed. Your cart and details are safely saved.";
      setErrorMessage(extractedMsg);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={paymentState === "idle" || paymentState === "failed" ? onClose : undefined}
      />

      {/* Single-Screen Checkout Sheet */}
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none">
        <div
          className="pointer-events-auto bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh] transition-all overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header & Clock Time Estimate */}
          <div className="flex-shrink-0 flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100 bg-slate-50/50">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Complete Secure Order</h2>
              {readyClockTime && (
                <p className="text-[11px] font-extrabold text-emerald-700 mt-0.5 flex items-center gap-1">
                  ⏱️ Ready for pickup by <span className="underline">{readyClockTime}</span>
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              disabled={paymentState !== "idle" && paymentState !== "failed"}
              className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 font-bold flex items-center justify-center hover:bg-slate-200 transition text-xs cursor-pointer disabled:opacity-50"
            >
              ✕
            </button>
          </div>

          {/* Form Content Stream */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-xs">
            {/* Payment In-Flight Status Indicator */}
            {paymentState !== "idle" && paymentState !== "failed" && (
              <div className="p-4 rounded-2xl bg-brand-50 border border-brand-200 text-brand-950 flex items-center gap-3 animate-pulse">
                <div className="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin shrink-0" />
                <div>
                  <span className="font-extrabold text-sm block">
                    {paymentState === "launching"
                      ? "Launching Razorpay..."
                      : paymentState === "processing"
                      ? "Processing Payment..."
                      : "Verifying Payment & Creating Order..."}
                  </span>
                  <span className="text-[11px] text-brand-700 font-medium">
                    Checking payment status... Please wait...
                  </span>
                </div>
              </div>
            )}

            {/* Failure Alert Box */}
            {paymentState === "failed" && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 space-y-2">
                <div className="flex items-center gap-2 font-extrabold text-sm text-rose-800">
                  <span>⚠️ Payment Not Completed</span>
                </div>
                <p className="text-xs leading-relaxed text-rose-700 font-medium">
                  {errorMessage || "Payment was not completed. No order has been created. Your cart items and details are safely saved."}
                </p>
                <button
                  type="button"
                  onClick={handlePlaceOrderAndPay}
                  className="w-full py-2.5 rounded-xl bg-rose-600 text-white font-extrabold text-xs shadow-xs hover:bg-rose-700 cursor-pointer"
                >
                  Try Payment Again (₹{total.toFixed(0)}) →
                </button>
              </div>
            )}

            {/* Order Mode Selection (Takeaway vs Dine-In) */}
            <div className="space-y-1.5">
              <label className="font-extrabold text-slate-700 block uppercase tracking-wider text-[11px]">
                Order Mode
              </label>

              {/* Case 1: Both Takeaway & Dine-In are Enabled */}
              {isTakeawayEnabled && isDineInEnabled && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setOrderModeLocal("takeaway");
                      onSetOrderMode("takeaway");
                      setTableNumberLocal(null);
                      onSetTableNumber(null);
                    }}
                    className={`p-2.5 rounded-xl border font-extrabold flex items-center justify-center gap-2 transition cursor-pointer ${
                      orderMode === "takeaway"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-950 shadow-xs"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span>🛍️ Takeaway</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOrderModeLocal("dining");
                      onSetOrderMode("dining");
                      if (!tableNumber) {
                        setTableNumberLocal(1);
                        onSetTableNumber(1);
                      }
                    }}
                    className={`p-2.5 rounded-xl border font-extrabold flex items-center justify-center gap-2 transition cursor-pointer ${
                      orderMode === "dining"
                        ? "border-blue-500 bg-blue-50 text-blue-950 shadow-xs"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span>🍽️ Dine-In</span>
                  </button>
                </div>
              )}

              {/* Case 2: Only Takeaway is Enabled */}
              {isTakeawayEnabled && !isDineInEnabled && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 font-bold flex items-center justify-between">
                  <span>🛍️ Takeaway Order (Pickup)</span>
                  <span className="text-[10px] font-black uppercase tracking-wide bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-md">
                    Store Pickup Only
                  </span>
                </div>
              )}

              {/* Case 3: Only Dine-In is Enabled */}
              {!isTakeawayEnabled && isDineInEnabled && (
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-950 font-bold flex items-center justify-between">
                  <span>🍽️ Dine-In Order (Eat at Restaurant)</span>
                  <span className="text-[10px] font-black uppercase tracking-wide bg-blue-200 text-blue-900 px-2 py-0.5 rounded-md">
                    Dine-In Only
                  </span>
                </div>
              )}

              {/* Table Number Selector (When Dine-In is active) */}
              {orderMode === "dining" && isDineInEnabled && (
                <div className="pt-2 space-y-1.5 animate-fadeIn">
                  <label className="font-bold text-slate-700 block text-[11px]">
                    Select Table Number ({effectiveTableCount} Tables Available)
                  </label>
                  <select
                    value={tableNumber || 1}
                    onChange={(e) => {
                      const num = parseInt(e.target.value, 10) || 1;
                      setTableNumberLocal(num);
                      onSetTableNumber(num);
                    }}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-extrabold text-slate-800 text-xs cursor-pointer focus:outline-none focus:border-blue-500 shadow-xs"
                  >
                    {Array.from({ length: effectiveTableCount }, (_, i) => i + 1).map((num) => (
                      <option key={num} value={num}>
                        Table #{num}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Required Customer Contact Inputs */}
            <div className="space-y-3 p-3.5 bg-slate-50/80 border border-slate-200/80 rounded-2xl">
              <span className="font-extrabold text-slate-800 uppercase tracking-wider text-[11px] block">
                Customer Information
              </span>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name (e.g. Rahul Sharma)"
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Mobile Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                />
                <p className="text-[10px] text-slate-400 font-medium mt-1">
                  Order acceptance status and receipts will be sent to your WhatsApp.
                </p>
              </div>

              {/* Conditional Cooking Instructions / Order Request (Hidden if items have allowInstructions === false) */}
              {(() => {
                const hasInstructionAllowingItems = cart.items.length > 0 && cart.items.some((item) => {
                  if (item.allowInstructions === false) return false;
                  if (item.allowInstructions === undefined && /coke|pepsi|sprite|fanta|limca|water|cold drink|beverage/i.test(item.name)) {
                    return false;
                  }
                  return true;
                });

                if (!hasInstructionAllowingItems) return null;

                return (
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Cooking Instructions / Request (Optional)
                    </label>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. Less spicy, extra green chutney..."
                      className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 resize-none"
                    />
                  </div>
                );
              })()}
            </div>

            {/* Pickup Location Card & Help Anchor */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Pickup Location</span>
                <span className="font-extrabold text-slate-800 block text-xs truncate">
                  {restaurantInfo?.name || "Restaurant Main Outlet"}
                </span>
                <span className="text-[11px] text-slate-500 block truncate max-w-[200px]">
                  {restaurantInfo?.address || "Main Street Outlet"}
                </span>
              </div>
              {restaurantInfo?.phone && (
                <a
                  href={`tel:${restaurantInfo.phone}`}
                  className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-[11px] shrink-0 hover:bg-slate-100"
                >
                  📞 Call Store
                </a>
              )}
            </div>

            {/* Final Order Summary Box */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5 text-xs">
              <div className="flex justify-between items-center font-extrabold text-slate-900 mb-1 border-b border-slate-200 pb-1">
                <span>Order Summary</span>
                <span className="text-[11px] font-mono text-slate-500">
                  {cart.items.length} {cart.items.length === 1 ? "Item" : "Items"}
                </span>
              </div>
              {cart.items.map((i) => (
                <div key={i.cartItemId} className="flex justify-between text-slate-600 font-medium">
                  <span className="truncate flex-1 mr-2">{i.name} × {i.quantity}</span>
                  <span className="font-bold text-slate-900">
                    ₹{((i.unitPrice + i.selectedModifiers.reduce((s, m) => s + m.price, 0)) * i.quantity).toFixed(0)}
                  </span>
                </div>
              ))}
              <div className="border-t border-slate-200 pt-1.5 flex justify-between font-black text-sm text-slate-900">
                <span>Total Amount Payable</span>
                <span className="text-emerald-600">₹{total.toFixed(0)}</span>
              </div>
            </div>
          </div>

          {/* Premium Payment CTA Footer */}
          <div className="flex-shrink-0 px-5 py-4 border-t border-slate-100 bg-white space-y-2 shadow-lg">
            <button
              id="razorpay-pay-btn"
              disabled={paymentState !== "idle" && paymentState !== "failed"}
              onClick={handlePlaceOrderAndPay}
              className="w-full py-3.5 rounded-2xl text-white font-extrabold text-sm transition-all active:scale-98 shadow-lg flex items-center justify-between px-5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: primaryColor }}
            >
              <div className="text-left">
                <span className="block text-xs opacity-90 font-medium">Complete Secure Payment</span>
                <span className="text-base font-black">Pay ₹{total.toFixed(0)}</span>
              </div>
              <span className="text-lg">→</span>
            </button>

            <p className="text-[10px] text-center text-slate-400 font-semibold">
              🔒 Secure payments powered by Razorpay
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
