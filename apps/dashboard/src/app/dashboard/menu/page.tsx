"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { MenuService } from "../../../lib/services/menu.service";
import { MenuItem, Category } from "../../../types";
import { useToast } from "../../../components/ui/ToastContainer";
import Button from "../../../components/ui/Button";
import Badge from "../../../components/ui/Badge";
import Card from "../../../components/ui/Card";
import Skeleton from "../../../components/ui/Skeleton";
import { EmptyState, ErrorState } from "../../../components/ui/StateViews";
import { Modal } from "../../../components/ui/Modal";
import { Input, Select } from "../../../components/ui/Input";
import {
  Search,
  Plus,
  RefreshCw,
  UtensilsCrossed,
  Leaf,
  Drumstick,
  Star,
  Eye,
  EyeOff,
  Edit2,
  Trash2,
  Copy,
  SlidersHorizontal,
  X,
  Sparkles,
  Smartphone,
  ChevronRight,
  Check,
  Zap,
  Tag,
  FolderPlus,
  FolderEdit
} from "lucide-react";

export default function ProductionMenuCatalogPage() {
  const toast = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterVeg, setFilterVeg] = useState<"all" | "veg" | "non-veg">("all");

  // Category Management Modal State (FIX 2)
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categorySortOrder, setCategorySortOrder] = useState(1);
  const [categoryIsVisible, setCategoryIsVisible] = useState(true);
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  // Item Editor Modal
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNewItem, setIsNewItem] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    basePrice: 0,
    categoryId: "",
    description: "",
    vegType: "veg" as "veg" | "non-veg",
    isPopular: false,
    allowInstructions: true,
    // Always start empty — variants are optional. If the user doesn't add any,
    // we send [] to the backend so stale variants are cleared.
    variants: [] as { variantName: string; price: number }[],
  });

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const loadMenuData = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);
    try {
      const [cats, itms] = await Promise.all([
        MenuService.listCategories().catch(() => []),
        MenuService.listItems(),
      ]);
      setCategories(cats);
      setItems(itms);
    } catch (err) {
      console.error("Failed to fetch menu items:", err);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMenuData();
  }, [loadMenuData]);

  // FIX 2: Category Create / Update Handler
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName.trim()) {
      toast.warning("Validation Error", "Category name is required.");
      return;
    }
    setIsSavingCategory(true);
    try {
      if (editingCategory) {
        const updated = await MenuService.updateCategory(editingCategory.id, {
          name: categoryName,
          displayOrder: Number(categorySortOrder),
          isVisible: categoryIsVisible,
        });
        setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        toast.success("Category Updated", `Renamed category to "${updated.name}".`);
      } else {
        const created = await MenuService.createCategory({
          name: categoryName,
          displayOrder: Number(categorySortOrder),
          isVisible: categoryIsVisible,
        });
        setCategories((prev) => [...prev, created]);
        toast.success("Category Created", `Created category "${created.name}".`);
      }
      setIsCategoryModalOpen(false);
    } catch (err: any) {
      toast.error("Category Error", err.message || "Could not save category.");
    } finally {
      setIsSavingCategory(false);
    }
  };

  // FIX 2: Category Delete with Item Confirmation Guard
  const handleDeleteCategory = async (cat: Category) => {
    const itemsInCat = items.filter((i) => i.categoryId === cat.id);
    const confirmMsg = itemsInCat.length > 0
      ? `Category "${cat.name}" contains ${itemsInCat.length} menu items. Are you sure you want to delete this category? Items will lose category assignment.`
      : `Delete category "${cat.name}"?`;

    if (!confirm(confirmMsg)) return;

    try {
      await MenuService.deleteCategory(cat.id);
      setCategories((prev) => prev.filter((c) => c.id !== cat.id));
      if (selectedCategoryId === cat.id) setSelectedCategoryId(null);
      toast.warning("Category Deleted", `Deleted "${cat.name}".`);
    } catch (err: any) {
      toast.error("Delete Error", err.message || "Failed to delete category.");
    }
  };

  // Instant Availability Toggle
  const handleToggleAvailability = async (item: MenuItem, currentStatus: boolean) => {
    const nextStatus = !currentStatus;
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, isAvailable: nextStatus } : i))
    );
    toast.info(
      nextStatus ? `${item.name} Available` : `${item.name} Hidden`,
      nextStatus ? "Item live for WhatsApp orders" : "Item marked out of stock"
    );

    try {
      await MenuService.updateAvailability(item.id, nextStatus);
    } catch (err) {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, isAvailable: currentStatus } : i))
      );
      toast.error("Update Failed", "Reverted availability status");
    }
  };

  const handleBulkToggle = async (enable: boolean) => {
    const targetIds = filteredItems.map((i) => i.id);
    setItems((prev) =>
      prev.map((i) => (targetIds.includes(i.id) ? { ...i, isAvailable: enable } : i))
    );
    toast.success("Bulk Updated", `${targetIds.length} items marked ${enable ? "Live" : "Out of Stock"}`);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Only send variants that have a non-empty name.
      // Sending [] explicitly tells the backend to clear any stale variants.
      const cleanVariants = formData.variants
        .filter((v) => v.variantName.trim() !== "")
        .map((v, i) => ({ variantName: v.variantName.trim(), price: Number(v.price), displayOrder: i }));

      if (isNewItem) {
        const created = await MenuService.createItem({
          name: formData.name,
          basePrice: Number(formData.basePrice),
          categoryId: formData.categoryId || undefined,
          description: formData.description,
          vegType: formData.vegType,
          isPopular: formData.isPopular,
          allowInstructions: formData.allowInstructions,
          variants: cleanVariants,
        });
        setItems((prev) => [...prev, created]);
        toast.success("Item Created", `"${created.name}" added to catalog.`);
      } else if (editingItem) {
        const updated = await MenuService.updateItem(editingItem.id, {
          name: formData.name,
          basePrice: Number(formData.basePrice),
          categoryId: formData.categoryId || undefined,
          description: formData.description,
          vegType: formData.vegType,
          isPopular: formData.isPopular,
          allowInstructions: formData.allowInstructions,
          variants: cleanVariants,
        });
        setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
        toast.success("Item Saved", `Updated details for "${updated.name}".`);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      toast.error("Save Error", err.message || "Could not save menu item.");
    }
  };

  const handleDeleteItem = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
    try {
      await MenuService.deleteItem(id);
      toast.warning("Item Deleted", `Removed "${name}" from menu.`);
    } catch (err) {
      loadMenuData();
      toast.error("Delete Failed", "Reverted deleted item.");
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesCategory = selectedCategoryId ? item.categoryId === selectedCategoryId : true;
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesVeg = filterVeg === "all" ? true : item.vegType === filterVeg;
      return matchesCategory && matchesSearch && matchesVeg;
    });
  }, [items, selectedCategoryId, searchQuery, filterVeg]);

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="font-heading text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100">
            Interactive Menu & Category Manager
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Category CRUD management, availability toggles, and WhatsApp customer preview.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPreviewOpen(true)}
            className="gap-2 font-semibold text-brand-600 dark:text-brand-400"
          >
            <Smartphone className="h-4 w-4" />
            <span>WhatsApp Preview</span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setEditingCategory(null);
              setCategoryName("");
              setCategorySortOrder(categories.length + 1);
              setCategoryIsVisible(true);
              setIsCategoryModalOpen(true);
            }}
            className="gap-1.5 font-bold"
          >
            <FolderPlus className="h-4 w-4 text-brand-600" />
            <span>+ Add Category</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setIsNewItem(true);
              setEditingItem(null);
              setFormData({
                name: "",
                basePrice: 0,
                categoryId: categories[0]?.id || "",
                description: "",
                vegType: "veg",
                isPopular: false,
                allowInstructions: true,
                // Start with no variants — user adds them only if this item has size options
                variants: [],
              });
              setIsModalOpen(true);
            }}
            className="gap-2 font-bold shadow-md"
          >
            <Plus className="h-4 w-4" />
            <span>Add Item</span>
          </Button>
        </div>
      </div>

      {/* Category Tabs Row with FIX 2 Edit/Delete Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-1 sm:pb-0">
          <button
            onClick={() => setSelectedCategoryId(null)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedCategoryId === null
                ? "bg-brand-600 text-white shadow-sm"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            All Categories ({items.length})
          </button>

          {categories.map((cat) => {
            const isSelected = selectedCategoryId === cat.id;
            const count = items.filter((i) => i.categoryId === cat.id).length;

            return (
              <div
                key={cat.id}
                className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  isSelected
                    ? "bg-brand-600 text-white shadow-sm"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
                onClick={() => setSelectedCategoryId(cat.id)}
              >
                <span>{cat.name} ({count})</span>
                
                {/* Category Hover Actions (Edit & Delete) */}
                <div className="hidden group-hover:flex items-center gap-1 border-l border-white/20 pl-1.5 ml-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingCategory(cat);
                      setCategoryName(cat.name);
                      setCategorySortOrder(cat.displayOrder || 1);
                      setCategoryIsVisible(cat.isVisible ?? true);
                      setIsCategoryModalOpen(true);
                    }}
                    className="hover:text-amber-300"
                    title="Rename Category"
                  >
                    <Edit2 className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCategory(cat);
                    }}
                    className="hover:text-red-300"
                    title="Delete Category"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button variant="ghost" size="sm" onClick={() => handleBulkToggle(true)} className="text-emerald-600 text-xs">
            Enable All
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleBulkToggle(false)} className="text-red-600 text-xs">
            Disable All
          </Button>
        </div>
      </div>

      {/* 4 STATES MANDATORY IMPLEMENTATION */}
      {isError && (
        <ErrorState title="Menu Load Error" message="Database catalog request failed." onRetry={loadMenuData} />
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-2xl" />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <EmptyState
          icon={<UtensilsCrossed className="h-8 w-8 text-brand-600" />}
          title="No Items Found in this Category"
          description="Create a new menu item to show in customer WhatsApp interactive menu."
          actionLabel="Add Item"
          onAction={() => {
            setIsNewItem(true);
            setIsModalOpen(true);
          }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item) => (
            <Card key={item.id} className="space-y-3 relative p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  {item.vegType === "veg" ? (
                    <span className="p-1 rounded-md border border-emerald-500 text-emerald-500 mt-0.5" title="Vegetarian">
                      <Leaf className="h-3.5 w-3.5" />
                    </span>
                  ) : (
                    <span className="p-1 rounded-md border border-red-500 text-red-500 mt-0.5" title="Non-Veg">
                      <Drumstick className="h-3.5 w-3.5" />
                    </span>
                  )}

                  <div>
                    <h3 className="font-heading font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <span>{item.name}</span>
                      {item.isPopular && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                      {item.description || "No description added."}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleToggleAvailability(item, item.isAvailable)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    item.isAvailable ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"
                  }`}
                  title={item.isAvailable ? "Mark Out of Stock" : "Mark Available"}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      item.isAvailable ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-xs font-semibold">
                {item.variants && item.variants.length > 0 ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Variants:</span>
                      <span className="font-heading font-extrabold text-sm text-slate-900 dark:text-slate-100">
                        {item.variants.length} size{item.variants.length > 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {item.variants.map((v: any) => (
                        <span key={v.id || v.variantName} className="px-1.5 py-0.5 rounded-md bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 text-[10px] font-bold">
                          {v.variantName} ₹{v.price}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Base Price:</span>
                    <span className="font-heading font-extrabold text-sm text-slate-900 dark:text-slate-100">
                      ₹{item.basePrice}
                    </span>
                  </div>
                )}
              </div>


              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                <Badge variant={item.isAvailable ? "success" : "neutral"} size="sm">
                  {item.isAvailable ? "Available" : "Hidden"}
                </Badge>

                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setIsNewItem(false);
                      setEditingItem(item);
                      setFormData({
                        name: item.name,
                        basePrice: item.basePrice,
                        categoryId: item.categoryId || "",
                        description: item.description || "",
                        vegType: item.vegType as any,
                        isPopular: item.isPopular,
                        allowInstructions: item.allowInstructions ?? true,
                        variants: item.variants?.map((v) => ({ variantName: v.variantName, price: v.price })) || [],
                      });
                      setIsModalOpen(true);
                    }}
                    className="p-1.5"
                  >
                    <Edit2 className="h-4 w-4 text-slate-500" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDeleteItem(item.id, item.name)} className="p-1.5 text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* FIX 2: Add / Edit Category Modal */}
      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title={editingCategory ? `Rename Category: ${editingCategory.name}` : "Create New Menu Category"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsCategoryModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSaveCategory} isLoading={isSavingCategory}>
              {editingCategory ? "Save Changes" : "Create Category"}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSaveCategory} className="space-y-4 text-xs">
          <Input
            label="Category Name"
            placeholder="e.g. Starters, Main Course, Beverages"
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            required
          />

          <Input
            label="Sort / Display Order"
            type="number"
            value={categorySortOrder}
            onChange={(e) => setCategorySortOrder(Number(e.target.value))}
            required
          />

          <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
            <div>
              <span className="font-bold text-slate-900 dark:text-slate-100 block">Category Visible</span>
              <span className="text-slate-500 text-[11px]">Show category in customer WhatsApp menu</span>
            </div>
            <input
              type="checkbox"
              checked={categoryIsVisible}
              onChange={(e) => setCategoryIsVisible(e.target.checked)}
              className="rounded text-brand-600 focus:ring-brand-500 h-4 w-4"
            />
          </div>
        </form>
      </Modal>

      {/* Item Editor Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isNewItem ? "Create Menu Item" : `Edit Item: ${editingItem?.name}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSaveItem}>Save Menu Item</Button>
          </>
        }
      >
        <form onSubmit={handleSaveItem} className="space-y-4 text-xs">
          {/* Item Name */}
          <Input
            label="Item Name"
            placeholder="e.g. Butter Chicken Special"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />

          {/* Base Price + Category */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={formData.variants.length > 0 ? "Base Price (₹) — optional if variants set" : "Base Price (₹)"}
              type="number"
              min={0}
              value={formData.basePrice}
              onChange={(e) => setFormData({ ...formData, basePrice: Number(e.target.value) })}
            />
            <Select
              label="Category"
              value={formData.categoryId}
              onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
            />
          </div>

          {/* Veg / Non-Veg + Options */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[140px]">
              <Select
                label="Type"
                value={formData.vegType}
                onChange={(e) => setFormData({ ...formData, vegType: e.target.value as any })}
                options={[
                  { value: "veg", label: "🟢 Vegetarian" },
                  { value: "non-veg", label: "🔴 Non-Vegetarian" },
                ]}
              />
            </div>
            <div className="flex items-center gap-4 mt-5">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formData.isPopular}
                  onChange={(e) => setFormData({ ...formData, isPopular: e.target.checked })}
                  className="rounded text-brand-600 focus:ring-brand-500 h-4 w-4"
                />
                <span className="font-semibold text-slate-700 dark:text-slate-300">⭐ Bestseller</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formData.allowInstructions}
                  onChange={(e) => setFormData({ ...formData, allowInstructions: e.target.checked })}
                  className="rounded text-brand-600 focus:ring-brand-500 h-4 w-4"
                />
                <span className="font-semibold text-slate-700 dark:text-slate-300">📝 Custom Instructions</span>
              </label>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 dark:text-slate-300">Description</label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Short description shown to customers..."
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* ── Variants Section ─────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200 block">Size / Variant Options</span>
                <span className="text-slate-500 text-[11px]">
                  {formData.variants.length === 0
                    ? "No variants — item sold at Base Price above."
                    : `${formData.variants.length} variant(s) defined. Base price is overridden by variant prices.`}
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  setFormData({
                    ...formData,
                    variants: [...formData.variants, { variantName: "", price: 0 }],
                  })
                }
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-brand-600 text-white text-[11px] font-bold hover:bg-brand-700 transition cursor-pointer"
              >
                <Plus className="h-3 w-3" />
                Add Variant
              </button>
            </div>

            {formData.variants.length > 0 && (
              <div className="space-y-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                {/* Header row */}
                <div className="grid grid-cols-[1fr_100px_32px] gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                  <span>Variant Name (e.g. Small, Regular, Large)</span>
                  <span>Price (₹)</span>
                  <span />
                </div>

                {formData.variants.map((variant, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_100px_32px] gap-2 items-center">
                    <input
                      type="text"
                      placeholder={`e.g. ${idx === 0 ? "Regular" : idx === 1 ? "Large" : "XL"}`}
                      value={variant.variantName}
                      onChange={(e) => {
                        const updated = [...formData.variants];
                        updated[idx] = { ...updated[idx], variantName: e.target.value };
                        setFormData({ ...formData, variants: updated });
                      }}
                      className="px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={variant.price}
                      onChange={(e) => {
                        const updated = [...formData.variants];
                        updated[idx] = { ...updated[idx], price: Number(e.target.value) };
                        setFormData({ ...formData, variants: updated });
                      }}
                      className="px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const updated = formData.variants.filter((_, i) => i !== idx);
                        setFormData({ ...formData, variants: updated });
                      }}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition cursor-pointer"
                      title="Remove this variant"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}

                <p className="text-[10px] text-slate-400 pt-1">
                  💡 Tip: Remove all variants to sell this item at a single Base Price.
                </p>
              </div>
            )}
          </div>
        </form>
      </Modal>

      {/* Customer WhatsApp Interactive Preview Modal */}
      <Modal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        title="WhatsApp Customer View Preview"
      >
        <div className="p-4 rounded-2xl bg-slate-900 text-slate-100 space-y-4 max-w-sm mx-auto shadow-2xl border border-slate-800 font-mono text-xs">
          <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-emerald-400 font-bold flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            <span>Restroex WhatsApp Bot</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-800 text-slate-200 leading-relaxed whitespace-pre-wrap">
            {"🍽️ *Restroex Menu*\n\n1. Butter Chicken — ₹280\n2. Dal Makhani — ₹220\n3. Garlic Naan — ₹50\n\nReply with item number or quantity to add to cart."}
          </div>
        </div>
      </Modal>
    </div>
  );
}
