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
  onSubmit: (input: WalkInput & { score: number }) => Promise<void>;
};

export function ManualWalkDialog({
  open,
  onClose,
  pets,
  streakDays,
  onSubmit,
}: Props) {
  const tC = useTranslations("Common");
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
    setPetId(pets[0]?.petId ?? "");
    setStartedAt(toLocalDatetimeInput(new Date(Date.now() - 60 * 60 * 1000)));
    setEndedAt(toLocalDatetimeInput(new Date()));
    setDistance("");
    setDuration("");
    setNotes("");
    setError(null);
  }, [open, pets]);

  // Auto-compute duration if both times set
  useEffect(() => {
    if (startedAt && endedAt) {
      const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
      if (ms > 0) {
        setDuration(String(Math.round(ms / 60_000)));
      }
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
    <Dialog open={open} onClose={onClose} title="手動補登遛狗">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <FieldLabel>寵物</FieldLabel>
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

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <FieldLabel>開始時間</FieldLabel>
            <Input
              type="datetime-local"
              value={startedAt}
              onChange={(e) => setStartedAt(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <FieldLabel>結束時間</FieldLabel>
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
            <FieldLabel>距離 (km)</FieldLabel>
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
            <FieldLabel>時長 (分鐘)</FieldLabel>
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
          <FieldLabel>備註 (選填)</FieldLabel>
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
