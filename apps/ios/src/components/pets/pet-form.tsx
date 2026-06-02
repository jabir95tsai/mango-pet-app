/**
 * Pet add/edit form — avatar picker (expo-image-picker → IMAGE_PRESETS.avatar
 * compress on upload) + name/species(+other)/breed/gender/weight/birthday/bio +
 * walk-goal stepper (clamp 5–120 step 5). Writes via pets-write
 * (createPet / updatePet). Mirrors web pet-form-dialog.
 */
import { useState } from "react";
import { Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import {
  getPetWalkGoalMinutes,
  WALK_GOAL_MIN_MINUTES,
  WALK_GOAL_STEP_MINUTES,
} from "@mango/shared-business";
import type { Gender, Pet, PetInput, Species } from "@mango/shared-types";

import { createPet, updatePet } from "@/lib/pets-write";
import { scoped } from "@/lib/i18n";
import { colors, radius, spacing } from "@/theme/theme";
import {
  FormSheet,
  DateField,
  SelectField,
  StepperField,
  TextField,
} from "./form-sheet";
import { PetAvatar } from "./pet-avatar";

const tPet = scoped("Pet");
const tC = scoped("Common");

// Spec caps the stepper at 120 (data layer clamps reads to [5,180]).
const WALK_GOAL_FORM_MAX = 120;
const SPECIES: Species[] = ["dog", "cat", "other"];
const GENDERS: Gender[] = ["unknown", "male", "female"];

function tsToDate(ts: unknown): Date | null {
  const d = ts as { toDate?: () => Date } | undefined;
  return d?.toDate ? d.toDate() : null;
}

export function PetForm({
  familyId,
  uid,
  pet,
  onClose,
  onSaved,
}: {
  familyId: string | null;
  uid: string;
  pet?: Pet;
  onClose: () => void;
  onSaved: () => void;
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
  const [saving, setSaving] = useState(false);

  const valid = name.trim().length > 0;

  async function pickAvatar() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(tPet("fields.photo"));
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (!res.canceled && res.assets[0]) setAvatarUri(res.assets[0].uri);
  }

  async function save() {
    if (!valid) return;
    setSaving(true);
    try {
      const w = parseFloat(weight);
      const input: PetInput = {
        name: name.trim(),
        species,
        speciesOther:
          species === "other" ? speciesOther.trim() || undefined : undefined,
        breed: breed.trim() || undefined,
        gender,
        weightKg: Number.isFinite(w) && w > 0 ? w : undefined,
        bio: bio.trim() || undefined,
        birthday: birthday ?? undefined,
        walkGoal: { minutes: goal, source: "manual" },
      };
      if (editing && pet) {
        await updatePet(pet.petId, input, uid, avatarUri ?? undefined);
      } else {
        await createPet(familyId, uid, input, avatarUri ?? undefined);
      }
      onSaved();
      onClose();
    } catch {
      Alert.alert(tPet("imageError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormSheet
      visible
      title={editing ? tPet("petDetail") : tPet("addPet")}
      onCancel={onClose}
      onSave={save}
      saving={saving}
      saveDisabled={!valid}
    >
      {/* Avatar */}
      <Pressable onPress={pickAvatar} style={styles.avatarRow} accessibilityRole="button">
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
        ) : (
          <PetAvatar name={name || "🐾"} photoURL={pet?.photoURL} size={72} />
        )}
        <Text style={styles.avatarHint}>{tPet("fields.photo")}</Text>
      </Pressable>

      <TextField
        label={tPet("fields.name")}
        value={name}
        onChangeText={setName}
        placeholder={tPet("fields.namePlaceholder")}
        autoFocus={!editing}
      />
      <SelectField
        label={tPet("fields.species")}
        value={species}
        onChange={setSpecies}
        options={SPECIES.map((s) => ({ value: s, label: tPet(`species.${s}`) }))}
      />
      {species === "other" ? (
        <TextField
          label={tPet("fields.speciesOther")}
          value={speciesOther}
          onChangeText={setSpeciesOther}
          placeholder={tPet("fields.speciesOtherPlaceholder")}
        />
      ) : null}
      <TextField
        label={tPet("fields.breed")}
        value={breed}
        onChangeText={setBreed}
        placeholder={tPet("fields.breedPlaceholder")}
      />
      <SelectField
        label={tPet("fields.gender")}
        value={gender}
        onChange={setGender}
        options={GENDERS.map((g) => ({ value: g, label: tPet(`gender.${g}`) }))}
      />
      <TextField
        label={tPet("fields.weight")}
        value={weight}
        onChangeText={setWeight}
        keyboardType="decimal-pad"
      />

      {/* Optional birthday */}
      {birthday ? (
        <View>
          <DateField
            label={tPet("fields.birthday")}
            value={birthday}
            onChange={setBirthday}
          />
          <Pressable onPress={() => setBirthday(null)} hitSlop={6}>
            <Text style={styles.clearBirthday}>✕ {tC("delete")}</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={() => {
            const d = new Date();
            d.setFullYear(d.getFullYear() - 1);
            setBirthday(d);
          }}
          style={styles.addBirthday}
          accessibilityRole="button"
        >
          <Text style={styles.addBirthdayText}>＋ {tPet("fields.birthday")}</Text>
        </Pressable>
      )}

      <StepperField
        label="每日散步目標"
        value={goal}
        onChange={setGoal}
        min={WALK_GOAL_MIN_MINUTES}
        max={WALK_GOAL_FORM_MAX}
        step={WALK_GOAL_STEP_MINUTES}
        unit="分"
      />
      <TextField
        label={tPet("fields.bio")}
        value={bio}
        onChangeText={setBio}
        placeholder={tPet("fields.bioPlaceholder")}
        multiline
      />
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  avatarRow: { alignItems: "center", gap: spacing.xs, paddingVertical: spacing.sm },
  avatarImg: { width: 72, height: 72, borderRadius: 24, backgroundColor: colors.brandTint },
  avatarHint: { fontSize: 12, color: colors.brandDeep, fontWeight: "700" },
  addBirthday: {
    alignSelf: "flex-start",
    backgroundColor: colors.cardSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addBirthdayText: { fontSize: 14, fontWeight: "700", color: colors.ink2 },
  clearBirthday: { color: colors.ink3, fontSize: 13, marginTop: 4, alignSelf: "flex-end" },
});
