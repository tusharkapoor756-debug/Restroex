// apps/dashboard/src/app/order/[restaurantSlug]/layout.tsx
// Lightweight layout — NO DashboardShell, NO admin auth, NO sidebar.
// The ordering platform is a public customer-facing experience.

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Order Online",
  description: "Order directly from our restaurant",
};

export default function OrderingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="ordering-platform">
      {children}
    </div>
  );
}
