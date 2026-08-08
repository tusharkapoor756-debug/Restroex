"use client";

// apps/dashboard/src/app/dashboard/menu/combos/page.tsx
// Special Combos & Value Deals Manager — Create, edit, and manage bundled menu deals

import React, { useState, useEffect } from "react";
import { useToast } from "../../../../components/ui/ToastContainer";
import Button from "../../../../components/ui/Button";
import Card from "../../../../components/ui/Card";
import Skeleton from "../../../../components/ui/Skeleton";
import { UploadService } from "../../../../lib/services/upload.service";
import {
  Tag,
  Plus,
  Trash2,
  Pencil,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Sparkles,
  Search,
  Package,
  Layers,
  Upload,
  ImageIcon,
} from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

interface ComboItemIncluded {
  menuItemId?: string;
  name: string;
  variantName?: string;
  quantity: number;
  price?: number;
}

interface Combo {
  id: string;
  name: string;
  description: string | null;
  comboPrice: number;
  originalPrice: number;
  savingsAmount: number;
  imageUrl: string | null;
  itemsIncluded: ComboItemIncluded[];
  isActive: boolean;
  createdAt: string;
}

interface MenuItemVariant {
  id?: string;
  variantName: string;
  price: number;
}

interface MenuItemOption {
  id: string;
  name: string;
  price: number;
  variants?: MenuItemVariant[];
}

