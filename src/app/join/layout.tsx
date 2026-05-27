import type { ReactNode } from "react";
import { AppProviders } from "@/components/auth/app-providers";

export default function JoinLayout({ children }: { children: ReactNode }) {
  return <AppProviders>{children}</AppProviders>;
}
