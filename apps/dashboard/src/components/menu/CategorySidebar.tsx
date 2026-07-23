"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, GripVertical, ChevronDown, ChevronRight, Eye, EyeOff, MoreHorizontal, Pencil, Trash2, Check, X, Tag } from "lucide-react";
import { Category } from "../../types";

interface Props {
  categories: Category[];
  selectedCategoryId: string | null;
  onSelect: (id: string | null) => void;
  onCreate: (name: string, parentId?: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onToggleVisible: (id: string, isVisible: boolean) => Promise<void>;
  onReorder: (ordered: { id: string; displayOrder: number }[]) => Promise<void>;
}

export function CategorySidebar({
  categories,
  selectedCategoryId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onToggleVisible,
  onReorder,
}: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [addingParentId, setAddingParentId] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const addInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (addingParentId !== null) {
      setTimeout(() => addInputRef.current?.focus(), 50);
    }
  }, [addingParentId]);

  const rootCategories = categories.filter((c) => !c.parentId).sort((a, b) => a.displayOrder - b.displayOrder);

  const handleRename = async (id: string) => {
    if (!editName.trim()) {
      setEditingId(null);
      return;
    }
    await onRename(id, editName.trim());
    setEditingId(null);
  };

  const handleAddCategory = async (parentId?: string) => {
    if (!newCategoryName.trim()) {
      setAddingParentId(null);
      return;
    }
    await onCreate(newCategoryName.trim(), parentId);
    setAddingParentId(null);
    setNewCategoryName("");
    if (parentId) {
      setExpanded((p) => ({ ...p, [parentId]: true }));
    }
  };

  const handleDrop = (toId: string) => {
    if (!dragId || dragId === toId) return;
    const cat = categories.find((c) => c.id === dragId);
    if (!cat) return;
    
    // Simplistic reorder logic: just swap displayOrders of roots if it's a root
    if (!cat.parentId) {
      const sorted = [...rootCategories];
      const fromIdx = sorted.findIndex((c) => c.id === dragId);
      const toIdx = sorted.findIndex((c) => c.id === toId);
      if (fromIdx === -1 || toIdx === -1) return;
      
      const [moved] = sorted.splice(fromIdx, 1);
      sorted.splice(toIdx, 0, moved);
      
      onReorder(sorted.map((c, i) => ({ id: c.id, displayOrder: i })));
    }
    setDragId(null);
    setDragOverId(null);
  };

  const CategoryItem = ({ category, depth = 0 }: { category: Category; depth?: number }) => {
    const children = categories.filter((c) => c.parentId === category.id).sort((a, b) => a.displayOrder - b.displayOrder);
    const hasChildren = children.length > 0;
    const isExpanded = !!expanded[category.id];

    return (
      <div
        draggable
        onDragStart={() => setDragId(category.id)}
        onDragOver={(e) => { e.preventDefault(); setDragOverId(category.id); }}
        onDrop={() => handleDrop(category.id)}
        onDragEnd={() => { setDragId(null); setDragOverId(null); }}
        className={`group flex flex-col rounded-xl transition-all ${dragOverId === category.id ? "bg-violet-500/10 border border-violet-500/30" : "border border-transparent"}`}
      >
        <div
          onClick={() => onSelect(category.id)}
          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all
            ${selectedCategoryId === category.id
              ? "bg-violet-500/15 text-violet-200"
              : "text-slate-300 hover:bg-white/5 hover:text-white"
            }
          `}
          style={{ paddingLeft: `${depth * 16 + 12}px` }}
        >
          <div className="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing shrink-0 transition-opacity">
            <GripVertical size={13} className="text-slate-500 hover:text-slate-300" />
          </div>

          {(hasChildren || depth === 0) ? (
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded((prev) => ({ ...prev, [category.id]: !isExpanded })); }}
              className={`p-0.5 rounded transition-colors shrink-0 ${selectedCategoryId === category.id ? "hover:bg-violet-500/20" : "hover:bg-white/10"}`}
            >
              {hasChildren ? (isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <div className="w-[14px]" />}
            </button>
          ) : (
            <div className="w-[14px] shrink-0" />
          )}

          {editingId === category.id ? (
            <input
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={() => handleRename(category.id)}
              onKeyDown={(e) => e.key === "Enter" && handleRename(category.id)}
              className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-0.5 text-sm outline-none text-white focus:border-violet-400"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div className="flex-1 min-w-0 flex items-center gap-2">
              <span className={`text-sm font-medium truncate ${!category.isVisible ? "opacity-50" : ""}`}>
                {category.icon && <span className="mr-2">{category.icon}</span>}
                {category.name}
              </span>
              <span className="text-[10px] font-bold bg-white/5 text-slate-400 px-1.5 py-0.5 rounded-full border border-white/5 shadow-inner shrink-0">
                {Math.floor(Math.random() * 20) + 1} {/* Mock count for UI */}
              </span>
            </div>
          )}

          <div className="opacity-0 group-hover:opacity-100 flex items-center shrink-0 transition-opacity">
            <button
              onClick={(e) => { e.stopPropagation(); onToggleVisible(category.id, !category.isVisible); }}
              className={`p-1.5 rounded-lg transition-colors ${category.isVisible ? "text-emerald-400 hover:bg-emerald-400/10" : "text-slate-500 hover:bg-white/10"}`}
              title={category.isVisible ? "Hide" : "Show"}
            >
              {category.isVisible ? <Eye size={13} /> : <EyeOff size={13} />}
            </button>
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === category.id ? null : category.id); }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <MoreHorizontal size={14} />
              </button>
              {menuOpenId === category.id && (
                <div className="absolute right-0 top-full mt-1 w-40 bg-[#181E29] rounded-xl shadow-2xl border border-white/10 overflow-hidden z-50 py-1">
                  <button onClick={(e) => { e.stopPropagation(); setEditingId(category.id); setEditName(category.name); setMenuOpenId(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors">
                    <Pencil size={13} className="text-slate-400" /> Rename
                  </button>
                  {depth === 0 && (
                    <button onClick={(e) => { e.stopPropagation(); setAddingParentId(category.id); setMenuOpenId(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors">
                      <Plus size={13} className="text-slate-400" /> Add Sub
                    </button>
                  )}
                  <div className="border-t border-white/5 my-1" />
                  <button onClick={(e) => { e.stopPropagation(); onDelete(category.id); setMenuOpenId(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-rose-400 hover:bg-rose-500/10 transition-colors">
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {addingParentId === category.id && (
          <div style={{ paddingLeft: `${(depth + 1) * 16 + 12}px` }} className="flex items-center gap-2 py-2 pr-3">
            <input
              ref={addInputRef}
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddCategory(category.id); if (e.key === "Escape") { setAddingParentId(null); setNewCategoryName(""); } }}
              placeholder="Subcategory name…"
              className="flex-1 text-sm bg-white/5 border border-violet-500/50 rounded-lg px-2 py-1.5 outline-none text-white focus:ring-1 focus:ring-violet-400"
            />
            <button onClick={() => handleAddCategory(category.id)} className="p-1.5 text-emerald-400 hover:bg-emerald-400/10 rounded-lg"><Check size={14} /></button>
            <button onClick={() => { setAddingParentId(null); setNewCategoryName(""); }} className="p-1.5 text-slate-400 hover:bg-white/10 rounded-lg"><X size={14} /></button>
          </div>
        )}

        {hasChildren && isExpanded && (
          <div className="mt-1 space-y-0.5 relative">
            <div className="absolute left-[30px] top-0 bottom-2 w-px bg-white/5" />
            {children.map((sub) => (
              <CategoryItem key={sub.id} category={sub} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#0F141F]">
      <div className="p-5 border-b border-white/5 shrink-0">
        <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-4">Menu Structure</h2>
        <button
          onClick={() => { setAddingParentId("root"); }}
          className="w-full flex items-center justify-center gap-2 py-2.5 text-sm text-violet-300 font-bold bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 rounded-xl transition-all shadow-inner"
        >
          <Plus size={16} /> Add Category
        </button>
      </div>

      <div className="px-3 pt-3">
        <button
          onClick={() => onSelect(null)}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-bold transition-all
            ${selectedCategoryId === null ? "bg-white/10 text-white shadow-sm" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
        >
          <Tag size={15} /> All Items
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {addingParentId === "root" && (
          <div className="flex items-center gap-2 py-2 px-2">
            <input
              ref={addInputRef}
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddCategory(); if (e.key === "Escape") { setAddingParentId(null); setNewCategoryName(""); } }}
              placeholder="Category name…"
              className="flex-1 text-sm bg-white/5 border border-violet-500/50 rounded-xl px-3 py-2 outline-none text-white focus:ring-1 focus:ring-violet-400 shadow-inner"
            />
            <button onClick={() => handleAddCategory()} className="p-2 text-emerald-400 hover:bg-emerald-400/10 rounded-xl"><Check size={16} /></button>
            <button onClick={() => { setAddingParentId(null); setNewCategoryName(""); }} className="p-2 text-slate-400 hover:bg-white/10 rounded-xl"><X size={16} /></button>
          </div>
        )}
        {rootCategories.map((cat) => (
          <CategoryItem key={cat.id} category={cat} depth={0} />
        ))}
        {rootCategories.length === 0 && addingParentId !== "root" && (
          <div className="text-center py-10 px-4">
            <p className="text-sm text-slate-500">No categories</p>
          </div>
        )}
      </div>
    </div>
  );
}
