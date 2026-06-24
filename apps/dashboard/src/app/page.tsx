"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { RestaurantSetupWizard } from "./components/restaurant-setup-wizard";
import type { RestaurantSetupResponse } from "./components/restaurant-setup-wizard";

type OrderStatus = "paid" | "accepted" | "preparing" | "ready" | "completed" | "cancelled";

type ReceiptSnapshotItem = {
  name: string;
  variantName?: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
  customizations?: string[];
};

type ReceiptSnapshot = {
  customerPhone: string;
  humanReadableId: string;
  totalAmount: number;
  items: ReceiptSnapshotItem[];
  generatedAt: string;
};

type Order = {
  id: string;
  restaurantId: string;
  customerPhone: string;
  status: OrderStatus;
  totalAmount: number;
  humanReadableId: string;
  receiptSnapshot?: ReceiptSnapshot;
  createdAt: string;
  updatedAt: string;
};

type Restaurant = {
  id: string;
  name: string;
  phoneNumber: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
};

type RestaurantSession = {
  restaurant: Restaurant;
  token: string;
  expiresAt: string;
};

type WhatsAppStatus = {
  restaurantId: string;
  state: "connected" | "disconnected" | "reconnecting" | "expired";
  qrCode?: string;
  qrCodeDataUrl?: string;
  connectedPhone?: string;
  lastError?: string;
};

type MenuItem = {
  id: string;
  name: string;
  aliases: string[];
  basePrice: number;
  isAvailable: boolean;
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
};

