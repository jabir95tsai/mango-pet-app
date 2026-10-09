/**
 * Post composer — 1:1 with web apps/web/src/components/feed/post-composer.tsx:
 * a Dialog titled Post.compose (sticky header + X) holding a textarea, a
 * 2-column square photo grid (remove X top-right, per-photo save bottom-
 * right), the add-photo row, pet tag chips, visibility chips (lucide
 * Globe / Users / Lock, solid mango when selected) and ghost cancel + primary
 * (btn-mango) publish. Writes through createPost, which compresses + uploads
 * the local URIs and cross-links walkId.
 *
 * iOS additions: a camera button next to the library picker (web's file
 * input offers the camera via the OS sheet) and the camera capture surface.
 * Used standalone (feed / home) and by the walks auto-photo-share flow
 * (initialPhotoUri + initialCaption + walkId).
 *
 * Guests can't post (firestore.rules isRealUser): like web the dialog is
 * forced shut for them; if a caller still opens it we report a close right
 * away so flows waiting on onClose (photo-share-flow) never get stuck.
 *
 * Partial photo failure (createPost `.partial`) is success-with-warning, like
 * web: onPosted fires, the warning shows and the sheet closes after 1.8s.
 */
import { useEffect, useRef, useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import {
  Camera,
  Globe,
  Image as ImageIcon,
  Lock,
  Users,
  X,
  type LucideIcon,
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import type { Pet, Visibility } from "@mango/shared-types";

import { createPost, isPartialPostError, isPostUploadAllFailed } from "@/lib/posts";
import { CameraCaptureModal } from "@/components/walks/camera-capture-modal";
import { Button, Dialog, FieldLabel, Textarea } from "@/components/ui";
import { notify } from "@/lib/confirm";
import { t } from "@/lib/i18n";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { useAuth } from "@/state/auth-context";
import { colors, radius, spacing } from "@/theme/theme";
import { SaveToAlbumButton } from "./save-to-album-button";

const MAX_PHOTOS = 4;
/** Web keeps the partial-failure warning on screen this long before closing. */
const PARTIAL_CLOSE_MS = 1800;
const GRID_GAP = spacing.sm;

const VISIBILITY_OPTIONS: { value: Visibility; icon: LucideIcon; labelKey: string }[] = [
  { value: "public", icon: Globe, labelKey: "Post.visibilityPublic" },
  { value: "friends", icon: Users, labelKey: "Post.visibilityFriends" },
  { value: "private", icon: Lock, labelKey: "Post.visibilityPrivate" },
];

type Props = {
  visible: boolean;
  pets: Pet[];
  initialPhotoUri?: string;
  initialCaption?: string;
  walkId?: string;
  onClose: () => void;
  onPosted?: () => void;
  /** Fires once the sheet has fully disappeared (Dialog onClosed) — safe
   *  point to present another modal (iOS drops one presented mid-dismissal). */
  onClosed?: () => void;
};

export function PostComposer({
  visible,
  pets,
  initialPhotoUri,
  initialCaption,
  walkId,
  onClose,
  onPosted,
  onClosed,
}: Props) {
  const { user, isGuest } = useAuth();
  const reduceMotion = useReducedMotion();
  const [text, setText] = useState("");
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  // Default 公開 per docs/features/ui-polish-bundle-2026-05-25.md Item #3.
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [selectedPets, setSelectedPets] = useState<string[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gridWidth, setGridWidth] = useState(0);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Defensive guest gate (web `open && !isGuest`).
  const open = visible && !isGuest;

  useEffect(() => {
    if (visible && isGuest) onCloseRef.current();
  }, [visible, isGuest]);

  function clearCloseTimer() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  /** Every user-initiated close also cancels a pending partial-success
   *  auto-close, so onClose never fires twice (photo-share-flow's onDone). */
  function handleClose() {
    clearCloseTimer();
    onClose();
  }

  useEffect(() => {
    clearCloseTimer();
    if (!visible) return;
    setText(initialCaption ?? "");
    setPhotoUris(initialPhotoUri ? [initialPhotoUri] : []);
    setVisibility("public");
    setSelectedPets([]);
    setCameraOpen(false);
    setClosing(false);
    setError(null);
    // initialPhoto/Caption are stable per open; intentionally not in deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  function togglePet(petId: string) {
    setSelectedPets((prev) =>
      prev.includes(petId) ? prev.filter((id) => id !== petId) : [...prev, petId],
    );
  }

  function removePhoto(idx: number) {
    setPhotoUris((prev) => prev.filter((_, i) => i !== idx));
  }

  async function pickFromLibrary() {
    const remaining = MAX_PHOTOS - photoUris.length;
    if (remaining <= 0) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        await notify(
          t("Ios.post.libraryPermissionTitle"),
          t("Ios.post.libraryPermissionBody"),
        );
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 1,
      });
      if (res.canceled) return;
      const uris = res.assets.map((a) => a.uri);
      setPhotoUris((prev) => [...prev, ...uris].slice(0, MAX_PHOTOS));
    } catch {
      setError(t("Ios.post.pickFailed"));
    }
  }

  async function handlePublish() {
    if (!user || posting || closing) return;
    if (!text.trim() && photoUris.length === 0) {
      setError(t("Post.needTextOrPhoto"));
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
      handleClose();
    } catch (err) {
      if (isPartialPostError(err)) {
        // The post exists (text or some photos made it) — refresh the feed,
        // show the warning, then close so a second tap can't duplicate it.
        onPosted?.();
        setError(err.message);
        setClosing(true);
        closeTimer.current = setTimeout(() => {
          closeTimer.current = null;
          onCloseRef.current();
        }, PARTIAL_CLOSE_MS);
      } else {
        // Only our own (localized) upload error is shown verbatim; raw
        // Firestore / Storage errors map to the generic message.
        setError(isPostUploadAllFailed(err) ? err.message : t("Post.publishFailed"));
      }
    } finally {
      setPosting(false);
    }
  }

  function onGridLayout(e: LayoutChangeEvent) {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w !== gridWidth) setGridWidth(w);
  }

  const tile = gridWidth > 0 ? Math.floor((gridWidth - GRID_GAP) / 2) : 0;
  const full = photoUris.length >= MAX_PHOTOS;
  const busy = posting || closing;

  return (
    <Dialog
      visible={open}
      onClose={handleClose}
      onClosed={onClosed}
      title={t("Post.compose")}
      dismissible={!posting}
      contentStyle={styles.body}
      footer={
        <View style={styles.actions}>
          <Button
            variant="ghost"
            label={t("Common.cancel")}
            onPress={handleClose}
            disabled={posting}
          />
          <Button
            variant="primary"
            label={t("Post.publish")}
            onPress={handlePublish}
            loading={posting}
            disabled={busy}
          />
        </View>
      }
    >
      <Textarea
        value={text}
        onChangeText={setText}
        placeholder={t("Post.placeholder")}
        accessibilityLabel={t("Post.placeholder")}
        maxLength={500}
        editable={!busy}
        style={styles.textarea}
      />

      {photoUris.length > 0 ? (
        <View style={styles.grid} onLayout={onGridLayout}>
          {tile > 0
            ? photoUris.map((uri, i) => (
                <View
                  key={`${uri}-${i}`}
                  style={[styles.photoBox, { width: tile, height: tile }]}
                >
                  <Image source={{ uri }} style={styles.photo} accessibilityIgnoresInvertColors />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("Post.removePhoto")}
                    onPress={() => removePhoto(i)}
                    disabled={busy}
                    hitSlop={6}
                    style={({ pressed }) => [styles.removeBtn, pressed && styles.removeBtnPressed]}
                  >
                    <X size={16} color="#ffffff" strokeWidth={2} />
                  </Pressable>
                  <SaveToAlbumButton uri={uri} style={styles.saveBtn} />
                </View>
              ))
            : null}
        </View>
      ) : null}

      <View style={styles.addRow}>
        <Button
          variant="ghost"
          size="sm"
          icon={Camera}
          label={t("WalksPhotoPrompt.take")}
          onPress={() => setCameraOpen(true)}
          disabled={full || busy}
        />
        <Button
          variant="ghost"
          size="sm"
          icon={ImageIcon}
          label={`${photoUris.length}/${MAX_PHOTOS}`}
          accessibilityLabel={`${t("Ios.post.pickFromLibrary")} ${photoUris.length}/${MAX_PHOTOS}`}
          onPress={() => void pickFromLibrary()}
          disabled={full || busy}
        />
      </View>

      {pets.length > 0 ? (
        <View style={styles.section}>
          <FieldLabel>{t("Post.tagPet")}</FieldLabel>
          <View style={styles.chipRow}>
            {pets.map((p) => {
              const on = selectedPets.includes(p.petId);
              return (
                <Pressable
                  key={p.petId}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => togglePet(p.petId)}
                  hitSlop={6}
                  style={[styles.petChip, on && styles.chipOn]}
                >
                  <Text style={[styles.petChipText, on && styles.chipTextOn]} numberOfLines={1}>
                    {`🐾 ${p.name}`}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <FieldLabel>{t("Post.visibility")}</FieldLabel>
        <View style={styles.chipRow}>
          {VISIBILITY_OPTIONS.map(({ value, icon: Icon, labelKey }) => {
            const on = visibility === value;
            return (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => setVisibility(value)}
                hitSlop={4}
                style={[styles.visChip, on && styles.chipOn]}
              >
                <Icon size={14} color={on ? "#ffffff" : colors.ink2} strokeWidth={2} />
                <Text style={[styles.visChipText, on && styles.chipTextOn]}>{t(labelKey)}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}

      {/* Camera — its own full-screen modal presented from the dialog's
          ("modal" presentation keeps the camera body mounted through the
          slide-down instead of a blank sheet; Reduce Motion → no slide). */}
      <CameraCaptureModal
        presentation="modal"
        visible={open && cameraOpen}
        onCaptured={(uri) => {
          setPhotoUris((prev) => [...prev, uri].slice(0, MAX_PHOTOS));
          setCameraOpen(false);
        }}
        onCancel={() => setCameraOpen(false)}
      />
    </Dialog>
  );
}

const styles = StyleSheet.create({
  // web flex flex-col gap-4
  body: { gap: spacing.lg },
  textarea: { minHeight: 104, fontSize: 14, lineHeight: 20 },
  // web grid grid-cols-2 gap-2
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GRID_GAP },
  // web relative aspect-square overflow-hidden rounded-lg bg-zinc-100
  photoBox: { borderRadius: radius.sm, overflow: "hidden", backgroundColor: colors.bgAlt },
  photo: { width: "100%", height: "100%" },
  // web absolute top-1 right-1 size-8 rounded-full bg-black/60
  removeBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  removeBtnPressed: { backgroundColor: "rgba(0,0,0,0.8)" },
  // web absolute bottom-1 right-1 size-8
  saveBtn: { position: "absolute", bottom: 4, right: 4 },
  // web flex items-center gap-2
  addRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  // web flex flex-col gap-2
  section: { gap: spacing.sm },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  // web px-3 h-8 rounded-full text-xs font-medium; off bg-zinc-100 text-zinc-600
  petChip: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.bgAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  petChipText: { fontSize: 12, fontWeight: "500", color: colors.ink2 },
  // web flex items-center gap-1.5 px-3 h-9 rounded-full text-sm font-medium
  visChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.bgAlt,
  },
  visChipText: { fontSize: 14, fontWeight: "500", color: colors.ink2 },
  // web selected bg-amber-500 text-white → mango brand
  chipOn: { backgroundColor: colors.brand },
  chipTextOn: { color: "#ffffff" },
  // web text-sm text-red-600
  error: { fontSize: 14, color: colors.danger },
  // web flex justify-end gap-3 pt-2
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.md },
});
