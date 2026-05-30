"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Bell, Footprints, PawPrint, Wallet } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  importPersonalToFamily,
  type ImportPersonalType,
} from "@/lib/firebase/families";
import { listPersonalPets } from "@/lib/firebase/pets";
import { listPersonalWalks } from "@/lib/firebase/walks";
import { listPersonalReminders } from "@/lib/firebase/reminders";
import { listPersonalExpenses } from "@/lib/firebase/expenses";
import { cn } from "@/lib/utils";

type Counts = Record<ImportPersonalType, number>;

const ZERO_COUNTS: Counts = { pets: 0, walks: 0, reminders: 0, expenses: 0 };

/** Shown after the user creates or joins a family — asks whether they
 *  want to drag any personal-mode docs over. Default is "yes for every
 *  non-zero category". User can uncheck per type. If every count is zero
 *  the dialog auto-closes via onComplete without rendering anything.
 *
 *  This is the post-rollback (2026-05-23) version: B4's merge-candidate
 *  detection + merge wizard step have been removed because users found
 *  the "both members had their own Mango before joining" scenario too
 *  rare to justify the extra UI. The mergeAndImportToFamily callable
 *  is still deployed (dormant) — no client surface invokes it. If a
 *  future spec resurrects the merge flow, restore the candidate-
 *  detection branch and route to mergeAndImportToFamily again. */
export function ImportWizardDialog({
  open,
  familyId,
  onClose,
  onComplete,
}: {
  open: boolean;
  familyId: string;
  /** Called when the user dismisses the dialog without importing. */
  onClose: () => void;
  /** Called after a successful import (or auto-skip when no personal data
   *  exists). The caller refreshes its own state. */
  onComplete: (result: { counts: Counts; skipped: boolean }) => void;
}) {
  const t = useTranslations("ImportWizard");
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Counts>(ZERO_COUNTS);
  const [selected, setSelected] = useState<Record<ImportPersonalType, boolean>>(
    { pets: true, walks: true, reminders: true, expenses: true },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Count the user's personal-mode docs on open. We use the existing
  // listPersonal* helpers — each does a single indexed query, cheap for
  // the scales this app targets (a few hundred docs per category at
  // most).
  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [pets, walks, reminders, expenses] = await Promise.allSettled([
          listPersonalPets(user.uid),
          listPersonalWalks(user.uid, 500),
          listPersonalReminders(user.uid, { includeDone: true }),
          listPersonalExpenses(user.uid, { max: 500 }),
        ]);
        if (cancelled) return;
        const c: Counts = {
          pets: pets.status === "fulfilled" ? pets.value.length : 0,
          walks: walks.status === "fulfilled" ? walks.value.length : 0,
          reminders:
            reminders.status === "fulfilled" ? reminders.value.length : 0,
          expenses: expenses.status === "fulfilled" ? expenses.value.length : 0,
        };
        setCounts(c);
        // Auto-skip if there's nothing to import — don't bother the user
        // with an empty wizard.
        const total = c.pets + c.walks + c.reminders + c.expenses;
        if (total === 0) {
          onComplete({ counts: c, skipped: true });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to count");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // onComplete is intentionally excluded — we don't want a new identity
    // each render to retrigger the count.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user]);

  const hasAnything = useMemo(
    () => counts.pets + counts.walks + counts.reminders + counts.expenses > 0,
    [counts],
  );

  const selectedTypes = useMemo(
    () =>
      (Object.keys(selected) as ImportPersonalType[]).filter(
        (k) => selected[k] && counts[k] > 0,
      ),
    [selected, counts],
  );

  const selectedTotal = useMemo(
    () => selectedTypes.reduce((sum, k) => sum + counts[k], 0),
    [selectedTypes, counts],
  );

  async function handleImport() {
    setBusy(true);
    setError(null);
    try {
      const res = await importPersonalToFamily(familyId, selectedTypes);
      onComplete({ counts: res.counts, skipped: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  if (!hasAnything && !loading) return null;

  return (
    <Dialog open={open} onClose={onClose} title={t("title")}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {t("subtitle")}
        </p>

        {loading ? (
          <p className="text-sm text-zinc-500">{t("loading")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            <CategoryRow
              icon={<PawPrint className="size-4" />}
              label={t("pets")}
              count={counts.pets}
              checked={selected.pets}
              onChange={(v) => setSelected((s) => ({ ...s, pets: v }))}
            />
            <CategoryRow
              icon={<Footprints className="size-4" />}
              label={t("walks")}
              count={counts.walks}
              checked={selected.walks}
              onChange={(v) => setSelected((s) => ({ ...s, walks: v }))}
            />
            <CategoryRow
              icon={<Bell className="size-4" />}
              label={t("reminders")}
              count={counts.reminders}
              checked={selected.reminders}
              onChange={(v) => setSelected((s) => ({ ...s, reminders: v }))}
            />
            <CategoryRow
              icon={<Wallet className="size-4" />}
              label={t("expenses")}
              count={counts.expenses}
              checked={selected.expenses}
              onChange={(v) => setSelected((s) => ({ ...s, expenses: v }))}
            />
          </ul>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={busy}
          >
            {t("skip")}
          </Button>
          <Button
            type="button"
            onClick={handleImport}
            disabled={busy || loading || selectedTotal === 0}
          >
            {busy
              ? t("importing")
              : selectedTotal > 0
                ? t("importN", { n: selectedTotal })
                : t("importEmpty")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function CategoryRow({
  icon,
  label,
  count,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const disabled = count === 0;
  return (
    <li>
      <label
        className={cn(
          "flex items-center gap-3 rounded-lg border border-zinc-200/80 px-3 py-2.5 dark:border-zinc-800",
          disabled
            ? "opacity-50 cursor-not-allowed"
            : "cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900",
        )}
      >
        <input
          type="checkbox"
          className="size-4 accent-amber-600"
          checked={checked && !disabled}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="grid size-8 place-items-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
          {icon}
        </span>
        <span className="flex-1 text-sm font-medium">{label}</span>
        <span className="tabular-nums text-sm text-zinc-500">{count}</span>
      </label>
    </li>
  );
}
