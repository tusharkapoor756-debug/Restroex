"use client";

import React, { useState, useEffect, ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getRestaurantSession, clearSession } from "../../lib/auth";
import { WhatsAppService } from "../../lib/services/whatsapp.service";
import { useTheme } from "../../hooks/useTheme";
import { useToast } from "../ui/ToastContainer";
import GlobalOperationsBanner from "./GlobalOperationsBanner";
import {
  LayoutDashboard,
  ShoppingBag,
  History,
  Utensils,
  Users,
  BarChart3,
  Settings,
  Menu,
  X,
  Bell,
  MessageSquare,
  Power,
  ChevronDown,
  Sun,
  Moon,
  Laptop,
  CreditCard,
  Wifi,
  WifiOff,
  Store,
  ChefHat,
  Palette,
  Globe,
  Tag,
  Wallet,
  Truck,
  Lock,
  Package,
  UserCheck,
} from "lucide-react";

interface DashboardShellProps {
  children: ReactNode;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  isComingSoon?: boolean;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

export default function DashboardShell({ children }: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const toast = useToast();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [restaurantStatus, setRestaurantStatus] = useState<"open" | "busy" | "closed">("open");
  const [restaurantName, setRestaurantName] = useState("Restroex Outlet");
  const [restaurantId, setRestaurantId] = useState<string | null>(null);

  const [mounted, setMounted] = useState(false);
  const [wsStatus, setWsStatus] = useState<"connected" | "connecting" | "disconnected">("connecting");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Load session, restaurant settings & check persistent WhatsApp status
  useEffect(() => {
    setMounted(true);
    const session = getRestaurantSession();
    if (session?.name) setRestaurantName(session.name);
    if (session?.restaurantId) setRestaurantId(session.restaurantId);

    // Initial load of Store Status from backend database
    const loadStoreStatus = async () => {
      console.log("🔍 [DashboardShell] Fetching store settings via SettingsService.getSettings()...");
      try {
        const { SettingsService } = await import("../../lib/services/settings.service");
        const fullSettings = await SettingsService.getSettings();
        console.log("✅ [DashboardShell] Received fullSettings from backend:", fullSettings);
        if (fullSettings?.settings?.isOpen === false) {
          setRestaurantStatus("closed");
        } else {
          setRestaurantStatus("open");
        }
      } catch (err) {
        console.error("❌ [DashboardShell] Failed to load store status:", err);
      }
    };

    const checkWhatsAppHealth = async () => {
      if (!session?.restaurantId) return;
      try {
        const res = await WhatsAppService.getStatus();
        if (res.state === "connected") {
          setWsStatus("connected");
        } else if (res.state === "reconnecting") {
          setWsStatus("connecting");
        } else {
          setWsStatus("disconnected");
        }
      } catch (err) {
        setWsStatus("disconnected");
      }
    };

    loadStoreStatus();
    checkWhatsAppHealth();
    const interval = setInterval(checkWhatsAppHealth, 10000); // 10s health check pulse
    return () => clearInterval(interval);
  }, []);

  // Instant-save onChange handler for Store Status selector
  const handleStatusChange = async (newStatus: "open" | "busy" | "closed") => {
    console.log(`⚡ [DashboardShell] handleStatusChange triggered! Target status: ${newStatus}`);
    const previousStatus = restaurantStatus;
    setRestaurantStatus(newStatus);
    setIsUpdatingStatus(true);

    try {
      const { SettingsService } = await import("../../lib/services/settings.service");
      // Map 'closed' to isOpen = false, 'open' or 'busy' to isOpen = true
      const isOpenValue = newStatus !== "closed";
      console.log(`🚀 [DashboardShell] Firing SettingsService.updateSettings({ isOpen: ${isOpenValue} })...`);
      const updateResult = await SettingsService.updateSettings({ isOpen: isOpenValue });
      console.log("✅ [DashboardShell] Backend updateSettings success response:", updateResult);
      
      const statusLabel = newStatus === "open" ? "🟢 Open" : newStatus === "busy" ? "🟡 Busy" : "🔴 Closed";
      toast.success("Store Status Saved", `Store is now ${statusLabel}. Changes applied immediately.`);
      window.dispatchEvent(new Event("store-status-changed"));
    } catch (err: any) {
      console.error("❌ [DashboardShell] updateSettings failed:", err);
      setRestaurantStatus(previousStatus);
      toast.error("Status Update Failed", err.message || "Failed to save store status.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const navGroups: NavGroup[] = [
    {
      group: "DAILY OPERATIONS",
      items: [
        { label: "Overview Hub", href: "/dashboard", icon: LayoutDashboard },
        { label: "Live Orders", href: "/dashboard/orders", icon: ShoppingBag, badge: "LIVE" },
        { label: "Order History", href: "/dashboard/orders/history", icon: History },
        { label: "Kitchen Display", href: "/dashboard/kitchen", icon: ChefHat, badge: "KDS" },
      ],
    },
    {
      group: "BUSINESS & CATALOG",
      items: [
        { label: "Menu Catalog", href: "/dashboard/menu", icon: Utensils },
        { label: "Payments & Ledger", href: "/dashboard/payments", icon: CreditCard },
        { label: "SaaS Wallet", href: "/dashboard/wallet", icon: Wallet },
        { label: "Customers", href: "/dashboard/customers", icon: Users },
        { label: "Analytics & Reports", href: "/dashboard/analytics", icon: BarChart3 },
      ],
    },
    {
      group: "CHANNELS & MARKETING",
      items: [
        { label: "WhatsApp Center", href: "/dashboard/whatsapp", icon: MessageSquare },
        { label: "Store Link & Settings", href: "/dashboard/channels/ordering-experience", icon: Globe },
        { label: "Brand Identity", href: "/dashboard/branding", icon: Palette },
        { label: "Marketing & Coupons", href: "/dashboard/marketing", icon: Tag },
      ],
    },
    {
      group: "SYSTEM",
      items: [
        { label: "System Settings", href: "/dashboard/settings", icon: Settings },
      ],
    },
    {
      group: "COMING SOON",
      items: [
        { label: "Inventory & Stock", href: "/dashboard/inventory", icon: Package, isComingSoon: true },
        { label: "Staff & Roles", href: "/dashboard/staff", icon: UserCheck, isComingSoon: true },
        { label: "Delivery", href: "/dashboard/delivery", icon: Truck, isComingSoon: true },
      ],
    },
  ];

  const flatNavItems = navGroups.flatMap((g) => g.items);

  const mobileBottomNavItems = [
    { label: "Live KOT", href: "/dashboard/orders", icon: ShoppingBag },
    { label: "History", href: "/dashboard/orders/history", icon: History },
    { label: "Menu", href: "/dashboard/menu", icon: Utensils },
    { label: "More", href: "/dashboard/settings", icon: Settings },
  ];

  const handleLogout = () => {
    clearSession();
    toast.info("Logged out", "Session closed successfully");
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans flex flex-col md:flex-row pb-16 md:pb-0">
      
      {/* 1a. TABLET ICON-ONLY SIDEBAR (md: 768-1023px) */}
      <aside className="hidden md:flex lg:hidden w-16 shrink-0 flex-col items-center justify-between border-r border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900 py-4 px-2 sticky top-0 h-screen z-30">
        <div className="flex flex-col items-center gap-1 w-full overflow-y-auto">
          <Link href="/dashboard" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 font-heading font-extrabold text-sm text-white shadow-md shadow-brand-600/30 mb-4">
            R
          </Link>
          {flatNavItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.isComingSoon ? "#" : item.href}
                title={`${item.label}${item.isComingSoon ? " (Coming Soon)" : ""}`}
                onClick={(e) => { if (item.isComingSoon) { e.preventDefault(); toast.info("Coming Soon", `${item.label} module will be available in future phase.`); } }}
                className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${
                  item.isComingSoon
                    ? "opacity-40 cursor-not-allowed text-slate-400"
                    : isActive
                    ? "bg-brand-600 text-white shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.badge && (
                  <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />
                )}
              </Link>
            );
          })}
        </div>
        <div className="flex flex-col items-center gap-2 w-full border-t border-slate-100 dark:border-slate-800 pt-3">
          <Link href="/dashboard/whatsapp" title="WhatsApp Bot" className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
            {wsStatus === "connected" ? <Wifi className="h-5 w-5 text-emerald-500" /> : <WifiOff className="h-5 w-5 text-red-500" />}
          </Link>
          <button
            onClick={handleLogout}
            title="Logout"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-all cursor-pointer"
          >
            <Power className="h-5 w-5" />
          </button>
        </div>
      </aside>

      {/* 1b. DESKTOP FULL SIDEBAR (lg: 1024px+) */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col justify-between border-r border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-4 sticky top-0 h-screen overflow-y-auto z-30">
        <div className="flex-1 overflow-y-auto pr-1 space-y-4">
          {/* Outlet Brand Header */}
          <Link href="/dashboard" className="flex items-center gap-3 px-2 mb-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 font-heading font-extrabold text-sm text-white shadow-md shadow-brand-600/30">
              R
            </span>
            <div className="min-w-0 flex-1">
              <span className="text-sm font-extrabold font-heading tracking-tight text-slate-900 dark:text-slate-100 truncate block">
                Restroex POS
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate block">
                {restaurantName}
              </span>
            </div>
          </Link>

          {/* Restaurant Store Status Selector */}
          <div className="mb-4 px-1">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-xs">
              <div className="flex items-center gap-2">
                <Store className="h-4 w-4 text-slate-500" />
                <span className="font-semibold text-slate-700 dark:text-slate-300">Store:</span>
              </div>
              <select
                value={restaurantStatus}
                disabled={isUpdatingStatus}
                onChange={(e) => handleStatusChange(e.target.value as any)}
                className="bg-transparent font-bold cursor-pointer text-slate-900 dark:text-slate-100 focus:outline-none appearance-none pr-3 disabled:opacity-50"
              >
                <option value="open" className="bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400">🟢 Open</option>
                <option value="busy" className="bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400">🟡 Busy</option>
                <option value="closed" className="bg-white dark:bg-slate-900 text-red-600 dark:text-red-400">🔴 Closed</option>
              </select>
            </div>
          </div>

          {/* Grouped Navigation Links */}
          <nav className="space-y-4">
            {navGroups.map((group) => (
              <div key={group.group} className="space-y-1">
                <div className="px-3 text-[10px] font-black tracking-wider text-slate-400 dark:text-slate-500 uppercase mb-1">
                  {group.group}
                </div>
                {group.items.map((item) => {
                  const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                  const Icon = item.icon;

                  if (item.isComingSoon) {
                    return (
                      <button
                        key={item.label}
                        onClick={() => toast.info("Coming Soon", `${item.label} module will be available in future expansion.`)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 dark:text-slate-500 hover:bg-slate-100/50 dark:hover:bg-slate-800/40 opacity-60 cursor-not-allowed transition-all"
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon className="h-4 w-4 shrink-0 text-slate-400" />
                          <span>{item.label}</span>
                        </div>
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase">
                          SOON
                        </span>
                      </button>
                    );
                  }

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                        isActive
                          ? "bg-brand-600 text-white shadow-sm shadow-brand-600/20 font-bold"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                            isActive ? "bg-white/20 text-white" : "bg-red-500 text-white animate-pulse"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        {/* Footer controls & Persistent WhatsApp Indicator */}
        <div className="space-y-3 border-t border-slate-100 dark:border-slate-800/80 pt-4 mt-2 shrink-0">
          <Link
            href="/dashboard/whatsapp"
            className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-xs font-semibold"
          >
            <div className="flex items-center gap-2">
              {wsStatus === "connected" ? (
                <Wifi className="h-4 w-4 text-emerald-500 animate-pulse" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-500" />
              )}
              <span className="text-slate-700 dark:text-slate-300">WhatsApp Bot</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                wsStatus === "connected"
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                  : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
              }`}
            >
              {wsStatus}
            </span>
          </Link>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-all text-left cursor-pointer border border-red-200/50 dark:border-red-900/40"
          >
            <Power className="h-4.5 w-4.5" />
            <span>Logout Account</span>
          </button>
        </div>
      </aside>

      {/* 2. MAIN WORKSPACE */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Persistent Top Bar */}
        <header className="h-16 border-b border-slate-200 dark:border-slate-800/80 px-4 sm:px-6 flex items-center justify-between shrink-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-20">
          
          {/* Mobile hamburger menu toggle (hidden at md+ since tablet has icon sidebar) */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Left Title & Persistent WhatsApp Indicator Dot */}
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 capitalize">
              {pathname === "/dashboard" ? "Live Operations" : pathname.replace("/dashboard/", "").replace("-", " ")}
            </h1>

            {/* PERSISTENT STATUS DOT REQUIREMENT */}
            <Link href="/dashboard/whatsapp" title={`WhatsApp Bot Status: ${wsStatus}`}>
              <span className="relative flex h-3 w-3 cursor-pointer">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    wsStatus === "connected" ? "bg-emerald-400" : "bg-red-400"
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-3 w-3 ${
                    wsStatus === "connected" ? "bg-emerald-500" : "bg-red-500"
                  }`}
                />
              </span>
            </Link>
          </div>

          {/* Right Header Actions (Theme Toggle, Notifications) */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* Dark/Light Mode Manual Toggle Button */}
            <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80">
              <button
                onClick={() => setTheme("light")}
                className={`p-1.5 rounded-lg text-xs transition-colors ${
                  theme === "light" ? "bg-white text-amber-500 shadow-sm" : "text-slate-400 hover:text-slate-700"
                }`}
                title="Light Mode"
              >
                <Sun className="h-4 w-4" />
              </button>
              <button
                onClick={() => setTheme("dark")}
                className={`p-1.5 rounded-lg text-xs transition-colors ${
                  theme === "dark" ? "bg-slate-950 text-indigo-400 shadow-sm" : "text-slate-400 hover:text-slate-200"
                }`}
                title="Dark Mode"
              >
                <Moon className="h-4 w-4" />
              </button>
            </div>

            {/* Notifications Feed Bell */}
            <div className="relative">
              <button
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 relative"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-brand-600 ring-2 ring-white dark:ring-slate-900" />
              </button>

              {isNotificationsOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsNotificationsOpen(false)} />
                  <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 shadow-xl z-50 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Live Alerts</h4>
                      <button onClick={() => setIsNotificationsOpen(false)} className="text-xs text-brand-600 hover:underline">
                        Dismiss
                      </button>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                        <div className="font-bold text-slate-900 dark:text-slate-100">WhatsApp Engine Ready</div>
                        <div className="text-slate-500 mt-0.5">Listening for incoming customer orders.</div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Staff Profile Avatar with Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="h-9 w-9 rounded-xl bg-brand-100 dark:bg-brand-950 border border-brand-200 dark:border-brand-800 flex items-center justify-center text-xs font-extrabold text-brand-700 dark:text-brand-300 hover:ring-2 hover:ring-brand-500 transition cursor-pointer"
                title="Account Menu"
              >
                ST
              </button>

              {isProfileOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsProfileOpen(false)} />
                  <div className="absolute right-0 mt-2 w-48 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 shadow-xl z-50 space-y-1 text-xs font-semibold">
                    <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                      <span className="block font-bold text-slate-900 dark:text-slate-100 truncate">{restaurantName}</span>
                      <span className="block text-[10px] text-slate-500 truncate">Store Admin</span>
                    </div>
                    <Link
                      href="/dashboard/settings"
                      onClick={() => setIsProfileOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                      <Settings className="h-4 w-4" />
                      <span>Settings</span>
                    </Link>
                    <button
                      onClick={() => {
                        setIsProfileOpen(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition text-left cursor-pointer"
                    >
                      <Power className="h-4 w-4" />
                      <span>Logout Account</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          <GlobalOperationsBanner />
          {children}
        </main>
      </div>

      {/* 3. MOBILE ONLY BOTTOM TAB NAV (hidden at md+ since tablet has icon sidebar) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 h-16 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-around z-40 px-2 shadow-lg">
        {mobileBottomNavItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center w-full h-full py-1 text-[11px] font-bold transition-all ${
                isActive
                  ? "text-brand-600 dark:text-brand-400"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              <Icon className={`h-5 w-5 mb-0.5 ${isActive ? "scale-110" : ""}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Mobile Drawer Overlay (mobile only) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <aside className="relative flex max-w-[80vw] w-72 flex-col justify-between border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 z-50">
            <div>
              <div className="flex items-center justify-between mb-6">
                <span className="font-heading font-extrabold text-base text-slate-900 dark:text-slate-100">
                  Restroex Menu
                </span>
                <button onClick={() => setMobileMenuOpen(false)} className="p-1 rounded-lg text-slate-400">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="space-y-1 max-h-[70vh] overflow-y-auto">
                {flatNavItems.map((item) => {
                  const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                  const Icon = item.icon;
                  if (item.isComingSoon) return null;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold ${
                        isActive ? "bg-brand-600 text-white" : "text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      <Icon className="h-4.5 w-4.5" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-red-600"
            >
              <Power className="h-4.5 w-4.5" />
              <span>Logout</span>
            </button>
          </aside>
        </div>
      )}
    </div>
  );
}
