/**
 * RouteHeader — 1:1 with web apps/web/src/components/nav/route-header.tsx,
 * the shared page header used by tab pages (settings, leaderboard, …) and
 * pushed pages (feed, friends, photos, family, achievements).
 *
 *   <header class="mb-6">
 *     row: flex items-start justify-between gap-3
 *       h1 26px / 800 / tracking -0.5 / mango-ink
 *       action (shrink-0)
 *     subtitle: mt-1 max-w-2xl text-sm leading-6 mango-ink-2
 *
 * iOS addition: `onBack` renders the back row web stack pages hand-roll above
 * the header (`mb-4` row, `p-2 rounded-lg` button, ArrowLeft size-5,
 * aria-label Common.back). The button is a 44pt target whose icon lines up with
 * the content edge like web's p-2 inset.
 *
 * `right` and `action` are the same slot (`action` is the web prop name).
 */
import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { ArrowLeft } from "lucide-react-native";

import { t } from "@/lib/i18n";
import { colors, radius, spacing, type } from "@/theme/theme";

export type RouteHeaderProps = {
  title: string;
  subtitle?: string;
  /** Right-aligned slot next to the title (web `action`). */
  right?: ReactNode;
  /** Alias of `right` (web prop name). */
  action?: ReactNode;
  /** When set, a back row (ArrowLeft) renders above the title. */
  onBack?: () => void;
  /** Back button accessibility label. Default t("Common.back"). */
  backLabel?: string;
  /** Extra content on the right of the back row (e.g. a bookmark button). */
  backRowRight?: ReactNode;
  /** Bottom margin under the header. Default 24 (web mb-6); pass 0 for web `className="mb-0"`. */
  marginBottom?: number;
  style?: StyleProp<ViewStyle>;
};

export function RouteHeader({
  title,
  subtitle,
  right,
  action,
  onBack,
  backLabel,
  backRowRight,
  marginBottom = spacing.xl,
  style,
}: RouteHeaderProps) {
  const slot = right ?? action;
  return (
    <View style={[{ marginBottom }, style]}>
      {onBack ? (
        <View style={styles.backRow}>
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel={backLabel ?? t("Common.back")}
            hitSlop={4}
            style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
          >
            <ArrowLeft size={20} color={colors.ink} strokeWidth={2} />
          </Pressable>
          {backRowRight ? <View style={styles.backRowRight}>{backRowRight}</View> : null}
        </View>
      ) : null}
      <View style={styles.row}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {slot ? <View style={styles.action}>{slot}</View> : null}
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  // 44pt target. The 20pt glyph is centred (12pt inset); web's p-2 button sits
  // at the content edge with the glyph 8px in, so pull the box left by 4.
  backBtn: {
    width: 44,
    height: 44,
    marginLeft: -4,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  backBtnPressed: { backgroundColor: colors.bgAlt },
  backRowRight: { flexShrink: 0 },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  title: { ...type.h1, color: colors.ink, flexShrink: 1 },
  action: { flexShrink: 0 },
  subtitle: {
    marginTop: spacing.xs,
    fontSize: 14,
    lineHeight: 24,
    color: colors.ink2,
  },
});
