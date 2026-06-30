// src/components/layout/DashboardShell.tsx
"use client";

import { useState, ReactNode, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getRestaurantSession, clearSession } from "../../lib/auth";
import {
  LayoutDashboard,
  ShoppingBag,
  Utensils,
  Users,
  Boxes,
  BarChart3,
  Settings,
  Menu,
  X,
  Bell,
  MessageSquare,
  Power,
  ChevronDown,
  Bot,
  Cpu
} from "lucide-react";

interface DashboardShellProps {
  children: ReactNode;
}

export default function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [restaurantStatus, setRestaurantStatus] = useState<"open" | "busy" | "closed">("open");
  const [restaurantName, setRestaurantName] = useState("Bella Italia");

  // Notifications List Mock
  const notifications = [
    { id: 1, title: "New WhatsApp Order #482", time: "2 min ago", type: "order" },
    { id: 2, title: "Tomato Stock Low (3 kg remaining)", time: "15 min ago", type: "alert" },
    { id: 3, title: "Kitchen Queue: 5 pending tickets", time: "1 hr ago", type: "queue" },
  ];

  // Load restaurant name from local storage
  useEffect(() => {
    const session = getRestaurantSession();
    if (session?.name) {
      setRestaurantName(session.name);
    }
  }, []);

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Orders & Live Queue", href: "/dashboard/orders", icon: ShoppingBag },
    { label: "Menu Catalog", href: "/dashboard/menu", icon: Utensils },
    { label: "Customers & CRM", href: "/dashboard/customers", icon: Users },
    { label: "Inventory & Stock", href: "/dashboard/inventory", icon: Boxes },
    { label: "Analytics & Sales", href: "/dashboard/analytics", icon: BarChart3 },
    { label: "WhatsApp Hub", href: "/dashboard/whatsapp", icon: MessageSquare },
    { label: "AI Engine", href: "/dashboard/ai", icon: Bot },
    { label: "Settings", href: "/dashboard/settings", icon: Settings },
  ];

  const handleLogout = () => {
    clearSession();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-slate-100 font-sans flex">
      {/* 1. SIDEBAR (Desktop) */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col justify-between border-r border-[#23242B]/50 bg-[#09090B] p-5 relative">
        <div className="absolute -left-16 top-0 h-64 w-64 rounded-full bg-violet-600/5 blur-[80px]" />
        
        <div>
          {/* Brand header */}
          <Link href="/dashboard" className="flex items-center gap-3 px-2 mb-8">
            <span className="flex h-7.5 w-7.5 items-center justify-center rounded-lg bg-violet-600 text-xs font-bold text-white shadow-[0_0_15px_rgba(124,58,237,0.3)]">R</span>
            <div>
              <span className="text-sm font-bold tracking-tight text-white font-sora block leading-none">Restroex</span>
              <span className="text-[10px] text-slate-500 font-medium mt-0.5 block">{restaurantName}</span>
            </div>
          </Link>

          {/* Quick Restaurant Status Indicator */}
          <div className="mb-6 px-2">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/30 border border-[#23242B] text-xs">
              <span className="text-slate-400">Store Status:</span>
              <div className="relative">
                <select
                  value={restaurantStatus}
                  onChange={(e) => setRestaurantStatus(e.target.value as any)}
                  className="bg-transparent font-semibold cursor-pointer text-slate-200 focus:outline-none pr-4 appearance-none"
                >
                  <option value="open" className="bg-slate-950 text-emerald-400">🟢 Open</option>
                  <option value="busy" className="bg-slate-950 text-amber-500">🟡 Busy</option>
                  <option value="closed" className="bg-slate-950 text-red-500">🔴 Closed</option>
                </select>
                <ChevronDown className="h-3 w-3 text-slate-400 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
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
                  className={`flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? "bg-violet-600 text-white shadow-[0_0_15px_rgba(124,58,237,0.15)]"
                      : "text-slate-400 hover:text-white hover:bg-slate-900/40"
                  }`}
                >
                  <Icon className="h-4.5 w-4.5 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer controls */}
        <div className="space-y-3 border-t border-[#23242B]/40 pt-4">
          <div className="flex items-center justify-between px-2 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5 text-emerald-500" />
              WhatsApp Bot: Connected
            </span>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-950/20 transition-all text-left"
          >
            <Power className="h-4.5 w-4.5" />
            Logout Account
          </button>
        </div>
      </aside>

      {/* 2. MAIN HUB WORKSPACE CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Header Bar */}
        <header className="h-16 border-b border-[#23242B]/50 px-6 flex items-center justify-between shrink-0 relative bg-[#09090B]">
          {/* Mobile hamburger menu toggle */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900/40 transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Page Route Title */}
          <div className="hidden lg:block text-xs font-semibold text-slate-500 uppercase tracking-widest">
            {pathname === "/dashboard" ? "System Overview" : pathname.replace("/dashboard/", "").replace("-", " ")}
          </div>

          {/* Right Control Actions */}
          <div className="flex items-center gap-4 ml-auto relative">
            
            {/* Notification Dropdown Trigger */}
            <div className="relative">
              <button
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900/40 transition-colors relative"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-violet-500 ring-2 ring-[#09090B]" />
              </button>

              {/* Notification Overlay Popover */}
              {isNotificationsOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsNotificationsOpen(false)} />
                  <div className="absolute right-0 mt-2.5 w-80 rounded-2xl bg-[#0e0f14] border border-[#23242B] p-4 shadow-2xl z-50 space-y-3">
                    <div className="flex items-center justify-between border-b border-[#23242B]/40 pb-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Operations Feed</h4>
                      <button
                        onClick={() => setIsNotificationsOpen(false)}
                        className="text-[10px] text-violet-400 hover:underline"
                      >
                        Dismiss All
                      </button>
                    </div>
                    <div className="space-y-2.5">
                      {notifications.map((notif) => (
                        <div key={notif.id} className="text-xs p-2.5 rounded-xl bg-slate-900/30 hover:bg-slate-900/60 border border-[#23242B] transition-all">
                          <div className="font-medium text-slate-200">{notif.title}</div>
                          <div className="text-[10px] text-slate-500 mt-1">{notif.time}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Profile widget */}
            <div className="flex items-center gap-2.5 border-l border-[#23242B]/50 pl-4">
              <div className="w-8 h-8 rounded-full bg-violet-600/30 border border-violet-500 flex items-center justify-center text-xs font-bold text-violet-300">
                OP
              </div>
              <div className="hidden sm:block text-left">
                <span className="text-xs font-semibold text-slate-200 block">Operator Hub</span>
                <span className="text-[10px] text-slate-500 block">Restroex Admin</span>
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic page contents wrapper */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#09090B]/40 relative">
          <div className="absolute top-0 right-0 h-96 w-96 rounded-full bg-violet-600/5 blur-[120px] pointer-events-none" />
          <div className="max-w-7xl mx-auto space-y-8">
            {children}
          </div>
        </main>
      </div>

      {/* 3. MOBILE MENU SIDEBAR DRAWER */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          
          <aside className="relative flex w-64 flex-col justify-between border-r border-[#23242B] bg-[#09090B] p-5 z-50">
            <div>
              <div className="flex items-center justify-between mb-8">
                <Link href="/dashboard" className="flex items-center gap-3">
                  <span className="flex h-7.5 w-7.5 items-center justify-center rounded-lg bg-violet-600 text-xs font-bold text-white">R</span>
                  <span className="text-sm font-bold text-white font-sora">Restroex</span>
                </Link>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
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
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        isActive ? "bg-violet-600 text-white" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <Icon className="h-4.5 w-4.5 shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="border-t border-[#23242B]/40 pt-4 space-y-2">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-red-400"
              >
                <Power className="h-4.5 w-4.5" />
                Logout
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
