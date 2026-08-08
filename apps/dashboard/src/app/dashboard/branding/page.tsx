"use client";

// apps/dashboard/src/app/dashboard/branding/page.tsx
// Brand Identity Module — Controls logo, cover image, photo gallery, primary theme color,
// restaurant story, and Google Review URL with a real-time live mobile preview.

import React, { useState, useEffect } from "react";
import { SettingsService } from "../../../lib/services/settings.service";
import { useToast } from "../../../components/ui/ToastContainer";
import Button from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";
import Skeleton from "../../../components/ui/Skeleton";
import {
  Palette,
  Image as ImageIcon,
  Upload,
  Sparkles,
  Star,
  CheckCircle2,
  Phone,
  MapPin,
  Smartphone,
  BookOpen,
  Trash2,
  ExternalLink,
  RefreshCw,
} from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

const PRESET_COLORS = [
  { label: "Vibrant Orange", hex: "#F97316" },
  { label: "Crimson Red", hex: "#E11D48" },
  { label: "Emerald Green", hex: "#059669" },
  { label: "Royal Blue", hex: "#2563EB" },
  { label: "Deep Purple", hex: "#9333EA" },
  { label: "Warm Amber", hex: "#D97706" },
  { label: "Sleek Dark", hex: "#0F172A" },
];

