/**
 * Pet add/edit form — 1:1 with apps/web/src/components/pets/pet-form-dialog.tsx:
 *  - 96pt round avatar button (photo, else a Camera glyph on brandTint with an
 *    amber ring) + "tap to add a photo" caption; picked via the system photo
 *    picker (PHPicker — no library permission needed) and compressed to
 *    IMAGE_PRESETS.avatar on upload;
 *  - name → species / gender → (speciesOther) → breed → weight (placeholder
 *    8.5) / birthday → daily walk-goal stepper (PetEdit.walkGoal.*, clamp
 *    WALK_GOAL_MIN..MAX = 5–180, step 5, + hint) → bio;
 *  - title Common.edit when editing, Pet.addPet when adding;
 *  - a failed save shows the real error (web shows err.message) and the sheet
 *    stays open.
 * Edit mode adds the destructive "Delete {name}" row (web detail-mode button +
 * handleDeletePet confirm copy), deleting through pets-write deletePet — the
 * same client path as web.
 *
 * Writes via pets-write (createPet / updatePet / deletePet).
 */
import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Camera } from "lucide-react-native";
import {
  getPetWalkGoalMinutes,
  WALK_GOAL_MAX_MINUTES,
  WALK_GOAL_MIN_MINUTES,
  WALK_GOAL_STEP_MINUTES,
} from "@mango/shared-business";
import type { Gender, Pet, PetInput, Species } from "@mango/shared-types";

import { alertError, confirm } from "@/lib/confirm";
import { createPet, deletePet, updatePet } from "@/lib/pets-write";
import { t } from "@/lib/i18n";
import { colors, radius, spacing } from "@/theme/theme";
import {
  FormSheet,
  OptionalDateField,
  SelectField,
  StepperField,
  TextField,
} from "./form-sheet";

const SPECIES: Species[] = ["dog", "cat", "other"];
const GENDERS: Gender[] = ["unknown", "male", "female"];

/** Pet.gender.* keys: web labels the "unknown" option `gender.unspecified`. */
function genderLabel(g: Gender): string {
  return t(`Pet.gender.${g === "unknown" ? "unspecified" : g}`);
}

function tsToDate(ts: unknown): Date | null {
  const d = ts as { toDate?: () => Date } | undefined;
  return d?.toDate ? d.toDate() : null;
}

