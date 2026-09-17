"use client";

import { SeasonProvider } from "@/lib/season";
import { AppShell } from "@/components/shell/AppShell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SeasonProvider>
      <AppShell>{children}</AppShell>
    </SeasonProvider>
  );
}
