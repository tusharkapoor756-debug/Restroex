// src/app/dashboard/layout.tsx
"use client";

import { ReactNode } from "react";
import DashboardShell from "../../components/layout/DashboardShell";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardShell>
      {children}
    </DashboardShell>
  );
}

