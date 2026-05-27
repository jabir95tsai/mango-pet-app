import type { ReactNode } from "react";
import { AppProviders } from "@/components/auth/app-providers";

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return <AppProviders>{children}</AppProviders>;
}
