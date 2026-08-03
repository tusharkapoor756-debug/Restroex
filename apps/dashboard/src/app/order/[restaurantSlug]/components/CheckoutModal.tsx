"use client";

// apps/dashboard/src/app/order/[restaurantSlug]/components/CheckoutModal.tsx
// Sleek multi-step mobile checkout wizard: Order Mode → Customer Details → Payment.

import React, { useState } from "react";
import { Capabilities, OrderMode } from "../types";
import { CartState } from "../hooks/useCart";

interface Props {
  cart: CartState;
  capabilities: Capabilities;
  primaryColor: string;
  restaurantSlug: string;
  onClose: () => void;
  onSuccess: (orderId: string) => void;
  onSetOrderMode: (mode: OrderMode) => void;
  onSetTableNumber: (n: number | null) => void;
  onSetCustomerInfo: (name: string, phone: string) => void;
}

type Step = "mode" | "info" | "payment" | "confirm";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

function StepIndicator({ step, primaryColor }: { step: Step; primaryColor: string }) {
  const steps: { key: Step; label: string }[] = [
    { key: "mode", label: "Mode" },
    { key: "info", label: "Details" },
    { key: "payment", label: "Payment" },
  ];
  const currentIdx = steps.findIndex((s) => s.key === step);

  return (
    <div className="flex items-center justify-center gap-1.5 py-2.5 border-b border-slate-100">
      {steps.map((s, idx) => (
        <React.Fragment key={s.key}>
          <div className="flex items-center gap-1">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-all"
              style={
                idx <= currentIdx
                  ? { backgroundColor: primaryColor, color: "#fff" }
                  : { backgroundColor: "#f1f5f9", color: "#94a3b8" }
              }
            >
              {idx + 1}
            </div>
            <span className={`text-xs font-extrabold ${idx <= currentIdx ? "text-slate-900" : "text-slate-400"}`}>
              {s.label}
            </span>
          </div>
          {idx < steps.length - 1 && (
            <div
              className="h-0.5 w-6 rounded transition-all"
              style={{ backgroundColor: idx < currentIdx ? primaryColor : "#e2e8f0" }}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export default function CheckoutModal({
  cart,
  capabilities,
  primaryColor,
  restaurantSlug,
  onClose,
  onSuccess,
  onSetOrderMode,
  onSetTableNumber,
  onSetCustomerInfo,
}: Props) {
  const [step, setStep] = useState<Step>("mode");
  const [orderMode, setOrderModeLocal] = useState<OrderMode | null>(cart.orderMode);
  const [tableNumber, setTableNumberLocal] = useState<number | null>(cart.tableNumber);
  const [name, setName] = useState(cart.customerName);
  
  // Preserve WhatsApp JID (e.g. 82073285091419@lid) passed from WhatsApp link
  const whatsappJid = cart.whatsappJid || (cart.customerPhone?.includes("@") ? cart.customerPhone : undefined);
  const [phone, setPhone] = useState<string>(() => {
    if (cart.customerPhone?.includes("@")) return "";
    return cart.customerPhone || "";
  });

  const [notes, setNotes] = useState<string>("");

  const paymentMethodsList = Array.isArray(capabilities?.paymentMethods)
    ? capabilities.paymentMethods
    : ["cash"];
  const [paymentMethod, setPaymentMethod] = useState<string>(
    paymentMethodsList[0] ?? "cash"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subtotal = cart.items.reduce(
    (sum, i) => sum + (i.unitPrice + i.selectedModifiers.reduce((ms, m) => ms + m.price, 0)) * i.quantity,
    0
  );
  const tax = Math.round(subtotal * (capabilities.taxes.taxPercentage / 100));
  const total = subtotal + tax;

  async function placeOrder() {
    setLoading(true);
    setError(null);
    try {
      const body = {
        restaurantSlug,
        orderMode,
        tableNumber: orderMode === "dining" ? tableNumber : undefined,
        customerName: name,
        customerPhone: whatsappJid || phone,
        contactPhone: phone || whatsappJid,
        paymentMethod,
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
      const res = await fetch(`${BACKEND_URL}/api/v1/public/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Order failed");
      onSetOrderMode(orderMode!);
      onSetTableNumber(tableNumber);
      onSetCustomerInfo(name, phone);

      const paymentLink = json.data?.payment?.paymentLink;
      if (paymentLink) {
        window.location.href = paymentLink;
        return;
      }

      onSuccess(json.data.orderId);
    } catch (err: any) {
      setError(err.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none">
        <div
          className="pointer-events-auto bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh] transition-all"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex-shrink-0 flex items-center justify-between px-5 pt-4 pb-2 border-b border-slate-100">
            <h2 className="text-base font-extrabold text-slate-900">Complete Your Order</h2>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 font-bold flex items-center justify-center hover:bg-slate-200 transition text-xs cursor-pointer">✕</button>
          </div>

          {step !== "confirm" && <StepIndicator step={step} primaryColor={primaryColor} />}

          <div className="flex-1 overflow-y-auto px-5 py-3">
            {error && (
              <div className="mb-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-600">{error}</div>
            )}

            {/* Step 1: Order Mode */}
            {step === "mode" && (
              <div className="space-y-3 py-2">
                <p className="text-xs font-extrabold text-slate-500 text-center uppercase tracking-wider mb-2">Select Order Type</p>
                
                {capabilities.takeaway.enabled && (
                  <button
                    className={`w-full p-3.5 rounded-xl border-2 text-left transition-all cursor-pointer active:scale-98 ${
                      orderMode === "takeaway"
                        ? "border-emerald-500 bg-emerald-50/50 text-emerald-950"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                    onClick={() => setOrderModeLocal("takeaway")}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🛍️</span>
                      <div>
                        <div className="font-extrabold text-sm text-slate-900">Takeaway (Pickup)</div>
                        <div className="text-xs text-slate-500 font-medium">Pick up food at counter when ready</div>
                      </div>
                    </div>
                  </button>
                )}

                {capabilities.dineIn.enabled && (
                  <button
                    className={`w-full p-3.5 rounded-xl border-2 text-left transition-all cursor-pointer active:scale-98 ${
                      orderMode === "dining"
                        ? "border-blue-500 bg-blue-50/50 text-blue-950"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                    onClick={() => setOrderModeLocal("dining")}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🍽️</span>
                      <div>
                        <div className="font-extrabold text-sm text-slate-900">Dine In (Table Order)</div>
                        <div className="text-xs text-slate-500 font-medium">Serving directly to your table</div>
                      </div>
                    </div>
                  </button>
                )}

                {orderMode === "dining" && capabilities.dineIn.totalTables > 0 && (
                  <div className="mt-4">
                    <label className="text-xs font-extrabold text-slate-700 block mb-2">Select Table Number</label>
                    <div className="grid grid-cols-5 gap-2">
                      {Array.from({ length: capabilities.dineIn.totalTables }, (_, i) => i + 1).map((n) => (
                        <button
                          key={n}
                          onClick={() => setTableNumberLocal(n)}
                          className={`py-2 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                            tableNumber === n
                              ? "border-blue-600 bg-blue-600 text-white shadow-xs"
                              : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Customer Info */}
            {step === "info" && (
              <div className="space-y-3 py-2">
                <div>
                  <label className="text-xs font-extrabold text-slate-700 block mb-1">Your Full Name</label>
                  <input
                    type="text"
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    placeholder="Enter your name (e.g. Rahul Sharma)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoFocus
                  />
                </div>

                <div>
                  <label className="text-xs font-extrabold text-slate-700 block mb-1">Contact Phone Number (Optional)</label>
                  <input
                    type="tel"
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Live order updates will be sent to your WhatsApp.</p>
                </div>

                <div>
                  <label className="text-xs font-extrabold text-slate-700 block mb-1">Special Cooking Instructions / Request (Optional)</label>
                  <textarea
                    rows={2}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 resize-none"
                    placeholder="e.g. Less spicy, Extra green chutney, No onions..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Step 3: Payment */}
            {step === "payment" && (
              <div className="space-y-3 py-2">
                <p className="text-xs font-extrabold text-slate-500 text-center uppercase tracking-wider mb-2">Select Payment Method</p>
                {paymentMethodsList.map((method) => (
                  <button
                    key={method}
                    className={`w-full p-3.5 rounded-xl border-2 text-left transition-all cursor-pointer active:scale-98 ${
                      paymentMethod === method ? "border-emerald-500 bg-emerald-50/40 text-emerald-950 font-bold" : "border-slate-200 hover:border-slate-300"
                    }`}
                    onClick={() => setPaymentMethod(method)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">
                          {method === "cash" ? "💵" : method === "card" ? "💳" : method === "upi" ? "📱" : "💳"}
                        </span>
                        <div>
                          <div className="font-extrabold text-sm capitalize">{method === "upi" ? "UPI / QR Code" : method === "razorpay" ? "Online Payment (UPI/Card)" : method}</div>
                          <div className="text-[11px] text-slate-500">Instant automatic payment verification</div>
                        </div>
                      </div>
                      <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${paymentMethod === method ? "border-emerald-600 bg-emerald-600" : "border-slate-300"}`}>
                        {paymentMethod === method && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
                      </span>
                    </div>
                  </button>
                ))}

                {/* Final Bill Breakdown */}
                <div className="mt-3 p-3.5 bg-slate-50 rounded-xl space-y-1.5 text-xs">
                  <div className="font-extrabold text-slate-800 mb-1.5 border-b border-slate-200/60 pb-1">Final Summary</div>
                  {cart.items.map((i) => (
                    <div key={i.cartItemId} className="flex justify-between text-slate-600 font-medium">
                      <span className="truncate flex-1 mr-2">{i.name} × {i.quantity}</span>
                      <span className="flex-shrink-0 font-bold">₹{((i.unitPrice + i.selectedModifiers.reduce((ms, m) => ms + m.price, 0)) * i.quantity).toFixed(0)}</span>
                    </div>
                  ))}
                  <div className="border-t border-slate-200/80 pt-1.5 flex justify-between font-black text-sm text-slate-900">
                    <span>Total Amount</span><span className="text-emerald-600">₹{total.toFixed(0)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Confirmation */}
            {step === "confirm" && (
              <div className="flex flex-col items-center py-6 text-center gap-2">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-3xl shadow-xs">
                  🎉
                </div>
                <h3 className="text-lg font-black text-slate-900">Order Placed!</h3>
                <p className="text-xs text-slate-500 max-w-xs font-medium">
                  Your order is received by the restaurant. WhatsApp notifications will keep you updated.
                </p>
              </div>
            )}
          </div>

          {/* Navigation Footer */}
          {step !== "confirm" && (
            <div className="flex-shrink-0 px-5 py-3.5 border-t border-slate-100 flex gap-2.5 bg-white">
              {step !== "mode" && (
                <button
                  onClick={() => setStep((s) => s === "info" ? "mode" : s === "payment" ? "info" : "mode")}
                  className="px-4 py-3 rounded-xl border border-slate-200 text-slate-700 text-xs font-extrabold hover:bg-slate-50 transition cursor-pointer active:scale-95"
                >
                  ← Back
                </button>
              )}
              <button
                id="checkout-next-btn"
                disabled={loading || (step === "mode" && !orderMode) || (step === "mode" && orderMode === "dining" && !tableNumber) || (step === "info" && (!name.trim() || (!phone.trim() && !whatsappJid)))}
                onClick={async () => {
                  if (step === "mode") setStep("info");
                  else if (step === "info") setStep("payment");
                  else if (step === "payment") { await placeOrder(); setStep("confirm"); }
                }}
                className="flex-1 py-3 rounded-xl text-white font-extrabold text-xs transition-all active:scale-98 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                style={{ backgroundColor: primaryColor }}
              >
                {loading
                  ? "Placing Order..."
                  : step === "payment"
                  ? `Pay & Order · ₹${total.toFixed(0)}`
                  : "Continue →"}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

