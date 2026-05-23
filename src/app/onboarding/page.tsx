"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowRight, PawPrint, UserPlus, Users } from "lucide-react";
import { RequireAuth } from "@/components/auth/require-auth";
import { useFamily } from "@/components/family/family-provider";
import { Button } from "@/components/ui/button";
import {
  CreateFamilyDialog,
  JoinFamilyDialog,
} from "@/components/family/family-section";

/** /onboarding — sits between sign-in and the main app for users who
 *  don't have a family yet. Three exits:
 *    1. Create a family → opens the same dialog used in settings, then
 *       refreshes the family provider and bounces to /app.
 *    2. Join a family   → same pattern, JoinFamilyDialog.
 *    3. Skip            → goes straight to /app in personal mode.
 *  Users with an existing family that lands here get auto-bounced to /app
 *  (the page is meant for the no-family case). */
export default function OnboardingPage() {
  return (
    <RequireAuth>
      <OnboardingInner />
    </RequireAuth>
  );
}

function OnboardingInner() {
  const t = useTranslations("Onboarding");
  const router = useRouter();
  const { family, refresh } = useFamily();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  async function handleAfterChoice() {
    // After a successful create/join, refresh family-provider so the
    // next page sees the new state, then go to the home tab.
    await refresh();
    router.replace("/app");
  }

  // If the user already has a family, this page isn't relevant — send
  // them to the main app immediately. We render a tiny fallback rather
  // than redirect-in-useEffect to keep the page deterministic for SEO.
  if (family) {
    return (
      <div className="mx-auto max-w-md p-6 text-center text-sm text-zinc-500">
        <p>{t("alreadyInFamily")}</p>
        <Link
          href="/app"
          className="mt-4 inline-flex items-center gap-1 text-amber-700 hover:underline dark:text-amber-300"
        >
          {t("goToApp")} <ArrowRight className="size-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 p-6">
      <header className="text-center">
        <div className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
          <PawPrint className="size-7" />
        </div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {t("subtitle")}
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <OptionCard
          icon={<Users className="size-5" />}
          title={t("createTitle")}
          description={t("createDescription")}
          actionLabel={t("createAction")}
          onClick={() => setShowCreate(true)}
        />
        <OptionCard
          icon={<UserPlus className="size-5" />}
          title={t("joinTitle")}
          description={t("joinDescription")}
          actionLabel={t("joinAction")}
          onClick={() => setShowJoin(true)}
        />
        <button
          type="button"
          onClick={() => router.replace("/app")}
          className="mt-2 self-center text-sm text-zinc-500 underline-offset-2 hover:text-zinc-700 hover:underline dark:hover:text-zinc-300"
        >
          {t("skipAction")}
        </button>
      </div>

      <p className="text-center text-xs text-zinc-400">
        {t("footerHint")}
      </p>

      <CreateFamilyDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={handleAfterChoice}
      />
      <JoinFamilyDialog
        open={showJoin}
        onClose={() => setShowJoin(false)}
        onJoined={handleAfterChoice}
      />
    </div>
  );
}

function OptionCard({
  icon,
  title,
  description,
  actionLabel,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  onClick: () => void;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-zinc-200/80 bg-white p-4 shadow-sm shadow-zinc-200/40 dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-none sm:flex-row sm:items-center sm:gap-4">
      <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-zinc-500 mt-0.5">{description}</p>
      </div>
      <Button size="sm" onClick={onClick} className="sm:w-auto">
        {actionLabel}
      </Button>
    </section>
  );
}
