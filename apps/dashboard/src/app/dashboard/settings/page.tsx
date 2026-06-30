// src/app/dashboard/settings/page.tsx
"use client";

import { useState, useEffect } from "react";
import {
  Building2,
  Users,
  MessageSquare,
  Globe,
  CreditCard,
  User,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  Lock,
  Loader2,
} from "lucide-react";
import { SettingsService } from "../../../lib/services/settings.service";

type SubSection = "profile" | "team" | "whatsapp" | "integrations" | "billing" | "account";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "owner" | "manager" | "chef" | "cashier";
  status: "active" | "invited";
}

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SubSection>("profile");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // 1. Profile
  const [restaurantName, setRestaurantName] = useState("Bella Italia");
  const [cuisineType, setCuisineType] = useState("Italian");
  const [phone, setPhone] = useState("+91 98124 55432");
  const [address, setAddress] = useState("123 Culinary Boulevard, Suite A");
  const [avgTicket, setAvgTicket] = useState("650");

  // 2. Team
  const [team, setTeam] = useState<TeamMember[]>([
    { id: "tm-1", name: "Operator Hub (You)", email: "admin@restroex.com", role: "owner", status: "active" },
    { id: "tm-2", name: "Chef Alex", email: "alex.cuisine@gmail.com", role: "chef", status: "active" },
    { id: "tm-3", name: "Sanjay Kumar", email: "sanjay@bistro.com", role: "manager", status: "active" },
    { id: "tm-4", name: "Ramesh Sen", email: "ramesh@bistro.com", role: "cashier", status: "invited" },
  ]);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"manager" | "chef" | "cashier">("manager");

  // 3. WhatsApp
  const [botWelcomeMsg, setBotWelcomeMsg] = useState(
    "Hello! Welcome to Bella Italia. Would you like to view our digital menu or place a new order today?"
  );
  const [aiAutoOrder, setAiAutoOrder] = useState(true);
  const [isWaConnected, setIsWaConnected] = useState(true);

  // 4. Integrations
  const [integrations, setIntegrations] = useState([
    { id: "zomato", name: "Zomato Partner Portal", desc: "Sync live menus and receive orders from Zomato directly.", connected: true },
    { id: "swiggy", name: "Swiggy Partner Sync", desc: "Sync menus and ingest Swiggy delivery orders automatically.", connected: false },
    { id: "ubereats", name: "UberEats Connect", desc: "Mirror catalog and receive UberEats order tickets.", connected: false },
  ]);

  // Load restaurant config from placeholder service
  useEffect(() => {
    (async () => {
      try {
        const settings = await SettingsService.getSettings();
        if (settings) {
          if (settings.name) setRestaurantName(settings.name);
          if (settings.phoneNumber) setPhone(settings.phoneNumber);
          if (settings.address) setAddress(settings.address);
          if (settings.city) setCuisineType(settings.city); // mocking cuisine as city for now
        }
      } catch {
        // fallback
      }
    })();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await SettingsService.updateSettings({
        name: restaurantName,
        phoneNumber: phone,
        address,
        city: cuisineType
      });
    } catch {
      // ignore
    }
    setIsSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleInviteTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName || !inviteEmail) return;
    setTeam((prev) => [
      ...prev,
      { id: `tm-${Date.now()}`, name: inviteName, email: inviteEmail, role: inviteRole, status: "invited" },
    ]);
    setInviteName("");
    setInviteEmail("");
  };

  const handleDeleteTeam = (id: string) => {
    if (id === "tm-1") { alert("Cannot remove the account owner."); return; }
    setTeam((prev) => prev.filter((m) => m.id !== id));
  };

  const toggleIntegration = (id: string) =>
    setIntegrations((prev) => prev.map((i) => (i.id === id ? { ...i, connected: !i.connected } : i)));

  const navSections: { id: SubSection; label: string; icon: React.ReactNode }[] = [
    { id: "profile", label: "Restaurant Profile", icon: <Building2 className="h-4 w-4" /> },
    { id: "team", label: "Team Members", icon: <Users className="h-4 w-4" /> },
    { id: "whatsapp", label: "WhatsApp Gateway", icon: <MessageSquare className="h-4 w-4" /> },
    { id: "integrations", label: "Aggregators Sync", icon: <Globe className="h-4 w-4" /> },
    { id: "billing", label: "Billing & Plans", icon: <CreditCard className="h-4 w-4" /> },
    { id: "account", label: "User Account", icon: <User className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-sora text-white">System Settings</h1>
        <p className="text-slate-400 text-xs mt-0.5">
          Control restaurant profile, team access, WhatsApp bot, integrations, and billing.
        </p>
      </div>

      {saveSuccess && (
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-950/40 border border-emerald-900/60 text-emerald-200 text-xs">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>Configuration saved successfully.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT: Settings Nav */}
        <div className="lg:col-span-3 bg-[#0e0f14]/50 border border-[#23242B] rounded-2xl p-3 space-y-1">
          {navSections.map((sec) => (
            <button
              key={sec.id}
              onClick={() => setActiveSection(sec.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition-all ${
                activeSection === sec.id
                  ? "bg-violet-600 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-900/40"
              }`}
            >
              {sec.icon}
              {sec.label}
            </button>
          ))}
        </div>

        {/* RIGHT: Settings Panel */}
        <div className="lg:col-span-9 bg-[#0e0f14]/40 border border-[#23242B] rounded-2xl p-6 min-h-[56vh]">

          {/* ── 1. PROFILE ── */}
          {activeSection === "profile" && (
            <form onSubmit={handleSaveProfile} className="space-y-6">
              <div className="flex justify-between items-center border-b border-[#23242B]/40 pb-3">
                <h3 className="text-sm font-bold text-white font-sora">Restaurant Profile</h3>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white px-3 py-1.5 text-xs font-semibold disabled:opacity-50 transition-all active:scale-[0.98]"
                >
                  {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Save Changes
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
                {[
                  { label: "Restaurant Name", value: restaurantName, setter: setRestaurantName, type: "text", placeholder: "e.g. Bella Italia" },
                  { label: "Cuisine Type", value: cuisineType, setter: setCuisineType, type: "text", placeholder: "e.g. Italian, Asian" },
                  { label: "Contact Hotline", value: phone, setter: setPhone, type: "tel", placeholder: "+91 98xxx xxxxx" },
                  { label: "Avg. Ticket Size (₹)", value: avgTicket, setter: setAvgTicket, type: "number", placeholder: "650" },
                ].map((field) => (
                  <div key={field.label} className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">{field.label}</label>
                    <input
                      type={field.type}
                      value={field.value}
                      placeholder={field.placeholder}
                      onChange={(e) => field.setter(e.target.value)}
                      className="w-full bg-slate-950 border border-[#23242B] focus:border-violet-500 rounded-xl px-3 py-2 text-slate-100 placeholder-slate-600 focus:outline-none transition-colors"
                      required
                    />
                  </div>
                ))}
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Physical Address</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full bg-slate-950 border border-[#23242B] focus:border-violet-500 rounded-xl px-3 py-2 text-slate-100 focus:outline-none transition-colors"
                    required
                  />
                </div>
              </div>
            </form>
          )}

          {/* ── 2. TEAM ── */}
          {activeSection === "team" && (
            <div className="space-y-5">
              <div className="border-b border-[#23242B]/40 pb-3">
                <h3 className="text-sm font-bold text-white font-sora">Team Hierarchy</h3>
              </div>
              <form
                onSubmit={handleInviteTeam}
                className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end bg-slate-950/40 p-4 rounded-2xl border border-[#23242B] text-xs"
              >
                {[
                  { label: "Full Name", value: inviteName, setter: setInviteName, type: "text", placeholder: "e.g. Ramesh Sen" },
                  { label: "Email Address", value: inviteEmail, setter: setInviteEmail, type: "email", placeholder: "ramesh@bistro.com" },
                ].map((f) => (
                  <div key={f.label} className="space-y-1.5">
                    <label className="text-[9px] uppercase font-bold tracking-wider text-slate-500">{f.label}</label>
                    <input
                      type={f.type}
                      placeholder={f.placeholder}
                      value={f.value}
                      onChange={(e) => f.setter(e.target.value)}
                      className="w-full bg-slate-950 border border-[#23242B] focus:border-violet-500 rounded-xl px-3 py-2 text-slate-100 focus:outline-none"
                      required
                    />
                  </div>
                ))}
                <div className="flex gap-2 items-end">
                  <div className="space-y-1.5 flex-1">
                    <label className="text-[9px] uppercase font-bold tracking-wider text-slate-500">Role</label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as "manager" | "chef" | "cashier")}
                      className="w-full bg-slate-950 border border-[#23242B] rounded-xl px-3 py-2 text-slate-100 focus:outline-none"
                    >
                      <option value="manager">Manager</option>
                      <option value="chef">Chef</option>
                      <option value="cashier">Cashier</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="rounded-xl bg-violet-600 hover:bg-violet-500 text-white p-2 font-semibold shrink-0 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </form>

              <div className="bg-slate-950/20 border border-[#23242B] rounded-2xl overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[#23242B] bg-slate-950/40 text-[9px] uppercase tracking-wider text-slate-500 font-bold">
                      <th className="p-3">Name</th>
                      <th className="p-3">Email</th>
                      <th className="p-3">Role</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Remove</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#23242B]/30">
                    {team.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-950/20">
                        <td className="p-3 font-bold text-slate-200">{m.name}</td>
                        <td className="p-3 text-slate-400">{m.email}</td>
                        <td className="p-3 text-slate-300 capitalize">{m.role}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold border ${
                            m.status === "active"
                              ? "bg-emerald-950/30 text-emerald-400 border-emerald-900/60"
                              : "bg-amber-950/30 text-amber-400 border-amber-900/60"
                          }`}>
                            {m.status}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button onClick={() => handleDeleteTeam(m.id)} className="p-1 text-slate-500 hover:text-red-400 transition-colors">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── 3. WHATSAPP ── */}
          {activeSection === "whatsapp" && (
            <div className="space-y-6 text-xs">
              <div className="flex justify-between items-center border-b border-[#23242B]/40 pb-3">
                <h3 className="text-sm font-bold text-white font-sora">WhatsApp Automation</h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                  isWaConnected ? "bg-emerald-950 text-emerald-400 border-emerald-900" : "bg-red-950 text-red-400 border-red-900"
                }`}>
                  {isWaConnected ? "Live" : "Offline"}
                </span>
              </div>

              <div className="space-y-5">
                <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-950/50 border border-[#23242B]">
                  <div>
                    <span className="font-bold text-slate-200 block">Bot Phone Line</span>
                    <span className="text-[11px] text-slate-500">Controls active automation channel</span>
                  </div>
                  <button
                    onClick={() => setIsWaConnected((v) => !v)}
                    className={`rounded-xl px-4 py-2 font-semibold border transition-all ${
                      isWaConnected
                        ? "border-red-900/50 text-red-400 hover:bg-red-950/20"
                        : "bg-violet-600 border-violet-600 text-white hover:bg-violet-500"
                    }`}
                  >
                    {isWaConnected ? "Disconnect" : "Connect"}
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-950/50 border border-[#23242B]">
                  <div>
                    <span className="font-bold text-slate-200 block">AI Auto-Order Assistant</span>
                    <span className="text-[11px] text-slate-500">Automatically parse and generate orders from customer chats</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={aiAutoOrder} onChange={(e) => setAiAutoOrder(e.target.checked)} className="sr-only peer" />
                    <div className="w-9 h-5 bg-slate-800 border border-[#23242B] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-slate-400 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-violet-600" />
                  </label>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Welcome / Greeting Template</label>
                  <textarea
                    value={botWelcomeMsg}
                    onChange={(e) => setBotWelcomeMsg(e.target.value)}
                    rows={3}
                    className="w-full bg-slate-950 border border-[#23242B] focus:border-violet-500 rounded-xl px-3 py-2 text-slate-100 focus:outline-none transition-colors"
                  />
                  <p className="text-[10px] text-slate-600">Sent automatically on first customer contact.</p>
                </div>
              </div>
            </div>
          )}

          {/* ── 4. INTEGRATIONS ── */}
          {activeSection === "integrations" && (
            <div className="space-y-6">
              <div className="border-b border-[#23242B]/40 pb-3">
                <h3 className="text-sm font-bold text-white font-sora">Aggregator Partner Sync</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                {integrations.map((int) => (
                  <div key={int.id} className="p-5 rounded-2xl bg-slate-950/40 border border-[#23242B] hover:border-slate-800 flex flex-col justify-between h-44 transition-colors">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-slate-200 leading-tight">{int.name}</span>
                        <span className={`h-2 w-2 rounded-full shrink-0 mt-1 ${int.connected ? "bg-emerald-500" : "bg-slate-700"}`} />
                      </div>
                      <p className="text-[11px] text-slate-500 leading-normal">{int.desc}</p>
                    </div>
                    <button
                      onClick={() => toggleIntegration(int.id)}
                      className={`w-full rounded-xl py-2 font-semibold border transition-all ${
                        int.connected
                          ? "border-[#23242B] text-slate-400 hover:text-white"
                          : "bg-violet-600 border-violet-600 text-white hover:bg-violet-500"
                      }`}
                    >
                      {int.connected ? "Disconnect" : "Connect Portal"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 5. BILLING ── */}
          {activeSection === "billing" && (
            <div className="space-y-6 text-xs">
              <div className="border-b border-[#23242B]/40 pb-3">
                <h3 className="text-sm font-bold text-white font-sora">Subscription & Billing</h3>
              </div>

              <div className="p-5 rounded-2xl bg-violet-950/10 border border-violet-800/70 relative overflow-hidden flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-violet-600/5 blur-[60px]" />
                <div className="space-y-1.5">
                  <span className="text-[9px] uppercase font-bold tracking-widest text-violet-400">Active Plan</span>
                  <h4 className="text-sm font-bold text-white">Restroex Growth Operating System</h4>
                  <p className="text-[11px] text-slate-400 max-w-xs leading-relaxed">
                    Full WhatsApp automation, AI order parser, unlimited catalog, and up to 5 operator seats.
                  </p>
                </div>
                <div className="shrink-0 text-left sm:text-right">
                  <span className="text-xl font-extrabold text-white">₹4,999<span className="text-sm font-normal text-slate-400">/mo</span></span>
                  <span className="text-[10px] text-slate-500 block mt-1">Renews July 28, 2026</span>
                </div>
              </div>

              <div className="space-y-2.5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Payment Method</span>
                <div className="flex justify-between items-center p-4 bg-slate-950/50 border border-[#23242B] rounded-2xl">
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-5 w-5 text-slate-500" />
                    <div>
                      <span className="font-bold text-slate-200 block">Visa ending in 4242</span>
                      <span className="text-[10px] text-slate-500">Expires 12/28</span>
                    </div>
                  </div>
                  <button className="text-violet-400 hover:text-violet-300 font-semibold transition-colors">Update</button>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-1">
                  {[
                    { label: "This Month", value: "₹4,999" },
                    { label: "Last Month", value: "₹4,999" },
                    { label: "Total Paid", value: "₹24,995" },
                  ].map((stat) => (
                    <div key={stat.label} className="p-3 rounded-xl bg-slate-950/40 border border-[#23242B] text-center">
                      <span className="text-[9px] text-slate-500 uppercase tracking-wider block">{stat.label}</span>
                      <span className="text-sm font-bold text-white mt-1 block">{stat.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── 6. ACCOUNT ── */}
          {activeSection === "account" && (
            <form
              onSubmit={(e) => { e.preventDefault(); setSaveSuccess(true); setTimeout(() => setSaveSuccess(false), 3000); }}
              className="space-y-6 text-xs"
            >
              <div className="flex justify-between items-center border-b border-[#23242B]/40 pb-3">
                <h3 className="text-sm font-bold text-white font-sora">Login Credentials</h3>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white px-3 py-1.5 font-semibold transition-all active:scale-[0.98]"
                >
                  <Lock className="h-3.5 w-3.5" /> Update Password
                </button>
              </div>

              <div className="max-w-sm space-y-4">
                <div className="p-4 rounded-2xl bg-slate-950/40 border border-[#23242B] flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-violet-600/20 border border-violet-500/50 flex items-center justify-center text-sm font-bold text-violet-300">
                    OP
                  </div>
                  <div>
                    <span className="font-bold text-slate-200 text-sm block">Operator Hub</span>
                    <span className="text-[10px] text-slate-500">admin@restroex.com · Owner</span>
                  </div>
                </div>

                {[
                  { label: "Current Password", id: "cur-pass" },
                  { label: "New Password (min 8 chars)", id: "new-pass" },
                  { label: "Confirm New Password", id: "conf-pass" },
                ].map((field) => (
                  <div key={field.id} className="space-y-1.5">
                    <label htmlFor={field.id} className="text-[10px] uppercase font-bold tracking-wider text-slate-400">{field.label}</label>
                    <input
                      id={field.id}
                      type="password"
                      placeholder="••••••••"
                      className="w-full bg-slate-950 border border-[#23242B] focus:border-violet-500 rounded-xl px-3 py-2 text-slate-100 focus:outline-none transition-colors"
                      required
                    />
                  </div>
                ))}
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
