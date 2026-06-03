import type { ReactNode } from "react";
import { AppProviders } from "@/components/auth/app-providers";
import { GuestUpgradeNudge } from "@/components/auth/guest-upgrade-nudge";
import { AchievementCelebrationProvider } from "@/components/achievements/celebration-provider";
import { AppNav } from "@/components/nav/app-nav";
import { NavDrawerProvider } from "@/components/nav/nav-drawer-context";
import { RequireAuth } from "@/components/auth/require-auth";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppProviders>
      <RequireAuth>
        <NavDrawerProvider>
          <div className="flex min-h-dvh flex-1 flex-col md:flex-row">
            <AppNav />
            <main className="flex-1 overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+4.75rem)] md:pb-0">
              <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
                <GuestUpgradeNudge />
                {children}
              </div>
            </main>
          </div>
        </NavDrawerProvider>
        {/* App-layer unlock celebration overlay (spec §H) — pops on a new
            grant (post-walk / app open) or a push `?unlocked=` deep-link,
            independent of the current page. */}
        <AchievementCelebrationProvider />
      </RequireAuth>
    </AppProviders>
  );
}
