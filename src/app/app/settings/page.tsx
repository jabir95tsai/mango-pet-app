"use client";

import { useTranslations } from "next-intl";
import { Globe } from "lucide-react";
import { RouteHeader } from "@/components/nav/route-header";
import { LanguageSwitcher } from "@/components/nav/language-switcher";
import { PushToggle } from "@/components/settings/push-toggle";
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
        <section className="rounded-2xl border border-amber-200/60 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950 flex flex-col gap-4">
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
              className="self-start h-10 px-4 rounded-full bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-700"
            >
              {tAuth("signOut")}
            </button>
          )}
        </section>

        <section className="rounded-2xl border border-amber-200/60 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <PushToggle />
        </section>

        <section className="rounded-2xl border border-amber-200/60 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Globe className="size-5 text-amber-500" />
            <p className="font-medium">Language / 語言</p>
          </div>
          <LanguageSwitcher />
        </section>
      </div>
    </>
  );
}