type ForgotPasswordResponse = {
  email: string;
  temporaryPassword: string;
  message: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api/v1";
const POLL_INTERVAL_MS = 5000;
const WHATSAPP_STATUS_POLL_MS = 3000;
const REMINDER_INTERVAL_MS = 45000;

const STATUS_COLUMNS: Array<{ status: OrderStatus; title: string; next?: OrderStatus; action?: string }> = [
  { status: "paid", title: "Paid", next: "accepted", action: "Accept" },
  { status: "accepted", title: "Accepted", next: "preparing", action: "Preparing" },
  { status: "preparing", title: "Preparing", next: "ready", action: "Ready" },
  { status: "ready", title: "Ready", next: "completed", action: "Complete" },
];

const DELAY_LIMITS_MS: Record<string, number> = {
  paid: 8 * 60 * 1000,
  accepted: 12 * 60 * 1000,
  preparing: 18 * 60 * 1000,
  ready: 10 * 60 * 1000,
};

export default function Page() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [knownOrderIds, setKnownOrderIds] = useState<Set<string>>(new Set());
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set());
  const [busyOrderIds, setBusyOrderIds] = useState<Set<string>>(new Set());
  const [restaurantSession, setRestaurantSession] = useState<RestaurantSession | null>(null);
  const [restaurantSetup, setRestaurantSetup] = useState<RestaurantSetupResponse | null>(null);
  const [isLoadingSetup, setIsLoadingSetup] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authForm, setAuthForm] = useState({
    restaurantName: "",
    phoneNumber: "",
    email: "",
    password: "",
  });
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuForm, setMenuForm] = useState({ name: "", basePrice: "", aliases: "" });
  const [whatsAppStatus, setWhatsAppStatus] = useState<WhatsAppStatus | null>(null);
  const [isConnectingWhatsApp, setIsConnectingWhatsApp] = useState(false);
  const [connectionLost, setConnectionLost] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.45);
  const [now, setNow] = useState(Date.now());
  const lastReminderAt = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const storedSession = window.localStorage.getItem("restroexRestaurantSession");
    const storedMuted = window.localStorage.getItem("restroexDashboardMuted") === "true";
    const storedVolume = Number(window.localStorage.getItem("restroexDashboardVolume"));

    if (storedSession) {
      try {
        setRestaurantSession(JSON.parse(storedSession) as RestaurantSession);
      } catch {
        window.localStorage.removeItem("restroexRestaurantSession");
      }
    }

    setMuted(storedMuted);
    if (!Number.isNaN(storedVolume) && storedVolume >= 0 && storedVolume <= 1) {
      setVolume(storedVolume);
    }
  }, []);

  useEffect(() => {
    if (restaurantSession) {
      window.localStorage.setItem("restroexRestaurantSession", JSON.stringify(restaurantSession));
    } else {
      window.localStorage.removeItem("restroexRestaurantSession");
    }
  }, [restaurantSession]);

  useEffect(() => {
    window.localStorage.setItem("restroexDashboardMuted", String(muted));
  }, [muted]);

  useEffect(() => {
    window.localStorage.setItem("restroexDashboardVolume", String(volume));
  }, [volume]);

  const authHeaders = useCallback(() => {
    return restaurantSession ? { Authorization: `Bearer ${restaurantSession.token}` } : {};
  }, [restaurantSession]);

  const isSetupComplete = restaurantSetup?.isComplete === true;

  const playPing = useCallback(
    (kind: "new" | "reminder" | "test" = "new") => {
      if (muted || volume <= 0) return;

      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextCtor) return;

      const context = audioContextRef.current || new AudioContextCtor();
      audioContextRef.current = context;

      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = kind === "reminder" ? "square" : "sine";
      oscillator.frequency.value = kind === "reminder" ? 720 : 960;
      gain.gain.value = volume;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.18);
      oscillator.stop(context.currentTime + 0.2);
    },
    [muted, volume]
  );

  const fetchMenu = useCallback(async () => {
    if (!restaurantSession || !isSetupComplete) return;

    try {
      const response = await fetch(`${API_BASE_URL}/menu/items`, {
        headers: authHeaders(),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Menu request failed with ${response.status}`);
      const payload = (await response.json()) as ApiResponse<MenuItem[]>;
      setMenuItems(payload.data || []);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load menu");
    }
  }, [authHeaders, isSetupComplete, restaurantSession]);

  const fetchWhatsAppStatus = useCallback(async () => {
    if (!restaurantSession || !isSetupComplete) return;

    try {
      const response = await fetch(`${API_BASE_URL}/whatsapp/session/status`, {
        headers: authHeaders(),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`WhatsApp status failed with ${response.status}`);
      const payload = (await response.json()) as ApiResponse<WhatsAppStatus>;
      setWhatsAppStatus(payload.data);
    } catch (error) {
      setConnectionLost(true);
      setErrorMessage(error instanceof Error ? error.message : "Unable to load WhatsApp status");
    }
  }, [authHeaders, isSetupComplete, restaurantSession]);

  const fetchActiveOrders = useCallback(async () => {
    if (!restaurantSession || !isSetupComplete || whatsAppStatus?.state !== "connected") return;

    try {
      const response = await fetch(`${API_BASE_URL}/orders/active`, {
        headers: authHeaders(),
        cache: "no-store",
      });

      if (!response.ok) throw new Error(`Active orders request failed with ${response.status}`);

      const payload = (await response.json()) as ApiResponse<Order[]>;
      const nextOrders = payload.data || [];
      const nextIds = new Set(nextOrders.map((order) => order.id));
      const firstLoad = knownOrderIds.size === 0;
      const arrivingIds = nextOrders.filter((order) => !knownOrderIds.has(order.id)).map((order) => order.id);

      setOrders(nextOrders);
      setKnownOrderIds(nextIds);
      setConnectionLost(false);
      setErrorMessage(null);
      setLastUpdatedAt(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));

      if (!firstLoad && arrivingIds.length > 0) {
        setNewOrderIds(new Set(arrivingIds));
        playPing("new");
        window.setTimeout(() => {
          setNewOrderIds((current) => {
            const updated = new Set(current);
            arrivingIds.forEach((id) => updated.delete(id));
            return updated;
          });
        }, 18000);
      }
    } catch (error) {
      setConnectionLost(true);
      setErrorMessage(error instanceof Error ? error.message : "Unable to load active orders");
    }
  }, [authHeaders, isSetupComplete, knownOrderIds, playPing, restaurantSession, whatsAppStatus?.state]);

  const fetchRestaurantSetup = useCallback(async () => {
    if (!restaurantSession) return;

    setIsLoadingSetup(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`${API_BASE_URL}/restaurants/setup`, {
        headers: authHeaders(),
        cache: "no-store",
      });

      if (!response.ok) throw new Error(await readApiError(response, `Restaurant setup failed with ${response.status}`));
      const payload = (await response.json()) as ApiResponse<RestaurantSetupResponse>;
      setRestaurantSetup(payload.data);
      setRestaurantSession((current) => {
        if (!current) return current;
        const nextRestaurant = { ...current.restaurant, ...payload.data.restaurant };
        return JSON.stringify(nextRestaurant) === JSON.stringify(current.restaurant)
          ? current
          : { ...current, restaurant: nextRestaurant };
      });
    } catch (error) {
      setErrorMessage(toFriendlyNetworkError(error, "Unable to load restaurant setup because backend is not reachable."));
    } finally {
      setIsLoadingSetup(false);
    }
  }, [authHeaders, restaurantSession]);

  useEffect(() => {
    fetchRestaurantSetup();
  }, [fetchRestaurantSetup]);

  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  useEffect(() => {
    fetchWhatsAppStatus();
    const poll = window.setInterval(fetchWhatsAppStatus, WHATSAPP_STATUS_POLL_MS);
    return () => window.clearInterval(poll);
  }, [fetchWhatsAppStatus]);

  useEffect(() => {
    fetchActiveOrders();
    const poll = window.setInterval(fetchActiveOrders, POLL_INTERVAL_MS);
    return () => window.clearInterval(poll);
  }, [fetchActiveOrders]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const visibleOrders = useMemo(() => {
    return [...orders]
      .filter((order) => STATUS_COLUMNS.some((column) => column.status === order.status))
      .sort((a, b) => {
        const urgentDiff = Number(isDelayed(b, now)) - Number(isDelayed(a, now));
        if (urgentDiff !== 0) return urgentDiff;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
  }, [orders, now]);

  useEffect(() => {
    const hasDelayedOrders = visibleOrders.some((order) => isDelayed(order, now));
    if (!hasDelayedOrders || Date.now() - lastReminderAt.current < REMINDER_INTERVAL_MS) return;

    lastReminderAt.current = Date.now();
    playPing("reminder");
  }, [now, playPing, visibleOrders]);

  const submitAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setResetMessage(null);

    try {
      const endpoint = authMode === "signup" ? "register" : "login";
      const response = await fetch(`${API_BASE_URL}/auth/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authForm),
      });

      if (!response.ok) throw new Error(await readApiError(response, `${authMode === "signup" ? "Signup" : "Login"} failed with ${response.status}`));
      const payload = (await response.json()) as ApiResponse<RestaurantSession>;
      setRestaurantSession(payload.data);
      setRestaurantSetup(null);
      setWhatsAppStatus(null);
      setOrders([]);
      setKnownOrderIds(new Set());
    } catch (error) {
      setErrorMessage(toFriendlyNetworkError(error, "Backend is not reachable. Start the backend on port 4000, then try again."));
    }
  };

  const forgotPassword = async () => {
    setErrorMessage(null);
    setResetMessage(null);

    if (!authForm.email.trim()) {
      setErrorMessage("Pehle email daalo, phir password reset karo.");
      return;
    }

    setIsResettingPassword(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authForm.email }),
      });

      if (!response.ok) throw new Error(await readApiError(response, `Password reset failed with ${response.status}`));
      const payload = (await response.json()) as ApiResponse<ForgotPasswordResponse>;
      setAuthForm((current) => ({ ...current, password: payload.data.temporaryPassword }));
      setResetMessage(`Temporary password: ${payload.data.temporaryPassword}`);
    } catch (error) {
      setErrorMessage(toFriendlyNetworkError(error, "Unable to reset password because backend is not reachable."));
    } finally {
      setIsResettingPassword(false);
    }
  };

  const addMenuItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    try {
      const response = await fetch(`${API_BASE_URL}/menu/items`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(menuForm),
      });

      if (!response.ok) throw new Error(await readApiError(response, `Menu item save failed with ${response.status}`));
      setMenuForm({ name: "", basePrice: "", aliases: "" });
      await fetchMenu();
    } catch (error) {
      setErrorMessage(toFriendlyNetworkError(error, "Unable to save menu item because backend is not reachable."));
    }
  };

  const toggleMenuItem = async (item: MenuItem) => {
    setErrorMessage(null);
    setMenuItems((current) => current.map((menuItem) => (menuItem.id === item.id ? { ...menuItem, isAvailable: !item.isAvailable } : menuItem)));

    try {
      const response = await fetch(`${API_BASE_URL}/menu/items/${item.id}/availability`, {
        method: "PATCH",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isAvailable: !item.isAvailable }),
      });

      if (!response.ok) throw new Error(await readApiError(response, `Availability update failed with ${response.status}`));
    } catch (error) {
      setMenuItems((current) => current.map((menuItem) => (menuItem.id === item.id ? item : menuItem)));
      setErrorMessage(toFriendlyNetworkError(error, "Unable to update menu item because backend is not reachable."));
    }
  };

  const connectWhatsApp = async () => {
    if (!restaurantSession) return;

    setIsConnectingWhatsApp(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`${API_BASE_URL}/whatsapp/session/connect`, {
        method: "POST",
        headers: authHeaders(),
      });

      if (!response.ok) throw new Error(await readApiError(response, `WhatsApp connect failed with ${response.status}`));
      const payload = (await response.json()) as ApiResponse<WhatsAppStatus>;
      setWhatsAppStatus(payload.data);
    } catch (error) {
      setErrorMessage(toFriendlyNetworkError(error, "Unable to connect WhatsApp because backend is not reachable."));
    } finally {
      setIsConnectingWhatsApp(false);
    }
  };

  const disconnectWhatsApp = async () => {
    if (!restaurantSession) return;

    try {
      await fetch(`${API_BASE_URL}/whatsapp/session/disconnect`, {
        method: "POST",
        headers: authHeaders(),
      });
      setWhatsAppStatus({ restaurantId: restaurantSession.restaurant.id, state: "disconnected" });
      setOrders([]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to disconnect WhatsApp");
    }
  };

  const transitionOrder = async (order: Order, nextStatus: OrderStatus) => {
    if (busyOrderIds.has(order.id)) return;

    const previousOrders = orders;
    setBusyOrderIds((current) => new Set(current).add(order.id));
    setErrorMessage(null);

    setOrders((current) => {
      if (nextStatus === "completed" || nextStatus === "cancelled") return current.filter((item) => item.id !== order.id);
      return current.map((item) => (item.id === order.id ? { ...item, status: nextStatus, updatedAt: new Date().toISOString() } : item));
    });

    try {
      const response = await fetch(`${API_BASE_URL}/orders/${order.id}/status`, {
        method: "PATCH",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!response.ok) throw new Error(await readApiError(response, `Status update failed with ${response.status}`));
      await fetchActiveOrders();
    } catch (error) {
      setOrders(previousOrders);
      setConnectionLost(true);
      setErrorMessage(toFriendlyNetworkError(error, "Order action failed and was rolled back."));
    } finally {
      window.setTimeout(() => {
        setBusyOrderIds((current) => {
          const updated = new Set(current);
          updated.delete(order.id);
          return updated;
        });
      }, 900);
    }
  };

  const printOrder = async (order: Order) => {
    if (busyOrderIds.has(order.id)) return;

    setBusyOrderIds((current) => new Set(current).add(order.id));
    setErrorMessage(null);

    try {
      const response = await fetch(`${API_BASE_URL}/orders/${order.id}/thermal-print-link`, {
        method: "POST",
        headers: authHeaders(),
      });

      if (!response.ok) throw new Error(await readApiError(response, `Print link request failed with ${response.status}`));
      const payload = (await response.json()) as ApiResponse<{ thermalReceiptUrl: string }>;
      const printWindow = window.open(payload.data.thermalReceiptUrl, "_blank", "noopener,noreferrer");
      if (!printWindow) setErrorMessage("Print popup was blocked. Allow popups and press Print again.");
    } catch (error) {
      setErrorMessage(toFriendlyNetworkError(error, "Unable to open thermal receipt."));
    } finally {
      window.setTimeout(() => {
        setBusyOrderIds((current) => {
          const updated = new Set(current);
          updated.delete(order.id);
          return updated;
        });
      }, 900);
    }
  };

  const enterFullscreen = async () => {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
  };

  const logoutRestaurant = () => {
    setRestaurantSession(null);
    setRestaurantSetup(null);
    setWhatsAppStatus(null);
    setMenuItems([]);
    setOrders([]);
    setKnownOrderIds(new Set());
  };

  const totalDelayed = visibleOrders.filter((order) => isDelayed(order, now)).length;

  if (!restaurantSession) {
    return (
      <main className="ops-shell login-shell" suppressHydrationWarning>
        <section className="login-panel">
          <span className="system-label">Restroex Kitchen</span>
          <h1>{authMode === "signup" ? "Create Account" : "Restaurant Login"}</h1>
          <p>Restaurant account banao, menu add karo, phir WhatsApp connect karke bot ko live karo.</p>

          <div className="auth-tabs">
            <button type="button" className={authMode === "login" ? "active" : ""} onClick={() => setAuthMode("login")}>
              Login
            </button>
            <button type="button" className={authMode === "signup" ? "active" : ""} onClick={() => setAuthMode("signup")}>
              Sign up
            </button>
          </div>

          <form onSubmit={submitAuth} className="login-form">
            {authMode === "signup" && (
              <>
                <label>
                  <span>Restaurant name</span>
                  <input
                    value={authForm.restaurantName}
                    onChange={(event) => setAuthForm((current) => ({ ...current, restaurantName: event.target.value }))}
                    placeholder="Kitchen name"
                  />
                </label>
                <label>
                  <span>WhatsApp number</span>
                  <input
                    value={authForm.phoneNumber}
                    onChange={(event) => setAuthForm((current) => ({ ...current, phoneNumber: event.target.value }))}
                    placeholder="+91..."
                  />
                </label>
              </>
            )}
            <label>
              <span>Email</span>
              <input
                value={authForm.email}
                onChange={(event) => setAuthForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="owner@restaurant.com"
                type="email"
              />
            </label>
            <label>
              <span>Password</span>
              <input
                value={authForm.password}
                onChange={(event) => setAuthForm((current) => ({ ...current, password: event.target.value }))}
                placeholder="Minimum 8 characters"
                type="password"
              />
            </label>
            {authMode === "login" && (
              <button type="button" className="link-button" onClick={forgotPassword} disabled={isResettingPassword}>
                {isResettingPassword ? "Resetting password" : "Forgot password?"}
              </button>
            )}
            <button type="submit">{authMode === "signup" ? "Create Account" : "Login"}</button>
          </form>

          {resetMessage && <section className="success-banner">{resetMessage}</section>}
          {errorMessage && <section className="danger-banner">{errorMessage}</section>}
        </section>
      </main>
    );
  }

  if (isLoadingSetup && !restaurantSetup) {
    return (
      <main className="ops-shell wizard-shell">
        <section className="wizard-panel">
          <span className="system-label">Restroex Setup</span>
          <h1>Loading Setup</h1>
          <p>Restaurant details load ho rahe hain.</p>
        </section>
      </main>
    );
  }

  if (!restaurantSetup?.isComplete) {
    return (
      <RestaurantSetupWizard
        apiBaseUrl={API_BASE_URL}
        token={restaurantSession.token}
        setup={restaurantSetup || {
          restaurant: restaurantSession.restaurant,
          currentStep: 1,
          isComplete: false,
        }}
        onSaved={(nextSetup) => {
          setRestaurantSetup(nextSetup);
          setRestaurantSession((current) => current ? { ...current, restaurant: { ...current.restaurant, ...nextSetup.restaurant } } : current);
        }}
        onComplete={(nextSetup) => {
          setRestaurantSetup(nextSetup);
          setRestaurantSession((current) => current ? { ...current, restaurant: { ...current.restaurant, ...nextSetup.restaurant } } : current);
          setErrorMessage(null);
        }}
        onLogout={logoutRestaurant}
      />
    );
  }

  const isWhatsAppConnected = whatsAppStatus?.state === "connected";

  return (
    <main className="ops-shell">
      <header className="ops-header">
        <section className="identity-block">
          <span className="system-label">{restaurantSession.restaurant.name}</span>
          <h1>{isWhatsAppConnected ? "Live Orders" : "Setup Restaurant"}</h1>
          <p>
            WhatsApp: {whatsAppStatus?.state || "disconnected"}
            {isWhatsAppConnected && lastUpdatedAt ? ` - ${visibleOrders.length} active orders - updated ${lastUpdatedAt}` : ""}
          </p>
        </section>

        <section className="ops-controls" aria-label="Dashboard controls">
          {isWhatsAppConnected ? (
            <button type="button" onClick={disconnectWhatsApp}>Disconnect WhatsApp</button>
          ) : (
            <button type="button" onClick={connectWhatsApp} disabled={isConnectingWhatsApp}>
              {isConnectingWhatsApp ? "Connecting" : whatsAppStatus?.qrCode ? "Regenerate QR" : "Connect WhatsApp"}
            </button>
          )}
          <button type="button" onClick={() => setMuted((value) => !value)} className={muted ? "muted" : ""}>
            {muted ? "Muted" : "Sound On"}
          </button>
          <label className="volume-control">
            <span>Volume</span>
            <input aria-label="Alert volume" type="range" min="0" max="1" step="0.05" value={volume} onChange={(event) => setVolume(Number(event.target.value))} />
          </label>
          <button type="button" onClick={() => playPing("test")}>Test Ping</button>
          <button type="button" onClick={enterFullscreen}>Fullscreen</button>
          <button type="button" onClick={logoutRestaurant}>Logout</button>
        </section>
      </header>

      {connectionLost && <section className="danger-banner">Connection lost. Reconnecting... {errorMessage || ""}</section>}
      {errorMessage && !connectionLost && <section className="danger-banner">{errorMessage}</section>}

      {!isWhatsAppConnected && (
        <section className="setup-grid">
          <section className="setup-card">
            <h2>Menu Setup</h2>
            <p>Add menu names, aliases, and price. Bot parser will use this menu when customer messages arrive.</p>
            <form className="menu-form" onSubmit={addMenuItem}>
              <input value={menuForm.name} onChange={(event) => setMenuForm((current) => ({ ...current, name: event.target.value }))} placeholder="Item name, e.g. Malai Chaap" />
              <input value={menuForm.basePrice} onChange={(event) => setMenuForm((current) => ({ ...current, basePrice: event.target.value }))} placeholder="Price" type="number" min="0" />
              <input value={menuForm.aliases} onChange={(event) => setMenuForm((current) => ({ ...current, aliases: event.target.value }))} placeholder="Aliases, comma separated" />
              <button type="submit">Add Item</button>
            </form>
            <div className="menu-list">
              {menuItems.map((item) => (
                <article className="menu-row" key={item.id}>
                  <div>
                    <strong>{item.name}</strong>
                    <span>Rs {item.basePrice.toFixed(2)} {item.aliases.length ? `- ${item.aliases.join(", ")}` : ""}</span>
                  </div>
                  <button type="button" onClick={() => toggleMenuItem(item)} className={item.isAvailable ? "" : "muted"}>
                    {item.isAvailable ? "Available" : "Hidden"}
                  </button>
                </article>
              ))}
              {menuItems.length === 0 && <div className="empty-column">No menu items yet</div>}
            </div>
          </section>

          <section className="setup-card">
            <h2>WhatsApp Connection</h2>
            <p>Connect restaurant WhatsApp using Web.js QR. After scan, dashboard starts automatically and incoming customer messages go to the bot queue.</p>
            {whatsAppStatus?.qrCodeDataUrl ? (
              <img src={whatsAppStatus.qrCodeDataUrl} alt="WhatsApp connection QR code" className="qr-code" />
            ) : (
              <div className="qr-placeholder">
                {whatsAppStatus?.qrCode ? "QR data received. Install qrcode package to render image." : "Click Connect WhatsApp to show QR."}
              </div>
            )}
            {whatsAppStatus?.lastError && <p className="provider-error">{whatsAppStatus.lastError}</p>}
          </section>
        </section>
      )}

      {isWhatsAppConnected && totalDelayed > 0 && (
        <section className="urgent-banner">{totalDelayed} delayed order{totalDelayed === 1 ? "" : "s"} need attention.</section>
      )}

      {isWhatsAppConnected && (
        <section className="orders-board" aria-label="Live active orders board">
          {STATUS_COLUMNS.map((column) => {
            const columnOrders = visibleOrders.filter((order) => order.status === column.status);
            return (
              <section className="order-column" key={column.status} aria-label={`${column.title} orders`}>
                <header className="column-header">
                  <h2>{column.title}</h2>
                  <strong>{columnOrders.length}</strong>
                </header>

                <div className="column-stack">
                  {columnOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      now={now}
                      isNew={newOrderIds.has(order.id)}
                      isBusy={busyOrderIds.has(order.id)}
                      primaryAction={column.action}
                      nextStatus={column.next}
                      onTransition={transitionOrder}
                      onPrint={printOrder}
                    />
                  ))}

                  {columnOrders.length === 0 && <div className="empty-column">No orders</div>}
                </div>
              </section>
            );
          })}
        </section>
      )}
    </main>
  );
}

