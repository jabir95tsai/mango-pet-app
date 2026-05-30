"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertTriangle, Trash2 } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  deleteAccount,
  previewDeleteAccountImpact,
  type DeleteAccountImpact,
} from "@/lib/firebase/users";
import { signOutCurrent } from "@/lib/firebase/auth";
import { cn } from "@/lib/utils";

/** Two-step destructive confirmation for account deletion (spec D3):
 *  1. Fetch + show the user the impact preview (counts of pets / walks /
 *     reminders / expenses / posts that will disappear, with explicit
 *     cascade warning for family pets they created).
 *  2. Live-validate the displayName input against their profile name —
 *     only when it matches exactly does the destructive button enable.
 *  Success → signs the user out and bounces to the public landing page;
 *  failure → keeps the dialog open with the error so they can retry
 *  without having to re-type the confirmation. */
export function DeleteAccountDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("DeleteAccount");
  const { user } = useAuth();
  const router = useRouter();

  const [impact, setImpact] = useState<DeleteAccountImpact | null>(null);
  const [impactLoading, setImpactLoading] = useState(true);
  const [impactError, setImpactError] = useState<string | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset transient state every time the dialog opens — we don't want a
  // partially-typed displayName or a stale error message leaking across
  // open cycles.
  useEffect(() => {
    if (!open) return;
    setConfirmName("");
    setError(null);
    setImpact(null);
    setImpactError(null);
    setImpactLoading(true);
  }, [open]);

  // Fetch impact preview once per open. If the queries fail (e.g.,
  // transient network), the dialog still renders the warning + confirm
  // field so the user can proceed — counts are nice-to-have, not a
  // gate.
  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await previewDeleteAccountImpact(user.uid);
        if (!cancelled) {
          setImpact(data);
          setImpactLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setImpactError(
            err instanceof Error ? err.message : "Failed to load preview",
          );
          setImpactLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, user]);

  const expectedName = (user?.displayName ?? "").trim();
  // Loose-trim on both sides — punishing exact-whitespace is meaner than
  // useful and the server re-validates anyway.
  const matches = expectedName.length > 0 && confirmName.trim() === expectedName;

  async function handleConfirm() {
    if (!matches || busy) return;
    setBusy(true);
    setError(null);
    try {
      await deleteAccount(confirmName.trim());
      // Successful delete → the auth user is gone server-side. Sign out
      // locally before navigating so onAuthStateChanged fires with null
      // and any subscribers (FamilyProvider etc.) reset cleanly.
      try {
        await signOutCurrent();
      } catch {
        // The auth user may already be gone on the wire — ignore.
      }
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={busy ? () => {} : onClose} title={t("dialogTitle")}>
      <div className="flex flex-col gap-4">
        <div className="flex gap-3 rounded-lg border border-red-300/70 bg-red-50 p-3 text-red-900 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-200">
          <AlertTriangle className="size-5 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1 text-sm">
            <p className="font-semibold">{t("warning")}</p>
            <p className="text-xs">{t("cannotUndo")}</p>
          </div>
        </div>

        {impactLoading ? (
          <p className="text-sm text-zinc-500">{t("previewLoading")}</p>
        ) : impactError ? (
          <p className="text-xs text-zinc-500">{t("previewFailed")}</p>
        ) : impact ? (
          <ImpactSummary impact={impact} t={t} />
        ) : null}

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            {t("confirmInputLabel", { name: expectedName || "—" })}
          </label>
          <Input
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder={expectedName}
            autoFocus
            disabled={busy}
          />
          {confirmName.length > 0 && !matches && (
            <p className="text-xs text-zinc-500">{t("confirmInputHint")}</p>
          )}
        </div>

        {error && (
          <p className="rounded-md bg-red-50 px-2 py-1.5 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-200">
            {t("errorPrefix")}: {error}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={busy}
          >
            {t("cancelButton")}
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!matches || busy}
            className={cn(
              "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500",
              "disabled:bg-red-600/40 disabled:text-white/80",
            )}
          >
            {busy ? (
              t("deleting")
            ) : (
              <>
                <Trash2 className="size-4" />
                {t("confirmButton")}
              </>
            )}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function ImpactSummary({
  impact,
  t,
}: {
  impact: DeleteAccountImpact;
  t: ReturnType<typeof useTranslations>;
}) {
  const personalTotal = impact.personalPets;
  const familyTotal = impact.familyPets;
  const myActivity =
    impact.familyWalks + impact.familyReminders + impact.familyExpenses;
  const social = impact.posts;
  const everythingZero =
    personalTotal + familyTotal + myActivity + social === 0;

  if (everythingZero) {
    return <p className="text-xs text-zinc-500">{t("nothingToDelete")}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        {t("impactHeader")}
      </p>
      <ul className="flex flex-col gap-1.5 text-sm">
        {personalTotal > 0 && (
          <li>
            <span className="font-medium">{t("personalDataSection")}：</span>
            {t("personalDataCount", { n: personalTotal })}
          </li>
        )}
        {familyTotal > 0 && (
          <>
            <li>
              <span className="font-medium">{t("familyDataSection")}：</span>
              {t("familyDataCount", { n: familyTotal })}
            </li>
            <li className="rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
              ⚠ {t("cascadeWarning")}
            </li>
          </>
        )}
        {myActivity > 0 && (
          <li>
            <span className="font-medium">{t("myActivitySection")}：</span>
            {t("myActivityCount", {
              walks: impact.familyWalks,
              reminders: impact.familyReminders,
              expenses: impact.familyExpenses,
            })}
          </li>
        )}
        {social > 0 && (
          <li>
            <span className="font-medium">{t("socialDataSection")}：</span>
            {t("socialDataCount", { n: social })}
          </li>
        )}
      </ul>
    </div>
  );
}
