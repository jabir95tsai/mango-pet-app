"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Globe, MoreHorizontal, Trash2 } from "lucide-react";
import { RouteHeader } from "@/components/nav/route-header";
import { LanguageSwitcher } from "@/components/nav/language-switcher";
import { PushToggle } from "@/components/settings/push-toggle";
import { FamilySection } from "@/components/family/family-section";
import { DeleteAccountDialog } from "@/components/settings/delete-account-dialog";
import { useAuth } from "@/components/auth/auth-provider";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { signOutCurrent } from "@/lib/firebase/auth";
import { useNavDrawer } from "@/components/nav/nav-drawer-context";

export default function SettingsPage() {
  const t = useTranslations("Nav");
  const tAuth = useTranslations("Auth");
  const tDz = useTranslations("Settings.dangerZone");
  const { user } = useAuth();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { open: drawerOpen, setOpen: setDrawerOpen } = useNavDrawer();

  return (
    <>
      <RouteHeader
        title={t("settings")}
        action={
          // Mobile-only overflow trigger. Desktop sidebar already lists all
          // 10 nav items, so the drawer is irrelevant there.
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label={t("more")}
            aria-expanded={drawerOpen}
            className="grid size-10 place-items-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 md:hidden dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
          >
            <MoreHorizontal className="size-5" />
          </button>
        }
      />

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
              className="h-10 self-start rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
            <Globe className="size-5 text-amber-700 dark:text-amber-300" />
            <p className="font-medium">Language / 語言</p>
          </div>
          <LanguageSwitcher />
        </section>

        {/* Danger zone — kept visually distinct (red border + warning icon
            + red action button) so a hand-of-god mis-tap looks obviously
            wrong. Sits last in the settings list since it's an end-of-
            relationship action. */}
        {user && (
          <section className="flex flex-col gap-3 rounded-lg border border-red-300/70 bg-red-50/50 p-6 dark:border-red-500/40 dark:bg-red-950/20">
            <div className="flex items-center gap-3">
              <AlertTriangle className="size-5 text-red-600 dark:text-red-400" />
              <p className="font-semibold text-red-700 dark:text-red-300">
                {tDz("title")}
              </p>
            </div>
            <p className="text-sm text-red-900/80 dark:text-red-200/80">
              {tDz("subtitle")}
            </p>
            <Button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="self-start bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500"
            >
              <Trash2 className="size-4" />
              {tDz("deleteAction")}
            </Button>
          </section>
        )}
      </div>

      <DeleteAccountDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
      />
    </>
  );
}
