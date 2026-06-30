// src/app/dashboard/menu/page.tsx
"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Search,
  Plus,
  Eye,
  EyeOff,
  X,
  Save,
  Trash2,
  Pencil,
  ChevronDown,
  ChevronUp,
  Tag,
} from "lucide-react";
import { MenuService } from "../../../lib/services/menu.service";
import { MenuItem, VariantInputDto, UpdateMenuItemDto, CreateMenuItemDto } from "../../../types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface VariantRow {
  id?: string;       // present when editing an existing saved variant
  variantName: string;
  price: number;
}

interface FormState {
  name: string;
  basePrice: number | "" | null;
  aliases: string;
  variants: VariantRow[];
}

const emptyForm = (): FormState => ({
  name: "",
  basePrice: "",
  aliases: "",
  variants: [],
});

// ─── Component ───────────────────────────────────────────────────────────────

export default function MenuPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [isSaving, setIsSaving] = useState(false);

  // Expanded cards (to show variants)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // ── Data Loading ──────────────────────────────────────────────────────────

  const fetchMenuItems = useCallback(async () => {
    try {
      const data = await MenuService.listItems();
      setMenuItems(data);
    } catch (error) {
      console.error("Failed to fetch menu items", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMenuItems();
  }, [fetchMenuItems]);

  // ── Filtering ─────────────────────────────────────────────────────────────

  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      const q = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.aliases.some((a) => a.toLowerCase().includes(q))
      );
    });
  }, [menuItems, searchQuery]);

  // ── Availability Toggle ───────────────────────────────────────────────────

  const handleToggleAvailable = async (id: string, currentAvailable: boolean) => {
    setMenuItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, isAvailable: !currentAvailable } : item
      )
    );
    try {
      await MenuService.updateAvailability(id, !currentAvailable);
    } catch (error) {
      console.error("Failed to update availability", error);
      fetchMenuItems();
    }
  };

  // ── Expand/Collapse ───────────────────────────────────────────────────────

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Form Open ─────────────────────────────────────────────────────────────

  const handleOpenCreate = () => {
    setEditingItemId(null);
    setForm(emptyForm());
    setIsFormOpen(true);
  };

  const handleOpenEdit = (item: MenuItem) => {
    setEditingItemId(item.id);
    setForm({
      name: item.name,
      basePrice: item.basePrice ?? "",
      aliases: item.aliases.join(", "),
      variants: (item.variants || []).map((v) => ({
        id: v.id,
        variantName: v.variantName,
        price: v.price,
      })),
    });
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingItemId(null);
  };

  // ── Variant Row Helpers ───────────────────────────────────────────────────

  const addVariantRow = () => {
    setForm((prev) => ({
      ...prev,
      variants: [...prev.variants, { variantName: "", price: 0 }],
    }));
  };

  const removeVariantRow = (index: number) => {
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index),
    }));
  };

  const updateVariantRow = (index: number, field: "variantName" | "price", value: string | number) => {
    setForm((prev) => {
      const updated = [...prev.variants];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, variants: updated };
    });
  };

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();

    const name = form.name.trim();
    if (!name) {
      alert("Dish name is required.");
      return;
    }

    const hasVariants = form.variants.length > 0;
    let basePrice: number | null = null;

    if (!hasVariants) {
      if (form.basePrice === null || form.basePrice === undefined || form.basePrice === "" || isNaN(Number(form.basePrice))) {
        alert("Base price is required when no variants exist.");
        return;
      }
      basePrice = Number(form.basePrice);
      if (basePrice < 0) {
        alert("Base price cannot be negative.");
        return;
      }
    } else {
      if (form.basePrice !== null && form.basePrice !== undefined && form.basePrice !== "") {
        basePrice = Number(form.basePrice);
        if (isNaN(basePrice) || basePrice < 0) {
          alert("Please enter a valid base price or leave it empty.");
          return;
        }
      } else {
        basePrice = null;
      }
    }

    // Validate variant rows
    for (const v of form.variants) {
      if (!v.variantName.trim()) {
        alert("All variants must have a name.");
        return;
      }
      if (!Number.isFinite(v.price) || v.price < 0) {
        alert(`Variant "${v.variantName}" has an invalid price.`);
        return;
      }
    }

    const aliases = form.aliases
      .split(",")
      .map((a) => a.trim())
      .filter((a) => a.length > 0);

    const variants: VariantInputDto[] = form.variants.map((v) => ({
      variantName: v.variantName.trim(),
      price: Number(v.price),
    }));

    setIsSaving(true);
    try {
      if (editingItemId) {
        const dto: UpdateMenuItemDto = {
          name,
          basePrice,
          aliases,
          variants,
        };
        const updated = await MenuService.updateItem(editingItemId, dto);
        setMenuItems((prev) =>
          prev.map((item) => (item.id === editingItemId ? updated : item))
        );
      } else {
        const dto: CreateMenuItemDto = {
          name,
          basePrice,
          aliases,
          variants,
        };
        const created = await MenuService.createItem(dto);
        setMenuItems((prev) => [...prev, created]);
      }
      handleCloseForm();
    } catch (error) {
      console.error("Failed to save menu item", error);
      alert("Failed to save menu item. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold font-sora text-white">Menu Catalog</h1>
          <p className="text-slate-400 text-xs mt-0.5">
            Manage dishes, variants, toggle availability, and set pricing.
          </p>
        </div>

        <button
          id="add-menu-item-btn"
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 text-xs font-semibold transition-all active:scale-[0.98] self-start sm:self-auto shadow-[0_0_15px_rgba(124,58,237,0.15)]"
        >
          <Plus className="h-4 w-4" />
          Add Menu Item
        </button>
      </div>

      {/* Search */}
      <div className="relative w-full sm:w-80">
        <Search className="h-4 w-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          id="menu-search"
          type="text"
          placeholder="Search dish or aliases..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-[#0e0f14]/80 border border-[#23242B] hover:border-slate-800 focus:border-violet-500 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none transition-all"
        />
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="text-center py-16 text-slate-500 text-xs">Loading menu...</div>
      )}

      {/* Menu Items Grid */}
      {!isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredItems.length === 0 ? (
            <div className="col-span-full text-center py-16 bg-[#0e0f14]/30 border border-[#23242B] rounded-2xl text-slate-500 text-xs">
              No menu items found.
            </div>
          ) : (
            filteredItems.map((item) => {
              const isExpanded = expandedIds.has(item.id);
              const hasVariants = (item.variants || []).length > 0;

              return (
                <div
                  key={item.id}
                  className={`bg-[#0e0f14]/60 border rounded-2xl p-5 flex flex-col gap-3 transition-all ${
                    item.isAvailable
                      ? "border-[#23242B] hover:border-slate-700"
                      : "border-[#23242B]/40 opacity-60"
                  }`}
                >
                  {/* Item header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-white font-sora leading-tight">
                        {item.name}
                      </h3>
                      {/* Aliases */}
                      {item.aliases.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {item.aliases.map((alias, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] bg-slate-900 text-slate-400 px-1.5 py-0.5 rounded border border-[#23242B]"
                            >
                              {alias}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        id={`edit-item-${item.id}`}
                        onClick={() => handleOpenEdit(item)}
                        className="p-1.5 rounded-lg border border-[#23242B] text-slate-500 hover:text-violet-400 hover:border-violet-800 transition-all"
                        title="Edit item"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        id={`toggle-${item.id}`}
                        onClick={() => handleToggleAvailable(item.id, item.isAvailable)}
                        className={`p-1.5 rounded-lg border transition-all ${
                          item.isAvailable
                            ? "border-[#23242B] text-emerald-400 hover:text-emerald-300"
                            : "border-[#23242B] text-slate-600 hover:text-slate-400"
                        }`}
                        title={item.isAvailable ? "Mark Out of Stock" : "Mark Available"}
                      >
                        {item.isAvailable ? (
                          <Eye className="h-3.5 w-3.5" />
                        ) : (
                          <EyeOff className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Price row */}
                  <div className="border-t border-[#23242B]/40 pt-3 flex items-center justify-between">
                    <div>
                      {hasVariants ? (
                        <div className="flex items-center gap-1.5">
                          <Tag className="h-3 w-3 text-violet-400" />
                          <span className="text-[10px] text-violet-300 font-medium">
                            {item.variants.length} variant{item.variants.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm font-bold text-white">₹{item.basePrice !== null ? item.basePrice : 0}</span>
                      )}
                    </div>

                    {hasVariants && (
                      <button
                        id={`expand-variants-${item.id}`}
                        onClick={() => toggleExpand(item.id)}
                        className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-white transition-colors"
                      >
                        {isExpanded ? (
                          <>
                            Hide <ChevronUp className="h-3 w-3" />
                          </>
                        ) : (
                          <>
                            View <ChevronDown className="h-3 w-3" />
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Variant list (expandable) */}
                  {hasVariants && isExpanded && (
                    <div className="border border-[#23242B] rounded-xl overflow-hidden">
                      {item.variants.map((v, idx) => (
                        <div
                          key={v.id}
                          className={`flex items-center justify-between px-3 py-2 text-xs ${
                            idx !== 0 ? "border-t border-[#23242B]" : ""
                          }`}
                        >
                          <span className="text-slate-300">{v.variantName}</span>
                          <span className="text-white font-semibold">₹{v.price}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── ADD / EDIT MODAL ─────────────────────────────────────────────────── */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={handleCloseForm}
          />

          <div className="relative w-full max-w-lg rounded-2xl bg-[#0e0f14] border border-[#23242B] p-6 shadow-2xl z-50 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-[#23242B]/40 pb-3 mb-5">
              <h2 className="text-base font-bold font-sora text-white">
                {editingItemId ? "Edit Menu Item" : "Add Menu Item"}
              </h2>
              <button onClick={handleCloseForm} className="text-slate-500 hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-5">

              {/* Dish Name */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  Dish Name *
                </label>
                <input
                  id="form-dish-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Malai Chaap"
                  className="w-full bg-slate-950 border border-[#23242B] focus:border-violet-500 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none transition-all"
                  required
                />
              </div>

              {/* Base Price */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  Base Price (₹)
                </label>
                <input
                  id="form-base-price"
                  type="number"
                  value={form.basePrice ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, basePrice: e.target.value === "" ? "" : Number(e.target.value) }))}
                  min={0}
                  placeholder="e.g. 240"
                  className="w-full bg-slate-950 border border-[#23242B] focus:border-violet-500 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none transition-all"
                />
                <p className="text-[10px] text-slate-500">
                  Used only when no variants exist. If variants are added, this is optional and not forced to 0.
                </p>
              </div>

              {/* Aliases */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  AI Aliases (comma-separated)
                </label>
                <input
                  id="form-aliases"
                  type="text"
                  value={form.aliases}
                  onChange={(e) => setForm((p) => ({ ...p, aliases: e.target.value }))}
                  placeholder="e.g. malai, chaap, malai kabab"
                  className="w-full bg-slate-950 border border-[#23242B] focus:border-violet-500 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none transition-all"
                />
                <p className="text-[10px] text-slate-500">
                  Used by AI engine to match natural language orders.
                </p>
              </div>

              {/* Variants Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    Variants (Optional)
                  </label>
                  <button
                    id="add-variant-btn"
                    type="button"
                    onClick={addVariantRow}
                    className="inline-flex items-center gap-1 text-[10px] text-violet-400 hover:text-violet-300 border border-violet-900 hover:border-violet-700 rounded-lg px-2 py-1 transition-all"
                  >
                    <Plus className="h-3 w-3" />
                    Add Variant
                  </button>
                </div>

                {form.variants.length === 0 && (
                  <p className="text-[10px] text-slate-600 italic">
                    No variants — customers will order at base price.
                  </p>
                )}

                {form.variants.map((variant, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 bg-slate-950/60 border border-[#23242B] rounded-xl px-3 py-2"
                  >
                    <input
                      id={`variant-name-${index}`}
                      type="text"
                      value={variant.variantName}
                      onChange={(e) => updateVariantRow(index, "variantName", e.target.value)}
                      placeholder="Variant name (e.g. Half)"
                      className="flex-1 bg-transparent text-xs text-slate-100 placeholder-slate-600 focus:outline-none"
                    />
                    <span className="text-slate-600 text-xs">₹</span>
                    <input
                      id={`variant-price-${index}`}
                      type="number"
                      value={variant.price || ""}
                      onChange={(e) => updateVariantRow(index, "price", Number(e.target.value))}
                      placeholder="0"
                      min={0}
                      className="w-20 bg-transparent text-xs text-slate-100 placeholder-slate-600 focus:outline-none text-right"
                    />
                    <button
                      id={`remove-variant-${index}`}
                      type="button"
                      onClick={() => removeVariantRow(index)}
                      className="text-slate-600 hover:text-red-400 transition-colors ml-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="border-t border-[#23242B]/40 pt-4 flex gap-3">
                <button
                  id="form-cancel-btn"
                  type="button"
                  onClick={handleCloseForm}
                  className="flex-1 rounded-xl border border-[#23242B] text-slate-400 hover:bg-[#23242B]/50 hover:text-white py-2 text-xs font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  id="form-save-btn"
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white py-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                >
                  <Save className="h-4 w-4" />
                  {isSaving ? "Saving..." : editingItemId ? "Update Item" : "Save Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
