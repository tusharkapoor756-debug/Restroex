"use client";

// apps/dashboard/src/app/order/[restaurantSlug]/hooks/useBootstrap.ts
// Fetches the single bootstrap payload from the backend.
// No auth token required — this is a public endpoint.

import { useEffect, useState } from "react";
import { BootstrapData } from "../types";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

export function useBootstrap(slug: string) {
  const [data, setData] = useState<BootstrapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetch(`${BACKEND_URL}/api/v1/public/restaurants/${encodeURIComponent(slug)}/bootstrap`)
      .then((res) => {
        if (!res.ok) throw new Error(`Bootstrap failed: ${res.status}`);
        return res.json();
      })
      .then((json) => {
        setData(json.data as BootstrapData);
        setError(null);
      })
      .catch((err) => setError(err.message || "Failed to load restaurant"))
      .finally(() => setLoading(false));
  }, [slug]);

  return { data, loading, error };
}
