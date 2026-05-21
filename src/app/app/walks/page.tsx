"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Footprints, Hand, Play, Plus } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useFamily } from "@/components/family/family-provider";
import { RouteHeader } from "@/components/nav/route-header";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { WalkSessionDialog } from "@/components/walks/walk-session-dialog";
import { ManualWalkDialog } from "@/components/walks/manual-walk-dialog";
import { WalkCard } from "@/components/walks/walk-card";
import { createWalk, deleteWalk, listWalks } from "@/lib/firebase/walks";
import { listPets } from "@/lib/firebase/pets";
import { computeStreak } from "@/lib/scoring";
import type { Pet, Walk, WalkInput } from "@/lib/types";
import type { Timestamp } from "firebase/firestore";

export default function WalksPage() {
  const t = useTranslations("Nav");
  const tC = useTranslations("Common");
  const askConfirm = useConfirm();
  const { user } = useAuth();
  const { family, loading: familyLoading } = useFamily();

  const [pets, setPets] = useState<Pet[]>([]);
  const [walks, setWalks] = useState<Walk[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!user || !family) return;
    setLoading(true);
    try {
      const [petR, walkR] = await Promise.allSettled([
        listPets(family.familyId),
        listWalks(family.familyId),
      ]);
      setPets(petR.status === "fulfilled" ? petR.value : []);
      setWalks(walkR.status === "fulfilled" ? walkR.value : []);
    } finally {
      setLoading(false);
    }
  }, [user, family]);

  useEffect(() => {
    if (familyLoading) return;
    refresh();
  }, [familyLoading, refresh]);

  const streakDays = useMemo(
    () =>
      computeStreak(
        walks.map((w) => new Date((w.startedAt as Timestamp).toMillis())),
      ),
    [walks],
  );

  const weekTotals = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86_400_000;
    const recent = walks.filter(
      (w) => (w.startedAt as Timestamp).toMillis() > weekAgo,
    );
    return {
      count: recent.length,
      distanceKm: recent.reduce((s, w) => s + w.distanceKm, 0),
      durationMin: recent.reduce((s, w) => s + w.durationMin, 0),
      score: recent.reduce((s, w) => s + w.score, 0),
    };
  }, [walks]);

  async function handleCreate(input: WalkInput & { score: number }) {
    if (!user || !family) return;
    const { score, ...rest } = input;
    await createWalk({
      ...rest,
      familyId: family.familyId,
      walkerUid: user.uid,
      walkerName: user.displayName ?? undefined,
      walkerPhotoURL: user.photoURL,
      score,
    });
    await refresh();
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

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <RouteHeader
          title={t("walks")}
          subtitle="GPS 追蹤 + 手動補登"
          className="mb-0"
        />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-2 rounded-lg border border-zinc-200/80 bg-white p-4 text-center shadow-sm shadow-zinc-200/40 sm:grid-cols-4 dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-none">
        <Stat label="連續天數" value={`${streakDays}`} suffix="天" accent />
        <Stat label="本週次數" value={`${weekTotals.count}`} />
        <Stat label="本週距離" value={`${weekTotals.distanceKm.toFixed(1)}`} suffix="km" />
        <Stat label="本週分數" value={`${weekTotals.score.toFixed(0)}`} />
      </div>

      <div className="mb-6 flex flex-col gap-2 sm:flex-row">
        <Button
          onClick={() => setSessionOpen(true)}
          disabled={pets.length === 0}
          size="md"
          className="flex-1"
        >
          <Play className="size-4" />
          開始遛狗
        </Button>
        <Button
          variant="secondary"
          onClick={() => setManualOpen(true)}
          disabled={pets.length === 0}
          className="sm:w-auto"
        >
          <Hand className="size-4" />
          補登
        </Button>
      </div>

      {pets.length === 0 ? (
        <EmptyState
          icon={Footprints}
          title="先新增寵物"
          description="遛狗前需要先建立寵物資料，才能算分數。"
        />
      ) : loading ? (
        <p className="text-sm text-zinc-500">{tC("loading")}</p>
      ) : walks.length === 0 ? (
        <EmptyState
          icon={Footprints}
          title="尚無遛狗紀錄"
          description="按下「開始遛狗」即時追蹤，或「補登」手動加入。"
          action={
            <Button onClick={() => setSessionOpen(true)}>
              <Plus className="size-4" />
              第一次遛狗
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {walks.map((w) => (
            <WalkCard key={w.walkId} walk={w} onDelete={() => handleDelete(w)} />
          ))}
        </div>
      )}

      <WalkSessionDialog
        open={sessionOpen}
        onClose={() => setSessionOpen(false)}
        pets={pets}
        streakDays={streakDays}
        onComplete={handleCreate}
      />
      <ManualWalkDialog
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        pets={pets}
        streakDays={streakDays}
        onSubmit={handleCreate}
      />
    </>
  );
}

function Stat({
  label,
  value,
  suffix,
  accent,
}: {
  label: string;
  value: string;
  suffix?: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[10px] text-zinc-500">{label}</span>
      <span
        className={`text-lg font-bold tabular-nums ${
          accent ? "text-amber-600 dark:text-amber-400" : ""
        }`}
      >
        {value}
        {suffix && <span className="text-xs font-normal text-zinc-500 ml-0.5">{suffix}</span>}
      </span>
    </div>
  );
}
