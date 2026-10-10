/**
 * Shared shell for the human + dog boards — a virtualized FlatList (up to 100
 * rows) whose header carries the page-level dimension toggle plus the board's
 * own RouteHeader-style title / subtitle / refresh button and tab rows, with
 * native pull-to-refresh wired to the same refresh as the icon button.
 *
 * Header rhythm matches web: title 26/800, subtitle 14 / lh 24, header→scope
 * 16, scope→period 12, period→list 16; rows are separated by 8.
 */
import type { ReactElement, ReactNode } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View, type ListRenderItem } from "react-native";

import { useTabBarScrollInsets } from "@/lib/liquid-glass";
import { colors, spacing, CONTENT_MAX_WIDTH } from "@/theme/theme";
import { RefreshIconButton } from "./refresh-icon-button";

export function BoardHeader({
  title,
  subtitle,
  refreshing,
  onRefresh,
}: {
  title: string;
  subtitle?: string;
  refreshing?: boolean;
  /** Omit to hide the refresh button (personal-mode empty state). */
  onRefresh?: () => void;
}) {
  return (
    <View style={styles.headerRow}>
      <View style={styles.headerText}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {onRefresh ? <RefreshIconButton refreshing={!!refreshing} onPress={onRefresh} /> : null}
    </View>
  );
}

/** Scope + period rows with web's 12 / 16 spacing. */
export function BoardTabs({ scope, period }: { scope: ReactNode; period: ReactNode }) {
  return (
    <>
      <View style={styles.scopeRow}>{scope}</View>
      <View style={styles.periodRow}>{period}</View>
    </>
  );
}

export function BoardList<T>({
  data,
  keyExtractor,
  renderItem,
  header,
  empty,
  footer,
  refreshing,
  onRefresh,
}: {
  data: T[];
  keyExtractor: (item: T) => string;
  renderItem: ListRenderItem<T>;
  header: ReactElement;
  /** Loading / error / empty card (shown when `data` is empty). */
  empty: ReactElement | null;
  footer?: ReactElement | null;
  refreshing: boolean;
  onRefresh?: () => void;
}) {
  const tabBarInsets = useTabBarScrollInsets();
  return (
    <FlatList
      {...tabBarInsets}
      data={data}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      ListFooterComponent={footer ?? null}
      ItemSeparatorComponent={Separator}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      initialNumToRender={12}
      windowSize={7}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />
        ) : undefined
      }
    />
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: "center",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  headerText: { flex: 1, minWidth: 0 },
  // web RouteHeader: text-[26px] font-extrabold tracking-[-0.5px]
  title: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5, color: colors.ink },
  // web: mt-1 text-sm leading-6 ink-2
  subtitle: { marginTop: 4, fontSize: 14, lineHeight: 24, color: colors.ink2 },
  scopeRow: { marginBottom: spacing.md },
  periodRow: { marginBottom: spacing.lg },
  separator: { height: spacing.sm },
});
