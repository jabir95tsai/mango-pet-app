"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, FieldLabel } from "@/components/ui/select";
import { computeWalkScore } from "@/lib/scoring";
import { toLocalDatetimeInput } from "@/lib/dates";
import type { Pet, WalkInput } from "@/lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  pets: Pet[];
  streakDays: number;
  /** Caller may return a `{ walkId }` (e.g., shared `handleCreate`
   *  on the walks page) but this dialog doesn't read it — the
   *  union widens the type purely so the same handler works for
   *  both this dialog and WalkTrackingView. */
  onSubmit: (
    input: WalkInput & { score: number },
  ) => Promise<{ walkId: string } | null | void>;
};

export function ManualWalkDialog({
  open,
  onClose,
  pets,
  streakDays,
  onSubmit,
}: Props) {
  const tC = useTranslations("Common");
  const tM = useTranslations("Walks.manual");
  const [petId, setPetId] = useState("");
  const [startedAt, setStartedAt] = useState(
    toLocalDatetimeInput(new Date(Date.now() - 60 * 60 * 1000)),
  );
  const [endedAt, setEndedAt] = useState(toLocalDatetimeInput(new Date()));
  const [distance, setDistance] = useState("");
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // Compute initial duration here (not via a separate effect that races with
    // this one — when the strings collide, the dep array bail-out swallows the
    // re-compute and the field stays empty).
    const start = new Date(Date.now() - 60 * 60 * 1000);
    const end = new Date();
    const initialDuration = Math.max(
      1,
      Math.round((end.getTime() - start.getTime()) / 60_000),
    );
    setPetId(pets[0]?.petId ?? "");
    setStartedAt(toLocalDatetimeInput(start));
    setEndedAt(toLocalDatetimeInput(end));
    setDistance("");
    setDuration(String(initialDuration));
    setNotes("");
    setError(null);
  }, [open, pets]);

  // Re-compute duration whenever the user manually changes start/end times.
  useEffect(() => {
    if (!startedAt || !endedAt) return;
    const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
    if (ms > 0) {
      setDuration(String(Math.round(ms / 60_000)));
    }
  }, [startedAt, endedAt]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const distNum = Number(distance);
    const durNum = Number(duration);
    if (!petId || Number.isNaN(distNum) || distNum <= 0 || Number.isNaN(durNum) || durNum <= 0) {
      setError("請填寫寵物、距離、時長");
      return;
    }
    const startD = new Date(startedAt);
    const endD = new Date(endedAt);
    if (Number.isNaN(startD.getTime()) || Number.isNaN(endD.getTime()) || endD <= startD) {
      setError("結束時間需晚於開始時間");
      return;
    }

    const pet = pets.find((p) => p.petId === petId);
    const score = computeWalkScore({
      distanceKm: distNum,
      durationMin: durNum,
      pet,
      streakDays,
    });

    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        petId,
        petName: pet?.name,
        startedAt: startD,
        endedAt: endD,
        distanceKm: distNum,
        durationMin: durNum,
        isManual: true,
        notes: notes.trim() || undefined,
        score,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={tM("title")}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <FieldLabel>{tM("pet")}</FieldLabel>
          <Select value={petId} onChange={(e) => setPetId(e.target.value)}>
            {pets.length === 0 ? (
              <option value="">{tM("noPet")}</option>
            ) : (
              pets.map((p) => (
                <option key={p.petId} value={p.petId}>
                  {p.name}
                </option>
              ))
            )}
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <FieldLabel>{tM("start")}</FieldLabel>
            <Input
              type="datetime-local"
              value={startedAt}
              onChange={(e) => setStartedAt(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <FieldLabel>{tM("end")}</FieldLabel>
            <Input
              type="datetime-local"
              value={endedAt}
              onChange={(e) => setEndedAt(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <FieldLabel>{tM("distance")}</FieldLabel>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <FieldLabel>{tM("duration")}</FieldLabel>
            <Input
              type="number"
              step="1"
              min="0"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <FieldLabel>{tM("notes")}</FieldLabel>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            {tC("cancel")}
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "..." : tC("save")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
