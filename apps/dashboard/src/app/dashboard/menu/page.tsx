// src/app/dashboard/menu/page.tsx
"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  Search,
  Plus,
  RefreshCw,
  UtensilsCrossed,
  Filter,
  Leaf,
  Drumstick,
  Star,
  ThumbsUp,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { MenuService } from "../../../lib/services/menu.service";
import { MenuItem, Category } from "../../../types";
import { CategorySidebar } from "../../../components/menu/CategorySidebar";
import { ItemCard } from "../../../components/menu/ItemCard";
import { ItemEditor } from "../../../components/menu/ItemEditor";
import { ToastProvider, toast } from "../../../components/menu/Toast";

// ── Skeleton ──────────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="bg-[#181E29] rounded-2xl border border-white/5 shadow-lg overflow-hidden flex flex-col h-full animate-pulse">
      <div className="h-44 bg-white/5" />
      <div className="p-4 space-y-3 flex-1">
        <div className="h-4 bg-white/10 rounded w-3/4" />
        <div className="h-3 bg-white/5 rounded w-1/2" />
        <div className="h-6 bg-white/5 rounded-full w-24 mt-4" />
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ categorySelected, onAdd }: { categorySelected: boolean; onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 py-32 text-center px-8 bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 mx-6 my-6 shadow-2xl">
      <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/30 flex items-center justify-center mb-6 shadow-[inset_0_0_20px_rgba(139,92,246,0.1)]">
        <UtensilsCrossed size={40} className="text-violet-300" />
      </div>
      <h3 className="text-2xl font-bold text-white mb-3 tracking-tight">
        {categorySelected ? "Category is empty" : "Let's build your menu"}
      </h3>
      <p className="text-sm text-slate-300 mb-10 max-w-sm leading-relaxed">
        {categorySelected
          ? "Start building this category by adding your first menu item."
          : "Create your first category and add mouth-watering items to start taking WhatsApp orders automatically."}
      </p>

      {!categorySelected && (
        <div className="flex items-center gap-4 mb-10 text-sm font-medium text-slate-400">
          <span className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg border border-white/5"><span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-300 flex items-center justify-center text-xs">1</span> Categories</span>
          <span className="text-slate-600">→</span>
          <span className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg border border-white/5"><span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-300 flex items-center justify-center text-xs">2</span> Add Items</span>
          <span className="text-slate-600">→</span>
          <span className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg border border-white/5"><span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-300 flex items-center justify-center text-xs">3</span> Auto-Orders</span>
        </div>
      )}

      <button
        onClick={onAdd}
        className="flex items-center gap-2 px-8 py-3.5 bg-white text-slate-900 text-sm font-bold rounded-xl shadow-[0_4px_20px_rgba(255,255,255,0.2)] hover:shadow-[0_4px_25px_rgba(255,255,255,0.3)] hover:-translate-y-0.5 transition-all"
      >
        <Plus size={18} /> Add Your First Item
      </button>
    </div>
  );
}

// ── Confirm dialog ─────────────────────────────────────────────────────────────

interface ConfirmState {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}