/** Local midnight of the picked day (web fromLocalDateInput of a date input). */
function dayOf(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function errorMessage(err: unknown): string | undefined {
  return err instanceof Error && err.message ? err.message : undefined;
}

export function PetForm({
  familyId,
  uid,
  pet,
  onClose,
  onSaved,
  onDeleted,
}: {
  familyId: string | null;
  uid: string;
  pet?: Pet;
  onClose: () => void;
  onSaved: () => void;
  /** Edit mode: called after the pet was deleted (before onClose). */
  onDeleted?: () => void;
}) {
  const editing = !!pet;
  const [name, setName] = useState(pet?.name ?? "");
  const [species, setSpecies] = useState<Species>(pet?.species ?? "dog");
  const [speciesOther, setSpeciesOther] = useState(pet?.speciesOther ?? "");
  const [breed, setBreed] = useState(pet?.breed ?? "");
  const [gender, setGender] = useState<Gender>(pet?.gender ?? "unknown");
  const [weight, setWeight] = useState(
    pet?.weightKg != null ? String(pet.weightKg) : "",
  );
  const [birthday, setBirthday] = useState<Date | null>(
    pet ? tsToDate(pet.birthday) : null,
  );
  const [bio, setBio] = useState(pet?.bio ?? "");
  const [goal, setGoal] = useState(getPetWalkGoalMinutes(pet ?? null));
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [photoBroken, setPhotoBroken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const busy = saving || deleting;

  const valid = name.trim().length > 0;
  const previewUri = avatarUri ?? (!photoBroken ? (pet?.photoURL ?? null) : null);

  async function pickAvatar() {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });
      if (!res.canceled && res.assets[0]) setAvatarUri(res.assets[0].uri);
    } catch {
      alertError(t("Pet.imageError"));
    }
  }

  async function save() {
    if (!valid || busy) return;
    setSaving(true);
    try {
      const w = parseFloat(weight.replace(/,/g, "."));
      const input: PetInput = {
        name: name.trim(),
        species,
        speciesOther:
          species === "other" ? speciesOther.trim() || undefined : undefined,
        breed: breed.trim() || undefined,
        gender,
        weightKg: Number.isFinite(w) && w > 0 ? w : undefined,
        bio: bio.trim() || undefined,
        birthday: birthday ? dayOf(birthday) : undefined,
        // Web always writes 'manual' on save (the user reviewed the value).
        walkGoal: { minutes: goal, source: "manual" },
      };
      if (editing && pet) {
        await updatePet(pet.petId, input, uid, avatarUri ?? undefined);
      } else {
        await createPet(familyId, uid, input, avatarUri ?? undefined);
      }
      onSaved();
      onClose();
    } catch (err) {
      alertError(errorMessage(err) ?? t("Family.actionFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!pet || busy) return;
    const ok = await confirm({
      title: `${t("Common.delete")}: ${pet.name}`,
      message: t("PetsPage.deletePetBody"),
      confirmLabel: t("Common.delete"),
      cancelLabel: t("Common.cancel"),
      destructive: true,
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await deletePet(pet.petId);
      onDeleted?.();
      onSaved();
      onClose();
    } catch (err) {
      alertError(errorMessage(err) ?? t("Family.actionFailed"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <FormSheet
      visible
      title={editing ? t("Common.edit") : t("Pet.addPet")}
      onCancel={onClose}
      onSave={save}
      saving={busy}
      saveDisabled={!valid}
    >
      {/* Avatar (web size-24 rounded-full ring-2 + Camera size-8) */}
      <View style={styles.avatarCol}>
        <Pressable
          onPress={pickAvatar}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={t("Pet.fields.photo")}
          style={({ pressed }) => [styles.avatarBtn, pressed && styles.pressed]}
        >
          {previewUri ? (
            <Image
              source={{ uri: previewUri }}
              style={styles.avatarImg}
              onError={() => {
                if (!avatarUri) setPhotoBroken(true);
              }}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <Camera size={32} color={colors.brandDeep} strokeWidth={2} />
          )}
        </Pressable>
        {!previewUri ? <Text style={styles.avatarHint}>{t("Pet.fields.photo")}</Text> : null}
      </View>

      <TextField
        label={t("Pet.fields.name")}
        value={name}
        onChangeText={setName}
        placeholder={t("Pet.fields.namePlaceholder")}
        autoFocus={!editing}
      />
      <SelectField
        label={t("Pet.fields.species")}
        value={species}
        onChange={setSpecies}
        options={SPECIES.map((s) => ({ value: s, label: t(`Pet.species.${s}`) }))}
      />
      <SelectField
        label={t("Pet.fields.gender")}
        value={gender}
        onChange={setGender}
        options={GENDERS.map((g) => ({ value: g, label: genderLabel(g) }))}
      />
      {species === "other" ? (
        <TextField
          label={t("Pet.fields.speciesOther")}
          value={speciesOther}
          onChangeText={setSpeciesOther}
          placeholder={t("Pet.fields.speciesOtherPlaceholder")}
        />
      ) : null}
      <TextField
        label={t("Pet.fields.breed")}
        value={breed}
        onChangeText={setBreed}
        placeholder={t("Pet.fields.breedPlaceholder")}
      />
      <TextField
        label={t("Pet.fields.weight")}
        value={weight}
        onChangeText={setWeight}
        keyboardType="decimal-pad"
        placeholder="8.5"
      />
      <OptionalDateField
        label={t("Pet.fields.birthday")}
        value={birthday}
        onChange={setBirthday}
        maximumDate={new Date()}
        // Web never deletes a saved birthday (an emptied date input is
        // dropped from the update), so only an unsaved one can be cleared.
        clearable={!(editing && pet?.birthday)}
        initialDate={() => {
          const d = new Date();
          d.setFullYear(d.getFullYear() - 1);
          return d;
        }}
      />

      <StepperField
        label={t("PetEdit.walkGoal.label")}
        value={goal}
        onChange={setGoal}
        min={WALK_GOAL_MIN_MINUTES}
        max={WALK_GOAL_MAX_MINUTES}
        step={WALK_GOAL_STEP_MINUTES}
        unit={t("PetEdit.walkGoal.unit")}
        hint={t("PetEdit.walkGoal.hint")}
      />
      <TextField
        label={t("Pet.fields.bio")}
        value={bio}
        onChangeText={setBio}
        placeholder={t("Pet.fields.bioPlaceholder")}
        multiline
      />

      {editing && pet ? (
        <Pressable
          onPress={handleDelete}
          disabled={busy}
          accessibilityRole="button"
          accessibilityState={{ disabled: busy, busy: deleting }}
          style={({ pressed }) => [
            styles.deleteBtn,
            pressed && styles.deleteBtnPressed,
            busy && styles.deleteBtnBusy,
          ]}
        >
          <Text style={styles.deleteText} numberOfLines={1}>
            {t("Common.delete")} {pet.name}
          </Text>
        </Pressable>
      ) : null}
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  // web flex-col items-center gap-2
  avatarCol: { alignItems: "center", gap: spacing.sm },
  avatarBtn: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: "hidden",
    backgroundColor: colors.brandTint,
    borderWidth: 2,
    borderColor: colors.amber,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImg: { width: "100%", height: "100%" },
  // web text-xs text-zinc-500 → mango ink3
  avatarHint: { fontSize: 12, color: colors.ink3 },
  pressed: { opacity: 0.85 },
  // web mt-8 w-full rounded-xl border hairline bg-card px-4 py-3 text-sm
  // font-medium text-red-600
  deleteBtn: {
    marginTop: spacing.lg,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  deleteBtnPressed: { backgroundColor: colors.peachTint },
  deleteBtnBusy: { opacity: 0.6 },
  deleteText: { fontSize: 14, fontWeight: "500", color: colors.danger },
});
