"use client";

// apps/dashboard/src/app/order/[restaurantSlug]/hooks/useCart.ts
// Persistent anonymous cart, saved to localStorage so customers never lose their cart on refresh.

import { useState, useEffect, useCallback } from "react";
import { CartItem, OrderMode } from "../types";

export interface CartState {
  restaurantSlug: string;
  orderMode: OrderMode | null;
  tableNumber: number | null;
  customerName: string;
  customerPhone: string;
  whatsappJid?: string;
  items: CartItem[];
}

const makeKey = (slug: string) => `restroex_cart_${slug}`;

function loadCart(slug: string): CartState {
  if (typeof window === "undefined") {
    return { restaurantSlug: slug, orderMode: null, tableNumber: null, customerName: "", customerPhone: "", whatsappJid: "", items: [] };
  }
  try {
    const raw = localStorage.getItem(makeKey(slug));
    if (raw) return JSON.parse(raw) as CartState;
  } catch {}
  return { restaurantSlug: slug, orderMode: null, tableNumber: null, customerName: "", customerPhone: "", whatsappJid: "", items: [] };
}

function saveCart(cart: CartState) {
  try {
    localStorage.setItem(makeKey(cart.restaurantSlug), JSON.stringify(cart));
  } catch {}
}

export function useCart(slug: string) {
  const [cart, setCart] = useState<CartState>(() => loadCart(slug));

  // Persist every change to localStorage
  useEffect(() => {
    saveCart(cart);
  }, [cart]);

  const addItem = useCallback((item: CartItem) => {
    setCart((prev) => {
      // If same item+variant already in cart, increment quantity
      const existing = prev.items.findIndex(
        (i) => i.menuItemId === item.menuItemId && i.variantId === item.variantId
      );
      if (existing >= 0 && item.selectedModifiers.length === 0) {
        const updated = [...prev.items];
        updated[existing] = { ...updated[existing], quantity: updated[existing].quantity + item.quantity };
        return { ...prev, items: updated };
      }
      return { ...prev, items: [...prev.items, item] };
    });
  }, []);

  const updateQuantity = useCallback((cartItemId: string, delta: number) => {
    setCart((prev) => {
      const updated = prev.items
        .map((i) => i.cartItemId === cartItemId ? { ...i, quantity: i.quantity + delta } : i)
        .filter((i) => i.quantity > 0);
      return { ...prev, items: updated };
    });
  }, []);

  const removeItem = useCallback((cartItemId: string) => {
    setCart((prev) => ({ ...prev, items: prev.items.filter((i) => i.cartItemId !== cartItemId) }));
  }, []);

  const clearCart = useCallback(() => {
    setCart((prev) => ({ ...prev, items: [] }));
  }, []);

  const setOrderMode = useCallback((mode: OrderMode) => {
    setCart((prev) => ({ ...prev, orderMode: mode }));
  }, []);

  const setTableNumber = useCallback((n: number | null) => {
    setCart((prev) => ({ ...prev, tableNumber: n }));
  }, []);

  const setCustomerInfo = useCallback((name: string, phone: string) => {
    setCart((prev) => ({ ...prev, customerName: name, customerPhone: phone }));
  }, []);

  const setWhatsappJid = useCallback((jid: string) => {
    setCart((prev) => ({ ...prev, whatsappJid: jid }));
  }, []);

  const itemCount = cart.items.reduce((sum, i) => sum + i.quantity, 0);

  const subtotal = cart.items.reduce(
    (sum, i) => sum + i.unitPrice * i.quantity + i.selectedModifiers.reduce((ms, m) => ms + m.price, 0) * i.quantity,
    0
  );

  return {
    cart,
    itemCount,
    subtotal,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    setOrderMode,
    setTableNumber,
    setCustomerInfo,
    setWhatsappJid,
  };
}
