// src/app/onboarding/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Clock,
  MessageSquare,
  FileText,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Upload,
  Loader2,
  Smartphone,
  Check,
  Globe,
  AlertCircle
} from "lucide-react";
import { RestaurantService } from "../../lib/services/restaurant.service";
import { getToken, clearSession } from "../../lib/auth";

type Step = "welcome" | "info" | "profile" | "whatsapp" | "menu" | "finish";

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>("welcome");

  // Session check loading state — shows spinner while we query the DB
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  // Step states
  const [restaurantName, setRestaurantName] = useState("");
  const [cuisineType, setCuisineType] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [tableCount, setTableCount] = useState("10");
  const [hoursOpen, setHoursOpen] = useState("09:00");
  const [hoursClose, setHoursClose] = useState("22:00");

  // WhatsApp States
  const [waConnected, setWaConnected] = useState(false);
  const [waConnecting, setWaConnecting] = useState(false);

  // Menu Import States
  const [importMethod, setImportMethod] = useState<"upload" | "link" | "manual" | null>(null);
  const [menuFile, setMenuFile] = useState<File | null>(null);
  const [menuFileName, setMenuFileName] = useState("");
  const [isUploadingMenu, setIsUploadingMenu] = useState(false);
  const [menuUploaded, setMenuUploaded] = useState(false);

  // Global form errors/validation
  const [error, setError] = useState<string | null>(null);

  /**
   * On mount: query the backend for the existing restaurant linked to the
   * current session token.  Source of truth is the database — not localStorage.
   *
   * Outcomes:
   *  - No token → unauthenticated, stay on welcome step
   *  - Token + isComplete=true → restaurant fully configured, go to dashboard
   *  - Token + isComplete=false → populate form from DB data, resume at the right step
   */
  useEffect(() => {
    const token = getToken();

    if (!token) {
      // Not logged in — show onboarding from scratch
      setIsCheckingSession(false);
      return;
    }

    (async () => {
      try {
        const setupRes = await RestaurantService.getSetup();
        const { restaurant, isComplete, currentStep: dbStep } = setupRes;

        if (isComplete) {
          // Restaurant fully configured — skip onboarding entirely
          router.replace("/dashboard");
          return;
        }

        // Populate form state from existing DB data
        if (restaurant) {
          if (restaurant.name) setRestaurantName(restaurant.name);
          if (restaurant.phoneNumber) setPhone(restaurant.phoneNumber);
          if (restaurant.address) setAddress(restaurant.address);
          if (restaurant.city) setCity(restaurant.city);
          if (restaurant.state) setState(restaurant.state);
          if (restaurant.pincode) setPincode(restaurant.pincode);
          
          // Map backend currentStep (1|2|3) to the matching onboarding step
          if (dbStep === 1) setCurrentStep("info");
          else if (dbStep === 2) setCurrentStep("profile");
          else if (dbStep === 3) setCurrentStep("whatsapp");
        }
      } catch {
        // Network error or token invalid
        clearSession();
        router.replace("/login");
      } finally {
        setIsCheckingSession(false);
      }
    })();
  }, [router]);

  // Steps configuration
  const steps: { id: Step; label: string }[] = [
    { id: "welcome", label: "Welcome" },
    { id: "info", label: "General Info" },
    { id: "profile", label: "Profile details" },
    { id: "whatsapp", label: "WhatsApp Link" },
    { id: "menu", label: "Menu Import" },
    { id: "finish", label: "Complete" },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  const handleNext = () => {
    console.log("BUTTON CLICKED");
    console.log("Current Step:", currentStep);
    setError(null);
    if (currentStep === "welcome") {
      setCurrentStep("info");
    } else if (currentStep === "info") {
      if (!restaurantName || !cuisineType || !phone) {
        setError("Please fill in all general information fields.");
        return;
      }
      setCurrentStep("profile");
    } else if (currentStep === "profile") {
      if (!address || !city || !state || !pincode || !hoursOpen || !hoursClose) {
        setError("Please fill in the complete address and operation hours.");
        return;
      }
      setCurrentStep("whatsapp");
    } else if (currentStep === "whatsapp") {
      // Connect WhatsApp is optional but recommended
      setCurrentStep("menu");
    } else if (currentStep === "menu") {
      setCurrentStep("finish");
    }
  };

  const handleBack = () => {
    setError(null);
    if (currentStep === "info") setCurrentStep("welcome");
    else if (currentStep === "profile") setCurrentStep("info");
    else if (currentStep === "whatsapp") setCurrentStep("profile");
    else if (currentStep === "menu") setCurrentStep("whatsapp");
    else if (currentStep === "finish") setCurrentStep("menu");
  };

  // WhatsApp connection simulation
  const handleConnectWhatsApp = () => {
    setWaConnecting(true);
    setTimeout(() => {
      setWaConnecting(false);
      setWaConnected(true);
    }, 2000);
  };

  // File Upload simulation
  const handleMenuUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setMenuFile(file);
      setMenuFileName(file.name);
      setIsUploadingMenu(true);

      setTimeout(() => {
        setIsUploadingMenu(false);
        setMenuUploaded(true);
      }, 2500);
    }
  };

  const handleCompleteSetup = async () => {
    try {
      // The complete setup endpoint needs all these fields
      const updateData = {
        name: restaurantName,
        phoneNumber: phone,
        address,
        city,
        state,
        pincode,
      };

      await RestaurantService.completeSetup(updateData);
    } catch {
      // Best-effort — still redirect to dashboard
    }

    router.push("/dashboard");
  };

  // Show a full-screen spinner while we resolve session state from the DB
  if (isCheckingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Side Progress Bar (Left, Hidden on Mobile) */}
      <div className="hidden md:flex md:w-80 flex-col justify-between p-8 border-r border-[#23242B]/40 bg-slate-900/20 backdrop-blur-xl relative">
        <div className="pointer-events-none absolute -bottom-1/4 right-0 h-96 w-96 rounded-full bg-indigo-600/5 blur-[120px]" />

        <div>
          <div className="flex items-center gap-3 mb-10">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600 text-xs font-bold text-white">R</span>
            <span className="text-md font-bold tracking-tight text-white font-sora">Restroex Setup</span>
          </div>

          <div className="space-y-6">
            {steps.map((step, idx) => {
              const isCompleted = idx < currentStepIndex;
              const isActive = step.id === currentStep;

              return (
                <div key={step.id} className="flex items-center gap-3">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition-all duration-300 ${isCompleted
                      ? "bg-violet-600 border-violet-600 text-white"
                      : isActive
                        ? "border-violet-500 text-violet-400 bg-violet-950/20"
                        : "border-slate-800 text-slate-500"
                      }`}
                  >
                    {isCompleted ? <Check className="h-4.5 w-4.5" /> : idx + 1}
                  </div>
                  <div>
                    <span
                      className={`text-sm font-medium transition-colors duration-300 ${isActive ? "text-slate-100 font-semibold" : isCompleted ? "text-slate-300" : "text-slate-500"
                        }`}
                    >
                      {step.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="text-xs text-slate-600">
          Step {currentStepIndex + 1} of {steps.length}
        </div>
      </div>

      {/* Main Form Work Area */}
      <div className="w-full flex-1 flex flex-col min-h-screen relative p-6 sm:p-12 md:p-16 justify-between">
        <div className="absolute -bottom-1/4 right-0 h-96 w-96 rounded-full bg-indigo-600/5 blur-[120px] pointer-events-none" />

        {/* Top Header for Mobile only */}
        <div className="md:hidden flex items-center justify-between pb-6 border-b border-[#23242B]/30 mb-6">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-violet-600 text-xs font-bold text-white">R</span>
            <span className="text-sm font-bold text-white font-sora">Restroex</span>
          </div>
          <span className="text-xs text-slate-500">
            Step {currentStepIndex + 1} of {steps.length}
          </span>
        </div>

        {/* Step Content Container */}
        <div className="max-w-xl w-full mx-auto my-auto space-y-8">
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-950/40 border border-red-900/60 text-red-200 text-sm">
              <AlertCircle className="h-4.5 w-4.5 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: WELCOME */}
          {currentStep === "welcome" && (
            <div className="space-y-6">
              <div className="space-y-3">
                <span className="text-xs font-bold uppercase tracking-widest text-violet-400">Restroex Platform Onboarding</span>
                <h1 className="text-3xl sm:text-4xl font-bold font-sora text-white tracking-tight leading-tight">
                  Let's launch your digital restaurant hub.
                </h1>
                <p className="text-slate-400 text-base leading-relaxed">
                  In a few quick steps, we will connect your restaurant details, sync a test WhatsApp customer ordering channel, and prepare your kitchen queue dashboard.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                <div className="p-4 rounded-xl bg-slate-900/30 border border-[#23242B] hover:border-slate-800 transition-all">
                  <Building2 className="h-6 w-6 text-violet-400 mb-2" />
                  <h3 className="text-sm font-semibold text-slate-200">1. Setup Profile</h3>
                  <p className="text-xs text-slate-500 mt-1">Specify layout, working hours, and cuisine.</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-900/30 border border-[#23242B] hover:border-slate-800 transition-all">
                  <MessageSquare className="h-6 w-6 text-violet-400 mb-2" />
                  <h3 className="text-sm font-semibold text-slate-200">2. WhatsApp Bot</h3>
                  <p className="text-xs text-slate-500 mt-1">Connect your WhatsApp number for auto-ordering.</p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: RESTAURANT INFORMATION */}
          {currentStep === "info" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold font-sora text-white">General Information</h2>
                <p className="text-sm text-slate-400">Tell us the core operations information of your restaurant</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="rname" className="text-xs font-semibold uppercase tracking-wider text-slate-400">Restaurant Name</label>
                  <input
                    id="rname"
                    type="text"
                    placeholder="e.g. Bella Italia Bistro"
                    value={restaurantName}
                    onChange={(e) => setRestaurantName(e.target.value)}
                    className="w-full bg-slate-950 border border-[#23242B] hover:border-slate-800 focus:border-violet-500 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="cuisine" className="text-xs font-semibold uppercase tracking-wider text-slate-400">Cuisine Type</label>
                    <select
                      id="cuisine"
                      value={cuisineType}
                      onChange={(e) => setCuisineType(e.target.value)}
                      className="w-full bg-slate-950 border border-[#23242B] hover:border-slate-800 focus:border-violet-500 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all"
                    >
                      <option value="">Select Cuisine...</option>
                      <option value="italian">Italian</option>
                      <option value="indian">Indian</option>
                      <option value="asian">Asian / Pan-Asian</option>
                      <option value="american">Burgers / American</option>
                      <option value="mexican">Mexican</option>
                      <option value="cafe">Cafe / Bakery</option>
                      <option value="multi">Multi-Cuisine</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="phone" className="text-xs font-semibold uppercase tracking-wider text-slate-400">Restaurant Phone</label>
                    <input
                      id="phone"
                      type="tel"
                      placeholder="+1 (555) 000-0000"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-slate-950 border border-[#23242B] hover:border-slate-800 focus:border-violet-500 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: RESTAURANT PROFILE DETAILS */}
          {currentStep === "profile" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold font-sora text-white">Restaurant Profile</h2>
                <p className="text-sm text-slate-400">Specify operational hours, location address, and capacity.</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="address" className="text-xs font-semibold uppercase tracking-wider text-slate-400">Physical Address</label>
                  <input
                    id="address"
                    type="text"
                    placeholder="123 Culinary Boulevard, Suite A"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full bg-slate-950 border border-[#23242B] hover:border-slate-800 focus:border-violet-500 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="city" className="text-xs font-semibold uppercase tracking-wider text-slate-400">City</label>
                    <input
                      id="city"
                      type="text"
                      placeholder="e.g. Mumbai"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full bg-slate-950 border border-[#23242B] hover:border-slate-800 focus:border-violet-500 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="state" className="text-xs font-semibold uppercase tracking-wider text-slate-400">State</label>
                    <input
                      id="state"
                      type="text"
                      placeholder="e.g. Maharashtra"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="w-full bg-slate-950 border border-[#23242B] hover:border-slate-800 focus:border-violet-500 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="pincode" className="text-xs font-semibold uppercase tracking-wider text-slate-400">Pincode</label>
                    <input
                      id="pincode"
                      type="text"
                      placeholder="e.g. 400001"
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value)}
                      className="w-full bg-slate-950 border border-[#23242B] hover:border-slate-800 focus:border-violet-500 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="tables" className="text-xs font-semibold uppercase tracking-wider text-slate-400">Table Count</label>
                    <input
                      id="tables"
                      type="number"
                      min="1"
                      value={tableCount}
                      onChange={(e) => setTableCount(e.target.value)}
                      className="w-full bg-slate-950 border border-[#23242B] hover:border-slate-800 focus:border-violet-500 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="hoursOpen" className="text-xs font-semibold uppercase tracking-wider text-slate-400">Opening Time</label>
                    <input
                      id="hoursOpen"
                      type="time"
                      value={hoursOpen}
                      onChange={(e) => setHoursOpen(e.target.value)}
                      className="w-full bg-slate-950 border border-[#23242B] hover:border-slate-800 focus:border-violet-500 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="hoursClose" className="text-xs font-semibold uppercase tracking-wider text-slate-400">Closing Time</label>
                    <input
                      id="hoursClose"
                      type="time"
                      value={hoursClose}
                      onChange={(e) => setHoursClose(e.target.value)}
                      className="w-full bg-slate-950 border border-[#23242B] hover:border-slate-800 focus:border-violet-500 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: WHATSAPP CONNECTION */}
          {currentStep === "whatsapp" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold font-sora text-white">WhatsApp Integration</h2>
                <p className="text-sm text-slate-400">Link your WhatsApp number to let customers browse and order via chat.</p>
              </div>

              {waConnected ? (
                <div className="p-6 rounded-2xl bg-emerald-950/20 border border-emerald-800/80 text-center space-y-4">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-950 border border-emerald-800 text-emerald-400">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">WhatsApp Bot Connected</h3>
                    <p className="text-xs text-slate-400 mt-1">Your line is active. Restroex bot will listen and handle messages.</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-6 p-6 rounded-2xl bg-slate-900/30 border border-[#23242B]">
                  {/* Mock QR Code */}
                  <div className="w-36 h-36 bg-white p-2 rounded-xl shrink-0 flex items-center justify-center relative shadow-[0_0_20px_rgba(255,255,255,0.05)]">
                    {/* Fake QR pattern */}
                    <div className="w-full h-full bg-slate-100 rounded flex flex-col gap-2 p-1 justify-around border border-slate-200">
                      <div className="flex justify-between">
                        <div className="w-8 h-8 bg-slate-900 rounded" />
                        <div className="w-8 h-8 bg-slate-900 rounded" />
                      </div>
                      <div className="w-full h-8 bg-slate-400 rounded-sm" />
                      <div className="flex justify-between">
                        <div className="w-8 h-8 bg-slate-900 rounded" />
                        <div className="w-4 h-4 bg-slate-800 rounded self-end" />
                      </div>
                    </div>
                    {waConnecting && (
                      <div className="absolute inset-0 bg-slate-950/80 rounded-xl flex flex-col items-center justify-center text-center p-2 text-white">
                        <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
                        <span className="text-[10px] mt-2">Linking account...</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 text-center sm:text-left">
                    <h3 className="text-sm font-bold text-white">Scan QR to connect</h3>
                    <ol className="text-xs text-slate-400 space-y-1.5 list-decimal pl-4">
                      <li>Open WhatsApp on your phone</li>
                      <li>Tap Menu or Settings and select Linked Devices</li>
                      <li>Point your phone to this screen to link Restroex bot</li>
                    </ol>

                    {!waConnecting && (
                      <button
                        type="button"
                        onClick={handleConnectWhatsApp}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white px-3.5 py-1.5 text-xs font-semibold tracking-wide transition-all shadow-[0_0_10px_rgba(124,58,237,0.1)] active:scale-[0.98]"
                      >
                        Simulate Link Scan
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 5: MENU IMPORT */}
          {currentStep === "menu" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold font-sora text-white">Import Menu</h2>
                <p className="text-sm text-slate-400">Add dishes, prices, and descriptions to Restroex.</p>
              </div>

              {!importMethod ? (
                <div className="space-y-3">
                  <button
                    onClick={() => setImportMethod("upload")}
                    className="w-full flex items-center justify-between p-4 rounded-xl bg-slate-900/30 border border-[#23242B] hover:border-slate-800 text-left transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-violet-950 text-violet-400">
                        <Upload className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-200">Upload PDF / Image</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Let Restroex AI parse your existing physical menu</p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-600 group-hover:text-slate-400 transition-colors" />
                  </button>

                  <button
                    onClick={() => setImportMethod("link")}
                    className="w-full flex items-center justify-between p-4 rounded-xl bg-slate-900/30 border border-[#23242B] hover:border-slate-800 text-left transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-violet-950 text-violet-400">
                        <Globe className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-200">Import from aggregator</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Sync categories & prices from Zomato / Swiggy link</p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-600 group-hover:text-slate-400 transition-colors" />
                  </button>

                  <button
                    onClick={() => {
                      setImportMethod("manual");
                      setMenuUploaded(true); // Treat as configure complete
                    }}
                    className="w-full flex items-center justify-between p-4 rounded-xl bg-slate-900/30 border border-[#23242B] hover:border-slate-800 text-left transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-slate-950 text-slate-400">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-200">Configure manually</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Input categories, dishes, and variants directly</p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-600 group-hover:text-slate-400 transition-colors" />
                  </button>
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-slate-900/20 border border-[#23242B] space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white capitalize">Method: {importMethod}</h3>
                    <button
                      onClick={() => {
                        setImportMethod(null);
                        setMenuUploaded(false);
                        setMenuFile(null);
                      }}
                      className="text-xs font-semibold text-violet-400 hover:text-violet-300"
                    >
                      Change Method
                    </button>
                  </div>

                  {importMethod === "upload" && (
                    <div className="space-y-4">
                      {menuUploaded ? (
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-950/20 border border-emerald-900/40 text-emerald-200 text-sm">
                          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                          <span>File parsed successfully! {menuFileName}</span>
                        </div>
                      ) : (
                        <div className="border border-dashed border-slate-800 rounded-xl p-8 text-center space-y-3 relative hover:border-slate-700 transition-colors">
                          <input
                            type="file"
                            accept=".pdf,.png,.jpg,.jpeg"
                            onChange={handleMenuUpload}
                            disabled={isUploadingMenu}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                          {isUploadingMenu ? (
                            <div className="space-y-2">
                              <Loader2 className="h-8 w-8 animate-spin text-violet-500 mx-auto" />
                              <p className="text-xs text-slate-400">AI parsing menu layouts...</p>
                            </div>
                          ) : (
                            <>
                              <Upload className="h-8 w-8 text-slate-600 mx-auto" />
                              <p className="text-sm text-slate-300">Drag & drop your PDF menu or click to browse</p>
                              <p className="text-xs text-slate-600">Supports PDF, PNG, JPG up to 10MB</p>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {importMethod === "link" && (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-400">Enter a public web page url or delivery aggregator restaurant page link:</p>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          placeholder="https://www.swiggy.com/restaurants/..."
                          disabled={menuUploaded || isUploadingMenu}
                          className="flex-1 bg-slate-950 border border-[#23242B] rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-violet-500"
                        />
                        <button
                          onClick={() => {
                            setIsUploadingMenu(true);
                            setTimeout(() => {
                              setIsUploadingMenu(false);
                              setMenuUploaded(true);
                            }, 2000);
                          }}
                          disabled={menuUploaded || isUploadingMenu}
                          className="rounded-xl bg-violet-600 hover:bg-violet-500 text-white px-4 text-xs font-semibold shrink-0"
                        >
                          {isUploadingMenu ? "Syncing..." : "Sync"}
                        </button>
                      </div>
                      {menuUploaded && (
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-950/20 border border-emerald-900/40 text-emerald-200 text-sm">
                          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                          <span>Aggregator items synced successfully!</span>
                        </div>
                      )}
                    </div>
                  )}

                  {importMethod === "manual" && (
                    <div className="p-4 rounded-xl bg-slate-950 border border-[#23242B] text-center text-xs text-slate-400 leading-normal">
                      We'll initialize an empty custom menu catalog. You can easily add items, modifiers, categories, and availability on the <strong>Menu page</strong> once setup is finished.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 6: FINISH SETUP */}
          {currentStep === "finish" && (
            <div className="space-y-6">
              <div className="space-y-3 text-center sm:text-left">
                <div className="mx-auto sm:mx-0 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-950 border border-violet-800 text-violet-400 shadow-[0_0_30px_rgba(124,58,237,0.2)]">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold font-sora text-white">Your platform is ready!</h2>
                <p className="text-sm text-slate-400 leading-relaxed">
                  We've successfully verified and structured your initial configurations. You're ready to enter the Restroex workspace.
                </p>
              </div>

              <div className="rounded-xl border border-[#23242B] bg-slate-900/10 p-5 space-y-3.5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Workspace Summary</h4>
                <div className="grid grid-cols-2 gap-y-2.5 gap-x-4 text-xs">
                  <div>
                    <span className="text-slate-500 block">Restaurant Name</span>
                    <span className="text-slate-300 font-medium">{restaurantName || "Bella Italia"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Cuisine & Tables</span>
                    <span className="text-slate-300 font-medium capitalize">{cuisineType || "Italian"} • {tableCount} Tables</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">WhatsApp Link Status</span>
                    <span className={`font-semibold ${waConnected ? "text-emerald-400" : "text-amber-500"}`}>
                      {waConnected ? "Active / Linked" : "Not Linked (Setup Later)"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Menu Setup</span>
                    <span className="text-slate-300 font-medium">
                      {menuUploaded ? "Imported / Complete" : "Configure Later"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Action Buttons (Bottom) */}
        <div className="max-w-xl w-full mx-auto flex items-center justify-between border-t border-[#23242B]/40 pt-6 mt-8">
          {currentStep !== "welcome" && currentStep !== "finish" ? (
            <button
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-white transition-colors"
            >
              <ChevronLeft className="h-4.5 w-4.5" />
              Back
            </button>
          ) : (
            <div />
          )}

          {currentStep === "finish" ? (
            <button
              onClick={handleCompleteSetup}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white px-6 py-3 text-sm font-semibold tracking-wide transition-all shadow-[0_0_20px_rgba(124,58,237,0.2)] active:scale-[0.98]"
            >
              Launch Dashboard
              <ChevronRight className="h-4.5 w-4.5" />
            </button>
          ) : (
            <button
              onClick={() => {
                console.log("BUTTON CLICKED");
                handleNext();
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white px-5 py-2.5 text-sm font-semibold tracking-wide transition-all active:scale-[0.98]"
            >
              Continue
              <ChevronRight className="h-4.5 w-4.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
