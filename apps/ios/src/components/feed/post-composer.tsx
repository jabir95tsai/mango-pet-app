/**
 * Post composer (RN, P1c) — mirrors web post-composer. Text + photos (≤4, via
 * camera) + pet tags + visibility (default 公開, per ui-polish-bundle) → writes
 * through createPost (which compresses + uploads the local URIs and cross-links
 * walkId). Used standalone and by the walks auto-photo-share flow (initialPhoto
 * + initialCaption + walkId).
 */
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Pet, Visibility } from "@mango/shared-types";

import { createPost } from "@/lib/posts";
import { CameraCaptureModal } from "@/components/walks/camera-capture-modal";
import { useAuth } from "@/state/auth-context";
import { colors, radius, spacing } from "@/theme/theme";

const MAX_PHOTOS = 4;

const VISIBILITY: { value: Visibility; label: string }[] = [
  { value: "public", label: "🌍 公開" },
  { value: "friends", label: "👥 好友" },
  { value: "private", label: "🔒 私人" },
];

type Props = {
  visible: boolean;
  pets: Pet[];
  initialPhotoUri?: string;
  initialCaption?: string;
  walkId?: string;
  onClose: () => void;
  onPosted?: () => void;
};

export function PostComposer({
  visible,
  pets,
  initialPhotoUri,
  initialCaption,
  walkId,
  onClose,
  onPosted,
}: Props) {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [selectedPets, setSelectedPets] = useState<string[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setText(initialCaption ?? "");
    setPhotoUris(initialPhotoUri ? [initialPhotoUri] : []);
    setVisibility("public");
    setSelectedPets([]);
    setError(null);
    // initialPhoto/Caption are stable per open; intentionally not in deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function togglePet(petId: string) {
    setSelectedPets((prev) =>
      prev.includes(petId) ? prev.filter((id) => id !== petId) : [...prev, petId],
    );
  }

  function removePhoto(idx: number) {
    setPhotoUris((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handlePublish() {
    if (!user) return;
    if (!text.trim() && photoUris.length === 0) {
      setError("請輸入文字或加一張照片");
      return;
    }
    setPosting(true);
    setError(null);
    try {
      await createPost({
        authorUid: user.uid,
        authorName: user.displayName ?? user.email?.split("@")[0] ?? "Friend",
        authorPhotoURL: user.photoURL,
        petIds: selectedPets,
        text: text.trim(),
        visibility,
        photoUris,
        walkId,
      });
      onPosted?.();
      onClose();
    } catch (err) {
      // createPost may throw on partial photo failure even though the doc was
      // created — surface the message; the user can close.
      setError(err instanceof Error ? err.message : "發佈失敗");
    } finally {
      setPosting(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <SafeAreaView edges={["bottom"]} style={styles.sheetWrap}>
          <Pressable style={styles.sheet}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.title}>分享動態</Text>

              <TextInput
                style={styles.text}
                value={text}
                onChangeText={setText}
                placeholder="說點什麼…"
                placeholderTextColor={colors.ink3}
                multiline
                maxLength={500}
              />

              {photoUris.length > 0 ? (
                <View style={styles.photoGrid}>
                  {photoUris.map((uri, i) => (
                    <View key={`${uri}-${i}`} style={styles.photoBox}>
                      <Image source={{ uri }} style={styles.photo} />
                      <Pressable
                        accessibilityLabel="移除照片"
                        onPress={() => removePhoto(i)}
                        style={styles.removeBtn}
                      >
                        <Text style={styles.removeText}>✕</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}

              <Pressable
                accessibilityRole="button"
                disabled={photoUris.length >= MAX_PHOTOS}
                onPress={() => setCameraOpen(true)}
                style={({ pressed }) => [
                  styles.addPhoto,
                  pressed && styles.pressed,
                  photoUris.length >= MAX_PHOTOS && styles.disabled,
                ]}
              >
                <Text style={styles.addPhotoText}>
                  {`📷  加照片 (${photoUris.length}/${MAX_PHOTOS})`}
                </Text>
              </Pressable>

              {pets.length > 0 ? (
                <>
                  <Text style={styles.label}>標記寵物</Text>
                  <View style={styles.chipRow}>
                    {pets.map((p) => {
                      const on = selectedPets.includes(p.petId);
                      return (
                        <Pressable
                          key={p.petId}
                          onPress={() => togglePet(p.petId)}
                          style={[styles.chip, on && styles.chipOn]}
                        >
                          <Text style={[styles.chipText, on && styles.chipTextOn]}>
                            {`🐾 ${p.name}`}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : null}

              <Text style={styles.label}>誰看得到</Text>
              <View style={styles.chipRow}>
                {VISIBILITY.map((v) => {
                  const on = visibility === v.value;
                  return (
                    <Pressable
                      key={v.value}
                      onPress={() => setVisibility(v.value)}
                      style={[styles.chip, on && styles.chipOn]}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>
                        {v.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <View style={styles.actions}>
                <Pressable onPress={onClose} disabled={posting} style={styles.cancelBtn}>
                  <Text style={styles.cancelText}>取消</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={handlePublish}
                  disabled={posting}
                  style={({ pressed }) => [
                    styles.publishBtn,
                    pressed && styles.pressed,
                    posting && styles.disabled,
                  ]}
                >
                  {posting ? (
                    <ActivityIndicator color={colors.card} />
                  ) : (
                    <Text style={styles.publishText}>發佈</Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </SafeAreaView>
      </Pressable>

      <CameraCaptureModal
        visible={cameraOpen}
        onCaptured={(uri) => {
          setPhotoUris((prev) => [...prev, uri].slice(0, MAX_PHOTOS));
          setCameraOpen(false);
        }}
        onCancel={() => setCameraOpen(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheetWrap: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: "88%",
  },
  sheet: { padding: spacing.lg },
  title: { fontSize: 18, fontWeight: "800", color: colors.ink, marginBottom: spacing.md },
  text: {
    minHeight: 80,
    backgroundColor: colors.bgAlt,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 15,
    color: colors.ink,
    textAlignVertical: "top",
  },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  photoBox: { width: 96, height: 96, borderRadius: radius.md, overflow: "hidden" },
  photo: { width: "100%", height: "100%" },
  removeBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  removeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  addPhoto: {
    marginTop: spacing.md,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  addPhotoText: { fontSize: 14, fontWeight: "600", color: colors.ink2 },
  label: { marginTop: spacing.lg, marginBottom: spacing.sm, fontSize: 12, fontWeight: "700", color: colors.ink2 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.bgAlt,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  chipOn: { backgroundColor: colors.brandTint, borderColor: colors.brand },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.ink2 },
  chipTextOn: { color: colors.brandDeep, fontWeight: "800" },
  error: { marginTop: spacing.md, fontSize: 13, color: colors.cookie },
  actions: { flexDirection: "row", gap: spacing.md, justifyContent: "flex-end", marginTop: spacing.lg },
  cancelBtn: { height: 48, paddingHorizontal: spacing.xl, alignItems: "center", justifyContent: "center" },
  cancelText: { fontSize: 15, fontWeight: "600", color: colors.ink2 },
  publishBtn: {
    height: 48,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  publishText: { fontSize: 15, fontWeight: "800", color: colors.card },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
});
