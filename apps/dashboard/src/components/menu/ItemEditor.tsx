"use client";

import { useState, useEffect, useRef } from "react";
import { Save, X, Plus, Trash2, GripVertical, ChevronDown, ChevronRight, Leaf, Drumstick, Star, ThumbsUp, Eye, EyeOff, ImagePlus, Tag, Clock, Hash, AlertCircle, Check, Sparkles } from "lucide-react";
import { MenuItem, Category } from "../../types";

interface VariantRow { id?: string; variantName: string; price: number | ""; isAvailable: boolean; displayOrder: number; }
interface CustomizationRow { id?: string; name: string; priceAdjustment: number | ""; isAvailable: boolean; }

interface FormData {
  name: string; description: string; basePrice: number | ""; aliases: string; vegType: "veg" | "non-veg"; isAvailable: boolean; isPopular: boolean; isRecommended: boolean; preparationTime: number | ""; displayOrder: number | ""; categoryId: string; subcategoryId: string; imageUrl: string; variants: VariantRow[]; customizations: CustomizationRow[];
}

interface Props {
  item: MenuItem | null; isNew: boolean; categories: Category[]; onSave: (data: Omit<Partial<MenuItem>, "variants" | "customizations"> & { variants: any[]; customizations: any[] }) => Promise<void>; onClose: () => void;
}

function emptyForm(item?: MenuItem | null): FormData {
  if (item) {
    return {
      name: item.name, description: item.description || "", basePrice: item.basePrice ?? "", aliases: (item.aliases || []).join(", "), vegType: item.vegType || "veg", isAvailable: item.isAvailable, isPopular: item.isPopular || false, isRecommended: item.isRecommended || false, preparationTime: item.preparationTime ?? "", displayOrder: item.displayOrder ?? "", categoryId: item.categoryId || "", subcategoryId: item.subcategoryId || "", imageUrl: item.imageUrl || "",
      variants: (item.variants || []).map((v, i) => ({ id: v.id, variantName: v.variantName, price: v.price, isAvailable: v.isAvailable, displayOrder: v.displayOrder ?? i })),
      customizations: (item.customizations || []).map((c) => ({ id: c.id, name: c.name, priceAdjustment: c.priceAdjustment, isAvailable: c.isAvailable }))
    };
  }
  return { name: "", description: "", basePrice: "", aliases: "", vegType: "veg", isAvailable: true, isPopular: false, isRecommended: false, preparationTime: 15, displayOrder: "", categoryId: "", subcategoryId: "", imageUrl: "", variants: [], customizations: [] };
}

