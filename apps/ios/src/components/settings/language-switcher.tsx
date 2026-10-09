/**
 * LanguageSwitcher — 1:1 with apps/web/src/components/nav/language-switcher.tsx
 * (SETTINGS-2 / SHELL-21): a simple two-option toggle 繁中 | EN, no sliding
 * indicator (docs/design-system.md §4). Selecting an option calls
 * setAppLocale(), which persists the choice and remounts the navigator so
 * every screen re-renders in the new language.
 *
 *   web: inline-flex rounded-lg border border-zinc-200/80 bg-white p-0.5
 *        option rounded-md px-3 py-1 text-xs font-medium
 *        active bg-zinc-900 text-white · inactive text-zinc-600
 *
 * The option labels are language autonyms copied from web's OPTIONS — they are
 * deliberately identical in every UI language, so they are not catalog copy.
 *
 * LanguageSection is the Settings card row web renders around it
 * (settings/page.tsx: Globe + the bilingual "語言 / Language" label).
 */
import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Globe } from "lucide-react-native";

import { setAppLocale, t, useLocale, type Locale } from "@/lib/i18n";
import { colors, radius, shadows, spacing } from "@/theme/theme";

const OPTIONS: readonly { value: Locale; label: string; lang: string }[] = [
  { value: "zh-TW", label: "繁中", lang: "zh-Hant" },
  { value: "en", label: "EN", lang: "en" },
];

// web text-white
const ACTIVE_FG = "#ffffff";

export function LanguageSwitcher({ style }: { style?: StyleProp<ViewStyle> }) {
  const current = useLocale();
  const [pending, setPending] = useState(false);

  async function choose(value: Locale) {
    if (pending || value === current) return;
    setPending(true);
    try {
      await setAppLocale(value);
    } finally {
      setPending(false);
    }
  }

  return (
    <View style={[styles.track, style]}>
      {OPTIONS.map((opt) => {
        const selected = current === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => choose(opt.value)}
            disabled={pending}
            accessibilityRole="button"
            accessibilityLabel={opt.label}
            accessibilityLanguage={opt.lang}
            accessibilityState={{ selected, disabled: pending }}
            hitSlop={HIT_SLOP}
            style={({ pressed }) => [
              styles.option,
              selected && styles.optionActive,
              pressed && !selected && styles.optionPressed,
            ]}
          >
            <Text style={[styles.label, selected ? styles.labelActive : styles.labelIdle]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Settings row (web settings/page.tsx 212-218): Globe 20 brandDeep + label on
 * the left, the switcher on the right. The Settings screen owner mounts it
 * (after Blocked users, before Privacy & Data, like web).
 */
export function LanguageSection({ style }: { style?: StyleProp<ViewStyle> }) {
  useLocale();
  return (
    <View style={[styles.section, style]}>
      <View style={styles.sectionLeft}>
        <Globe size={20} color={colors.brandDeep} strokeWidth={2} />
        <Text style={styles.sectionLabel} numberOfLines={1}>
          {t("Settings.languageLabel")}
        </Text>
      </View>
      <LanguageSwitcher />
    </View>
  );
}

// 24pt-tall pills → 44pt touch target.
const HIT_SLOP = { top: 10, bottom: 10, left: 2, right: 2 };

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    alignSelf: "flex-start",
    padding: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
  },
  // web rounded-md (6) px-3 py-1
  option: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  optionActive: { backgroundColor: colors.ink },
  optionPressed: { backgroundColor: colors.bgAlt },
  // web text-xs font-medium
  label: { fontSize: 12, lineHeight: 16, fontWeight: "500" },
  labelActive: { color: ACTIVE_FG },
  labelIdle: { color: colors.ink2 },

  // web: flex-row items-center justify-between gap-3 rounded-xl border
  // border-mango-hairline bg-mango-card p-6 shadow-card
  section: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.card,
    padding: spacing.lg,
    ...shadows.card,
  },
  sectionLeft: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: spacing.md },
  // web font-medium (16)
  sectionLabel: { flexShrink: 1, fontSize: 16, fontWeight: "500", color: colors.ink },
});
