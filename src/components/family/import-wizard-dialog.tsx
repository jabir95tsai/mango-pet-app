"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Bell, Footprints, Merge, PawPrint, Wallet } from "lucide-react";
import type { Timestamp } from "firebase/firestore";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  importPersonalToFamily,
  mergeAndImportToFamily,
  type ImportPersonalType,
  type MergePair,
} from "@/lib/firebase/families";
import { listPersonalPets, listPets } from "@/lib/firebase/pets";
import { listPersonalWalks } from "@/lib/firebase/walks";
import { listPersonalReminders } from "@/lib/firebase/reminders";
import { listPersonalExpenses } from "@/lib/firebase/expenses";
import type { Pet } from "@/lib/types";
import { cn } from "@/lib/utils";

type Counts = Record<ImportPersonalType, number>;

const ZERO_COUNTS: Counts = { pets: 0, walks: 0, reminders: 0, expenses: 0 };

/** Candidate detected client-side by matching (name normalized,
 *  species, birthday). The user opts each pair in or out before the
 *  callable runs. */
type MergeCandidate = {
  personalPet: Pet;
  familyPet: Pet;
};

function normaliseName(s: string): string {
  return s.trim().toLowerCase();
}

function birthdayKey(b: Pet["birthday"]): string {
  // Two missing birthdays count as equal (per dedupe spec). Use the
  // Firestore millisecond stamp so two `Timestamp`s representing the
  // same point in time agree.
  if (!b) return "none";
  return String((b as Timestamp).toMillis());
}

/** Pure helper — extracted so the wizard logic stays declarative.
 *  Detects pet pairs that would be the obvious "this is the same pet"
 *  candidates the merge wizard should offer. */
function findMergeCandidates(
  personalPets: Pet[],
  familyPets: Pet[],
): MergeCandidate[] {
  const candidates: MergeCandidate[] = [];
  for (const p of personalPets) {
    const key = `${normaliseName(p.name)}|${p.species}|${birthdayKey(p.birthday)}`;
    const match = familyPets.find(
      (f) =>
        `${normaliseName(f.name)}|${f.species}|${birthdayKey(f.birthday)}` ===
        key,
    );
    if (match) candidates.push({ personalPet: p, familyPet: match });
  }
  return candidates;
}

