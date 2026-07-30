"use client";

// apps/dashboard/src/app/order/[restaurantSlug]/components/ItemCustomizerModal.tsx
// Modal for selecting variants and modifiers before adding an item to cart.

import React, { useState, useEffect } from "react";
import { MenuItem, CartItem, CartItemModifier } from "../types";

interface Props {
  item: MenuItem;
  primaryColor: string;
  onAdd: (cartItem: CartItem) => void;
  onClose: () => void;
}

function generateCartItemId() {
  return `cart_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export default function ItemCustomizerModal({ item, primaryColor, onAdd, onClose }: Props) {
  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(
    item.variants.length > 0 ? item.variants[0].id : undefined
  );
  const [selectedModifiers, setSelectedModifiers] = useState<CartItemModifier[]>([]);
  const [qty, setQty] = useState(1);
  const [specialInstructions, setSpecialInstructions] = useState("");

  // Resolve price
  const selectedVariant = item.variants.find((v) => v.id === selectedVariantId);
  const basePrice = selectedVariant ? selectedVariant.price : item.price;
  const modifiersTotal = selectedModifiers.reduce((sum, m) => sum + m.price, 0);
  const total = (basePrice + modifiersTotal) * qty;

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  function toggleModifier(groupId: string, groupName: string, optionId: string, optionName: string, price: number, max: number) {
    setSelectedModifiers((prev) => {
      const inGroup = prev.filter((m) => m.groupId === groupId);
      const already = prev.find((m) => m.optionId === optionId);
      if (already) return prev.filter((m) => m.optionId !== optionId);
      if (inGroup.length >= max) {
        // Replace last selection when max=1 (radio-like)
        if (max === 1) return [...prev.filter((m) => m.groupId !== groupId), { groupId, groupName, optionId, optionName, price }];
        return prev; // max already reached for multi-select
      }
      return [...prev, { groupId, groupName, optionId, optionName, price }];
    });
  }

  function handleAdd() {
    const cartItem: CartItem = {
      cartItemId: generateCartItemId(),
      menuItemId: item.id,
      variantId: selectedVariantId,
      name: item.name,
      variantName: selectedVariant?.name,
      unitPrice: basePrice,
      quantity: qty,
      selectedModifiers,
      specialInstructions: specialInstructions.trim() || undefined,
      imageUrl: item.imageUrl,
      isVeg: item.isVeg,
    };
    onAdd(cartItem);
    onClose();
  }

  return (
    <div
      id="item-customizer-backdrop"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => { if ((e.target as HTMLElement).id === "item-customizer-backdrop") onClose(); }}
    >
      <div className="relative bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
        {/* Item image */}
        {item.imageUrl && (
          <img src={item.imageUrl} alt={item.name} className="w-full h-44 object-cover flex-shrink-0" />
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center text-sm hover:bg-black/60 transition"
          aria-label="Close"
        >
          ✕
        </button>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {/* Title */}
          <div>
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-lg font-bold text-slate-900">{item.name}</h2>
              <span className={`flex-shrink-0 w-4 h-4 rounded border-2 mt-0.5 ${item.isVeg ? "border-green-600" : "border-red-600"}`}>
                <span className={`block w-2 h-2 rounded-full m-0.5 ${item.isVeg ? "bg-green-600" : "bg-red-600"}`} />
              </span>
            </div>
            {item.description && <p className="text-sm text-slate-500 mt-1">{item.description}</p>}
          </div>

          {/* Variants */}
          {item.variants.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Choose Size</h3>
              <div className="space-y-2">
                {item.variants.map((v) => (
                  <label key={v.id} className="flex items-center gap-3 cursor-pointer group">
                    <span
                      className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
                      style={selectedVariantId === v.id ? { borderColor: primaryColor, backgroundColor: primaryColor } : { borderColor: "#cbd5e1" }}
                    >
                      {selectedVariantId === v.id && <span className="w-2 h-2 rounded-full bg-white" />}
                    </span>
                    <input type="radio" className="sr-only" checked={selectedVariantId === v.id} onChange={() => setSelectedVariantId(v.id)} />
                    <span className="flex-1 text-sm text-slate-700 group-hover:text-slate-900">{v.name}</span>
                    <span className="text-sm font-semibold text-slate-900">₹{v.price}</span>
                  </label>
                ))}
              </div>
            </section>
          )}

          {/* Modifier groups */}
          {item.modifierGroups.map((group) => (
            <section key={group.id}>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-semibold text-slate-700">{group.name}</h3>
                {group.minSelection > 0 && (
                  <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded-full">Required</span>
                )}
                {group.maxSelection > 1 && (
                  <span className="text-xs text-slate-400">Up to {group.maxSelection}</span>
                )}
              </div>
              <div className="space-y-2">
                {group.options.map((opt) => {
                  const checked = selectedModifiers.some((m) => m.optionId === opt.id);
                  return (
                    <label key={opt.id} className="flex items-center gap-3 cursor-pointer group">
                      <span
                        className="w-5 h-5 rounded flex items-center justify-center border-2 transition-all"
                        style={checked ? { borderColor: primaryColor, backgroundColor: primaryColor } : { borderColor: "#cbd5e1" }}
                      >
                        {checked && <span className="text-white text-xs">✓</span>}
                      </span>
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        onChange={() => toggleModifier(group.id, group.name, opt.id, opt.name, opt.price, group.maxSelection)}
                      />
                      <span className="flex-1 text-sm text-slate-700 group-hover:text-slate-900">{opt.name}</span>
                      {opt.price > 0 && <span className="text-sm text-slate-500">+₹{opt.price}</span>}
                    </label>
                  );
                })}
              </div>
            </section>
          ))}

          {/* Special instructions */}
          {(item.allowInstructions ?? true) && (
            <section>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Special Instructions</h3>
              <textarea
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:border-transparent"
                style={{ ["--tw-ring-color" as string]: primaryColor }}
                placeholder="e.g. No onions, extra spicy..."
                rows={2}
                maxLength={200}
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
              />
            </section>
          )}
        </div>

        {/* Quantity + Add to Cart */}
        <div className="flex-shrink-0 border-t border-slate-100 px-5 py-4 flex items-center gap-3 bg-white">
          {/* Quantity stepper */}
          <div className="flex items-center gap-2 border border-slate-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="w-9 h-9 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition text-lg"
            >−</button>
            <span className="w-8 text-center text-sm font-bold text-slate-800">{qty}</span>
            <button
              onClick={() => setQty((q) => q + 1)}
              className="w-9 h-9 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition text-lg"
            >+</button>
          </div>

          {/* Add to cart */}
          <button
            id="add-to-cart-btn"
            onClick={handleAdd}
            className="flex-1 py-3 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90 active:scale-95"
            style={{ backgroundColor: primaryColor }}
          >
            Add to Cart · ₹{total.toFixed(0)}
          </button>
        </div>
      </div>
    </div>
  );
}
