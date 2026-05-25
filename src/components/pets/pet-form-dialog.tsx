"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Camera, Loader2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, FieldLabel } from "@/components/ui/select";
import { fromLocalDateInput, toLocalDateInput } from "@/lib/dates";
import { IMAGE_PRESETS, processImage } from "@/lib/image-processing";
import { PetWalkGoalInput } from "@/components/pets/pet-walk-goal-input";
import { DEFAULT_WALK_GOAL_MINUTES, getPetWalkGoalMinutes } from "@/lib/walk-goals";
import type { Pet, PetInput, Species, Gender } from "@/lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  initial?: Pet;
  onSubmit: (input: PetInput, avatar?: File) => Promise<void>;
};

export function PetFormDialog({ open, onClose, initial, onSubmit }: Props) {
  const tPet = useTranslations("Pet");
  const tCommon = useTranslations("Common");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [species, setSpecies] = useState<Species>("dog");
  const [breed, setBreed] = useState("");
  const [gender, setGender] = useState<Gender>("unknown");
  const [weight, setWeight] = useState("");
  const [birthday, setBirthday] = useState("");
  const [bio, setBio] = useState("");
  const [walkGoalMin, setWalkGoalMin] = useState(DEFAULT_WALK_GOAL_MINUTES);
  // Snapshot of the initial pet's walkGoal source so the input chip
  // reflects "建議值（可覆蓋）" when loaded from a future computed
  // recommendation. This round always writes back 'manual' since the
  // user explicitly touched the stepper to save.
  const [walkGoalSource, setWalkGoalSource] = useState<"manual" | "computed">(
    "manual",
  );
  const [avatar, setAvatar] = useState<File | null>(null);
  const [previewURL, setPreviewURL] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setSpecies(initial?.species ?? "dog");
    setBreed(initial?.breed ?? "");
    setGender(initial?.gender ?? "unknown");
    setWeight(initial?.weightKg?.toString() ?? "");
    setBirthday(
      initial?.birthday
        ? toLocalDateInput(new Date(initial.birthday.toMillis()))
        : "",
    );
    setBio(initial?.bio ?? "");
    // Seed from existing pet's goal via the same clamp/fallback the
    // rest of the app uses; first-edit on a legacy pet shows 30.
    setWalkGoalMin(getPetWalkGoalMinutes(initial ?? null));
    setWalkGoalSource(initial?.walkGoal?.source ?? "manual");
    setAvatar(null);
    setPreviewURL(initial?.photoURL ?? null);
    setProcessing(false);
    setError(null);
  }, [open, initial]);

  useEffect(() => {
    if (!avatar) return;
    const url = URL.createObjectURL(avatar);
    setPreviewURL(url);
    return () => URL.revokeObjectURL(url);
  }, [avatar]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit(
        {
          name: name.trim(),
          species,
          breed: breed.trim() || undefined,
          gender,
          weightKg: weight ? Number(weight) : undefined,
          birthday: birthday ? fromLocalDateInput(birthday) : undefined,
          bio: bio.trim() || undefined,
          // Always write 'manual' on save — even if the input was
          // seeded from a 'computed' value, the act of saving means
          // the user reviewed it. Future spec may refine this (e.g.,
          // only flip to manual when the value differs from the
          // computed recommendation).
          walkGoal: { minutes: walkGoalMin, source: "manual" },
        },
        avatar ?? undefined,
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={initial ? tCommon("edit") : tPet("addPet")}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={processing}
            aria-label={tPet("fields.photo")}
            aria-busy={processing}
            className="relative size-24 rounded-full overflow-hidden bg-amber-100 dark:bg-zinc-800 ring-2 ring-amber-300/60 hover:ring-amber-500 flex items-center justify-center transition-colors disabled:cursor-wait"
          >
            {previewURL ? (
              <Image
                src={previewURL}
                alt="avatar"
                fill
                sizes="96px"
                className="object-cover"
                unoptimized
              />
            ) : (
              <Camera className="size-8 text-amber-700 dark:text-amber-400" />
            )}
            {processing && (
              <div className="absolute inset-0 bg-black/50 grid place-items-center">
                <Loader2 className="size-6 text-white animate-spin" />
              </div>
            )}
          </button>
          {processing ? (
            <span className="text-xs text-amber-600">處理中…</span>
          ) : !previewURL ? (
            <span className="text-xs text-zinc-500">{tPet("fields.photo")}</span>
          ) : null}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setProcessing(true);
              setError(null);
              try {
                const processed = await processImage(file, IMAGE_PRESETS.avatar);
                setAvatar(processed);
              } catch (err) {
                setError(err instanceof Error ? err.message : "圖片處理失敗");
              } finally {
                setProcessing(false);
              }
            }}
          />
        </div>

        <div className="flex flex-col gap-1">
          <FieldLabel>{tPet("fields.name")}</FieldLabel>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={tPet("fields.namePlaceholder")}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <FieldLabel>{tPet("fields.species")}</FieldLabel>
            <Select
              value={species}
              onChange={(e) => setSpecies(e.target.value as Species)}
            >
              <option value="dog">{tPet("species.dog")}</option>
              <option value="cat">{tPet("species.cat")}</option>
              <option value="other">{tPet("species.other")}</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <FieldLabel>{tPet("fields.gender")}</FieldLabel>
            <Select
              value={gender}
              onChange={(e) => setGender(e.target.value as Gender)}
            >
              <option value="unknown">{tPet("gender.unspecified")}</option>
              <option value="male">{tPet("gender.male")}</option>
              <option value="female">{tPet("gender.female")}</option>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <FieldLabel>{tPet("fields.breed")}</FieldLabel>
          <Input
            value={breed}
            onChange={(e) => setBreed(e.target.value)}
            placeholder={tPet("fields.breedPlaceholder")}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <FieldLabel>{tPet("fields.weight")}</FieldLabel>
            <Input
              type="number"
              step="0.1"
              min="0"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="8.5"
            />
          </div>
          <div className="flex flex-col gap-1">
            <FieldLabel>{tPet("fields.birthday")}</FieldLabel>
            <Input
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
            />
          </div>
        </div>

        <PetWalkGoalInput
          value={walkGoalMin}
          onChange={setWalkGoalMin}
          source={walkGoalSource}
        />

        <div className="flex flex-col gap-1">
          <FieldLabel>{tPet("fields.bio")}</FieldLabel>
          <Textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder={tPet("fields.bioPlaceholder")}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 justify-end pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={saving || processing}
          >
            {tCommon("cancel")}
          </Button>
          <Button type="submit" disabled={saving || processing}>
            {saving ? "..." : tCommon("save")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