export default function CombosPage() {
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [combos, setCombos] = useState<Combo[]>([]);
  const [availableMenuItems, setAvailableMenuItems] = useState<MenuItemOption[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Drawer / Form State
  const [showDrawer, setShowDrawer] = useState(false);
  const [editingComboId, setEditingComboId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [comboPrice, setComboPrice] = useState<number>(299);
  const [originalPrice, setOriginalPrice] = useState<number>(399);
  const [imageUrl, setImageUrl] = useState("");
  const [itemsIncluded, setItemsIncluded] = useState<ComboItemIncluded[]>([]);

  // Item Selector State inside Modal
  const [selectedMenuItemId, setSelectedMenuItemId] = useState("");
  const [selectedVariantName, setSelectedVariantName] = useState("");
  const [itemQuantity, setItemQuantity] = useState<number>(1);

  useEffect(() => {
    fetchData();
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

  const [uploadingImage, setUploadingImage] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Combos
      const comboRes = await fetch(`${BACKEND_URL}/api/v1/combos`, {
        headers: getAuthHeaders(),
      });
      const comboJson = await comboRes.json();
      if (comboRes.ok && comboJson.data) {
        setCombos(comboJson.data);
      }

      // 2. Fetch Menu Items for bundle picker
      const menuRes = await fetch(`${BACKEND_URL}/api/v1/menu/items`, {
        headers: getAuthHeaders(),
      });
      const menuJson = await menuRes.json();
      if (menuRes.ok && menuJson.data) {
        const rawList = Array.isArray(menuJson.data) ? menuJson.data : (menuJson.data.categories ? menuJson.data.categories.flatMap((c: any) => c.items || []) : []);
        const itemsList: MenuItemOption[] = rawList.map((it: any) => ({
          id: it.id,
          name: it.name,
          price: Number(it.basePrice || it.price || 0),
          variants: Array.isArray(it.variants) ? it.variants.map((v: any) => ({
            id: v.id,
            variantName: v.variantName || v.name,
            price: Number(v.price || 0),
          })) : [],
        }));
        setAvailableMenuItems(itemsList);
      }
    } catch (err: any) {
      toast.error("Failed to load combos", err.message || "Could not fetch combo packages");
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const res = await UploadService.uploadFile(file);
      if (res.url) {
        setImageUrl(res.url);
        toast.success("Image Uploaded", "Combo photo attached successfully.");
      }
    } catch (err: any) {
      toast.error("Upload Failed", err.message || "Could not upload image file.");
    } finally {
      setUploadingImage(false);
    }
  };

  const openCreateDrawer = () => {
    setEditingComboId(null);
    setName("");
    setDescription("");
    setComboPrice(299);
    setOriginalPrice(399);
    setImageUrl("");
    setItemsIncluded([]);
    setShowDrawer(true);
  };

  const openEditDrawer = (combo: Combo) => {
    setEditingComboId(combo.id);
    setName(combo.name);
    setDescription(combo.description || "");
    setComboPrice(combo.comboPrice);
    setOriginalPrice(combo.originalPrice);
    setImageUrl(combo.imageUrl || "");
    setItemsIncluded(combo.itemsIncluded || []);
    setShowDrawer(true);
  };

  const handleAddItemToBundle = () => {
    if (!selectedMenuItemId) return;
    const foundItem = availableMenuItems.find((i) => i.id === selectedMenuItemId);
    if (!foundItem) return;

    let selectedVariantPrice = foundItem.price;
    let variantLabel = "";

    if (foundItem.variants && foundItem.variants.length > 0) {
      const selectedVar = foundItem.variants.find((v) => v.variantName === selectedVariantName) || foundItem.variants[0];
      if (selectedVar) {
        selectedVariantPrice = selectedVar.price;
        variantLabel = selectedVar.variantName;
      }
    }

    const displayName = variantLabel ? `${foundItem.name} (${variantLabel})` : foundItem.name;

    const newItem: ComboItemIncluded = {
      menuItemId: foundItem.id,
      name: displayName,
      variantName: variantLabel || undefined,
      quantity: itemQuantity,
      price: selectedVariantPrice,
    };

    const newItems = [...itemsIncluded, newItem];
    setItemsIncluded(newItems);

    const calculatedSum = newItems.reduce((sum, inc) => sum + ((inc.price || 0) * inc.quantity), 0);
    if (calculatedSum > 0) setOriginalPrice(calculatedSum);

    setSelectedMenuItemId("");
    setSelectedVariantName("");
    setItemQuantity(1);
  };

  const handleRemoveItemFromBundle = (index: number) => {
    setItemsIncluded((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveCombo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.warning("Name Required", "Please enter a valid combo deal name.");
      return;
    }

    if (itemsIncluded.length === 0) {
      toast.warning("Items Required", "Please include at least 1 menu item in the combo package.");
      return;
    }

    setSaving(true);
    try {
      const isEditing = Boolean(editingComboId);
      const url = isEditing
        ? `${BACKEND_URL}/api/v1/combos/${editingComboId}`
        : `${BACKEND_URL}/api/v1/combos`;

      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          comboPrice,
          originalPrice,
          imageUrl: imageUrl.trim() || undefined,
          itemsIncluded,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || json.message || "Failed to save combo");

      toast.success(
        isEditing ? "Combo Updated" : "Combo Created",
        `Special Combo '${name}' saved successfully.`
      );
      setShowDrawer(false);
      fetchData();
    } catch (err: any) {
      toast.error("Save Error", err.message || "Could not save combo package");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (combo: Combo) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/combos/${combo.id}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ isActive: !combo.isActive }),
      });

      if (!res.ok) throw new Error("Status update failed");

      toast.info("Status Updated", `Combo '${combo.name}' is now ${!combo.isActive ? "ACTIVE" : "INACTIVE"}`);
      fetchData();
    } catch (err: any) {
      toast.error("Error", err.message || "Failed to toggle combo status");
    }
  };

  const handleDeleteCombo = async (comboId: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/combos/${comboId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      if (!res.ok) throw new Error("Deletion failed");

      toast.success("Combo Deleted", "Special combo deal removed.");
      fetchData();
    } catch (err: any) {
      toast.error("Error", err.message || "Could not delete combo package");
    }
  };

  const filteredCombos = combos.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const calculatedSavings = Math.max(0, originalPrice - comboPrice);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400">
              <Package className="h-5 w-5" />
            </span>
            <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 font-heading">
              Special Combos & Value Deals
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Bundle menu items together into high-converting special value meal deals.
          </p>
        </div>

        <Button onClick={openCreateDrawer} className="font-bold gap-2 px-5">
          <Plus className="h-4 w-4" />
          <span>Create Combo Deal</span>
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 block uppercase">Total Combos</span>
            <span className="text-xl font-black text-slate-900 dark:text-slate-100 font-mono">
              {combos.length}
            </span>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 block uppercase">Active Deals</span>
            <span className="text-xl font-black text-slate-900 dark:text-slate-100 font-mono">
              {combos.filter((c) => c.isActive).length}
            </span>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 block uppercase">Ordering Page</span>
            <span className="text-xs font-extrabold text-purple-600 dark:text-purple-300 block">
              Auto-Highlighted at Top
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
              placeholder="Search combo deals..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none"
            />
          </div>

          <button
            onClick={fetchData}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : filteredCombos.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-extrabold uppercase text-slate-400">
                  <th className="py-2.5 px-3">Combo Package</th>
                  <th className="py-2.5 px-3">Included Items</th>
                  <th className="py-2.5 px-3">Combo Price</th>
                  <th className="py-2.5 px-3">Customer Savings</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                {filteredCombos.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-3">
                        {c.imageUrl ? (
                          <img
                            src={c.imageUrl}
                            alt={c.name}
                            className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 border border-orange-200/60 flex items-center justify-center font-bold text-sm shrink-0">
                            🍱
                          </div>
                        )}
                        <div>
                          <span className="font-extrabold text-slate-900 dark:text-slate-100 block">
                            {c.name}
                          </span>
                          {c.description && (
                            <span className="text-[11px] text-slate-400 line-clamp-1">
                              {c.description}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {c.itemsIncluded && c.itemsIncluded.map((inc, i) => (
                          <span
                            key={i}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60"
                          >
                            {inc.quantity}x {inc.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-baseline gap-1.5 font-mono">
                        <span className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">
                          ₹{c.comboPrice}
                        </span>
                        {c.originalPrice > c.comboPrice && (
                          <span className="text-xs text-slate-400 line-through">
                            ₹{c.originalPrice}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      {c.savingsAmount > 0 ? (
                        <span className="font-black text-xs text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                          SAVE ₹{c.savingsAmount}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs font-medium">Standard</span>
                      )}
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
                          title="Edit combo"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteCombo(c.id)}
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer"
                          title="Delete combo"
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
            No special combos created yet. Click "Create Combo Deal" to bundle items together.
          </div>
        )}
      </Card>

      {/* Create / Edit Combo Modal Drawer */}
      {showDrawer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 p-6 rounded-2xl max-w-xl w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-extrabold font-heading flex items-center gap-2">
                <Package className="h-4 w-4 text-orange-600" />
                <span>{editingComboId ? `Edit Combo — ${name}` : "Create Special Combo Package"}</span>
              </h3>
              <button onClick={() => setShowDrawer(false)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCombo} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Combo Name (e.g. Super Value Family Meal)
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Super Value Family Meal"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Description / Subtext
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Serves 2 | Includes Paneer Tikka, 2 Naans & 1 Cold Drink"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Combo Image (Upload or Paste URL)</span>
                  {uploadingImage && <span className="text-[11px] font-extrabold text-orange-600 animate-pulse">Uploading image...</span>}
                </label>

                <div className="flex items-center gap-3">
                  {imageUrl ? (
                    <div className="relative group shrink-0">
                      <img
                        src={imageUrl}
                        alt="Combo preview"
                        className="w-16 h-16 rounded-xl object-cover border border-slate-200 shadow-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setImageUrl("")}
                        className="absolute -top-1.5 -right-1.5 bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shadow-sm hover:bg-red-600 cursor-pointer"
                        title="Remove photo"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-slate-100 dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-400 shrink-0">
                      <ImageIcon className="h-6 w-6" />
                    </div>
                  )}

                  <div className="flex-1 space-y-2">
                    <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-xs cursor-pointer transition shadow-xs">
                      <Upload className="h-4 w-4" />
                      <span>{uploadingImage ? "Uploading..." : "Upload Image File"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={uploadingImage}
                        className="hidden"
                      />
                    </label>
                    <input
                      type="url"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="or paste image URL..."
                      className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-[11px]"
                    />
                  </div>
                </div>
              </div>

              {/* Items Bundled Picker */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                <label className="font-extrabold text-slate-800 dark:text-slate-200 block text-xs">
                  🍱 Select Items Included in Combo
                </label>

                <div className="space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                        1. Select Menu Dish
                      </span>
                      <select
                        value={selectedMenuItemId}
                        onChange={(e) => {
                          const id = e.target.value;
                          setSelectedMenuItemId(id);
                          const item = availableMenuItems.find((i) => i.id === id);
                          if (item && item.variants && item.variants.length > 0) {
                            setSelectedVariantName(item.variants[0].variantName);
                          } else {
                            setSelectedVariantName("");
                          }
                        }}
                        className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-xs truncate"
                      >
                        <option value="">-- Choose Menu Item --</option>
                        {availableMenuItems.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} {item.variants && item.variants.length > 0 ? `(${item.variants.length} Variants)` : `(₹${item.price})`}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Dynamic Variant Selector */}
                    {(() => {
                      const activeItem = availableMenuItems.find((i) => i.id === selectedMenuItemId);
                      if (!activeItem || !activeItem.variants || activeItem.variants.length === 0) return null;

                      return (
                        <div>
                          <span className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 uppercase tracking-wider block mb-1">
                            2. Select Portion / Variant
                          </span>
                          <select
                            value={selectedVariantName}
                            onChange={(e) => setSelectedVariantName(e.target.value)}
                            className="w-full p-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-slate-900 font-bold text-xs text-amber-900 dark:text-amber-200 truncate"
                          >
                            {activeItem.variants.map((v, idx) => (
                              <option key={idx} value={v.variantName}>
                                {v.variantName} (₹{v.price})
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Quantity:</span>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={itemQuantity}
                        onChange={(e) => setItemQuantity(parseInt(e.target.value) || 1)}
                        className="w-16 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-black text-center text-xs"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleAddItemToBundle}
                      className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-extrabold rounded-xl text-xs cursor-pointer shadow-xs transition"
                    >
                      + Add Item to Combo
                    </button>
                  </div>
                </div>

                {/* Added items list */}
                {itemsIncluded.length > 0 ? (
                  <div className="space-y-1 pt-1">
                    {itemsIncluded.map((inc, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 font-medium text-xs"
                      >
                        <span>
                          <strong className="text-orange-600">{inc.quantity}x</strong> {inc.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveItemFromBundle(index)}
                          className="text-red-500 hover:text-red-700 font-bold text-xs cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-400 italic">No items added to bundle yet.</p>
                )}
              </div>

              {/* Price & Savings inputs */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Original Price (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={originalPrice}
                    onChange={(e) => setOriginalPrice(parseFloat(e.target.value) || 0)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Discounted Combo Price (₹)
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={comboPrice}
                    onChange={(e) => setComboPrice(parseFloat(e.target.value) || 0)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold font-mono text-emerald-600"
                  />
                </div>
              </div>

              {/* Savings pill preview */}
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900 dark:text-amber-300">
                  Customer Live Savings Preview:
                </span>
                <span className="text-xs font-black text-rose-600 bg-white dark:bg-slate-900 px-2.5 py-0.5 rounded-lg border border-rose-200">
                  SAVE ₹{calculatedSavings}
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowDrawer(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-400"
                >
                  Cancel
                </button>
                <Button type="submit" isLoading={saving} className="font-bold px-5">
                  Save Combo Deal
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
