"use client";

import { useState } from "react";
import { GripVertical, Star, ThumbsUp, Eye, EyeOff, Pencil, Trash2, Copy, MoreHorizontal, Leaf, Drumstick, Clock } from "lucide-react";
import { MenuItem } from "../../types";

interface Props {
  item: MenuItem;
  isSelected: boolean;
  onSelect: () => void;
  onToggleAvailability: (isAvailable: boolean) => Promise<void>;
  onDelete: () => void;
  onDuplicate: () => Promise<void>;
  dragging?: boolean;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
}

export function ItemCard({
  item,
  isSelected,
  onSelect,
  onToggleAvailability,
  onDelete,
  onDuplicate,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [toggling, setToggling] = useState(false);

  const price = item.basePrice !== null
    ? `₹${item.basePrice}`
    : item.variants.length > 0
      ? `₹${Math.min(...item.variants.map((v) => v.price))}`
      : "—";

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setToggling(true);
    try { await onToggleAvailability(!item.isAvailable); }
    finally { setToggling(false); }
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      className={`group relative bg-[#181E29] rounded-2xl border transition-all cursor-pointer select-none overflow-hidden
        ${isSelected
          ? "border-violet-500/50 shadow-[0_0_20px_rgba(139,92,246,0.15)] ring-1 ring-violet-500/20 bg-[#1D2433]"
          : "border-white/5 shadow-lg hover:shadow-xl hover:border-white/10 hover:-translate-y-1 hover:bg-[#1C2330]"
        }
        ${!item.isAvailable ? "opacity-60 saturate-50" : ""}
      `}
    >
      {/* Image */}
      <div className="relative overflow-hidden h-44 bg-black/40 shrink-0">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
        ) : (
          <div className="flex items-center justify-center h-full text-5xl opacity-50 grayscale group-hover:grayscale-0 transition-all">🍽️</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#181E29] to-transparent opacity-80" />

        {/* Badges overlay */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
          {item.isPopular && (
            <span className="flex items-center gap-1 bg-amber-500/90 backdrop-blur-md border border-amber-400/50 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg">
              <Star size={9} fill="white" /> Popular
            </span>
          )}
          {item.isRecommended && (
            <span className="flex items-center gap-1 bg-violet-600/90 backdrop-blur-md border border-violet-400/50 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg">
              <ThumbsUp size={9} /> Chef's Pick
            </span>
          )}
        </div>

        {/* Veg indicator */}
        <div className="absolute top-3 right-3 z-10">
          <div className={`p-1.5 rounded-lg backdrop-blur-md shadow-lg border border-white/10 ${item.vegType === "veg" ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"}`}>
            {item.vegType === "veg" ? <Leaf size={12} /> : <Drumstick size={12} />}
          </div>
        </div>

        {/* Drag handle */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <div className="px-3 py-1 bg-black/40 backdrop-blur-md border border-white/10 rounded-full shadow-lg cursor-grab active:cursor-grabbing">
            <GripVertical size={13} className="text-white" />
          </div>
        </div>

        {/* Content overlapping image slightly */}
        <div className="absolute bottom-3 left-4 right-4 z-10 flex items-end justify-between">
          <div className="min-w-0 pr-2">
            <h3 className="font-bold text-white text-lg truncate drop-shadow-md">{item.name}</h3>
            {item.description && (
              <p className="text-xs text-slate-300 truncate mt-0.5 drop-shadow">{item.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col justify-between">
        
        {/* Price Row */}
        <div className="flex items-center justify-between mb-4 bg-white/5 rounded-xl px-3 py-2 border border-white/5">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Price</span>
          <div className="text-right flex items-center gap-2">
            {item.variants.length > 0 && (
              <span className="text-[10px] text-violet-300 bg-violet-500/20 px-1.5 py-0.5 rounded-md font-bold">{item.variants.length} var</span>
            )}
            <span className="text-base font-bold text-white">{price}</span>
          </div>
        </div>

        {/* Meta row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggle}
              disabled={toggling}
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl transition-all shadow-sm
                ${item.isAvailable
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
                  : "bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10"
                }`}
            >
              {item.isAvailable ? <Eye size={12} /> : <EyeOff size={12} />}
              {item.isAvailable ? "Live" : "Hidden"}
            </button>
            {item.preparationTime > 0 && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-slate-400 bg-white/5 px-2 py-1 rounded-lg">
                <Clock size={10} /> {item.preparationTime}m
              </span>
            )}
          </div>

          {/* Kebab menu */}
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
              className="p-2 rounded-xl text-slate-400 hover:bg-white/10 hover:text-white transition-colors border border-transparent hover:border-white/5"
            >
              <MoreHorizontal size={16} />
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 bottom-full mb-2 w-44 bg-[#181E29] rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] border border-white/10 overflow-hidden z-50 py-1.5"
                onClick={(e) => e.stopPropagation()}
              >
                <button onClick={() => { setMenuOpen(false); onSelect(); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white transition-colors">
                  <Pencil size={14} className="text-slate-400" /> Edit Item
                </button>
                <button onClick={() => { setMenuOpen(false); onDuplicate(); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white transition-colors">
                  <Copy size={14} className="text-slate-400" /> Duplicate
                </button>
                <div className="border-t border-white/5 my-1" />
                <button onClick={() => { setMenuOpen(false); onDelete(); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-rose-400 hover:bg-rose-500/10 transition-colors">
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-violet-400 to-purple-600" />
      )}
    </div>
  );
}
