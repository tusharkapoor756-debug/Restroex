"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";

export type SetupRestaurant = {
  id: string;
  name: string;
  phoneNumber: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
};

export type RestaurantSetupResponse = {
  restaurant: SetupRestaurant;
  currentStep: 1 | 2 | 3;
  isComplete: boolean;
};

type SetupForm = {
  name: string;
  phoneNumber: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
};

type Props = {
  apiBaseUrl: string;
  token: string;
  setup: RestaurantSetupResponse;
  onSaved: (setup: RestaurantSetupResponse) => void;
  onComplete: (setup: RestaurantSetupResponse) => void;
  onLogout: () => void;
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
};

export function RestaurantSetupWizard(props: Props) {
  const { apiBaseUrl, token, setup, onSaved, onComplete, onLogout } = props;
  const [step, setStep] = useState<1 | 2 | 3>(setup.currentStep);
  const [form, setForm] = useState<SetupForm>(() => toForm(setup.restaurant));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setStep(setup.currentStep);
    setForm(toForm(setup.restaurant));
  }, [setup]);

  const saveStep = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      const payload = step === 1
        ? pick(form, ["name", "phoneNumber", "email"])
        : step === 2
          ? pick(form, ["address", "city", "state", "pincode"])
          : form;

      const endpoint = step === 3 ? "setup/complete" : "setup";
      const method = step === 3 ? "POST" : "PATCH";
      const response = await fetch(`${apiBaseUrl}/restaurants/${endpoint}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Unable to save restaurant setup"));
      }

      const data = ((await response.json()) as ApiResponse<RestaurantSetupResponse>).data;
      onSaved(data);

      if (step === 3) {
        onComplete(data);
        return;
      }

      setStep((current) => (current === 1 ? 2 : 3));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save restaurant setup");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="ops-shell wizard-shell">
      <section className="wizard-panel">
        <header className="wizard-header">
          <div>
            <span className="system-label">Restroex Setup</span>
            <h1>Restaurant Setup</h1>
            <p>Complete basic restaurant details before opening the live dashboard.</p>
          </div>
          <button type="button" onClick={onLogout}>Logout</button>
        </header>

        <ol className="wizard-steps" aria-label="Setup progress">
          {[1, 2, 3].map((item) => (
            <li key={item} className={item === step ? "active" : item < step ? "done" : ""}>
              Step {item}
            </li>
          ))}
        </ol>

        <form className="wizard-form" onSubmit={saveStep}>
          {step === 1 && (
            <section className="wizard-fields">
              <label>
                <span>Restaurant Name</span>
                <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
              </label>
              <label>
                <span>Phone</span>
                <input value={form.phoneNumber} onChange={(event) => setForm((current) => ({ ...current, phoneNumber: event.target.value }))} />
              </label>
              <label>
                <span>Email</span>
                <input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
              </label>
            </section>
          )}

          {step === 2 && (
            <section className="wizard-fields">
              <label className="wide">
                <span>Address</span>
                <textarea value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} />
              </label>
              <label>
                <span>City</span>
                <input value={form.city} onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))} />
              </label>
              <label>
                <span>State</span>
                <input value={form.state} onChange={(event) => setForm((current) => ({ ...current, state: event.target.value }))} />
              </label>
              <label>
                <span>Pincode</span>
                <input inputMode="numeric" value={form.pincode} onChange={(event) => setForm((current) => ({ ...current, pincode: event.target.value }))} />
              </label>
            </section>
          )}

          {step === 3 && (
            <section className="review-grid">
              <ReviewItem label="Restaurant Name" value={form.name} />
              <ReviewItem label="Phone" value={form.phoneNumber} />
              <ReviewItem label="Email" value={form.email} />
              <ReviewItem label="Address" value={form.address} />
              <ReviewItem label="City" value={form.city} />
              <ReviewItem label="State" value={form.state} />
              <ReviewItem label="Pincode" value={form.pincode} />
            </section>
          )}

          {error && <section className="danger-banner">{error}</section>}

          <footer className="wizard-actions">
            {step > 1 && (
              <button type="button" className="secondary-action" onClick={() => setStep((current) => (current === 3 ? 2 : 1))} disabled={isSaving}>
                Back
              </button>
            )}
            <button type="submit" disabled={isSaving}>
              {isSaving ? "Saving" : step === 3 ? "Complete Setup" : "Save & Continue"}
            </button>
          </footer>
        </form>
      </section>
    </main>
  );
}

function ReviewItem(props: { label: string; value: string }) {
  return (
    <article>
      <span>{props.label}</span>
      <strong>{props.value || "Missing"}</strong>
    </article>
  );
}

function toForm(restaurant: SetupRestaurant): SetupForm {
  return {
    name: restaurant.name || "",
    phoneNumber: restaurant.phoneNumber || "",
    email: restaurant.email || "",
    address: restaurant.address || "",
    city: restaurant.city || "",
    state: restaurant.state || "",
    pincode: restaurant.pincode || "",
  };
}

function pick<T extends Record<string, string>, K extends keyof T>(source: T, keys: K[]): Pick<T, K> {
  return keys.reduce((target, key) => {
    target[key] = source[key];
    return target;
  }, {} as Pick<T, K>);
}

async function readApiError(response: Response, fallback: string): Promise<string> {
  try {
    const payload = await response.json();
    return payload?.error?.message || fallback;
  } catch {
    return fallback;
  }
}
