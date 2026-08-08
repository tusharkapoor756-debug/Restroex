"use client";

// apps/dashboard/src/app/dashboard/marketing/page.tsx
// Marketing & Coupon Manager — Create, edit, and toggle discount promotional coupons
// with minimum order limits, expiry tracking, and instant checkout validation.

import React, { useState, useEffect } from "react";
import { useToast } from "../../../components/ui/ToastContainer";
import Button from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";
import Skeleton from "../../../components/ui/Skeleton";
import {
  Tag,
  Plus,
  Percent,
  DollarSign,
  Calendar,
  CheckCircle2,
  XCircle,
  Trash2,
  Pencil,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  Search,
} from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

interface Coupon {
  id: string;
  code: string;
  discountType: "percentage" | "flat";
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount?: number;
  isActive: boolean;
  startsAt?: string;
  expiresAt?: string;
  activeDays?: string[];
  createdAt: string;
}

export default function MarketingPage() {
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Drawer / Form State
  const [showDrawer, setShowDrawer] = useState(false);
  const [editingCouponId, setEditingCouponId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "flat">("percentage");
  const [discountValue, setDiscountValue] = useState<number>(10);
  const [minOrderAmount, setMinOrderAmount] = useState<number>(200);
  const [maxDiscountAmount, setMaxDiscountAmount] = useState<number>(100);
  const [startsAt, setStartsAt] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [activeDays, setActiveDays] = useState<string[]>([]);

  useEffect(() => {
    fetchCoupons();
  }, []);

  const getAuthHeaders = () => {
    if (typeof window === "undefined") return { "Content-Type": "application/json" };
    const session = JSON.parse(localStorage.getItem("restroex_session") || localStorage.getItem("restroex_dashboard_session") || "{}");
    const restId = session.restaurantId || session.restaurant?.id || localStorage.getItem("restroex_restaurant_id") || "d004cddc-dc64-420f-8621-cdbbffd1be8b";
    return {
      "Content-Type": "application/json",
      ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
      "x-restaurant-id": restId,
    };
  };

  const fetchCoupons = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/marketing/coupons`, {
        headers: getAuthHeaders(),
      });

      const json = await res.json();
      if (res.ok && json.data) {
        setCoupons(json.data);
      }
    } catch (err: any) {
      toast.error("Failed to load coupons", err.message || "Could not fetch promotional codes");
    } finally {
      setLoading(false);
    }
  };

  const openCreateDrawer = () => {
    setEditingCouponId(null);
    setCode("");
    setDiscountType("percentage");
    setDiscountValue(10);
    setMinOrderAmount(200);
    setMaxDiscountAmount(100);
    setStartsAt("");
    setExpiresAt("");
    setActiveDays([]);
    setShowDrawer(true);
  };

  const openEditDrawer = (coupon: Coupon) => {
    setEditingCouponId(coupon.id);
    setCode(coupon.code);
    setDiscountType(coupon.discountType);
    setDiscountValue(coupon.discountValue);
    setMinOrderAmount(coupon.minOrderAmount || 0);
    setMaxDiscountAmount(coupon.maxDiscountAmount || 0);
    setStartsAt(coupon.startsAt ? new Date(coupon.startsAt).toISOString().slice(0, 16) : "");
    setExpiresAt(coupon.expiresAt ? new Date(coupon.expiresAt).toISOString().slice(0, 16) : "");
    setActiveDays(coupon.activeDays || []);
    setShowDrawer(true);
  };

  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      toast.warning("Code Required", "Please enter a valid coupon code.");
      return;
    }

    setCreating(true);
    try {
      const isEditing = Boolean(editingCouponId);
      const url = isEditing
        ? `${BACKEND_URL}/api/v1/marketing/coupons/${editingCouponId}`
        : `${BACKEND_URL}/api/v1/marketing/coupons`;

      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          discountType,
          discountValue,
          minOrderAmount,
          maxDiscountAmount: discountType === "percentage" ? maxDiscountAmount : undefined,
          startsAt: startsAt || undefined,
          expiresAt: expiresAt || undefined,
          activeDays: activeDays.length > 0 ? activeDays : undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(typeof json.error === 'string' ? json.error : json.error?.message || json.message || "Failed to save coupon");

      toast.success(
        isEditing ? "Coupon Updated" : "Coupon Created",
        `Promo code '${code.toUpperCase()}' saved successfully.`
      );
      setShowDrawer(false);
      setEditingCouponId(null);
      setCode("");
      setStartsAt("");
      setExpiresAt("");
      setActiveDays([]);
      fetchCoupons();
    } catch (err: any) {
      toast.error("Save Error", err.message || "Could not save coupon");
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (coupon: Coupon) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/marketing/coupons/${coupon.id}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ isActive: !coupon.isActive }),
      });

      if (!res.ok) throw new Error("Status update failed");

      toast.info("Coupon Status Updated", `Coupon '${coupon.code}' is now ${!coupon.isActive ? "ACTIVE" : "INACTIVE"}`);
      fetchCoupons();
    } catch (err: any) {
      toast.error("Error", err.message || "Failed to toggle status");
    }
  };

  const handleDeleteCoupon = async (couponId: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/marketing/coupons/${couponId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      if (!res.ok) throw new Error("Deletion failed");

      toast.success("Coupon Deleted", "Promotional code removed.");
      fetchCoupons();
    } catch (err: any) {
      toast.error("Error", err.message || "Could not delete coupon");
    }
  };

  const filteredCoupons = coupons.filter((c) =>
    c.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
              <Tag className="h-5 w-5" />
            </span>
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 font-heading">
              Marketing & Coupons Manager
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Create promotional discount codes that validate automatically on customer checkout.
          </p>
        </div>
        <Button onClick={openCreateDrawer} className="font-bold gap-2 px-5">
          <Plus className="h-4 w-4" />
          <span>Create Promo Code</span>
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400">
            <Tag className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 block uppercase">Total Coupons</span>
            <span className="text-xl font-black text-slate-900 dark:text-slate-100 font-mono">
              {coupons.length}
            </span>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 block uppercase">Active Promos</span>
            <span className="text-xl font-black text-slate-900 dark:text-slate-100 font-mono">
              {coupons.filter((c) => c.isActive).length}
            </span>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 block uppercase">Checkout Engine</span>
            <span className="text-xs font-extrabold text-purple-600 dark:text-purple-300 block">
              Auto-Validation Active
            </span>
          </div>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="p-4 space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search coupon code..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none"
            />
          </div>

          <button
            onClick={fetchCoupons}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : filteredCoupons.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-extrabold uppercase text-slate-400">
                  <th className="py-2.5 px-3">Code</th>
                  <th className="py-2.5 px-3">Discount</th>
                  <th className="py-2.5 px-3">Min Order</th>
                  <th className="py-2.5 px-3">Max Cap</th>
                  <th className="py-2.5 px-3">Schedule & Rule</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                {filteredCoupons.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition">
                    <td className="py-3 px-3">
                      <span className="font-mono font-extrabold px-2.5 py-1 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
                        {c.code}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-200">
                      {c.discountType === "percentage" ? `${c.discountValue}% OFF` : `₹${c.discountValue} FLAT`}
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-400 font-mono">
                      ₹{c.minOrderAmount}
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-400 font-mono">
                      {c.maxDiscountAmount ? `₹${c.maxDiscountAmount}` : "No Cap"}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex flex-col gap-0.5 text-[11px]">
                        {c.activeDays && c.activeDays.length > 0 ? (
                          <span className="font-bold text-amber-600 dark:text-amber-400">
                            ☀️ {c.activeDays.map((d) => d.slice(0, 3).toUpperCase()).join(", ")}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-medium">Everyday</span>
                        )}
                        {c.startsAt && (
                          <span className="text-slate-500 text-[10px]">
                            Starts: {new Date(c.startsAt).toLocaleDateString()}
                          </span>
                        )}
                        {c.expiresAt && (
                          <span className="text-slate-500 text-[10px]">
                            Exp: {new Date(c.expiresAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <button
                        onClick={() => handleToggleStatus(c)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer transition ${
                          c.isActive
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${c.isActive ? "bg-emerald-500" : "bg-slate-400"}`} />
                        <span>{c.isActive ? "ACTIVE" : "INACTIVE"}</span>
                      </button>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditDrawer(c)}
                          className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition cursor-pointer"
                          title="Edit coupon"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteCoupon(c.id)}
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer"
                          title="Delete coupon"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400 text-xs font-semibold">
            No promotional coupons created yet. Click "Create Promo Code" to get started.
          </div>
        )}
      </Card>

      {/* Create / Edit Coupon Modal Drawer */}
      {showDrawer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-extrabold font-heading flex items-center gap-2">
                <Tag className="h-4 w-4 text-brand-600" />
                <span>{editingCouponId ? `Edit Promo Code — ${code}` : "Create Promotional Coupon"}</span>
              </h3>
              <button onClick={() => setShowDrawer(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCoupon} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Coupon Code (e.g. WELCOME50)
                </label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="WELCOME50"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono font-bold uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Discount Type
                  </label>
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="flat">Flat Amount (₹)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Discount Value ({discountType === "percentage" ? "%" : "₹"})
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={discountType === "percentage" ? 100 : 10000}
                    required
                    value={discountValue}
                    onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Min Order Subtotal (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={minOrderAmount}
                    onChange={(e) => setMinOrderAmount(parseFloat(e.target.value) || 0)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold"
                  />
                </div>

                {discountType === "percentage" && (
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Max Discount Cap (₹)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={maxDiscountAmount}
                      onChange={(e) => setMaxDiscountAmount(parseFloat(e.target.value) || 0)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold"
                    />
                  </div>
                )}
              </div>

              {/* Start & Expiry Date & Time Section */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Auto-Start Time (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-medium"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Auto-Expire Time (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-medium"
                  />
                </div>
              </div>

              {/* Recurring Active Days Selector (e.g. Every Sunday) */}
              <div className="space-y-1.5 pt-1">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">
                  Recurring Active Days (Optional — e.g. Every Sunday)
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { key: "sunday", label: "Sun" },
                    { key: "monday", label: "Mon" },
                    { key: "tuesday", label: "Tue" },
                    { key: "wednesday", label: "Wed" },
                    { key: "thursday", label: "Thu" },
                    { key: "friday", label: "Fri" },
                    { key: "saturday", label: "Sat" },
                  ].map((day) => {
                    const isSelected = activeDays.includes(day.key);
                    return (
                      <button
                        type="button"
                        key={day.key}
                        onClick={() => {
                          if (isSelected) {
                            setActiveDays((prev) => prev.filter((d) => d !== day.key));
                          } else {
                            setActiveDays((prev) => [...prev, day.key]);
                          }
                        }}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                          isSelected
                            ? "bg-brand-600 text-white shadow-xs"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                        }`}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-slate-400">
                  {activeDays.length === 0
                    ? "Active every day of the week by default."
                    : `Active ONLY on ${activeDays.map((d) => d.toUpperCase()).join(", ")}.`}
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowDrawer(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-400"
                >
                  Cancel
                </button>
                <Button type="submit" isLoading={creating} className="font-bold px-5">
                  Save & Activate
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
