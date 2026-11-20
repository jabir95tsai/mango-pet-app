"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Camera, Loader2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, FieldLabel } from "@/components/ui/select";
import { fromLocalDateInput, toLocalDateInput } from "@/lib/dates";
import { recommendPetWalkGoal } from "@/lib/firebase/ai-walk-goal";
import { IMAGE_PRESETS, processImage } from "@/lib/image-processing";
import { PetWalkGoalInput } from "@/components/pets/pet-walk-goal-input";
import { SaveToAlbumButton } from "@/components/ui/save-to-album-button";
import { DEFAULT_WALK_GOAL_MINUTES, getPetWalkGoalMinutes } from "@/lib/walk-goals";
import type {
  Pet,
  PetInput,
  Species,
  Gender,
  WalkGoalRecommendation,
} from "@/lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  initial?: Pet;
  onSubmit: (input: PetInput, avatar?: File) => Promise<void>;
};

export function PetFormDialog({ open, onClose, initial, onSubmit }: Props) {
  const locale = useLocale();
  const tPet = useTranslations("Pet");
  const tWalkGoal = useTranslations("PetEdit.walkGoal");
  const tCommon = useTranslations("Common");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recommendReqIdRef = useRef(0);

  const [name, setName] = useState("");
  const [species, setSpecies] = useState<Species>("dog");
  // Free-text animal type, shown + saved only when species === "other".
  const [speciesOther, setSpeciesOther] = useState("");
  const [breed, setBreed] = useState("");
  const [gender, setGender] = useState<Gender>("unknown");
  const [weight, setWeight] = useState("");
  const [birthday, setBirthday] = useState("");
  const [bio, setBio] = useState("");
  const [walkGoalMin, setWalkGoalMin] = useState(DEFAULT_WALK_GOAL_MINUTES);
  // Tracks whether the current walkGoalMin matches an AI recommendation
  // ("computed") or was entered/overridden manually ("manual").
  const [walkGoalSource, setWalkGoalSource] = useState<"manual" | "computed">(
    "manual",
  );
  const [computedMinutes, setComputedMinutes] = useState<number | null>(null);
  const [recommendation, setRecommendation] =
    useState<WalkGoalRecommendation | null>(null);
  const [recommending, setRecommending] = useState(false);
  const [recommendError, setRecommendError] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [previewURL, setPreviewURL] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    recommendReqIdRef.current += 1;
    if (!open) return;
    const loadedMinutes = getPetWalkGoalMinutes(initial ?? null);
    const loadedSource = initial?.walkGoal?.source ?? "manual";
    setName(initial?.name ?? "");
    setSpecies(initial?.species ?? "dog");
    setSpeciesOther(initial?.speciesOther ?? "");
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
    setWalkGoalMin(loadedMinutes);
    setWalkGoalSource(loadedSource);
    setComputedMinutes(loadedSource === "computed" ? loadedMinutes : null);
    setRecommendation(null);
    setRecommending(false);
    setRecommendError(null);
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

  function handleWalkGoalChange(next: number) {
    setWalkGoalMin(next);
    setWalkGoalSource(
      computedMinutes !== null && next === computedMinutes
        ? "computed"
        : "manual",
    );
  }

  function handleApplyRecommendation(minutes: number) {
    setComputedMinutes(minutes);
    setWalkGoalMin(minutes);
    setWalkGoalSource("computed");
  }

  async function handleRequestRecommend() {
    const reqId = ++recommendReqIdRef.current;
    setRecommending(true);
    setRecommendError(null);
    try {
      const parsedWeight = weight.trim() ? Number(weight) : undefined;
      const validWeight =
        parsedWeight !== undefined &&
        Number.isFinite(parsedWeight) &&
        parsedWeight > 0
          ? parsedWeight
          : undefined;
      const result = await recommendPetWalkGoal({
        species,
        speciesOther:
          species === "other" ? speciesOther.trim() || undefined : undefined,
        breed: breed.trim() || undefined,
        birthday: birthday || undefined,
        gender,
        weightKg: validWeight,
        petId: initial?.petId,
        bio: bio.trim() || undefined,
        locale: locale === "en" ? "en" : "zh-TW",
      });
      if (recommendReqIdRef.current !== reqId) return;
      setRecommendation(result);
      setComputedMinutes(result.minutes);
      setWalkGoalMin(result.minutes);
      setWalkGoalSource("computed");
    } catch (err) {
      if (recommendReqIdRef.current !== reqId) return;
      const code =
        typeof err === "object" && err !== null && "code" in err
          ? String((err as { code?: unknown }).code ?? "")
          : "";
      if (code === "functions/resource-exhausted") {
        setRecommendError(tWalkGoal("aiErrorRateLimit"));
      } else if (code === "functions/failed-precondition") {
        setRecommendError(tWalkGoal("aiErrorUnavailable"));
      } else {
        setRecommendError(tWalkGoal("aiErrorGeneric"));
      }
    } finally {
      if (recommendReqIdRef.current === reqId) {
        setRecommending(false);
      }
    }
  }

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
          // Only meaningful for "other"; send undefined otherwise so the
          // data layer clears any stale value.
          speciesOther:
            species === "other" ? speciesOther.trim() || undefined : undefined,
          breed: breed.trim() || undefined,
          gender,
          weightKg: weight ? Number(weight) : undefined,
          birthday: birthday ? fromLocalDateInput(birthday) : undefined,
          bio: bio.trim() || undefined,
          walkGoal: { minutes: walkGoalMin, source: walkGoalSource },
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
            <span className="text-xs text-amber-600">{tPet("processing")}</span>
          ) : !previewURL ? (
            <span className="text-xs text-zinc-500">{tPet("fields.photo")}</span>
          ) : null}
          {/* Save-to-album — appears only after the user just picked
              a new file (avatar set) AND the browser supports Web
              Share with files. On legacy pet edit with no new pick
              (avatar still null), the existing photoURL lives on
              Storage with no File handle, so nothing to share. */}
          {avatar && (
            <SaveToAlbumButton
              file={avatar}
              title={name.trim() || tPet("fields.photo")}
              className="size-9"
            />
          )}
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
                setError(err instanceof Error ? err.message : tPet("imageError"));
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

        {/* Custom animal type — only when "其他/other" is picked, so the
            dropdown stays simple for the common dog/cat cases. */}
        {species === "other" && (
          <div className="flex flex-col gap-1">
            <FieldLabel>{tPet("fields.speciesOther")}</FieldLabel>
            <Input
              value={speciesOther}
              onChange={(e) => setSpeciesOther(e.target.value)}
              placeholder={tPet("fields.speciesOtherPlaceholder")}
            />
          </div>
        )}

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
          onChange={handleWalkGoalChange}
          source={walkGoalSource}
          onRequestRecommend={handleRequestRecommend}
          recommending={recommending}
          recommendation={recommendation}
          recommendError={recommendError}
          onApplyRecommendation={handleApplyRecommendation}
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