function Section({ title, children, defaultOpen = true, badge, icon }: { title: string; children: React.ReactNode; defaultOpen?: boolean; badge?: string | number, icon?: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-[#131820] border border-white/5 rounded-2xl overflow-hidden mb-6 shadow-sm">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between px-5 py-4 bg-white/5 hover:bg-white/10 transition-colors text-left border-b border-white/5">
        <div className="flex items-center gap-3">
          {icon && <span className="text-slate-400">{icon}</span>}
          <span className="text-sm font-bold text-white tracking-wide">{title}</span>
          {badge !== undefined && badge !== 0 && (
            <span className="text-[10px] bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-md font-bold">{badge}</span>
          )}
        </div>
        {open ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronRight size={16} className="text-slate-500" />}
      </button>
      {open && <div className="p-5">{children}</div>}
    </div>
  );
}

export function ItemEditor({ item, isNew, categories, onSave, onClose }: Props) {
  const [form, setForm] = useState<FormData>(() => emptyForm(item));
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [variantDragIdx, setVariantDragIdx] = useState<number | null>(null);
  const [variantDragOverIdx, setVariantDragOverIdx] = useState<number | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setForm(emptyForm(item)); setErrors({}); setTimeout(() => nameRef.current?.focus(), 100); }, [item?.id]);

  const rootCategories = categories.filter((c) => !c.parentId);
  const subcategories = categories.filter((c) => c.parentId === form.categoryId);

  const set = <K extends keyof FormData>(key: K, value: FormData[K]) => setForm((f) => ({ ...f, [key]: value }));

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Item name is required";
    const hasVariants = form.variants.length > 0;
    if (!hasVariants && (form.basePrice === "" || Number(form.basePrice) < 0)) errs.basePrice = "Base price is required when no variants exist";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await onSave({
        name: form.name.trim(), description: form.description.trim() || null, basePrice: form.basePrice !== "" ? Number(form.basePrice) : null, aliases: form.aliases.split(",").map((a) => a.trim()).filter(Boolean), vegType: form.vegType, isAvailable: form.isAvailable, isPopular: form.isPopular, isRecommended: form.isRecommended, preparationTime: form.preparationTime !== "" ? Number(form.preparationTime) : 15, displayOrder: form.displayOrder !== "" ? Number(form.displayOrder) : 0, categoryId: form.categoryId || null, subcategoryId: form.subcategoryId || null, imageUrl: form.imageUrl.trim() || null,
        variants: form.variants.map((v, i) => ({ ...(v.id ? { id: v.id } : {}), variantName: v.variantName.trim(), price: Number(v.price) || 0, isAvailable: v.isAvailable, displayOrder: i })),
        customizations: form.customizations.map((c) => ({ ...(c.id ? { id: c.id } : {}), name: c.name.trim(), priceAdjustment: Number(c.priceAdjustment) || 0, isAvailable: c.isAvailable })),
      });
    } finally { setSaving(false); }
  };

  const addVariant = () => set("variants", [...form.variants, { variantName: "", price: "", isAvailable: true, displayOrder: form.variants.length }]);
  const updateVariant = (idx: number, patch: Partial<VariantRow>) => set("variants", form.variants.map((v, i) => (i === idx ? { ...v, ...patch } : v)));
  const removeVariant = (idx: number) => set("variants", form.variants.filter((_, i) => i !== idx));
  const handleVariantDrop = (toIdx: number) => {
    if (variantDragIdx === null || variantDragIdx === toIdx) return;
    const arr = [...form.variants];
    const [moved] = arr.splice(variantDragIdx, 1);
    arr.splice(toIdx, 0, moved);
    set("variants", arr);
    setVariantDragIdx(null);
    setVariantDragOverIdx(null);
  };

  const addCustomization = () => set("customizations", [...form.customizations, { name: "", priceAdjustment: 0, isAvailable: true }]);
  const updateCustomization = (idx: number, patch: Partial<CustomizationRow>) => set("customizations", form.customizations.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  const removeCustomization = (idx: number) => set("customizations", form.customizations.filter((_, i) => i !== idx));

  const inputCls = (field?: string) => `w-full text-sm bg-black/20 border rounded-xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all text-white placeholder-slate-500 ${field && errors[field] ? "border-rose-500/50 bg-rose-500/5" : "border-white/10 hover:border-white/20"}`;
  const labelCls = "block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2";

  return (
    <div className="flex flex-col h-full bg-[#0F141F]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 shrink-0 bg-[#0A0D14]/80 backdrop-blur-xl">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">{isNew ? "New Menu Item" : "Edit Item"}</h2>
          {!isNew && item && <p className="text-xs font-medium text-slate-400 mt-0.5 truncate max-w-[250px]">{item.name}</p>}
        </div>
        <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors">
          <X size={18} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-6">
          
          {/* Media Section */}
          <Section title="Media" defaultOpen={true}>
            <div className="relative group rounded-2xl overflow-hidden bg-black/40 h-56 flex flex-col items-center justify-center border border-white/5 shadow-inner">
              {form.imageUrl ? (
                <img src={form.imageUrl} alt="preview" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
              ) : (
                <div className="flex flex-col items-center gap-3 text-slate-500">
                  <div className="p-4 rounded-full bg-white/5 border border-white/10"><ImagePlus size={32} /></div>
                  <span className="text-sm font-medium">Add dish photo</span>
                </div>
              )}
              {form.vegType === "veg" ? (
                <div className="absolute top-3 right-3 p-2 bg-emerald-500/90 backdrop-blur text-white rounded-xl shadow-lg border border-emerald-400/50"><Leaf size={14} /></div>
              ) : (
                <div className="absolute top-3 right-3 p-2 bg-rose-500/90 backdrop-blur text-white rounded-xl shadow-lg border border-rose-400/50"><Drumstick size={14} /></div>
              )}
            </div>
            <div className="mt-4">
              <label className={labelCls}>Image URL</label>
              <input value={form.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} placeholder="https://..." className={inputCls()} />
            </div>
          </Section>

          {/* Basic Info Section */}
          <Section title="Basic Information">
            <div className="space-y-5">
              <div>
                <label className={labelCls}>Dish Name <span className="text-rose-500">*</span></label>
                <input ref={nameRef} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Paneer Tikka" className={inputCls("name")} />
                {errors.name && <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1"><AlertCircle size={12} />{errors.name}</p>}
              </div>

              <div>
                <label className={labelCls}>Description</label>
                <textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Short description visible to customers…" rows={3} className={`${inputCls()} resize-none`} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Category</label>
                  <select value={form.categoryId} onChange={(e) => { set("categoryId", e.target.value); set("subcategoryId", ""); }} className={inputCls()}>
                    <option value="" className="bg-[#131820]">None</option>
                    {rootCategories.map((c) => <option key={c.id} value={c.id} className="bg-[#131820]">{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Subcategory</label>
                  <select value={form.subcategoryId} onChange={(e) => set("subcategoryId", e.target.value)} disabled={!form.categoryId || subcategories.length === 0} className={`${inputCls()} disabled:opacity-50 disabled:cursor-not-allowed`}>
                    <option value="" className="bg-[#131820]">None</option>
                    {subcategories.map((c) => <option key={c.id} value={c.id} className="bg-[#131820]">{c.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </Section>

          {/* Configuration Section */}
          <Section title="Configuration">
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Base Price (₹) {form.variants.length === 0 && <span className="text-rose-500">*</span>}</label>
                  <input type="number" min={0} value={form.basePrice} onChange={(e) => set("basePrice", e.target.value === "" ? "" : Number(e.target.value))} placeholder={form.variants.length > 0 ? "Optional" : "0"} className={inputCls("basePrice")} />
                  {errors.basePrice && <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1"><AlertCircle size={12} />{errors.basePrice}</p>}
                </div>
                <div>
                  <label className={labelCls}><Clock size={11} className="inline mr-1" /> Prep Time (min)</label>
                  <input type="number" min={0} value={form.preparationTime} onChange={(e) => set("preparationTime", e.target.value === "" ? "" : Number(e.target.value))} placeholder="15" className={inputCls()} />
                </div>
              </div>

              <div>
                <label className={labelCls}>Food Type</label>
                <div className="flex gap-3">
                  {(["veg", "non-veg"] as const).map((type) => (
                    <button key={type} type="button" onClick={() => set("vegType", type)} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-bold transition-all ${form.vegType === type ? type === "veg" ? "border-emerald-500 bg-emerald-500/10 text-emerald-400" : "border-rose-500 bg-rose-500/10 text-rose-400" : "border-white/5 bg-white/5 text-slate-400 hover:border-white/10"}`}>
                      {type === "veg" ? <Leaf size={16} /> : <Drumstick size={16} />} {type === "veg" ? "Veg" : "Non-Veg"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelCls}>Visibility & Badges</label>
                <div className="grid grid-cols-3 gap-3">
                  {([{ key: "isAvailable", icon: <Eye size={14} />, label: "Live", active: "bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]", inactive: "text-emerald-500" }, { key: "isPopular", icon: <Star size={14} />, label: "Popular", active: "bg-amber-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.3)]", inactive: "text-amber-500" }, { key: "isRecommended", icon: <ThumbsUp size={14} />, label: "Chef Pick", active: "bg-violet-600 text-white shadow-[0_0_15px_rgba(124,58,237,0.3)]", inactive: "text-violet-400" }] as const).map(({ key, icon, label, active, inactive }) => (
                    <button key={key} type="button" onClick={() => set(key as any, !(form as any)[key])} className={`flex flex-col items-center justify-center gap-2 py-3 rounded-xl border transition-all text-xs font-bold ${form[key as keyof FormData] ? `${active} border-transparent` : `border-white/5 bg-white/5 ${inactive} hover:bg-white/10`}`}>
                      {icon} {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          {/* AI Settings Section */}
          <Section title="AI Ordering Settings" icon={<Sparkles size={16} />}>
            <div>
              <label className={labelCls}><Tag size={11} className="inline mr-1" /> AI Aliases</label>
              <input value={form.aliases} onChange={(e) => set("aliases", e.target.value)} placeholder="paneer, PT, spicy paneer (comma separated)" className={inputCls()} />
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">Help the AI recognize this item by alternative names customers might use on WhatsApp.</p>
            </div>
            <div className="mt-5">
              <label className={labelCls}><Hash size={11} className="inline mr-1" /> Menu Display Order</label>
              <input type="number" min={0} value={form.displayOrder} onChange={(e) => set("displayOrder", e.target.value === "" ? "" : Number(e.target.value))} placeholder="0" className={`${inputCls()} w-full`} />
            </div>
          </Section>

          {/* Variants */}
          <Section title="Variants" badge={form.variants.length} defaultOpen={false}>
            {form.variants.length === 0 && <p className="text-sm text-slate-400 mb-4 text-center py-4 bg-white/5 rounded-xl border border-white/5">No variants — using base price above</p>}
            <div className="space-y-3 mb-4">
              {form.variants.map((v, idx) => (
                <div key={idx} draggable onDragStart={() => setVariantDragIdx(idx)} onDragOver={(e) => { e.preventDefault(); setVariantDragOverIdx(idx); }} onDrop={() => handleVariantDrop(idx)} onDragEnd={() => { setVariantDragIdx(null); setVariantDragOverIdx(null); }} className={`flex items-center gap-3 p-3 rounded-xl border bg-black/20 transition-all ${variantDragOverIdx === idx ? "border-violet-500/50 bg-violet-500/10 shadow-lg" : "border-white/10"}`}>
                  <GripVertical size={16} className="text-slate-500 cursor-grab active:cursor-grabbing shrink-0" />
                  <input value={v.variantName} onChange={(e) => updateVariant(idx, { variantName: e.target.value })} placeholder="Name (e.g. Half)" className="flex-1 text-sm bg-transparent border-b border-white/10 px-1 py-1.5 focus:outline-none focus:border-violet-500 text-white min-w-0" />
                  <div className="flex items-center gap-1 shrink-0 border-b border-white/10 px-1 focus-within:border-violet-500">
                    <span className="text-slate-400 text-sm font-bold">₹</span>
                    <input type="number" min={0} value={v.price} onChange={(e) => updateVariant(idx, { price: e.target.value === "" ? "" : Number(e.target.value) })} placeholder="0" className="w-16 text-sm bg-transparent py-1.5 focus:outline-none text-white font-bold text-right" />
                  </div>
                  <button type="button" onClick={() => updateVariant(idx, { isAvailable: !v.isAvailable })} className={`p-2 rounded-lg transition-colors shrink-0 ${v.isAvailable ? "text-emerald-400 bg-emerald-500/10" : "text-slate-500 bg-white/5"}`} title="Toggle availability">
                    {v.isAvailable ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <button type="button" onClick={() => removeVariant(idx)} className="p-2 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 rounded-lg transition-colors shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addVariant} className="w-full flex items-center justify-center gap-2 py-3 text-sm text-violet-300 font-bold border border-dashed border-violet-500/30 rounded-xl hover:bg-violet-500/10 hover:border-violet-500/50 transition-all">
              <Plus size={16} /> Add Variant
            </button>
          </Section>

          {/* Customizations */}
          <Section title="Customizations" badge={form.customizations.length} defaultOpen={false}>
            {form.customizations.length === 0 && <p className="text-sm text-slate-400 mb-4 text-center py-4 bg-white/5 rounded-xl border border-white/5">No customizations yet</p>}
            <div className="space-y-3 mb-4">
              {form.customizations.map((c, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-black/20">
                  <input value={c.name} onChange={(e) => updateCustomization(idx, { name: e.target.value })} placeholder="e.g. Extra Cheese" className="flex-1 text-sm bg-transparent border-b border-white/10 px-1 py-1.5 focus:outline-none focus:border-violet-500 text-white min-w-0" />
                  <div className="flex items-center gap-1 shrink-0 border-b border-white/10 px-1 focus-within:border-violet-500">
                    <span className="text-slate-400 text-sm font-bold">+₹</span>
                    <input type="number" min={0} value={c.priceAdjustment} onChange={(e) => updateCustomization(idx, { priceAdjustment: e.target.value === "" ? "" : Number(e.target.value) })} placeholder="0" className="w-16 text-sm bg-transparent py-1.5 focus:outline-none text-white font-bold text-right" />
                  </div>
                  <button type="button" onClick={() => updateCustomization(idx, { isAvailable: !c.isAvailable })} className={`p-2 rounded-lg transition-colors shrink-0 ${c.isAvailable ? "text-emerald-400 bg-emerald-500/10" : "text-slate-500 bg-white/5"}`}>
                    {c.isAvailable ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <button type="button" onClick={() => removeCustomization(idx)} className="p-2 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 rounded-lg transition-colors shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addCustomization} className="w-full flex items-center justify-center gap-2 py-3 text-sm text-violet-300 font-bold border border-dashed border-violet-500/30 rounded-xl hover:bg-violet-500/10 hover:border-violet-500/50 transition-all">
              <Plus size={16} /> Add Customization
            </button>
          </Section>

          <div className="pb-8" />
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-5 border-t border-white/10 shrink-0 bg-[#0F141F] shadow-[0_-10px_20px_rgba(0,0,0,0.2)] z-10">
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-white/10 text-sm font-bold text-slate-300 bg-white/5 hover:bg-white/10 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="flex-[2] py-3 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-500 hover:shadow-[0_0_20px_rgba(139,92,246,0.4)] transition-all disabled:opacity-60 disabled:hover:shadow-none flex items-center justify-center gap-2">
            {saving ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Save size={16} />}
            {saving ? "Saving…" : "Save Item"}
          </button>
        </div>
      </div>
    </div>
  );
}
