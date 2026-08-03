"use client";

// apps/dashboard/src/app/order/[restaurantSlug]/page.tsx
// Root page of the Customer Experience Platform.
// Assembles all components. NO admin authentication — fully public.

import React, { useEffect, useRef, useState } from "react";
import { useBootstrap } from "./hooks/useBootstrap";
import { useCart } from "./hooks/useCart";
import { MenuItem } from "./types";
import RestaurantHeader from "./components/RestaurantHeader";
import CategoryNav from "./components/CategoryNav";
import MenuSection from "./components/MenuSection";
import ItemCustomizerModal from "./components/ItemCustomizerModal";
import CartDrawer from "./components/CartDrawer";
import CheckoutModal from "./components/CheckoutModal";

interface Props {
  params: Promise<{ restaurantSlug: string }>;
}

export default function OrderingPage({ params }: Props) {
  const { restaurantSlug } = React.use(params);
  const { data, loading, error } = useBootstrap(restaurantSlug);
  const cart = useCart(restaurantSlug);

  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [completedOrderId, setCompletedOrderId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const primaryColor = data?.theme.primaryColor ?? "#f97316";
  const [orderStatus, setOrderStatus] = useState<string>("checkout_pending");

  // Header-level filter state (lifted from RestaurantHeader for menu filtering)
  const [searchQuery, setSearchQuery] = useState("");
  const [vegOnly, setVegOnly] = useState(false);
  const [onlyBestsellers, setOnlyBestsellers] = useState(false);

  // Read URL query params on page load:
  // - ?phone= : WhatsApp number pre-filled by bot greeting link → auto-populate checkout phone field
  // - ?orderId= : Razorpay payment callback → show order confirmation screen
  useEffect(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);

      // Pre-fill phone & WhatsApp JID from WhatsApp greeting link (?phone=82073285091419%40lid)
      const urlPhone = searchParams.get("phone");
      if (urlPhone) {
        const decodedJid = decodeURIComponent(urlPhone);
        cart.setWhatsappJid(decodedJid);
        if (!cart.cart.customerPhone || cart.cart.customerPhone.includes("@")) {
          cart.setCustomerInfo(cart.cart.customerName, decodedJid);
        }
      }

      // Post-payment return (?orderId=...&status=success)
      const urlOrderId = searchParams.get("orderId");
      const urlStatus = searchParams.get("status");
      if (urlOrderId) {
        setCompletedOrderId(urlOrderId);
        if (urlStatus === "success") {
          setOrderStatus("paid");
        }
        cart.clearCart();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll order status when an order is completed/redirected
  useEffect(() => {
    if (!completedOrderId) return;
    const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";
    // Terminal statuses — stop polling when we reach one of these
    const TERMINAL_STATUSES = new Set(["paid", "accepted", "preparing", "ready", "completed", "cancelled"]);

    let active = true;

    const fetchStatus = () => {
      fetch(`${BACKEND_URL}/api/v1/public/orders/${encodeURIComponent(completedOrderId)}/status`)
        .then((res) => res.json())
        .then((json) => {
          if (!active) return;
          if (json?.data?.status) {
            const newStatus = json.data.status;
            setOrderStatus(newStatus);
            if (TERMINAL_STATUSES.has(newStatus)) {
              clearInterval(interval);
            }
          }
        })
        .catch(() => {});
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => { active = false; clearInterval(interval); };
  }, [completedOrderId]);

  // Scroll-spy: update activeCategory as the user scrolls through sections
  useEffect(() => {
    if (!data) return;
    const ids = data.menu.categories.map((c) => `menu-section-${c.id}`);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const catId = entry.target.id.replace("menu-section-", "");
            setActiveCategory(catId);
            break;
          }
        }
      },
      { rootMargin: "-30% 0px -60% 0px" }
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    if (data.menu.categories.length > 0) {
      setActiveCategory(data.menu.categories[0].id);
    }
    return () => observer.disconnect();
  }, [data]);

  function scrollToCategory(categoryId: string) {
    const el = document.getElementById(`menu-section-${categoryId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveCategory(categoryId);
  }

  function handleOrderSuccess(orderId: string) {
    setCompletedOrderId(orderId);
    cart.clearCart();
  }

  // --- Loading State ---
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
        <div
          className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin"
          style={{ borderColor: `${primaryColor} transparent transparent transparent` }}
        />
        <p className="text-slate-400 text-xs font-semibold">Loading menu…</p>
      </div>
    );
  }

  // --- Error State ---
  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="text-5xl">😕</span>
        <h1 className="text-lg font-extrabold text-slate-800">Restaurant not found</h1>
        <p className="text-slate-500 text-xs max-w-xs">{error ?? "This restaurant's menu isn't available right now."}</p>
      </div>
    );
  }

  const { restaurant, theme, operationalStatus, capabilities, menu } = data;
  const availableCategories = menu.categories.filter((c) => c.items.length > 0);

  // --- Order Confirmed State ---
  if (completedOrderId) {
    const isPaidOrAccepted = orderStatus === "paid" || orderStatus === "accepted" || orderStatus === "preparing" || orderStatus === "ready" || orderStatus === "completed";
    const isPaymentPending = orderStatus === "payment_pending" || orderStatus === "checkout_pending";

    const statusLabel: Record<string, string> = {
      checkout_pending: "Awaiting Payment",
      payment_pending: "Payment Pending",
      paid: "Payment Confirmed ✅",
      accepted: "Order Accepted 👌",
      preparing: "Being Prepared 👨‍🍳",
      ready: "Ready for Pickup! 🎉",
      completed: "Order Completed",
      cancelled: "Order Cancelled",
    };
    const currentLabel = statusLabel[orderStatus] ?? orderStatus.replace("_", " ");

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-5 px-6 text-center">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center text-4xl shadow-lg"
          style={{ backgroundColor: primaryColor + "22" }}
        >{isPaidOrAccepted ? "🎉" : isPaymentPending ? "⏳" : "🎉"}</div>
        <h1 className="text-xl font-extrabold text-slate-900">
          {isPaidOrAccepted ? "Payment Confirmed & Order Placed!" : "Order Received!"}
        </h1>
        <p className="text-slate-500 text-xs max-w-xs">
          {isPaidOrAccepted
            ? `${restaurant.name} has received your payment. You'll get WhatsApp updates on your order.`
            : isPaymentPending
            ? "Complete your payment to confirm the order. We'll notify you on WhatsApp."
            : `${restaurant.name} has received your order. You'll get WhatsApp notifications for real-time updates.`}
        </p>
        <div className="text-xs font-bold px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-700 shadow-xs flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isPaidOrAccepted ? "bg-emerald-500" : "bg-amber-500 animate-pulse"}`} />
          {currentLabel}
        </div>
        <button
          onClick={() => setCompletedOrderId(null)}
          className="mt-2 px-6 py-3 rounded-xl text-white font-extrabold text-sm transition hover:opacity-90 active:scale-95 shadow-sm cursor-pointer"
          style={{ backgroundColor: primaryColor }}
        >
          Order Again 🍽️
        </button>
      </div>
    );
  }

  // Client-side filtering: search + veg-only + bestsellers
  const filteredCategories = availableCategories
    .map((cat) => {
      let items = cat.items;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        items = items.filter(
          (i) =>
            i.name.toLowerCase().includes(q) ||
            (i.description?.toLowerCase().includes(q) ?? false)
        );
      }
      if (vegOnly) items = items.filter((i) => i.isVeg);
      if (onlyBestsellers) items = items.filter((i) => i.isBestSeller);
      return { ...cat, items };
    })
    .filter((cat) => cat.items.length > 0);

  const hasActiveFilters = searchQuery.trim() || vegOnly || onlyBestsellers;

  return (
    <div className="min-h-screen bg-slate-50 pb-28" ref={menuRef}>
      {/* Restaurant header with search & filters */}
      <RestaurantHeader
        restaurant={restaurant}
        theme={theme}
        operationalStatus={operationalStatus}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        vegOnly={vegOnly}
        setVegOnly={setVegOnly}
        onlyBestsellers={onlyBestsellers}
        setOnlyBestsellers={setOnlyBestsellers}
      />

      {/* Category navigation — only shown when no active filter */}
      {!hasActiveFilters && (
        <CategoryNav
          categories={availableCategories}
          activeCategory={activeCategory}
          onSelect={scrollToCategory}
          primaryColor={primaryColor}
        />
      )}

      {/* Menu sections */}
      <main className="max-w-3xl mx-auto px-4 py-4">
        {filteredCategories.length > 0 ? (
          filteredCategories.map((category) => (
            <MenuSection
              key={category.id}
              category={category}
              primaryColor={primaryColor}
              isOpen={operationalStatus.isOpen}
              onItemClick={(item) => setSelectedItem(item)}
            />
          ))
        ) : (
          <div className="text-center py-20 text-slate-400">
            <span className="text-4xl block mb-3">🔍</span>
            <p className="text-sm font-semibold text-slate-500">No items found</p>
            <p className="text-xs text-slate-400 mt-1">Try a different search or filter</p>
            <button
              onClick={() => { setSearchQuery(""); setVegOnly(false); setOnlyBestsellers(false); }}
              className="mt-4 text-xs font-bold px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              Clear Filters
            </button>
          </div>
        )}
      </main>

      {/* Floating Sticky Cart Bar (Swiggy-style full width) */}
      {cart.itemCount > 0 && !cartOpen && (
        <div className="fixed bottom-0 left-0 right-0 z-30 px-4 pb-4 pt-2 pointer-events-none">
          <button
            id="view-cart-btn"
            onClick={() => setCartOpen(true)}
            className="pointer-events-auto w-full max-w-3xl mx-auto flex items-center justify-between px-5 py-3.5 rounded-2xl text-white font-extrabold shadow-2xl transition-all active:scale-98 cursor-pointer"
            style={{ backgroundColor: primaryColor }}
          >
            <span className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 bg-white/20 rounded-lg text-xs font-black">
                {cart.itemCount}
              </span>
              <span className="text-sm">{cart.itemCount === 1 ? "1 item" : `${cart.itemCount} items`} in cart</span>
            </span>
            <span className="flex items-center gap-2 text-sm">
              <span>View Cart</span>
              <span className="font-medium text-white/80">·</span>
              <span>₹{cart.subtotal.toFixed(0)}</span>
            </span>
          </button>
        </div>
      )}

      {/* Item customizer modal */}
      {selectedItem && (
        <ItemCustomizerModal
          item={selectedItem}
          primaryColor={primaryColor}
          onAdd={cart.addItem}
          onClose={() => setSelectedItem(null)}
        />
      )}

      {/* Cart drawer */}
      {cartOpen && (
        <CartDrawer
          items={cart.cart.items}
          subtotal={cart.subtotal}
          taxPercentage={capabilities.taxes.taxPercentage}
          primaryColor={primaryColor}
          onClose={() => setCartOpen(false)}
          onUpdateQuantity={cart.updateQuantity}
          onCheckout={() => { setCartOpen(false); setCheckoutOpen(true); }}
        />
      )}

      {/* Checkout modal */}
      {checkoutOpen && (
        <CheckoutModal
          cart={cart.cart}
          capabilities={capabilities}
          primaryColor={primaryColor}
          restaurantSlug={restaurantSlug}
          onClose={() => setCheckoutOpen(false)}
          onSuccess={(id) => { setCheckoutOpen(false); handleOrderSuccess(id); }}
          onSetOrderMode={cart.setOrderMode}
          onSetTableNumber={cart.setTableNumber}
          onSetCustomerInfo={cart.setCustomerInfo}
        />
      )}
    </div>
  );
}
