/**
 * SaveToAlbumButton — 1:1 with web apps/web/src/components/ui/save-to-album-
 * button.tsx: a small round icon button (card fill, hairline border, ink2
 * Download glyph) that saves one photo to the Photos library, then swaps the
 * icon for 2s (Check on leaf tint when saved, red tint when it failed) before
 * reverting. Web pipes the File through the share sheet; iOS writes straight
 * to PhotosKit via the shared save-photo helper (accepted platform upgrade) —
 * works for local file:// URIs (composer drafts) and remote URLs alike.
 */
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Check, Download } from "lucide-react-native";

import { savePhotoToAlbum } from "@/lib/save-photo";
import { t } from "@/lib/i18n";
import { colors, radius } from "@/theme/theme";

const FEEDBACK_DURATION_MS = 2000;

type State = "idle" | "saving" | "saved" | "failed";

export function SaveToAlbumButton({
  uri,
  size = 32,
  style,
}: {
  uri: string | null | undefined;
  /** Visual box (web size-8 = 32). The touch target is topped up to 44. */
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const [state, setState] = useState<State>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!uri) return null;

  async function handlePress() {
    if (state === "saving" || !uri) return;
    setState("saving");
    let next: State = "saved";
    try {
      await savePhotoToAlbum(uri);
    } catch {
      next = "failed";
    }
    if (!aliveRef.current) return;
    setState(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (aliveRef.current) setState("idle");
    }, FEEDBACK_DURATION_MS);
  }

  const label =
    state === "saved"
      ? t("Common.saveToAlbum.saved")
      : state === "failed"
        ? t("Common.saveToAlbum.failed")
        : t("Common.saveToAlbum.label");
  const slop = Math.max(0, Math.ceil((44 - size) / 2));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: state === "saving", busy: state === "saving" }}
      disabled={state === "saving"}
      onPress={handlePress}
      hitSlop={slop}
      style={({ pressed }) => [
        styles.base,
        { width: size, height: size, borderRadius: size / 2 },
        state === "saved" && styles.saved,
        state === "failed" && styles.failed,
        state === "saving" && styles.saving,
        pressed && state !== "saving" && styles.pressed,
        style,
      ]}
    >
      {state === "saving" ? (
        <ActivityIndicator size="small" color={colors.ink2} />
      ) : state === "saved" ? (
        <Check size={16} color={colors.leaf} strokeWidth={2.6} />
      ) : (
        <Download
          size={16}
          color={state === "failed" ? colors.danger : colors.ink2}
          strokeWidth={2}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // web: rounded-full bg-mango-card border border-mango-hairline text-mango-ink-2 shadow-sm
  base: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.pill,
  },
  // web: border-mango-leaf bg-mango-leaf-tint text-mango-leaf
  saved: { borderColor: colors.leaf, backgroundColor: colors.leafTint },
  // web: border-red-300 bg-red-50 text-red-600 → danger semantics on peach tint
  failed: { borderColor: colors.danger, backgroundColor: colors.peachTint },
  saving: { opacity: 0.7 },
  pressed: { backgroundColor: colors.bgAlt },
});
