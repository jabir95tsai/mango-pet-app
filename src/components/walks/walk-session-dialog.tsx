"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Footprints, Play, Square } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, FieldLabel } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { WalkSession, type WalkSessionState } from "@/lib/walk-tracking";
import { computeWalkScore } from "@/lib/scoring";
import type { Pet, WalkInput } from "@/lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  pets: Pet[];
  streakDays: number;
  onComplete: (input: WalkInput & { score: number }) => Promise<void>;
};

export function WalkSessionDialog({
  open,
  onClose,
  pets,
  streakDays,
  onComplete,
}: Props) {
  const tC = useTranslations("Common");
  const sessionRef = useRef<WalkSession | null>(null);
  const [state, setState] = useState<WalkSessionState | null>(null);
  const [petId, setPetId] = useState("");
  const [notes, setNotes] = useState("");
  const [phase, setPhase] = useState<"setup" | "tracking" | "done">("setup");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const session = new WalkSession();
    sessionRef.current = session;
    const unsub = session.on(setState);
    setPetId(pets[0]?.petId ?? "");
    setNotes("");
    setPhase("setup");
    setSaveError(null);
    return () => {
      unsub();
      session.stop();
      sessionRef.current = null;
    };
  }, [open, pets]);

  function handleStart() {
    if (!petId) return;
    sessionRef.current?.start();
    setPhase("tracking");
  }

  function handleStop() {
    sessionRef.current?.stop();
    setPhase("done");
  }

  async function handleSave() {
    if (!sessionRef.current || !state || !state.startedAt) return;
    const pet = pets.find((p) => p.petId === petId);
    setSaving(true);
    setSaveError(null);
    try {
      const score = computeWalkScore({
        distanceKm: state.totalDistanceKm,
        durationMin: state.durationMin,
        pet,
        streakDays,
      });
      await onComplete({
        petId,
        petName: pet?.name,
        startedAt: state.startedAt,
        endedAt: new Date(),
        distanceKm: state.totalDistanceKm,
        durationMin: state.durationMin,
        path: state.path,
        isManual: false,
        notes: notes.trim() || undefined,
        score,
      });
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "儲存失敗");
    } finally {
      setSaving(false);
    }
  }

  const pet = pets.find((p) => p.petId === petId);
  const liveScore =
    state && pet
      ? computeWalkScore({
          distanceKm: state.totalDistanceKm,
          durationMin: state.durationMin,
          pet,
          streakDays,
        })
      : 0;

  return (
    <Dialog open={open} onClose={onClose} title="開始遛狗">
      {phase === "setup" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <FieldLabel>選擇寵物</FieldLabel>
            <Select value={petId} onChange={(e) => setPetId(e.target.value)}>
              {pets.length === 0 ? (
                <option value="">先新增寵物</option>
              ) : (
                pets.map((p) => (
                  <option key={p.petId} value={p.petId}>
                    {p.name}
                  </option>
                ))
              )}
            </Select>
          </div>
          <p className="text-xs text-zinc-500">
            ⚠️ 開始後請保持 App 開著且螢幕亮著。鎖屏後手機瀏覽器會停止 GPS。
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={onClose}>
              {tC("cancel")}
            </Button>
            <Button onClick={handleStart} disabled={!petId}>
              <Play className="size-4" />
              開始追蹤
            </Button>
          </div>
        </div>
      )}

      {phase === "tracking" && state && (
        <div className="flex flex-col gap-5 items-center">
          <div className="flex flex-col items-center gap-1">
            <Footprints className="size-10 text-amber-500 animate-pulse" />
            <p className="text-xs text-zinc-500">追蹤中</p>
          </div>

          <div className="grid grid-cols-3 gap-2 w-full text-center">
            <Stat label="距離" value={`${state.totalDistanceKm.toFixed(2)}`} suffix="km" />
            <Stat label="時長" value={`${state.durationMin.toFixed(1)}`} suffix="min" />
            <Stat label="分數" value={liveScore.toFixed(1)} accent />
          </div>

          {state.lastError && (
            <p className="text-xs text-red-600 text-center">{state.lastError}</p>
          )}

          <Button variant="danger" size="lg" onClick={handleStop}>
            <Square className="size-4" />
            停止
          </Button>
        </div>
      )}

      {phase === "done" && state && (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl bg-amber-50 dark:bg-amber-500/10 p-4 grid grid-cols-3 gap-2 text-center">
            <Stat label="距離" value={`${state.totalDistanceKm.toFixed(2)}`} suffix="km" small />
            <Stat label="時長" value={`${state.durationMin.toFixed(1)}`} suffix="min" small />
            <Stat label="分數" value={liveScore.toFixed(1)} accent small />
          </div>
          <div className="flex flex-col gap-1">
            <FieldLabel>備註 (選填)</FieldLabel>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {saveError && <p className="text-sm text-red-600">{saveError}</p>}
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              {tC("cancel")}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "..." : tC("save")}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function Stat({
  label,
  value,
  suffix,
  accent,
  small,
}: {
  label: string;
  value: string;
  suffix?: string;
  accent?: boolean;
  small?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
        {label}
      </span>
      <span
        className={`font-bold tabular-nums ${small ? "text-base" : "text-2xl"} ${
          accent ? "text-amber-600 dark:text-amber-400" : ""
        }`}
      >
        {value}
        {suffix && (
          <span className="ml-0.5 text-xs font-normal text-zinc-500">
            {suffix}
          </span>
        )}
      </span>
    </div>
  );
}
