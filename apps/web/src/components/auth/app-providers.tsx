"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/components/auth/auth-provider";
import { GuestUpgradeProvider } from "@/components/auth/guest-upgrade";
import { FamilyProvider } from "@/components/family/family-provider";
import { ConfirmProvider } from "@/components/ui/confirm-provider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <FamilyProvider>
        <ConfirmProvider>
          <GuestUpgradeProvider>{children}</GuestUpgradeProvider>
        </ConfirmProvider>
      </FamilyProvider>
    </AuthProvider>
  );
}
