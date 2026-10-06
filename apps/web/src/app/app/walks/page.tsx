"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronDown, Footprints, Hand, Play, Plus } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useFamily } from "@/components/family/family-provider";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { WalkTrackingView } from "@/components/walks/walk-tracking-view";
import { ManualWalkDialog } from "@/components/walks/manual-walk-dialog";
import { WalksDial } from "@/components/walks/walks-dial";
import { WalksWeekStrip } from "@/components/walks/walks-week-strip";
import { WalksConfettiDecor } from "@/components/walks/walks-confetti-decor";
import { StreakChip } from "@/components/walks/streak-chip";
import { WalkRow } from "@/components/walks/walk-row";
import { PetPickerDropdown } from "@/components/walks/pet-picker-dropdown";
import { PhotoPromptSheet } from "@/components/walks/photo-prompt-sheet";
import { PostComposer } from "@/components/feed/post-composer";
import {
  createWalk,
  deleteWalk,
  listPersonalWalks,
  listWalks,
  mintWalkId,
  updateWalkDetails,
} from "@/lib/firebase/walks";
import { discardWalkDraft, listWalkDrafts, onWalkReconnect, removeWalkDraft, storeWalkDraft, wasWalkDraftDiscarded, type WalkDraft } from "@/lib/walk-drafts";
import { listPersonalPets, listPets } from "@/lib/firebase/pets";
import { getAppUser } from "@/lib/firebase/users";
import { computeStreak } from "@/lib/scoring";
import {
  getTodayProgress,
  getWeeklyAvgMinutes,
} from "@/lib/walk-tracking";
import { getPetWalkGoalMinutes } from "@/lib/walk-goals";
import { cn } from "@/lib/utils";
import type { Pet, Walk, WalkInput } from "@/lib/types";
import type { Timestamp } from "firebase/firestore";

// Spec decisions:
const WEEK_GOAL_COUNT = 5;
const RECENT_WALKS_LIMIT = 5;
const LAST_PET_ID_STORAGE_KEY = "mango.walks.lastPetId";

// CTA family — the raised mango gradient (same look as the pets ＋ FAB and
// the 開始遛狗 CTA), white text. Shared by the desktop hero CTA + the
// empty-state inline link via the `.btn-mango` class.
const CTA_MANGO = "btn-mango text-white";

/** ISO-8601 week start (Monday 00:00 device-local). Mirrors the helper
 *  inside `walk-tracking.ts` but re-implemented here per spec rule
 *  "不動 walk-tracking.ts". */
function startOfWeekLocal(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const daysFromMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - daysFromMonday);
  return d;
}

/** Day index 0..6 (Monday=0) for "today". */
function todayIdxLocal(now: Date = new Date()): number {
  return (now.getDay() + 6) % 7;
}

/** Per-day minute totals for this week → boolean array of length 7,
 *  Monday-first, true if that day's total minutes >= goalMin. */
function getWeekDayDoneFlags(walks: Walk[], goalMin: number): boolean[] {
  const start = startOfWeekLocal().getTime();
  const dayMs = 24 * 3600 * 1000;
  const totals = [0, 0, 0, 0, 0, 0, 0];
  for (const w of walks) {
    const ts = w.startedAt as Timestamp | undefined;
    if (!ts) continue;
    const t = ts.toMillis();
    const idx = Math.floor((t - start) / dayMs);
    if (idx >= 0 && idx < 7) {
      totals[idx] += w.durationMin ?? 0;
    }
  }
  return totals.map((m) => m >= goalMin);
}

/** Total km across this week (used in the week-strip header summary). */
function getWeekKm(walks: Walk[]): number {
  const start = startOfWeekLocal().getTime();
  let km = 0;
  for (const w of walks) {
    const ts = w.startedAt as Timestamp | undefined;
    if (!ts) continue;
    if (ts.toMillis() >= start) km += w.distanceKm ?? 0;
  }
  return km;
}

/** This-week walk count (matches the dial's data shape — counted by
 *  walks not days). */
function getWeekWalkCount(walks: Walk[]): number {
  const start = startOfWeekLocal().getTime();
  let n = 0;
  for (const w of walks) {
    const ts = w.startedAt as Timestamp | undefined;
    if (!ts) continue;
    if (ts.toMillis() >= start) n += 1;
  }
  return n;
}

