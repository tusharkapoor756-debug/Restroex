"use client";

import React, { useState, useEffect, ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getRestaurantSession, clearSession } from "../../lib/auth";
import { WhatsAppService } from "../../lib/services/whatsapp.service";
import { useTheme } from "../../hooks/useTheme";
import { useToast } from "../ui/ToastContainer";
import {
  LayoutDashboard,
  ShoppingBag,
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
} from "lucide-react";

interface DashboardShellProps {
  children: ReactNode;
}

export default function DashboardShell({ children }: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const toast = useToast();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [restaurantStatus, setRestaurantStatus] = useState<"open" | "busy" | "closed">("open");
  const [restaurantName, setRestaurantName] = useState("Restroex Outlet");
  const [restaurantId, setRestaurantId] = useState<string | null>(null);

  // Persistent WhatsApp Connection Status Indicator State
  const [wsStatus, setWsStatus] = useState<"connected" | "connecting" | "disconnected">("connecting");

  // Load session & check persistent WhatsApp status
  useEffect(() => {
    const session = getRestaurantSession();
    if (session?.name) setRestaurantName(session.name);
    if (session?.restaurantId) setRestaurantId(session.restaurantId);

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

    checkWhatsAppHealth();
    const interval = setInterval(checkWhatsAppHealth, 10000); // 10s health check pulse
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Live Orders", href: "/dashboard/orders", icon: ShoppingBag, badge: "LIVE" },
    { label: "Menu Catalog", href: "/dashboard/menu", icon: Utensils },
    { label: "Payments", href: "/dashboard/payments", icon: CreditCard },
    { label: "Customers", href: "/dashboard/customers", icon: Users },
    { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
    { label: "WhatsApp Bot", href: "/dashboard/whatsapp", icon: MessageSquare },
    { label: "Settings", href: "/dashboard/settings", icon: Settings },
  ];

  const mobileBottomNavItems = [
    { label: "Orders", href: "/dashboard/orders", icon: ShoppingBag },
    { label: "Menu", href: "/dashboard/menu", icon: Utensils },
    { label: "WhatsApp", href: "/dashboard/whatsapp", icon: MessageSquare },
    { label: "More", href: "/dashboard/settings", icon: Settings },
  ];

  const handleLogout = () => {
    clearSession();
    toast.info("Logged out", "Session closed successfully");
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans flex flex-col lg:flex-row pb-16 lg:pb-0">
      
      {/* 1. DESKTOP SIDEBAR (Fixed Left) */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col justify-between border-r border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-5 sticky top-0 h-screen z-30">
        <div>
          {/* Outlet Brand Header */}
          <Link href="/dashboard" className="flex items-center gap-3 px-2 mb-6">
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
          <div className="mb-6 px-1">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-xs">
              <div className="flex items-center gap-2">
                <Store className="h-4 w-4 text-slate-500" />
                <span className="font-semibold text-slate-700 dark:text-slate-300">Store:</span>
              </div>
              <select
                value={restaurantStatus}
                onChange={(e) => setRestaurantStatus(e.target.value as any)}
                className="bg-transparent font-bold cursor-pointer text-slate-900 dark:text-slate-100 focus:outline-none appearance-none pr-3"
              >
                <option value="open" className="bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400">🟢 Open</option>
                <option value="busy" className="bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400">🟡 Busy</option>
                <option value="closed" className="bg-white dark:bg-slate-900 text-red-600 dark:text-red-400">🔴 Closed</option>
              </select>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    isActive
                      ? "bg-brand-600 text-white shadow-sm shadow-brand-600/20"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-4.5 w-4.5 shrink-0" />
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
          </nav>
        </div>

        {/* Footer controls & Persistent WhatsApp Indicator */}
        <div className="space-y-3 border-t border-slate-100 dark:border-slate-800/80 pt-4">
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
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all text-left"
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
          
          {/* Mobile hamburger menu toggle */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
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

            {/* Staff Profile Avatar */}
            <div className="h-9 w-9 rounded-xl bg-brand-100 dark:bg-brand-950 border border-brand-200 dark:border-brand-800 flex items-center justify-center text-xs font-extrabold text-brand-700 dark:text-brand-300">
              ST
            </div>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-8">
          {children}
        </main>
      </div>

      {/* 3. MOBILE FIRST BOTTOM TAB NAVIGATION BAR (Mandatory for Restaurant Counter Staff) */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 h-16 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-around z-40 px-2 shadow-lg">
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

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <aside className="relative flex w-72 flex-col justify-between border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 z-50">
            <div>
              <div className="flex items-center justify-between mb-6">
                <span className="font-heading font-extrabold text-base text-slate-900 dark:text-slate-100">
                  Restroex Menu
                </span>
                <button onClick={() => setMobileMenuOpen(false)} className="p-1 rounded-lg text-slate-400">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="space-y-1">
                {navItems.map((item) => {
                  const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                  const Icon = item.icon;
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
