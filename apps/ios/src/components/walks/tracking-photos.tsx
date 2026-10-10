/**
 * In-walk photo UI — 1:1 with the web walk-tracking-view photo blocks
 * (apps/web/src/components/walks/walk-tracking-view.tsx):
 *
 *  - TrackingPhotoControls (tracking phase): the h-11 pill button
 *    (brand border, brand-tint fill, Camera + "拍照 (n/5)", or the disabled
 *    "已達上限 5 張" when full) and a horizontally scrolling row of 64px
 *    thumbnails with an uploading overlay (spinner on black/30), a failed
 *    overlay (AlertTriangle on red/40, tap to retry — iOS keeps the local
 *    file), a top-right X delete and, once uploaded, a bottom-right
 *    save-to-album button.
 *  - TrackingPhotoGrid (done phase): "本次紀錄 (n)" label + 2-column square
 *    grid; tapping a tile opens the lightbox.
 *
 * Slots are keyed by an immutable id (not the array index), so a delete never
 * re-targets an in-flight upload.
 */
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { useState } from "react";
import { AlertTriangle, Camera, X } from "lucide-react-native";

import { SaveToAlbumButton } from "@/components/feed/save-to-album-button";
import { withAlpha } from "@/components/auth/color";
import { t } from "@/lib/i18n";
import { colors, radius, spacing } from "@/theme/theme";

/** Spec D2: hard cap photos per walk. */
export const WALK_PHOTO_LIMIT = 5;

export type WalkPhotoSlot = {
  id: string;
  /** Monotonic per-session index used in the Storage file name. */
  seq: number;
  ts: number;
  /** Local capture URI — shown immediately, kept for retry / save. */
  localUri: string;
  status: "uploading" | "done" | "failed";
  url?: string;
  storagePath?: string;
};

const THUMB = 64;
const GRID_GAP = spacing.sm;