function ConfirmDialog({ state, onClose }: { state: ConfirmState; onClose: () => void }) {
  if (!state.open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#181E29] rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 border border-white/10 animate-in zoom-in-95 duration-200">
        <h3 className="text-lg font-bold text-white mb-2">{state.title}</h3>
        <p className="text-sm text-slate-300 mb-8 leading-relaxed">{state.message}</p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-white/5 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => { state.onConfirm(); onClose(); }}
            className="flex-1 py-3 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-400 text-sm font-semibold hover:bg-rose-500 hover:text-white transition-all shadow-sm"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MenuPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [isNewItem, setIsNewItem] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterVeg, setFilterVeg] = useState<"all" | "veg" | "non-veg">("all");
  const [filterAvail, setFilterAvail] = useState<"all" | "available" | "hidden">("all");

  const [dragItem, setDragItem] = useState<string | null>(null);
  const [dragOverItem, setDragOverItem] = useState<string | null>(null);

  const [confirm, setConfirm] = useState<ConfirmState>({
    open: false, title: "", message: "", onConfirm: () => {},
  });

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadAll = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    try {
      const [cats, itms] = await Promise.all([
        MenuService.listCategories().catch(() => []),
        MenuService.listItems(),
      ]);
      setCategories(cats);
      setItems(itms);
    } catch {
      toast("Failed to load menu data", "error");
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Filtered items ──────────────────────────────────────────────────────────

  const filteredItems = useMemo(() => {
    let result = items;

    // Category filter
    if (selectedCategoryId) {
      const subIds = categories.filter((c) => c.parentId === selectedCategoryId).map((c) => c.id);
      result = result.filter(
        (i) => i.categoryId === selectedCategoryId || subIds.includes(i.subcategoryId || ""),
      );
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.description || "").toLowerCase().includes(q) ||
          (i.aliases || []).some((a) => a.toLowerCase().includes(q)) ||
          i.variants.some((v) => v.variantName.toLowerCase().includes(q)),
      );
    }

    // Veg filter
    if (filterVeg !== "all") result = result.filter((i) => i.vegType === filterVeg);

    // Availability filter
    if (filterAvail === "available") result = result.filter((i) => i.isAvailable);
    if (filterAvail === "hidden") result = result.filter((i) => !i.isAvailable);

    return result.sort((a, b) => a.displayOrder - b.displayOrder);
  }, [items, categories, selectedCategoryId, searchQuery, filterVeg, filterAvail]);

  // ── Category actions ────────────────────────────────────────────────────────

  const handleCreateCategory = async (name: string, parentId?: string) => {
    try {
      const cat = await MenuService.createCategory({
        name,
        parentId,
        isVisible: true,
        displayOrder: categories.filter((c) => !c.parentId).length,
      });
      setCategories((prev) => [...prev, cat]);
      toast(`"${name}" created`, "success");
    } catch {
      toast("Failed to create category", "error");
    }
  };

  const handleRenameCategory = async (id: string, name: string) => {
    try {
      const updated = await MenuService.updateCategory(id, { name });
      setCategories((prev) => prev.map((c) => (c.id === id ? updated : c)));
      toast("Category renamed", "success");
    } catch {
      toast("Failed to rename category", "error");
    }
  };

  const handleDeleteCategory = async (id: string) => {
    const cat = categories.find((c) => c.id === id);
    setConfirm({
      open: true,
      title: "Delete category",
      message: `Delete "${cat?.name}"? Items in this category won't be deleted but will lose their category assignment.`,
      onConfirm: async () => {
        try {
          await MenuService.deleteCategory(id);
          setCategories((prev) => prev.filter((c) => c.id !== id));
          if (selectedCategoryId === id) setSelectedCategoryId(null);
          toast("Category deleted", "success");
        } catch {
          toast("Failed to delete category", "error");
        }
      },
    });
  };

  const handleToggleCategoryVisible = async (id: string, isVisible: boolean) => {
    try {
      const updated = await MenuService.updateCategory(id, { isVisible });
      setCategories((prev) => prev.map((c) => (c.id === id ? updated : c)));
      toast(isVisible ? "Category visible" : "Category hidden", "success");
    } catch {
      toast("Failed to update category", "error");
    }
  };

  const handleReorderCategories = async (ordered: { id: string; displayOrder: number }[]) => {
    // Optimistic update
    setCategories((prev) =>
      prev.map((c) => {
        const o = ordered.find((x) => x.id === c.id);
        return o ? { ...c, displayOrder: o.displayOrder } : c;
      }),
    );
    try {
      await MenuService.reorderCategories(ordered);
    } catch {
      toast("Failed to reorder categories", "error");
      loadAll();
    }
  };

  // ── Item actions ────────────────────────────────────────────────────────────

  const handleSelectItem = (item: MenuItem) => {
    setSelectedItem(item);
    setIsNewItem(false);
  };

  const handleAddItem = () => {
    setSelectedItem(null);
    setIsNewItem(true);
  };

  const handleCloseEditor = () => {
    setSelectedItem(null);
    setIsNewItem(false);
  };

  const handleSaveItem = async (data: any) => {
    const { variants, customizations, ...rest } = data;
    try {
      let saved: MenuItem;
      if (isNewItem) {
        saved = await MenuService.createItem({
          ...rest,
          categoryId: rest.categoryId || selectedCategoryId || undefined,
          variants: variants.map((v: any) => ({
            variantName: v.variantName,
            price: Number(v.price),
            displayOrder: v.displayOrder,
          })),
        });
        setItems((prev) => [...prev, saved]);
        toast(`"${saved.name}" added`, "success");
      } else if (selectedItem) {
        saved = await MenuService.updateItem(selectedItem.id, {
          ...rest,
          variants: variants.map((v: any) => ({
            variantName: v.variantName,
            price: Number(v.price),
            displayOrder: v.displayOrder,
          })),
        });
        // Update customizations separately
        if (customizations.length > 0 || (selectedItem.customizations || []).length > 0) {
          // Delete removed ones
          for (const existing of selectedItem.customizations || []) {
            if (!customizations.find((c: any) => c.id === existing.id)) {
              await MenuService.deleteCustomization(selectedItem.id, existing.id).catch(() => {});
            }
          }
          // Create/update remaining
          for (const c of customizations) {
            if (c.id) {
              await MenuService.updateCustomization(selectedItem.id, c.id, {
                name: c.name, priceAdjustment: c.priceAdjustment, isAvailable: c.isAvailable,
              }).catch(() => {});
            } else {
              await MenuService.createCustomization(selectedItem.id, {
                name: c.name, priceAdjustment: c.priceAdjustment, isAvailable: c.isAvailable,
              }).catch(() => {});
            }
          }
          // Re-fetch for fresh customizations
          await loadAll();
        } else {
          setItems((prev) => prev.map((i) => (i.id === saved.id ? saved : i)));
        }
        toast(`"${saved.name}" updated`, "success");
      } else return;

      setSelectedItem(saved);
      setIsNewItem(false);
    } catch (err: any) {
      toast(err?.message || "Failed to save item", "error");
    }
  };

  const handleToggleAvailability = async (item: MenuItem, isAvailable: boolean) => {
    // Optimistic
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, isAvailable } : i)));
    if (selectedItem?.id === item.id) setSelectedItem((s) => s && { ...s, isAvailable });
    try {
      await MenuService.updateAvailability(item.id, isAvailable);
    } catch {
      // Revert
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, isAvailable: !isAvailable } : i)));
      toast("Failed to update availability", "error");
    }
  };

  const handleDeleteItem = (item: MenuItem) => {
    setConfirm({
      open: true,
      title: "Delete item",
      message: `Delete "${item.name}"? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          await MenuService.deleteItem(item.id);
          setItems((prev) => prev.filter((i) => i.id !== item.id));
          if (selectedItem?.id === item.id) handleCloseEditor();
          toast(`"${item.name}" deleted`, "success");
        } catch (err: any) {
          toast(err?.message || "Failed to delete item", "error");
        }
      },
    });
  };

  const handleDuplicateItem = async (item: MenuItem) => {
    try {
      const dup = await MenuService.createItem({
        name: `${item.name} (Copy)`,
        basePrice: item.basePrice,
        aliases: item.aliases,
        categoryId: item.categoryId || undefined,
        subcategoryId: item.subcategoryId || undefined,
        description: item.description || undefined,
        vegType: item.vegType,
        preparationTime: item.preparationTime,
        isPopular: item.isPopular,
        isRecommended: item.isRecommended,
        displayOrder: item.displayOrder + 1,
        variants: item.variants.map((v) => ({
          variantName: v.variantName, price: v.price, displayOrder: v.displayOrder,
        })),
      });
      setItems((prev) => [...prev, dup]);
      toast(`"${dup.name}" duplicated`, "success");
    } catch {
      toast("Failed to duplicate item", "error");
    }
  };

  // ── Item drag & drop ────────────────────────────────────────────────────────

  const handleItemDrop = async (toId: string) => {
    if (!dragItem || dragItem === toId) return;
    const sorted = [...filteredItems];
    const fromIdx = sorted.findIndex((i) => i.id === dragItem);
    const toIdx = sorted.findIndex((i) => i.id === toId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = sorted.splice(fromIdx, 1);
    sorted.splice(toIdx, 0, moved);
    const orders = sorted.map((i, idx) => ({ id: i.id, displayOrder: idx }));
    // Optimistic
    setItems((prev) => {
      const updated = [...prev];
      for (const o of orders) {
        const idx = updated.findIndex((i) => i.id === o.id);
        if (idx !== -1) updated[idx] = { ...updated[idx], displayOrder: o.displayOrder };
      }
      return updated;
    });
    setDragItem(null);
    setDragOverItem(null);
    try {
      await MenuService.reorderItems(orders);
    } catch {
      toast("Failed to reorder items", "error");
      loadAll();
    }
  };

  // ── Stats ───────────────────────────────────────────────────────────────────

  const stats = useMemo(() => ({
    total: items.length,
    available: items.filter((i) => i.isAvailable).length,
    veg: items.filter((i) => i.vegType === "veg").length,
    popular: items.filter((i) => i.isPopular).length,
  }), [items]);

  const isEditorOpen = isNewItem || selectedItem !== null;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-[#0A0D14] overflow-hidden selection:bg-violet-500/30 selection:text-violet-200">
      <ToastProvider />
      <ConfirmDialog state={confirm} onClose={() => setConfirm((s) => ({ ...s, open: false }))} />

      {/* ── Top Header ───────────────────────────────────────────────────────── */}
      <div className="shrink-0 bg-[#0F141F] border-b border-white/10 px-6 py-4 shadow-sm z-20">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Menu Builder</h1>
            <p className="text-xs text-slate-400 mt-0.5 font-medium">
              <span className="text-white">{stats.total}</span> items · <span className="text-emerald-400">{stats.available}</span> live · <span className="text-amber-400">{stats.popular}</span> popular
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search items, aliases, variants…"
                className="pl-9 pr-4 py-2 text-sm bg-white/5 border border-white/10 rounded-xl w-72 focus:outline-none focus:ring-1 focus:ring-violet-400 focus:bg-white/10 text-white placeholder-slate-500 transition-all"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors">
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Filters */}
            <div className="flex items-center gap-1 border border-white/10 rounded-xl p-1 bg-white/5">
              {([
                { val: "all" as const, label: "All", icon: null },
                { val: "veg" as const, label: "Veg", icon: <Leaf size={11} className="text-emerald-400" /> },
                { val: "non-veg" as const, label: "Non-Veg", icon: <Drumstick size={11} className="text-rose-400" /> },
              ].map(({ val, label, icon }) => (
                <button
                  key={val}
                  onClick={() => setFilterVeg(val)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all
                    ${filterVeg === val ? "bg-white/10 text-white shadow-sm border border-white/10" : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent"}`}
                >
                  {icon}{label}
                </button>
              )))}
            </div>

            <div className="flex items-center gap-1 border border-white/10 rounded-xl p-1 bg-white/5">
              {([
                { val: "all", label: "All" },
                { val: "available", label: "Live" },
                { val: "hidden", label: "Hidden" },
              ] as const).map(({ val, label }) => (
                <button
                  key={val}
                  onClick={() => setFilterAvail(val)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all
                    ${filterAvail === val ? "bg-white/10 text-white shadow-sm border border-white/10" : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent"}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Refresh */}
            <button
              onClick={() => loadAll(true)}
              disabled={refreshing}
              className="p-2 border border-white/10 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
              title="Refresh"
            >
              <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
            </button>

            {/* Add Item */}
            <button
              onClick={handleAddItem}
              className="flex items-center gap-2 px-5 py-2 bg-white text-slate-900 text-sm font-bold rounded-xl shadow-[0_2px_10px_rgba(255,255,255,0.1)] hover:shadow-[0_2px_15px_rgba(255,255,255,0.2)] hover:-translate-y-0.5 transition-all"
            >
              <Plus size={16} /> Add Item
            </button>
          </div>
        </div>
      </div>

      {/* ── Three-panel layout ────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Background glow effect for premium feel */}
        <div className="absolute top-0 left-[20%] w-[600px] h-[600px] bg-violet-600/10 rounded-full blur-[120px] pointer-events-none" />

        {/* Left: Category Sidebar (20%) */}
        <div className="w-1/5 min-w-[260px] max-w-[320px] shrink-0 overflow-hidden border-r border-white/10 bg-[#0F141F] z-10">
          <CategorySidebar
            categories={categories}
            selectedCategoryId={selectedCategoryId}
            onSelect={setSelectedCategoryId}
            onCreate={handleCreateCategory}
            onRename={handleRenameCategory}
            onDelete={handleDeleteCategory}
            onToggleVisible={handleToggleCategoryVisible}
            onReorder={handleReorderCategories}
          />
        </div>

        {/* Center: Items Panel (45%) */}
        <div className="flex-1 overflow-y-auto relative z-10">
          {/* Panel header */}
          <div className="sticky top-0 z-10 bg-[#0A0D14]/80 backdrop-blur-xl border-b border-white/5 px-8 py-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                {selectedCategoryId
                  ? categories.find((c) => c.id === selectedCategoryId)?.name || "Items"
                  : "All Items"}
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                {filteredItems.length} item{filteredItems.length !== 1 ? "s" : ""}
                {searchQuery && <span className="text-violet-400"> matching "{searchQuery}"</span>}
              </p>
            </div>
            <button
              onClick={handleAddItem}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 rounded-xl transition-all"
            >
              <Plus size={16} /> New Item
            </button>
          </div>

          {/* Items grid */}
          <div className="p-8">
            {isLoading ? (
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
              </div>
            ) : filteredItems.length === 0 ? (
              <EmptyState
                categorySelected={!!selectedCategoryId}
                onAdd={handleAddItem}
              />
            ) : (
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredItems.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    isSelected={selectedItem?.id === item.id}
                    onSelect={() => handleSelectItem(item)}
                    onToggleAvailability={(v) => handleToggleAvailability(item, v)}
                    onDelete={() => handleDeleteItem(item)}
                    onDuplicate={() => handleDuplicateItem(item)}
                    onDragStart={() => setDragItem(item.id)}
                    onDragOver={(e) => { e.preventDefault(); setDragOverItem(item.id); }}
                    onDrop={() => handleItemDrop(item.id)}
                    onDragEnd={() => { setDragItem(null); setDragOverItem(null); }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Item Editor (35%) */}
        {isEditorOpen && (
          <div className="w-[35%] min-w-[360px] max-w-[500px] shrink-0 overflow-hidden border-l border-white/10 bg-[#0F141F] shadow-[-20px_0_40px_rgba(0,0,0,0.5)] z-20">
            <ItemEditor
              item={selectedItem}
              isNew={isNewItem}
              categories={categories}
              onSave={handleSaveItem}
              onClose={handleCloseEditor}
            />
          </div>
        )}
      </div>
    </div>
  );
}