export default function WalksPage() {
  const t = useTranslations("Nav");
  const tW = useTranslations("Walks.core");
  const tP = useTranslations("Walks.page");
  const tS = useTranslations("Walks.streak");
  const tC = useTranslations("Common");
  const tPP = useTranslations("WalksPhotoPrompt");
  const askConfirm = useConfirm();
  const { user, isGuest } = useAuth();
  const { family, loading: familyLoading } = useFamily();

  const [pets, setPets] = useState<Pet[]>([]);
  const [walks, setWalks] = useState<Walk[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [pendingDrafts, setPendingDrafts] = useState<WalkDraft[]>([]);
  const [recovering, setRecovering] = useState(false);
  const [recoveryError, setRecoveryError] = useState<"saveFailed" | "discardDraftFailed" | null>(null);
  const [discardingDraft, setDiscardingDraft] = useState<string | null>(null);
  const recoveryScope = useMemo(() => ({ uid: user?.uid ?? null, sessionOpen }), [user?.uid, sessionOpen]);
  const scopeRef = useRef<typeof recoveryScope | null>(recoveryScope);
  scopeRef.current = recoveryScope;
  const recoveryInFlight = useRef<{ scope: typeof recoveryScope; promise: Promise<boolean> } | null>(null);
  const discardInFlight = useRef<{ scope: typeof recoveryScope; walkId: string } | null>(null);
  const [showAllWalks, setShowAllWalks] = useState(false);
  // Confetti decor — fires a brief celebration then auto-hides so it
  // doesn't camp at the top of the page forever (user feedback
  // 2026-05-25 "彩帶動畫完後不要留在頁面上").
  const [showConfetti, setShowConfetti] = useState(false);
  // Multi-pet picker state — per per-pet-walk-goal spec D2, the
  // chevron-down Phase 1 v2 deferred is now active. activePetId
  // persists across sessions via localStorage; reconciliation with
  // the actual pet list happens in the activePet useMemo below.
  const [pickerOpen, setPickerOpen] = useState(false);
  const [storedPetId, setStoredPetId] = useState<string | null>(null);
  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    setStoredPetId(localStorage.getItem(LAST_PET_ID_STORAGE_KEY));
  }, []);

  // ── Walks auto-photo-share (flow A: start prompt) ──────────────
  // Spec docs/features/walks-auto-photo-share.md.
  // `pendingWalkId` is minted on every walk-start attempt (whether
  // or not the user takes the photo) so we have a stable id to use
  // for both (a) the optional start-photo post.walkId and (b) the
  // eventual createWalk pre-minted id — when the walk doc finally
  // saves, it lands at the same id, making the cross-link valid.
  const [autoPhotoEnabled, setAutoPhotoEnabled] = useState(true);
  const [pendingWalkId, setPendingWalkId] = useState<string | null>(null);
  const [startPromptOpen, setStartPromptOpen] = useState(false);
  const [startComposerOpen, setStartComposerOpen] = useState(false);
  const [startPhoto, setStartPhoto] = useState<File | null>(null);
  const startPhotoInputRef = useRef<HTMLInputElement | null>(null);

  // Pull the user's walkPrefs once. Absent walkPrefs / absent
  // autoPhotoShare both fall back to ON per spec — only an explicit
  // `false` disables the prompt.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const u = await getAppUser(user.uid);
        if (!cancelled) {
          setAutoPhotoEnabled(u?.walkPrefs?.autoPhotoShare !== false);
        }
      } catch {
        // Best-effort — default ON is the spec-mandated fallback so
        // a read failure doesn't accidentally suppress the prompt.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [petR, walkR] = await Promise.allSettled([
        family ? listPets(family.familyId) : listPersonalPets(user.uid),
        family
          ? listWalks(family.familyId, null)
          : listPersonalWalks(user.uid, null),
      ]);
      if (scopeRef.current?.uid !== user.uid) return;
      setPets(petR.status === "fulfilled" ? petR.value : []);
      setWalks(walkR.status === "fulfilled" ? walkR.value : []);
    } finally {
      if (scopeRef.current?.uid === user.uid) setLoading(false);
    }
  }, [user, family]);

  useEffect(() => {
    if (familyLoading) return;
    refresh();
  }, [familyLoading, refresh]);

  useEffect(() => {
    scopeRef.current = recoveryScope;
    setPendingDrafts([]);
    setRecovering(false);
    setRecoveryError(null);
    setDiscardingDraft(null);
    discardInFlight.current = null;
    const scope = recoveryScope;
    const invalidate = () => { if (scopeRef.current === scope) scopeRef.current = null; };
    if (!scope.uid || scope.sessionOpen) return invalidate;
    try {
      setPendingDrafts(listWalkDrafts(scope.uid));
    } catch {
      // Storage can be unavailable in private mode. Current-session saves
      // still work, but recovery after closing the browser is unavailable.
      setPendingDrafts([]);
    }
    let queued = false;
    const unsubscribe = onWalkReconnect(() => {
      if (scopeRef.current !== scope || discardInFlight.current || queued) return;
      const running = recoveryInFlight.current;
      if (running?.scope === scope) {
        queued = true;
        // A reconnect during an unsuccessful request buys one follow-up,
        // not parallel writes or an unbounded retry loop.
        void running.promise.then((ok) => {
          queued = false;
          if (!ok && scopeRef.current === scope && !discardInFlight.current) void recoverWalks();
        });
      } else {
        void recoverWalks();
      }
    }, true);
    return () => { unsubscribe(); invalidate(); };
    // Scope identity deliberately excludes refreshed user/family objects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recoveryScope]);

  function recoverWalks(): Promise<boolean> {
    const scope = recoveryScope;
    if (!scope.uid || scope.sessionOpen || scopeRef.current !== scope || discardInFlight.current) return Promise.resolve(false);
    if (recoveryInFlight.current?.scope === scope) return recoveryInFlight.current.promise;
    const uid = scope.uid;
    setRecovering(true);
    setRecoveryError(null);
    const promise: Promise<boolean> = Promise.resolve().then(async () => {
      let failed = false;
      try {
        const drafts = listWalkDrafts(uid);
        if (drafts.length === 0) {
          if (scopeRef.current === scope) setPendingDrafts([]);
          return true;
        }
        for (const draft of drafts) {
          if (scopeRef.current !== scope || discardInFlight.current) return false;
          if (wasWalkDraftDiscarded(uid, draft.walkId)) continue;
          try {
            await createWalk(draft);
            removeWalkDraft(uid, draft.walkId);
          } catch {
            failed = true; // An unrecoverable draft must not block later ones.
          }
        }
        if (scopeRef.current === scope) await refresh();
      } catch {
        failed = true;
      }
      if (scopeRef.current === scope) {
        setRecoveryError(failed ? "saveFailed" : null);
        try { setPendingDrafts(listWalkDrafts(uid)); } catch { /* retain visible drafts */ }
      }
      return !failed;
    }).finally(() => {
      if (recoveryInFlight.current?.promise === promise) recoveryInFlight.current = null;
      if (scopeRef.current === scope) setRecovering(false);
    });
    recoveryInFlight.current = { scope, promise };
    return promise;
  }

  async function discardRecoveredWalk(draft: WalkDraft) {
    const scope = recoveryScope;
    if (scopeRef.current !== scope || scope.uid !== draft.walkerUid
      || recoveryInFlight.current?.scope === scope || discardInFlight.current) return;
    const operation = { scope, walkId: draft.walkId };
    discardInFlight.current = operation;
    setDiscardingDraft(draft.walkId);
    try {
      const confirmed = await askConfirm({ title: tW("discardDraftTitle"), message: tW("discardDraftBody"),
        confirmText: tW("discardDraft"), cancelText: tC("cancel"), danger: true });
      if (!confirmed || scopeRef.current !== scope) return;
      discardWalkDraft(draft.walkerUid, draft.walkId);
      setPendingDrafts(listWalkDrafts(draft.walkerUid));
      setRecoveryError(null);
    } catch {
      if (scopeRef.current === scope) setRecoveryError("discardDraftFailed");
    } finally {
      if (discardInFlight.current === operation) discardInFlight.current = null;
      if (scopeRef.current === scope) setDiscardingDraft(null);
    }
  }

  // Primary pet = earliest createdAt. Anchored fallback for activePet
  // resolution AND for the cloud-functions push (which also uses
  // "earliest createdAt" — kept aligned so the user's experience
  // matches the push copy).
  const primaryPet = useMemo<Pet | null>(() => {
    if (pets.length === 0) return null;
    return [...pets].sort((a, b) => {
      const at = a.createdAt?.toMillis?.() ?? 0;
      const bt = b.createdAt?.toMillis?.() ?? 0;
      return at - bt;
    })[0];
  }, [pets]);
  const hasMultiplePets = pets.length > 1;

  // Active pet = stored localStorage choice if it still resolves to a
  // real pet, else fall back to primary. Stored-pet-deleted case is
  // covered here automatically (lookup returns undefined → fallback).
  const activePet = useMemo<Pet | null>(() => {
    if (pets.length === 0) return null;
    if (storedPetId) {
      const found = pets.find((p) => p.petId === storedPetId);
      if (found) return found;
    }
    return primaryPet;
  }, [pets, storedPetId, primaryPet]);

  const goalMin = useMemo(() => getPetWalkGoalMinutes(activePet), [activePet]);

  const todayProgress = useMemo(
    () => getTodayProgress(walks, goalMin),
    [walks, goalMin],
  );

  const streakDays = useMemo(
    () =>
      computeStreak(
        walks.map((w) => new Date((w.startedAt as Timestamp).toMillis())),
      ),
    [walks],
  );

  const weekDayFlags = useMemo(
    () => getWeekDayDoneFlags(walks, goalMin),
    [walks, goalMin],
  );
  const weekKm = useMemo(() => getWeekKm(walks), [walks]);
  const weekCount = useMemo(() => getWeekWalkCount(walks), [walks]);
  const todayIdx = useMemo(() => todayIdxLocal(), []);

  const weeklyAvgMin = useMemo(() => getWeeklyAvgMinutes(walks), [walks]);

  // goalHit + showConfetti effect MUST sit above the 0-pet early-return
  // below — every hook in this component has to run on every render or
  // React throws #300 ("Rendered fewer hooks than expected"). User
  // reproduce 2026-05-26: PWA add-to-home-screen → /app/walks crashed
  // with React #300 on iOS Safari when the user transiently rendered
  // through (loading === false && pets.length === 0) — e.g. cold-start
  // Firestore IndexedDB race, or a genuinely 0-pet account. Previously
  // this useEffect lived BELOW the early-return, so on that branch it
  // never ran and the hook count dropped by one between renders. Bug
  // Hunter session @ commit (this) — see docs/team/backlog.md React #300
  // entry.
  const goalHitEarly = useMemo(
    () => todayProgress.percent >= 100,
    [todayProgress.percent],
  );
  useEffect(() => {
    if (!goalHitEarly) {
      setShowConfetti(false);
      return;
    }
    setShowConfetti(true);
    const t = setTimeout(() => setShowConfetti(false), 4000);
    return () => clearTimeout(t);
  }, [goalHitEarly]);

  async function handleCreate(input: WalkInput & { score: number }, trackedWalkId?: string) {
    if (!user || scopeRef.current?.uid !== user.uid) return null;
    const { score, ...rest } = input;
    const args = {
      ...rest,
      // family === null → personal walk (not on leaderboard, anti-farm).
      familyId: family?.familyId ?? null,
      walkerUid: user.uid,
      walkerName: user.displayName ?? undefined,
      walkerPhotoURL: user.photoURL,
      score,
      // Tracked sessions retain their pre-minted START-post id across
      // retries. Manual entries get their own id, independent of tracking.
      walkId: trackedWalkId ?? mintWalkId(),
    };
    if (trackedWalkId) {
      // A discard marker is intentional, unlike unavailable local storage.
      let discarded = false;
      try { discarded = wasWalkDraftDiscarded(user.uid, trackedWalkId); } catch { /* storage unavailable */ }
      if (discarded) throw new Error(tW("draftDiscarded"));
      try { storeWalkDraft(args); } catch { /* server save remains available without local storage */ }
    }
    const walk = await createWalk(args);
    if (trackedWalkId) {
      try { removeWalkDraft(user.uid, trackedWalkId); } catch { /* same id makes recovery safe */ }
    }
    // A list refresh is not part of the write acknowledgement. In particular,
    // do not replace the active pet with an empty list while recap is open.
    if (!trackedWalkId) await refresh();
    // Return the id so WalkTrackingView's end-photo flow can use it
    // for the END post's walkId cross-link.
    return { walkId: walk.walkId };
  }

  // Single entry point for the "開始遛狗" CTA on both mobile + desktop.
  // Mints a walkId up-front so the optional start-photo post can
  // cross-link to the same id `createWalk` will eventually use. Then
  // either shows the prompt (default) or skips straight into tracking
  // (user toggled the pref off, or no active pet).
  function handleStartWalking() {
    if (pets.length === 0) return;
    const id = mintWalkId();
    setPendingWalkId(id);
    // Guests can't share to feed, so skip the auto-photo prompt entirely
    // and go straight into tracking — otherwise the prompt (which gates
    // setSessionOpen) would never resolve for them. Spec §C.
    if (autoPhotoEnabled && !isGuest) {
      setStartPromptOpen(true);
    } else {
      setSessionOpen(true);
    }
  }

  function handleStartPromptTake() {
    // Open the hidden camera input — the resulting picked file is
    // handled by handleStartPhotoPicked below, which advances to the
    // composer.
    setStartPromptOpen(false);
    startPhotoInputRef.current?.click();
  }

  function handleStartPromptSkip() {
    setStartPromptOpen(false);
    // No photo, no composer — straight into tracking. The pre-minted
    // walkId stays in pendingWalkId for handleCreate to consume on
    // save.
    setSessionOpen(true);
  }

  function handleStartPhotoPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (!file) {
      // User dismissed the OS camera sheet — treat as Skip per spec.
      setSessionOpen(true);
      return;
    }
    setStartPhoto(file);
    setStartComposerOpen(true);
  }

  function handleStartComposerClose() {
    // Composer closed via either [取消] (no post created) or after a
    // successful publish. Either way the next step is to start
    // tracking — the walkId is already pinned to pendingWalkId.
    setStartComposerOpen(false);
    setStartPhoto(null);
    setSessionOpen(true);
  }

  async function handleDelete(walk: Walk) {
    const ok = await askConfirm({
      title: tC("delete"),
      message: `${walk.distanceKm.toFixed(2)} km · ${walk.durationMin.toFixed(0)} min`,
      confirmText: tC("delete"),
      cancelText: tC("cancel"),
      danger: true,
    });
    if (!ok) return;
    await deleteWalk(walk.walkId);
    await refresh();
  }

  function discardCurrentWalk(walkId: string) {
    if (!user || scopeRef.current?.uid !== user.uid) throw new Error(tW("saveFailed"));
    discardWalkDraft(user.uid, walkId);
  }

  const visibleDrafts = pendingDrafts.filter(draft => draft.walkerUid === user?.uid);
  const recoveryNotice = visibleDrafts.length > 0 && (
    <div role="status" className="mb-4 rounded-[var(--radius-lg)] border border-mango-hairline bg-mango-card-soft p-4 text-sm text-mango-ink">
      <p>{tW("pendingRecovery", { count: visibleDrafts.length })}</p>
      {recoveryError && <p role="alert">{tW(recoveryError)}</p>}
      <Button onClick={() => { void recoverWalks(); }} disabled={recovering || discardingDraft !== null} className="mt-2 rounded-[var(--radius-pill)]">
        {recovering ? tW("savingWalk") : tC("retry")}
      </Button>
      <ul className="mt-2 space-y-2">
        {visibleDrafts.map(draft => (
          <li key={draft.walkId} className="flex flex-wrap items-center justify-between gap-2">
            <span>{draft.petName ?? draft.petId} · {draft.startedAt.toLocaleString()}</span>
            <Button variant="secondary" onClick={() => { void discardRecoveredWalk(draft); }}
              disabled={recovering || discardingDraft !== null} className="rounded-[var(--radius-pill)]">
              {tW("discardDraft")}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );

  // No-pets short circuit — same as before, just re-styled into the
  // mango CTA family.
  if (!loading && pets.length === 0) {
    return (
      <>
        {recoveryNotice}
        <EmptyState
          icon={Footprints}
          title={tW("needPetTitle")}
          description={tW("needPetDescription")}
          action={
            <Link
              href="/app/pets"
              className={cn(
                "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                CTA_MANGO,
              )}
            >
              <Plus className="size-4" />
              {tW("needPetCta")}
            </Link>
          }
        />
      </>
    );
  }

  const remainingMin = Math.max(
    0,
    goalMin - Math.round(todayProgress.minutes),
  );
  // Re-aliased here so the downstream render-time consts stay readable.
  // The actual useEffect that drives showConfetti now lives ABOVE the
  // 0-pet early-return (see goalHitEarly + useEffect block); see the
  // comment up there for why.
  const goalHit = goalHitEarly;
  const doneMin = Math.round(todayProgress.minutes);
  const petName = activePet?.name ?? "";

  // Hero copy — title + sub-line. Spec format:
  //   "再走 {min} 分鐘" / "達標了 🎉"
  //   "{pet} 今天走了 {done} 分 · 連續 {streak} 天"
  const heroTitle = goalHit
    ? tP("heroComplete")
    : tP("heroIncomplete", { min: remainingMin });
  const heroSub = petName
    ? tP("heroSub", { pet: petName, done: doneMin, streak: streakDays })
    : tP("heroSubNoPet", { done: doneMin, streak: streakDays });
  const canToggleAllWalks = walks.length > RECENT_WALKS_LIMIT;
  const visibleWalks = showAllWalks
    ? walks
    : walks.slice(0, RECENT_WALKS_LIMIT);

  return (
    <>
      {recoveryNotice}
      {/* Confetti decor — brief celebration that auto-hides after 4s
          (user feedback). `showConfetti` is driven by the useEffect
          above which watches goalHit and runs the timer. */}
      {showConfetti && (
        <div className="relative">
          <WalksConfettiDecor />
        </div>
      )}

      {/* Top bar — title (left) + Mango pill (active pet, opens picker
          when multi-pet) + streak chip (right). Per per-pet-walk-goal
          spec D2, the chevron-down is now active and opens a dropdown
          listing each pet + its daily goal chip. Single-pet users see
          the pill but no chevron — the button is non-interactive in
          that case to keep the UX uncluttered. */}
      <div className="relative z-40 mb-3 flex items-center gap-2.5">
        {/* Topic size aligned with PetsTopBar (我的寵物) + family-aligned
            pages — 26px extrabold, -0.5px tracking. User feedback
            2026-05-25: previous 22px read smaller than 我的寵物 + 排行榜. */}
        <h1 className="text-[26px] font-extrabold tracking-[-0.5px] text-mango-ink">
          {t("walks")}
        </h1>
        {activePet && (
          <div className="relative">
            <button
              type="button"
              onClick={hasMultiplePets ? () => setPickerOpen((v) => !v) : undefined}
              disabled={!hasMultiplePets}
              aria-haspopup={hasMultiplePets ? "menu" : undefined}
              aria-expanded={hasMultiplePets ? pickerOpen : undefined}
              aria-label={
                hasMultiplePets
                  ? tP("petPicker.openLabel", { pet: activePet.name })
                  : activePet.name
              }
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border border-mango-hairline bg-mango-card py-1 pl-1 pr-2.5 text-[13px] font-semibold text-mango-ink transition-colors",
                hasMultiplePets
                  ? "hover:bg-mango-bg-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep"
                  : "cursor-default",
              )}
            >
              <span
                aria-hidden="true"
                className="grid h-[22px] w-[22px] place-items-center overflow-hidden rounded-full bg-[#f7c168] text-[13px]"
              >
                🐶
              </span>
              <span className="truncate max-w-[6.5rem]">{activePet.name}</span>
              {hasMultiplePets && (
                <ChevronDown
                  className={cn(
                    "size-3 text-mango-ink-3 transition-transform",
                    pickerOpen && "rotate-180",
                  )}
                  aria-hidden="true"
                />
              )}
            </button>
            {pickerOpen && hasMultiplePets && (
              <PetPickerDropdown
                pets={pets}
                currentPetId={activePet.petId}
                onSelect={(p) => {
                  setStoredPetId(p.petId);
                  if (typeof localStorage !== "undefined") {
                    localStorage.setItem(LAST_PET_ID_STORAGE_KEY, p.petId);
                  }
                  setPickerOpen(false);
                }}
                onClose={() => setPickerOpen(false)}
              />
            )}
          </div>
        )}
        <div className="flex-1" />
        <StreakChip
          streakDays={streakDays}
          label={tS("labelShort", { days: streakDays })}
          weekTooltip={tS("weekTooltip")}
        />
      </div>

      {/* Hero copy — title + sub-line. Mounts above the dial. */}
      <div className="relative z-10 mb-3 px-1">
        <h2
          className="text-[26px] font-bold leading-tight tracking-tight text-mango-ink"
          aria-live="polite"
        >
          {heroTitle}
        </h2>
        <p className="mt-1 text-[13px] font-medium text-mango-ink-2">
          {heroSub}
        </p>
      </div>

      {/* Dial — the page's hero element. 232px radial with walking dog
          inside. Bottom pill ({done} / {goal} 分) overlaps the ring. */}
      <div className="relative z-10 mb-6 pt-2 pb-6">
        <WalksDial
          percent={todayProgress.percent}
          complete={goalHit}
          doneMin={todayProgress.minutes}
          goalMin={goalMin}
        />
      </div>

      {/* Week strip — 7 days Mon-Sun + summary header */}
      <section className="mb-6">
        <div className="mb-2 flex items-baseline justify-between px-1">
          <span className="text-xs font-semibold text-mango-ink-2">
            {tP("weekLabel")}
          </span>
          <span className="text-xs text-mango-ink-3">
            <strong className="font-bold text-mango-ink">{weekCount}</strong>
            {" / "}
            {WEEK_GOAL_COUNT}
            {" · "}
            <span className="tabular-nums">{weekKm.toFixed(1)}</span>
            {" km"}
          </span>
        </div>
        <WalksWeekStrip
          days={weekDayFlags}
          todayIdx={todayIdx}
          complete={goalHit}
        />
      </section>

      {/* Recent walks — compact rows by default; "全部" expands the
          current list so family members can inspect older records in
          the same flow. */}
      {loading ? (
        <p className="text-sm text-mango-ink-2">{tC("loading")}</p>
      ) : walks.length === 0 ? (
        <EmptyState
          icon={Footprints}
          title={tW("emptyWalksTitle")}
          description={tW("emptyWalksDescription")}
        />
      ) : (
        <section className="mb-6">
          <div className="mb-2 flex items-baseline justify-between px-1">
            <h3 className="text-sm font-semibold text-mango-ink">
              {tP("recentTitle")}
            </h3>
            {canToggleAllWalks && (
              <button
                type="button"
                onClick={() => setShowAllWalks((v) => !v)}
                aria-expanded={showAllWalks}
                className="rounded-full px-2 py-1 text-xs font-semibold text-mango-brand-deep transition-colors hover:bg-mango-brand-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep"
              >
                {showAllWalks ? tP("showRecent") : tP("viewAll")}
              </button>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {visibleWalks.map((w) => (
              <WalkRow
                key={w.walkId}
                walk={w}
                onDelete={() => handleDelete(w)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Manual log — secondary action; small, low-contrast so it never
          competes with the sticky CTA. */}
      <div className="mt-6 flex justify-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setManualOpen(true)}
          disabled={pets.length === 0}
          className="text-mango-ink-2 hover:bg-mango-bg-alt hover:text-mango-ink"
        >
          <Hand className="size-4" />
          {tW("manualLog")}
        </Button>
      </div>

      {/* Mobile-only spacer — sticky CTA below sits 5.75rem above
          viewport bottom (3.75rem nav + 1rem disc protrusion + 1rem
          gap). h-28 (was h-24) accounts for the taller 62px v2 pill so
          the tail content still clears it. */}
      <div className="h-28 md:hidden" aria-hidden="true" />

      {/* Sticky bottom CTA — always orange-gradient「開始遛狗」regardless
          of goal-hit state (user feedback 2026-05-25: dropped the
          white-pill "再遛一次" variant + the surrounding cream dock so
          the bar reads as a single floating pill, matching prototype's
          "solo floating pill, no dock wrapper"). */}
      {!sessionOpen && (
        <div
          className="fixed inset-x-0 z-20 px-4 py-3 md:hidden"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 5.75rem)" }}
        >
          {/* V2 pill (nav-cta-mango-v2 spec §2) — full-width 62px gradient
              capsule with a white play badge, white 19px/800 label, press
              scale(.97), and a gloss band that sweeps the full width then
              parks ~2s (`.cta-sweep`, clipped by overflow-hidden). Tokens
              only, no raw hex. */}
          <button
            type="button"
            onClick={handleStartWalking}
            disabled={pets.length === 0}
            aria-label={tW("startWalking")}
            className="group relative flex h-[62px] w-full items-center justify-center gap-3 overflow-hidden rounded-[31px] border-0 transition-transform duration-[180ms] ease-[cubic-bezier(0.34,1.4,0.64,1)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60 motion-reduce:transition-none"
            style={{
              background:
                "linear-gradient(160deg, var(--color-mango-amber), var(--color-mango-brand) 50%, var(--color-mango-brand-deep))",
              boxShadow: "0 12px 26px -8px rgba(243,152,0,0.6)",
            }}
          >
            <span
              aria-hidden="true"
              className="cta-sweep pointer-events-none absolute -top-3 -bottom-3 w-[82px] -skew-x-[18deg]"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(255,255,255,0.62), transparent)",
              }}
            />
            <span
              aria-hidden="true"
              className="relative grid size-10 place-items-center rounded-full"
              style={{ background: "rgba(255,255,255,0.22)" }}
            >
              <Play className="size-5 text-white" fill="currentColor" />
            </span>
            <span className="relative text-[19px] font-extrabold tracking-[0.5px] text-white">
              {tW("startWalking")}
            </span>
          </button>
        </div>
      )}

      {/* Desktop CTA — same label as the sticky (no variant swap).
          `text-white` overrides CTA_MANGO's `text-mango-ink` per user
          2026-05-25 — white reads as a stronger primary on the orange
          gradient. The "去新增寵物" empty-state link still uses
          CTA_MANGO unchanged (ink), so the override only fires here. */}
      <div className="mt-4 hidden justify-center md:flex">
        <Button
          onClick={handleStartWalking}
          size="lg"
          disabled={pets.length === 0}
          className={cn(
            "h-14 w-full max-w-xs text-base font-bold sm:text-lg",
            CTA_MANGO,
            "text-white hover:text-white",
          )}
        >
          <Play className="size-5" />
          {tW("startWalking")}
        </Button>
      </div>

      <WalkTrackingView
        open={sessionOpen}
        walkId={pendingWalkId}
        onClose={() => {
          setSessionOpen(false);
          // Walk session ended (saved or abandoned) — pendingWalkId
          // is single-use, clear it so the next walk attempt mints a
          // fresh one.
          setPendingWalkId(null);
          void refresh();
        }}
        pet={activePet}
        streakDays={streakDays}
        storedTodayMin={todayProgress.minutes}
        goalMin={goalMin}
        weeklyAvgMin={weeklyAvgMin}
        onComplete={handleCreate}
        onUpdate={updateWalkDetails}
        onDiscard={discardCurrentWalk}
      />
      <ManualWalkDialog
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        pets={pets}
        streakDays={streakDays}
        onSubmit={handleCreate}
      />

      {/* ── Auto-photo-share flow A: walk-start prompt ──
          Sheet → optional camera → composer. All gated on pendingWalkId
          being non-null, so they only render in the brief window
          between [開始遛狗] click and tracking actually starting. */}
      <input
        ref={startPhotoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleStartPhotoPicked}
        aria-hidden="true"
      />
      {activePet && (
        <>
          {/* Auto-share to feed is a community action — guests can walk
              but can't post, so the share prompt never fires for them.
              Spec §C (walks 自動發動態 gated). */}
          <PhotoPromptSheet
            open={startPromptOpen && !isGuest}
            onSkip={handleStartPromptSkip}
            onTake={handleStartPromptTake}
            petName={activePet.name}
            phase="start"
          />
          <PostComposer
            open={startComposerOpen}
            onClose={handleStartComposerClose}
            pets={pets}
            initialPhoto={startPhoto ?? undefined}
            initialCaption={
              startPhoto
                ? tPP("captionStartDefault", { pet: activePet.name })
                : undefined
            }
            walkId={pendingWalkId ?? undefined}
          />
        </>
      )}
    </>
  );
}