/** Shown after the user creates or joins a family — asks whether they
 *  want to drag any personal-mode docs over. Default is "yes for every
 *  non-zero category". User can uncheck per type. If every count is zero
 *  the dialog auto-closes via onComplete without rendering anything.
 *
 *  Phase B3 scope: pure search-and-replace move. B4 inserts a pet-merge
 *  step before this for duplicates. */
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
  // B4: candidate merges discovered by name+species+birthday match. Each
  // entry's `keepSeparate=true` means "don't merge, keep as two pets".
  const [mergeCandidates, setMergeCandidates] = useState<MergeCandidate[]>([]);
  const [keepSeparate, setKeepSeparate] = useState<Record<string, boolean>>({});

  // Count the user's personal-mode docs on open. We use the existing
  // listPersonal* helpers — each does a single indexed query, cheap for
  // the scales this app targets (a few hundred docs per category at
  // most). Also fetches family pets to detect merge candidates.
  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [pets, walks, reminders, expenses, familyPets] =
          await Promise.allSettled([
            listPersonalPets(user.uid),
            listPersonalWalks(user.uid, 500),
            listPersonalReminders(user.uid, { includeDone: true }),
            listPersonalExpenses(user.uid, { max: 500 }),
            listPets(familyId),
          ]);
        if (cancelled) return;
        const personalPetList = pets.status === "fulfilled" ? pets.value : [];
        const familyPetList =
          familyPets.status === "fulfilled" ? familyPets.value : [];
        const c: Counts = {
          pets: personalPetList.length,
          walks: walks.status === "fulfilled" ? walks.value.length : 0,
          reminders:
            reminders.status === "fulfilled" ? reminders.value.length : 0,
          expenses: expenses.status === "fulfilled" ? expenses.value.length : 0,
        };
        setCounts(c);

        const candidates = findMergeCandidates(personalPetList, familyPetList);
        setMergeCandidates(candidates);

        // Auto-skip if no personal data AND no merge candidates — don't
        // bother the user with an empty wizard.
        const total = c.pets + c.walks + c.reminders + c.expenses;
        if (total === 0 && candidates.length === 0) {
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
  }, [open, user, familyId]);

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

  // Merge pairs the user wants to apply (i.e., NOT marked keepSeparate).
  const merges: MergePair[] = useMemo(
    () =>
      mergeCandidates
        .filter((c) => !keepSeparate[c.personalPet.petId])
        .map((c) => ({
          personalPetId: c.personalPet.petId,
          familyPetId: c.familyPet.petId,
        })),
    [mergeCandidates, keepSeparate],
  );

  // Effective import counts AFTER applying merges:
  // - pets count loses the ones being merged away (their docs get deleted)
  // - walks/reminders/expenses for merged pets get reassigned by the server
  //   in the same callable, NOT counted in "import" — the user sees them
  //   "move" as part of the merge step instead.
  const effectiveCounts = useMemo<Counts>(() => {
    const petsAfterMerge = Math.max(0, counts.pets - merges.length);
    return { ...counts, pets: petsAfterMerge };
  }, [counts, merges]);

  const selectedTotal = useMemo(
    () => selectedTypes.reduce((sum, k) => sum + effectiveCounts[k], 0),
    [selectedTypes, effectiveCounts],
  );

  // Enable the action button if EITHER a merge is queued OR there's any
  // import volume to move. Button label adapts.
  const hasActionableWork = merges.length > 0 || selectedTotal > 0;

  async function handleImport() {
    setBusy(true);
    setError(null);
    try {
      if (merges.length > 0) {
        const res = await mergeAndImportToFamily(
          familyId,
          merges,
          selectedTypes,
        );
        // Recompose Counts shape so the caller's callback sees the same
        // shape both code paths return.
        onComplete({ counts: res.importCounts, skipped: false });
      } else {
        const res = await importPersonalToFamily(familyId, selectedTypes);
        onComplete({ counts: res.counts, skipped: false });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  if (!hasAnything && mergeCandidates.length === 0 && !loading) return null;

  return (
    <Dialog open={open} onClose={onClose} title={t("title")}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {t("subtitle")}
        </p>

        {loading ? (
          <p className="text-sm text-zinc-500">{t("loading")}</p>
        ) : (
          <>
            {mergeCandidates.length > 0 && (
              <section className="flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  {t("mergeSectionTitle")}
                </p>
                <p className="text-xs text-zinc-500">
                  {t("mergeSectionHint")}
                </p>
                <ul className="flex flex-col gap-2">
                  {mergeCandidates.map((c) => (
                    <MergeCandidateRow
                      key={c.personalPet.petId}
                      candidate={c}
                      keepSeparate={!!keepSeparate[c.personalPet.petId]}
                      labels={{
                        merge: t("mergeAction"),
                        keep: t("mergeKeepSeparate"),
                      }}
                      onToggle={(v) =>
                        setKeepSeparate((s) => ({
                          ...s,
                          [c.personalPet.petId]: v,
                        }))
                      }
                    />
                  ))}
                </ul>
              </section>
            )}

            <section className="flex flex-col gap-2">
              {mergeCandidates.length > 0 && (
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  {t("importSectionTitle")}
                </p>
              )}
              <ul className="flex flex-col gap-2">
                <CategoryRow
                  icon={<PawPrint className="size-4" />}
                  label={t("pets")}
                  count={effectiveCounts.pets}
                  checked={selected.pets}
                  onChange={(v) => setSelected((s) => ({ ...s, pets: v }))}
                />
                <CategoryRow
                  icon={<Footprints className="size-4" />}
                  label={t("walks")}
                  count={effectiveCounts.walks}
                  checked={selected.walks}
                  onChange={(v) => setSelected((s) => ({ ...s, walks: v }))}
                />
                <CategoryRow
                  icon={<Bell className="size-4" />}
                  label={t("reminders")}
                  count={effectiveCounts.reminders}
                  checked={selected.reminders}
                  onChange={(v) =>
                    setSelected((s) => ({ ...s, reminders: v }))
                  }
                />
                <CategoryRow
                  icon={<Wallet className="size-4" />}
                  label={t("expenses")}
                  count={effectiveCounts.expenses}
                  checked={selected.expenses}
                  onChange={(v) => setSelected((s) => ({ ...s, expenses: v }))}
                />
              </ul>
            </section>
          </>
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
            disabled={busy || loading || !hasActionableWork}
          >
            {busy
              ? t("importing")
              : merges.length > 0
                ? t("mergeAndImportN", {
                    merges: merges.length,
                    n: selectedTotal,
                  })
                : selectedTotal > 0
                  ? t("importN", { n: selectedTotal })
                  : t("importEmpty")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function MergeCandidateRow({
  candidate,
  keepSeparate,
  labels,
  onToggle,
}: {
  candidate: MergeCandidate;
  keepSeparate: boolean;
  labels: { merge: string; keep: string };
  onToggle: (keepSeparate: boolean) => void;
}) {
  const { personalPet, familyPet } = candidate;
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-emerald-200/70 bg-emerald-50/60 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/5">
      <div className="flex items-center gap-3 text-sm">
        <span className="font-medium">{personalPet.name}</span>
        <Merge className="size-4 text-emerald-700 dark:text-emerald-400" />
        <span className="font-medium">{familyPet.name}</span>
      </div>
      <div className="flex items-center gap-3 text-xs text-zinc-500">
        <span>
          {personalPet.species}
          {personalPet.breed ? ` · ${personalPet.breed}` : ""}
        </span>
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          className="size-4 accent-amber-600"
          checked={!keepSeparate}
          onChange={(e) => onToggle(!e.target.checked)}
        />
        <span>{keepSeparate ? labels.keep : labels.merge}</span>
      </label>
    </li>
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