export function TrackingPhotoControls({
  slots,
  onOpenCamera,
  onDelete,
  onRetry,
}: {
  slots: WalkPhotoSlot[];
  onOpenCamera: () => void;
  onDelete: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  const full = slots.length >= WALK_PHOTO_LIMIT;
  return (
    <View style={styles.controls}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: full }}
        disabled={full}
        onPress={onOpenCamera}
        style={({ pressed }) => [
          styles.photoBtn,
          full ? styles.photoBtnFull : styles.photoBtnActive,
          pressed && !full && styles.photoBtnPressed,
        ]}
      >
        <Camera size={16} color={full ? colors.ink3 : colors.ink} strokeWidth={2} />
        <Text style={[styles.photoBtnText, full && styles.photoBtnTextFull]}>
          {full
            ? t("Walks.photo.limitReached")
            : t("Walks.photo.button", { n: slots.length, max: WALK_PHOTO_LIMIT })}
        </Text>
      </Pressable>

      {slots.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.thumbScroll}
          contentContainerStyle={styles.thumbRow}
        >
          {slots.map((slot) => (
            <View key={slot.id} style={styles.thumbWrap}>
              <Image
                source={{ uri: slot.localUri }}
                style={[
                  styles.thumb,
                  slot.status === "uploading" && styles.thumbUploading,
                  slot.status === "failed" && styles.thumbFailed,
                ]}
                accessibilityIgnoresInvertColors
              />
              {slot.status === "uploading" ? (
                <View
                  style={[styles.overlay, styles.overlayUploading]}
                  accessible
                  accessibilityLabel={t("Walks.photo.uploading")}
                >
                  <ActivityIndicator color="#ffffff" size="small" />
                </View>
              ) : null}
              {slot.status === "failed" ? (
                <Pressable
                  style={[styles.overlay, styles.overlayFailed]}
                  accessibilityRole="button"
                  accessibilityLabel={t("Walks.photo.failed")}
                  accessibilityHint={t("Common.retry")}
                  onPress={() => onRetry(slot.id)}
                >
                  <AlertTriangle size={16} color="#ffffff" strokeWidth={2} />
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("Walks.photo.delete")}
                onPress={() => onDelete(slot.id)}
                hitSlop={12}
                style={({ pressed }) => [styles.deleteBtn, pressed && styles.deletePressed]}
              >
                <X size={12} color="#ffffff" strokeWidth={2.5} />
              </Pressable>
              {slot.status === "done" ? (
                <SaveToAlbumButton uri={slot.localUri} size={20} style={styles.saveBtn} />
              ) : null}
            </View>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

export function TrackingPhotoGrid({
  slots,
  onOpen,
}: {
  slots: WalkPhotoSlot[];
  onOpen: (index: number) => void;
}) {
  const [width, setWidth] = useState(0);
  if (slots.length === 0) return null;
  const tile = width > 0 ? Math.floor((width - GRID_GAP) / 2) : 0;
  return (
    <View
      style={styles.grid}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
    >
      <Text style={styles.gridLabel}>{t("Walks.photo.recapGridLabel", { n: slots.length })}</Text>
      <View style={styles.gridRow}>
        {tile > 0
          ? slots.map((slot, i) => (
              <Pressable
                key={`done-${slot.id}`}
                accessibilityRole="imagebutton"
                accessibilityLabel={t("Walks.photo.viewLightbox")}
                onPress={() => onOpen(i)}
                style={({ pressed }) => [
                  styles.gridTile,
                  { width: tile, height: tile },
                  pressed && styles.gridTilePressed,
                ]}
              >
                <Image
                  source={{ uri: slot.url ?? slot.localUri }}
                  style={styles.gridImage}
                  resizeMode="cover"
                  accessibilityIgnoresInvertColors
                />
              </Pressable>
            ))
          : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // web: flex w-full max-w-xs flex-col items-center gap-3
  controls: { width: "100%", maxWidth: 320, alignItems: "center", gap: spacing.md },
  // web: h-11 rounded-full border px-4 text-sm font-medium gap-2
  photoBtn: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  photoBtnActive: { borderColor: colors.brand, backgroundColor: colors.brandTint },
  photoBtnFull: { borderColor: colors.hairline, backgroundColor: "transparent" },
  photoBtnPressed: { backgroundColor: withAlpha(colors.brandTint, 0.7) },
  photoBtnText: { fontSize: 14, fontWeight: "500", color: colors.ink },
  photoBtnTextFull: { color: colors.ink3 },
  thumbScroll: { alignSelf: "stretch", marginHorizontal: -spacing.sm },
  // room for the X / save buttons that overhang the thumbnail by 4pt
  thumbRow: { gap: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  thumbWrap: { width: THUMB, height: THUMB },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.bgAlt,
  },
  thumbUploading: { opacity: 0.5 },
  thumbFailed: { borderColor: colors.danger },
  overlay: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  overlayUploading: { backgroundColor: "rgba(0,0,0,0.3)" },
  overlayFailed: { backgroundColor: withAlpha(colors.danger, 0.4) },
  // web: absolute -right-1 -top-1 size-5 rounded-full bg-zinc-900 ring-1 ring-white
  deleteBtn: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
    borderWidth: 1,
    borderColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  deletePressed: { opacity: 0.8 },
  // web: absolute -bottom-1 -right-1 size-5
  saveBtn: { position: "absolute", bottom: -4, right: -4 },

  // Done-phase grid (web: w-full max-w-xs; label mb-2 text-xs semibold uppercase)
  grid: { width: "100%", maxWidth: 320 },
  gridLabel: {
    marginBottom: spacing.sm,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.3,
    textTransform: "uppercase",
    color: colors.ink3,
  },
  gridRow: { flexDirection: "row", flexWrap: "wrap", gap: GRID_GAP },
  gridTile: {
    borderRadius: radius.sm,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.bgAlt,
  },
  gridTilePressed: { opacity: 0.85 },
  gridImage: { width: "100%", height: "100%" },
});
