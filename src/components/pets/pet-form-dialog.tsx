"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Camera } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, FieldLabel } from "@/components/ui/select";
import { fromLocalDateInput, toLocalDateInput } from "@/lib/dates";
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
  const [avatar, setAvatar] = useState<File | null>(null);
  const [previewURL, setPreviewURL] = useState<string | null>(null);
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
    setAvatar(null);
    setPreviewURL(initial?.photoURL ?? null);
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
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="relative size-24 rounded-full overflow-hidden bg-amber-100 dark:bg-zinc-800 ring-2 ring-amber-300/60 flex items-center justify-center"
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
              <Camera className="size-8 text-amber-500" />
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setAvatar(file);
            }}
          />
        </div>

        <div className="flex flex-col gap-1">
          <FieldLabel>Name</FieldLabel>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="芒果"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <FieldLabel>Species</FieldLabel>
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
            <FieldLabel>Gender</FieldLabel>
            <Select
              value={gender}
              onChange={(e) => setGender(e.target.value as Gender)}
            >
              <option value="unknown">—</option>
              <option value="male">♂</option>
              <option value="female">♀</option>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <FieldLabel>Breed</FieldLabel>
          <Input
            value={breed}
            onChange={(e) => setBreed(e.target.value)}
            placeholder="柴犬 / Shiba"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <FieldLabel>Weight (kg)</FieldLabel>
            <Input
              type="number"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="8.5"
            />
          </div>
          <div className="flex flex-col gap-1">
            <FieldLabel>Birthday</FieldLabel>
            <Input
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <FieldLabel>Bio</FieldLabel>
          <Textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="個性、喜好..."
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            {tCommon("cancel")}
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "..." : tCommon("save")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
