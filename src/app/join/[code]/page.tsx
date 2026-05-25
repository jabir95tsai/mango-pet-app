"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertTriangle, Check, Loader2, Users } from "lucide-react";
import { RequireAuth } from "@/components/auth/require-auth";
import { useFamily } from "@/components/family/family-provider";
import { Button } from "@/components/ui/button";
import { joinFamilyByCode } from "@/lib/firebase/families";

/** /join/{6-digit-code} — deep-link landing page that auto-joins the
 *  family bound to the code, then bounces to /app. RequireAuth wraps
 *  the inner logic so an unauthenticated visitor lands on /?next=
 *  /join/{code}, signs in, and gets bounced back here for the auto-
 *  join — same redirect pattern as the rest of the auth gate.
 *
 *  Minimal slice per user-confirmed scope 2026-05-25:
 *    - Reuse the existing inviteCode (6-digit numeric string)
 *    - Reuse joinFamilyByCode callable (handles invalid / already-
 *      member / family-not-found via HttpsError)
 *    - No preview page, no expiry, no QR — see backlog "家庭邀請連結
 *      follow-up" for the polish items deferred to PM. */
export default function JoinFamilyPage() {
  return (
    <RequireAuth>
      <JoinInner />
    </RequireAuth>
  );
}

type Status =
  | { kind: "joining" }
  | { kind: "joined" }
  | { kind: "alreadyMember" }
  | { kind: "invalidCode"; raw: string }
  | { kind: "error"; message: string };

function JoinInner() {
  const t = useTranslations("JoinFamily");
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const { refresh } = useFamily();
  const [status, setStatus] = useState<Status>({ kind: "joining" });

  useEffect(() => {
    const raw = params.code ?? "";
    // Same code-shape check JoinFamilyDialog runs. Keeps a corrupted
    // URL (e.g., copy-paste loses a digit) from hitting the callable
    // and burning a network round-trip on a guaranteed 400.
    if (!/^\d{6}$/.test(raw)) {
      setStatus({ kind: "invalidCode", raw });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await joinFamilyByCode(raw);
        if (cancelled) return;
        if (res.alreadyMember) {
          setStatus({ kind: "alreadyMember" });
          return;
        }
        await refresh();
        setStatus({ kind: "joined" });
        // Auto-bounce on success — give a moment for the toast text
        // to register before navigating away.
        setTimeout(() => {
          if (!cancelled) router.replace("/app");
        }, 1200);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Failed";
        setStatus({ kind: "error", message: msg });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.code, refresh, router]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-6 py-10 text-center">
      <div className="grid size-16 place-items-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
        {status.kind === "joining" ? (
          <Loader2 className="size-8 animate-spin" />
        ) : status.kind === "joined" ? (
          <Check className="size-8" />
        ) : status.kind === "alreadyMember" ? (
          <Users className="size-8" />
        ) : (
          <AlertTriangle className="size-8" />
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">
          {status.kind === "joining" && t("joining")}
          {status.kind === "joined" && t("joinedTitle")}
          {status.kind === "alreadyMember" && t("alreadyMemberTitle")}
          {status.kind === "invalidCode" && t("invalidCodeTitle")}
          {status.kind === "error" && t("errorTitle")}
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {status.kind === "joining" && t("joiningHint")}
          {status.kind === "joined" && t("joinedHint")}
          {status.kind === "alreadyMember" && t("alreadyMemberHint")}
          {status.kind === "invalidCode" &&
            t("invalidCodeHint", { code: status.raw })}
          {status.kind === "error" && status.message}
        </p>
      </div>

      {(status.kind === "alreadyMember" ||
        status.kind === "invalidCode" ||
        status.kind === "error") && (
        <Link href="/app">
          <Button>{t("goToApp")}</Button>
        </Link>
      )}
    </div>
  );
}
