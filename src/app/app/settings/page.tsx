"use client";

import { useTranslations } from "next-intl";
import { Globe } from "lucide-react";
import { RouteHeader } from "@/components/nav/route-header";
import { LanguageSwitcher } from "@/components/nav/language-switcher";
import { PushToggle } from "@/components/settings/push-toggle";
import { FamilySection } from "@/components/family/family-section";
import { useAuth } from "@/components/auth/auth-provider";
import { Avatar } from "@/components/ui/avatar";
import { signOutCurrent } from "@/lib/firebase/auth";

export default function SettingsPage() {
  const t = useTranslations("Nav");
  const tAuth = useTranslations("Auth");
  const { user } = useAuth();

  return (
    <>
      <RouteHeader title={t("settings")} />

      <div className="flex flex-col gap-4">
        <section className="flex flex-col gap-4 rounded-lg border border-zinc-200/80 bg-white p-6 shadow-sm shadow-zinc-200/40 dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-none">
          <div className="flex items-center gap-3">
            <Avatar
              src={user?.photoURL}
              name={user?.displayName ?? "Guest"}
              size={48}
            />
            <div>
              <p className="font-medium">{user?.displayName ?? "Guest"}</p>
              <p className="text-sm text-zinc-500">{user?.email ?? "—"}</p>
            </div>
          </div>
          {user && (
            <button
              type="button"
              onClick={() => signOutCurrent()}
              className="h-10 self-start rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {tAuth("signOut")}
            </button>
          )}
        </section>

        <section className="rounded-lg border border-zinc-200/80 bg-white p-6 shadow-sm shadow-zinc-200/40 dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-none">
          <FamilySection />
        </section>

        <section className="rounded-lg border border-zinc-200/80 bg-white p-6 shadow-sm shadow-zinc-200/40 dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-none">
          <PushToggle />
        </section>

        <section className="flex flex-col gap-3 rounded-lg border border-zinc-200/80 bg-white p-6 shadow-sm shadow-zinc-200/40 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-none">
          <div className="flex items-center gap-3">
            <Globe className="size-5 text-emerald-700 dark:text-emerald-300" />
            <p className="font-medium">Language / 語言</p>
          </div>
          <LanguageSwitcher />
        </section>
      </div>
    </>
  );
}
