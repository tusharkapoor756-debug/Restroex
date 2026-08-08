"use client";

// apps/dashboard/src/app/order/[restaurantSlug]/components/CartDrawer.tsx
// Redesigned friction-free mobile cart drawer with upfront promo coupon discovery,
// prep time estimates, food thumbnails, and high-trust checkout CTA.

import React, { useState } from "react";
import { CartItem, ActiveCoupon } from "../types";

interface Props {
  items: CartItem[];
  subtotal: number;
  taxPercentage: number;
  primaryColor: string;
  isOpen?: boolean;
  restaurantSlug: string;
  activeCoupons?: ActiveCoupon[];
  onClose: () => void;
  onUpdateQuantity: (cartItemId: string, delta: number) => void;
  onCheckout: () => void;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

export default function CartDrawer({
  items,
  subtotal,
  taxPercentage,
  primaryColor,
  isOpen = true,
  restaurantSlug,
  activeCoupons = [],
  onClose,
  onUpdateQuantity,
  onCheckout,
}: Props) {
  // Coupon state
  const [couponCode, setCouponCode] = useState("");
  const [appliedCouponCode, setAppliedCouponCode] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<number>(0);
  const [couponMessage, setCouponMessage] = useState("");
  const [isValidating, setIsValidating] = useState(false);

  const [fetchedCoupons, setFetchedCoupons] = useState<ActiveCoupon[]>([]);

  React.useEffect(() => {
    if (activeCoupons && activeCoupons.length > 0) return;

    fetch(`${BACKEND_URL}/api/v1/public/restaurants/${encodeURIComponent(restaurantSlug)}/bootstrap`)
      .then((res) => res.json())
      .then((data) => {
        if (data.data?.activeCoupons) {
          setFetchedCoupons(data.data.activeCoupons);
        }
      })
      .catch(() => {});
  }, [restaurantSlug, activeCoupons]);

  const effectiveCoupons = (activeCoupons && activeCoupons.length > 0) ? activeCoupons : fetchedCoupons;

  const tax = taxPercentage > 0 ? Math.round(subtotal * (taxPercentage / 100)) : 0;
  const grandTotal = Math.max(0, subtotal - appliedDiscount + tax);
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  const handleApplyCoupon = async (codeToApply?: string) => {
    const code = (codeToApply || couponCode).trim().toUpperCase();
    if (!code) return;

    setIsValidating(true);
    setCouponMessage("");

    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/public/coupons/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantSlug,
          code,
          orderSubtotal: subtotal,
        }),
      });

      const json = await res.json();
      if (json.data && json.data.valid) {
        setAppliedDiscount(json.data.discountAmount);
        setAppliedCouponCode(code);
        setCouponMessage(`🎉 ${json.data.message}`);
      } else {
        setAppliedDiscount(0);
        setAppliedCouponCode("");
        setCouponMessage(`❌ ${json.data?.message || "Invalid coupon code"}`);
      }
    } catch (err) {
      setAppliedDiscount(0);
      setAppliedCouponCode("");
      setCouponMessage("❌ Could not validate promo code");
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Slide-Up Bottom Sheet Drawer */}
      <div className="fixed bottom-0 right-0 left-0 sm:top-0 sm:left-auto sm:w-full sm:max-w-md h-[90vh] sm:h-full z-50 bg-white rounded-t-3xl sm:rounded-none shadow-2xl flex flex-col transition-all">
        {/* Mobile Drag Handle Bar */}
        <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto my-2 shrink-0 sm:hidden" />

        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🛒</span>
              <h2 className="text-base font-extrabold text-slate-900">Your Cart</h2>
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                {itemCount} {itemCount === 1 ? "item" : "items"}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5 flex items-center gap-1">
              ⚡ Estimated Prep: <span className="font-bold text-slate-700">15-20 mins</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 text-sm font-bold transition cursor-pointer"
            aria-label="Close cart"
          >
            ✕
          </button>
        </div>

        {/* Store Closed Banner */}
        {!isOpen && (
          <div className="bg-rose-50 border-b border-rose-200 px-5 py-2.5 text-xs text-rose-800 font-bold flex items-center gap-2">
            <span>🔴 Outlet is currently closed for new orders.</span>
          </div>
        )}

        {/* Scrollable Content Stream */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-16">
              <span className="text-6xl">🛍️</span>
              <h3 className="text-slate-800 font-extrabold text-base">Your cart is empty</h3>
              <p className="text-slate-400 text-xs max-w-xs">
                Explore delicious dishes from our menu and add them to your order.
              </p>
              <button
                onClick={onClose}
                className="mt-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white font-extrabold text-xs cursor-pointer shadow-sm"
              >
                Explore Menu 🍽️
              </button>
            </div>
          ) : (
            <>
              {/* Cart Item Rows */}
              <div className="space-y-3">
                {items.map((item) => {
                  const modifiersTotal = item.selectedModifiers.reduce((s, m) => s + m.price, 0);
                  const itemTotal = (item.unitPrice + modifiersTotal) * item.quantity;
                  return (
                    <div
                      key={item.cartItemId}
                      className="flex items-center gap-3 p-3 bg-slate-50/90 rounded-2xl border border-slate-100"
                    >
                      {/* Food Thumbnail */}
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-14 h-14 rounded-xl object-cover flex-shrink-0 border border-slate-100"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-2xl flex-shrink-0">
                          🍲
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1">
                          <span className="text-xs font-extrabold text-slate-900 truncate leading-snug">
                            {item.name}
                            {item.variantName && (
                              <span className="text-slate-500 font-medium"> ({item.variantName})</span>
                            )}
                          </span>
                          <span className="text-xs font-black text-slate-900 flex-shrink-0">
                            ₹{itemTotal.toFixed(0)}
                          </span>
                        </div>

                        {item.selectedModifiers.length > 0 && (
                          <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                            + {item.selectedModifiers.map((m) => m.optionName).join(", ")}
                          </p>
                        )}

                        {/* Interactive Stepper (Auto-removes at 0) */}
                        <div className="flex items-center gap-2 mt-2">
                          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
                            <button
                              onClick={() => onUpdateQuantity(item.cartItemId, -1)}
                              className="w-6 h-6 rounded-md text-slate-700 flex items-center justify-center hover:bg-slate-100 font-black text-sm active:scale-95 cursor-pointer"
                              title="Decrease quantity"
                            >
                              −
                            </button>
                            <span className="text-xs font-black text-slate-900 w-6 text-center">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => onUpdateQuantity(item.cartItemId, 1)}
                              className="w-6 h-6 rounded-md text-slate-700 flex items-center justify-center hover:bg-slate-100 font-black text-sm active:scale-95 cursor-pointer"
                              title="Increase quantity"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Upfront Promo Coupon Box & Active Offers */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    🏷️ Promo Coupon Code
                  </span>
                  {appliedDiscount > 0 && (
                    <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      APPLIED (-₹{appliedDiscount})
                    </span>
                  )}
                </div>

                {/* Interactive Available Coupons Carousel / List */}
                {effectiveCoupons.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                      Available Restaurant Offers
                    </span>
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {effectiveCoupons.map((c) => {
                        const isSelected = appliedCouponCode.toUpperCase() === c.code.toUpperCase();
                        const isEligible = subtotal >= c.minOrderAmount;

                        return (
                          <div
                            key={c.id}
                            className={`p-2.5 rounded-xl border-2 transition flex items-center justify-between gap-2 ${
                              isSelected
                                ? "border-emerald-500 bg-emerald-50/60"
                                : isEligible
                                ? "border-amber-300/80 bg-amber-50/50 hover:bg-amber-50"
                                : "border-slate-200 bg-slate-100/50 opacity-75"
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-xs font-mono font-black text-slate-900 uppercase">
                                  {c.code}
                                </span>
                                <span className="text-xs font-extrabold text-orange-700 truncate">
                                  {c.discountType === "percentage"
                                    ? `${c.discountValue}% OFF`
                                    : `₹${c.discountValue} OFF`}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-500 font-medium mt-1 truncate">
                                {c.minOrderAmount > 0
                                  ? `Valid on orders ₹${c.minOrderAmount}+`
                                  : "No minimum order required"}
                                {c.maxDiscountAmount ? ` (Max ₹${c.maxDiscountAmount})` : ""}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setCouponCode(c.code);
                                handleApplyCoupon(c.code);
                              }}
                              disabled={isValidating || isSelected}
                              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold shrink-0 cursor-pointer shadow-2xs transition ${
                                isSelected
                                  ? "bg-emerald-600 text-white"
                                  : isEligible
                                  ? "bg-orange-600 text-white hover:bg-orange-700"
                                  : "bg-slate-300 text-slate-600"
                              }`}
                            >
                              {isSelected ? "Applied ✓" : "APPLY"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Manual Code Input */}
                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="ENTER COUPON CODE"
                    className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 text-xs font-mono font-extrabold uppercase focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 shadow-2xs"
                  />
                  <button
                    type="button"
                    onClick={() => handleApplyCoupon()}
                    disabled={isValidating || !couponCode.trim()}
                    className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 disabled:opacity-50 cursor-pointer shadow-2xs transition"
                  >
                    {isValidating ? "..." : "Apply"}
                  </button>
                </div>

                {couponMessage && (
                  <p className={`text-[11px] font-bold ${appliedDiscount > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {couponMessage}
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Bill Summary & High-Contrast Checkout Footer */}
        {items.length > 0 && (
          <div className="flex-shrink-0 border-t border-slate-100 bg-white px-5 py-4 space-y-3 shadow-lg">
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600 font-medium">
                <span>Items Subtotal</span>
                <span className="font-bold text-slate-900">₹{subtotal.toFixed(0)}</span>
              </div>

              {appliedDiscount > 0 && (
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>Promo Savings ({appliedCouponCode})</span>
                  <span>-₹{appliedDiscount.toFixed(0)}</span>
                </div>
              )}

              {taxPercentage > 0 && (
                <div className="flex justify-between text-slate-600 font-medium">
                  <span>GST Tax ({taxPercentage}%)</span>
                  <span className="font-bold text-slate-900">₹{tax.toFixed(0)}</span>
                </div>
              )}

              <div className="flex justify-between text-sm font-black text-slate-900 border-t border-slate-100 pt-2">
                <span>Grand Total</span>
                <span className="text-emerald-600">₹{grandTotal.toFixed(0)}</span>
              </div>
            </div>

            {/* High-Contrast Checkout CTA */}
            <div className="space-y-1.5">
              <button
                id="proceed-to-checkout-btn"
                onClick={onCheckout}
                disabled={!isOpen}
                className="w-full py-3.5 rounded-2xl text-white font-extrabold text-sm transition-all active:scale-98 shadow-lg flex items-center justify-between px-5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: isOpen ? primaryColor : "#94a3b8" }}
              >
                <span>Proceed to Pay</span>
                <span className="flex items-center gap-1">
                  <span className="font-black text-base">₹{grandTotal.toFixed(0)}</span>
                  <span>→</span>
                </span>
              </button>

              <p className="text-[10px] text-center text-slate-400 font-semibold flex items-center justify-center gap-1">
                🔒 100% Prepaid Online Razorpay Verification
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