function OrderCard(props: {
  order: Order;
  now: number;
  isNew: boolean;
  isBusy: boolean;
  primaryAction?: string;
  nextStatus?: OrderStatus;
  onTransition: (order: Order, nextStatus: OrderStatus) => void;
  onPrint: (order: Order) => void;
}) {
  const { order, now, isNew, isBusy, primaryAction, nextStatus, onTransition, onPrint } = props;
  const snapshot = order.receiptSnapshot;
  const delayed = isDelayed(order, now);
  const pickupCode = getPickupCode(order);
  const elapsed = formatElapsed(now - new Date(order.createdAt).getTime());
  const items = snapshot?.items || [];

  return (
    <article className={`order-card status-${order.status} ${isNew ? "is-new" : ""} ${delayed ? "is-delayed" : ""}`}>
      <header className="card-topline">
        <div>
          <span className="pickup-label">Pickup</span>
          <strong className="pickup-code">{pickupCode}</strong>
        </div>
        <div className="order-meta">
          <strong>{order.humanReadableId}</strong>
          <span>{elapsed}</span>
        </div>
      </header>

      <section className="card-status-row">
        <span className="payment-chip">{order.status === "paid" ? "Paid" : order.status}</span>
        {delayed && <strong className="delay-chip">Delayed</strong>}
        {isNew && <strong className="new-chip">New</strong>}
      </section>

      <section className="item-list" aria-label={`Items for ${order.humanReadableId}`}>
        {items.map((item, index) => (
          <div className="item-line" key={`${item.name}-${index}`}>
            <strong>{item.quantity}x</strong>
            <span>
              {item.name}
              {item.variantName ? <em>{item.variantName}</em> : null}
              {item.notes ? <small>{item.notes}</small> : null}
              {item.customizations?.length ? <small>{item.customizations.join(", ")}</small> : null}
            </span>
          </div>
        ))}
        {items.length === 0 && <p className="missing-items">Receipt snapshot missing item details.</p>}
      </section>

      <footer className="card-actions">
        {nextStatus && primaryAction ? (
          <button type="button" disabled={isBusy} onClick={() => onTransition(order, nextStatus)} className="primary-action">
            {isBusy ? "Working" : primaryAction}
          </button>
        ) : null}
        <button type="button" disabled={isBusy} onClick={() => onPrint(order)} className="secondary-action">
          Print
        </button>
        <button type="button" disabled={isBusy} onClick={() => onTransition(order, "cancelled")} className="danger-action">
          Cancel
        </button>
      </footer>
    </article>
  );
}

function isDelayed(order: Order, now: number): boolean {
  const limit = DELAY_LIMITS_MS[order.status] || 15 * 60 * 1000;
  return now - new Date(order.createdAt).getTime() > limit;
}

function getPickupCode(order: Order): string {
  const source = order.receiptSnapshot?.humanReadableId || order.humanReadableId;
  return source.split("-")[1] || source.slice(-4).toUpperCase();
}

function formatElapsed(ms: number): string {
  const safeMs = Math.max(0, ms);
  const minutes = Math.floor(safeMs / 60000);
  const seconds = Math.floor((safeMs % 60000) / 1000);
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  }
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

async function readApiError(response: Response, fallback: string): Promise<string> {
  try {
    const payload = await response.json();
    return payload?.error?.message || fallback;
  } catch {
    return fallback;
  }
}

function toFriendlyNetworkError(error: unknown, fallback: string): string {
  if (error instanceof TypeError && error.message.toLowerCase().includes("fetch")) {
    return fallback;
  }

  return error instanceof Error ? error.message : fallback;
}