export default function BrandIdentityPage() {
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  // Brand State
  const [restaurantName, setRestaurantName] = useState("Restroex Kitchen");
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [coverImageUrl, setCoverImageUrl] = useState<string>("");
  const [primaryColor, setPrimaryColor] = useState<string>("#F97316");
  const [restaurantStory, setRestaurantStory] = useState<string>("");
  const [googleReviewUrl, setGoogleReviewUrl] = useState<string>("");
  const [galleryImages, setGalleryImages] = useState<string[]>([]);

  // Address & Phone for preview
  const [address, setAddress] = useState("123 Main Street");
  const [city, setCity] = useState("New Delhi");

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const fullSettings = await SettingsService.getSettings();
      const p = fullSettings.profile;
      if (p.name) setRestaurantName(p.name);
      if (p.logoUrl) setLogoUrl(p.logoUrl);
      if (p.coverImageUrl) setCoverImageUrl(p.coverImageUrl);
      if (p.primaryColor) setPrimaryColor(p.primaryColor);
      if (p.restaurantStory) setRestaurantStory(p.restaurantStory);
      if (p.googleReviewUrl) setGoogleReviewUrl(p.googleReviewUrl);
      if (p.galleryImages && Array.isArray(p.galleryImages)) setGalleryImages(p.galleryImages);
      if (p.address) setAddress(p.address);
      if (p.city) setCity(p.city);
    } catch (err: any) {
      toast.error("Failed to load branding", err.message || "Could not fetch restaurant profile");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: "logo" | "cover" | "gallery"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingField(field);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const session = JSON.parse(localStorage.getItem("restroex_session") || "{}");
      const token = localStorage.getItem("restroex_token") || session.token;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      if (session.restaurantId) headers["x-restaurant-id"] = session.restaurantId;

      const res = await fetch(`${BACKEND_URL}/api/v1/media/upload`, {
        method: "POST",
        headers,
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Image upload failed");

      const uploadedUrl = json.data?.url || json.url;

      if (field === "logo") {
        setLogoUrl(uploadedUrl);
        toast.success("Logo Uploaded", "Transaction-safe media optimization complete.");
      } else if (field === "cover") {
        setCoverImageUrl(uploadedUrl);
        toast.success("Cover Banner Uploaded", "WebP optimization complete.");
      } else if (field === "gallery") {
        setGalleryImages((prev) => [...prev, uploadedUrl]);
        toast.success("Gallery Photo Added", "Photo added to showcase gallery.");
      }
    } catch (err: any) {
      toast.error("Upload Error", err.message || "Failed to process image");
    } finally {
      setUploadingField(null);
    }
  };

  const handleRemoveGalleryImage = (idx: number) => {
    setGalleryImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveBranding = async () => {
    setSaving(true);
    try {
      await SettingsService.updateSettings({
        logoUrl,
        coverImageUrl,
        primaryColor,
        restaurantStory,
        googleReviewUrl,
        galleryImages,
      });
      toast.success("Branding Saved", "Customer ordering page updated immediately!");
    } catch (err: any) {
      toast.error("Save Failed", err.message || "Could not update brand identity");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-96 lg:col-span-2 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Module Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
              <Palette className="h-5 w-5" />
            </span>
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 font-heading">
              Brand Identity & Style
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Customize how your restaurant looks to customers on WhatsApp & Web ordering links.
          </p>
        </div>

        <Button
          onClick={handleSaveBranding}
          isLoading={saving}
          className="font-bold gap-2 px-6"
        >
          <Sparkles className="h-4 w-4" />
          <span>Save Brand Changes</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: BRAND CONTROLS (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. Theme Color Picker */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Palette className="h-4 w-4 text-brand-600" />
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                Primary Theme Color
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              This color dictates checkout buttons, floating cart bar, and active category highlights on the customer page.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c.hex}
                  onClick={() => setPrimaryColor(c.hex)}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                    primaryColor.toLowerCase() === c.hex.toLowerCase()
                      ? "ring-2 ring-offset-2 ring-slate-900 dark:ring-slate-100 scale-110 shadow-md"
                      : "hover:scale-105"
                  }`}
                  style={{ backgroundColor: c.hex }}
                  title={c.label}
                >
                  {primaryColor.toLowerCase() === c.hex.toLowerCase() && (
                    <CheckCircle2 className="h-4 w-4 text-white drop-shadow-sm" />
                  )}
                </button>
              ))}

              <div className="flex items-center gap-2 ml-auto">
                <span className="text-xs font-semibold text-slate-500">Custom Hex:</span>
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent"
                />
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-24 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold uppercase text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>
          </Card>

          {/* 2. Restaurant Logo & Cover Banner Upload */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <ImageIcon className="h-4 w-4 text-brand-600" />
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                Logo & Cover Header Image
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Logo Box */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  Restaurant Logo (Square)
                </label>
                <div className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Logo"
                      className="w-14 h-14 rounded-xl object-cover border border-slate-200 dark:border-slate-800 shadow-xs"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-400 text-xs font-bold">
                      No Logo
                    </div>
                  )}
                  <div className="flex-1">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer shadow-2xs">
                      <Upload className="h-3.5 w-3.5" />
                      <span>{uploadingField === "logo" ? "Optimizing..." : "Upload Logo"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, "logo")}
                        disabled={uploadingField === "logo"}
                        className="hidden"
                      />
                    </label>
                    <p className="text-[10px] text-slate-400 mt-1">Auto-converted to WebP</p>
                  </div>
                </div>
              </div>

              {/* Cover Banner Box */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  Header Cover Banner
                </label>
                <div className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                  {coverImageUrl ? (
                    <img
                      src={coverImageUrl}
                      alt="Cover"
                      className="w-16 h-14 rounded-xl object-cover border border-slate-200 dark:border-slate-800 shadow-xs"
                    />
                  ) : (
                    <div className="w-16 h-14 rounded-xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-400 text-[10px] font-bold text-center px-1">
                      No Cover
                    </div>
                  )}
                  <div className="flex-1">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer shadow-2xs">
                      <Upload className="h-3.5 w-3.5" />
                      <span>{uploadingField === "cover" ? "Optimizing..." : "Upload Cover"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, "cover")}
                        disabled={uploadingField === "cover"}
                        className="hidden"
                      />
                    </label>
                    <p className="text-[10px] text-slate-400 mt-1">Recommended: 1200 x 400</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* 3. Restaurant Story & Google Review Link */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <BookOpen className="h-4 w-4 text-brand-600" />
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                Restaurant Story & Reviews
              </h2>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Restaurant Story (About Us)
                </label>
                <textarea
                  rows={3}
                  value={restaurantStory}
                  onChange={(e) => setRestaurantStory(e.target.value)}
                  placeholder="Share your culinary heritage, hygiene promise, or specialty dishes with customers..."
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                  <span>Google Review Link</span>
                  <span className="text-[10px] font-normal text-slate-400">Rendered on order receipt</span>
                </label>
                <div className="relative">
                  <Star className="absolute left-3 top-2.5 h-4 w-4 text-amber-500" />
                  <input
                    type="url"
                    value={googleReviewUrl}
                    onChange={(e) => setGoogleReviewUrl(e.target.value)}
                    placeholder="https://g.page/r/your-google-review-link/review"
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* 4. Photo Gallery */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-brand-600" />
                <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                  Ambiance Photo Gallery
                </h2>
              </div>
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-bold hover:bg-brand-700 transition cursor-pointer shadow-xs">
                <Upload className="h-3.5 w-3.5" />
                <span>{uploadingField === "gallery" ? "Uploading..." : "Add Photo"}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, "gallery")}
                  disabled={uploadingField === "gallery"}
                  className="hidden"
                />
              </label>
            </div>

            {galleryImages.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {galleryImages.map((img, idx) => (
                  <div key={idx} className="relative group rounded-xl overflow-hidden aspect-square border border-slate-200 dark:border-slate-800">
                    <img src={img} alt={`Gallery ${idx}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => handleRemoveGalleryImage(idx)}
                      className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition text-xs cursor-pointer shadow-md"
                      title="Remove image"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400 text-xs font-semibold">
                No gallery photos added yet. Upload food & dining photos to showcase your restaurant.
              </div>
            )}
          </Card>
        </div>

        {/* RIGHT COLUMN: REAL-TIME MOBILE PREVIEW (5 cols) */}
        <div className="lg:col-span-5 sticky top-6">
          <Card className="p-4 bg-slate-900 border-slate-800 text-white space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-emerald-400" />
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
                  Live Customer View Preview
                </span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Real-Time
              </span>
            </div>

            {/* Simulated Smartphone Screen Frame */}
            <div className="mx-auto w-full max-w-[320px] bg-slate-50 text-slate-900 rounded-[32px] overflow-hidden shadow-2xl border-4 border-slate-800 flex flex-col min-h-[520px]">
              {/* Phone Header Cover Banner */}
              <div className="relative h-24 bg-slate-800 overflow-hidden">
                {coverImageUrl ? (
                  <img src={coverImageUrl} alt="Cover" className="w-full h-full object-cover" />
                ) : (
                  <div
                    className="w-full h-full opacity-80"
                    style={{ backgroundColor: primaryColor }}
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              </div>

              {/* Logo Overlap & Brand Stack */}
              <div className="px-3 pb-2 bg-white border-b border-slate-100">
                <div className="-mt-8 mb-1.5 flex items-end justify-between relative z-10">
                  <div className="w-14 h-14 rounded-2xl bg-white border-2 border-white overflow-hidden shrink-0 shadow-md flex items-center justify-center text-xs font-bold text-slate-700">
                    {logoUrl ? <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" /> : "LOGO"}
                  </div>
                  <span className="bg-amber-50 text-amber-800 text-[9px] font-extrabold px-2 py-0.5 rounded-lg border border-amber-200">
                    ⭐ 4.8 Rating
                  </span>
                </div>
                <h3 className="text-xs font-extrabold text-slate-900 leading-tight">{restaurantName}</h3>
                <p className="text-[10px] text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                  <MapPin className="h-2.5 w-2.5 shrink-0" />
                  <span className="truncate">{address}, {city}</span>
                </p>
                <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                  <span className="bg-emerald-50 text-emerald-700 text-[8px] font-bold px-1.5 py-0.5 rounded border border-emerald-100">
                    🛡️ FSSAI
                  </span>
                  <span className="bg-orange-50 text-orange-700 text-[8px] font-bold px-1.5 py-0.5 rounded border border-orange-100">
                    🛍️ Takeaway
                  </span>
                  <span className="bg-blue-50 text-blue-700 text-[8px] font-bold px-1.5 py-0.5 rounded border border-blue-100">
                    🍽️ Dine-In
                  </span>
                </div>
              </div>

              {/* Story Teaser (if defined) */}
              {restaurantStory && (
                <div className="px-3 py-2 bg-amber-50 border-b border-amber-100 text-[10px] text-amber-900 font-medium line-clamp-2">
                  📖 {restaurantStory}
                </div>
              )}

              {/* Gallery Photos Teaser (if uploaded) */}
              {galleryImages.length > 0 && (
                <div className="px-3 py-2 bg-white border-b border-slate-100 space-y-1">
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">
                    📸 Ambiance & Food Gallery
                  </span>
                  <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
                    {galleryImages.map((img, idx) => (
                      <img
                        key={idx}
                        src={img}
                        alt={`Gallery ${idx + 1}`}
                        className="w-14 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Sample Menu Items List */}
              <div className="p-3 flex-1 space-y-2.5 bg-slate-50 overflow-y-auto">
                <div className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                  Starters & Bestsellers
                </div>

                <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-xs font-bold text-slate-800">Paneer Tikka</span>
                    </div>
                    <span className="text-[10px] font-extrabold text-slate-600 block mt-0.5">₹220</span>
                  </div>
                  <button
                    className="px-3 py-1 rounded-lg text-[10px] font-black text-white shadow-2xs"
                    style={{ backgroundColor: primaryColor }}
                  >
                    ADD +
                  </button>
                </div>

                <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-xs font-bold text-slate-800">Malai Chaap</span>
                    </div>
                    <span className="text-[10px] font-extrabold text-slate-600 block mt-0.5">₹180</span>
                  </div>
                  <button
                    className="px-3 py-1 rounded-lg text-[10px] font-black text-white shadow-2xs"
                    style={{ backgroundColor: primaryColor }}
                  >
                    ADD +
                  </button>
                </div>
              </div>

              {/* Floating Bottom Cart Bar Teaser */}
              <div className="p-2.5 bg-white border-t border-slate-200">
                <button
                  className="w-full py-2 px-3 rounded-xl text-white font-extrabold text-xs flex items-center justify-between shadow-md"
                  style={{ backgroundColor: primaryColor }}
                >
                  <span>1 item in cart</span>
                  <span>View Cart · ₹220</span>
                </button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
