/**
 * Shared shell for the human + dog boards — a virtualized FlatList (up to 100
 * rows) whose header carries the page-level dimension toggle plus the board's
 * own RouteHeader-style title / subtitle and tab rows, with native
 * pull-to-refresh as the only refresh (the icon button was removed 2026-11-17).
 *
 * Header rhythm matches web: title 26/800, subtitle 14 / lh 24, header→scope
 * 16, scope→period 12, period→list 16; rows are separated by 8.
 */
import { createContext, useContext, type MutableRefObject, type ReactElement, type ReactNode, type RefObject } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View, type ListRenderItem } from "react-native";

import { useTabBarScrollInsets } from "@/lib/liquid-glass";
import { colors, spacing, CONTENT_MAX_WIDTH } from "@/theme/theme";
import { MY_RANK_BAR_SPACE } from "./podium";

/** Per-board scroll handle so the screen can line the incoming board up with
 *  the outgoing one's offset (toggle stays put on swap). Provided by
 *  app/(tabs)/leaderboard.tsx. */
export type BoardSlot = { ref: RefObject<FlatList<any> | null>; y: MutableRefObject<number> };
export const BoardScroll = createContext<BoardSlot | null>(null);

export function BoardHeader({
  title,
  subtitle,
  accessory,
}: {
  title: string;
  subtitle?: string;
  /** Extra control beside the title (the human/dog toggle). Refresh is pull-to-refresh only. */
  accessory?: ReactNode;
}) {
  return (
    <View style={styles.headerRow}>
      <View style={styles.headerText}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {accessory}
    </View>
  );
}

export function BoardList<T>({
  data,
  keyExtractor,
  renderItem,
  header,
  empty,
  footer,
  overlay,
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
  /** Pinned over the list (layout A: MyRankBar); the list pads past it. */
  overlay?: ReactElement | null;
  refreshing: boolean;
  onRefresh?: () => void;
}) {
  const tabBarInsets = useTabBarScrollInsets();
  const slot = useContext(BoardScroll);
  return (
    <View style={styles.flex}>
    <FlatList
      {...tabBarInsets}
      ref={slot?.ref}
      onScroll={slot ? (e) => (slot.y.current = e.nativeEvent.contentOffset.y) : undefined}
      scrollEventThrottle={16}
      data={data}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      ListFooterComponent={footer}
      ItemSeparatorComponent={Separator}
      contentContainerStyle={[styles.content, overlay ? { paddingBottom: spacing.xxl + MY_RANK_BAR_SPACE } : null]}
      showsVerticalScrollIndicator={false}
      initialNumToRender={12}
      windowSize={7}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />
        ) : undefined
      }
    />
    {overlay}
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    padding: spacing.lg,
    paddingTop: 10, // tab-screen title row: top 10, minHeight 44 (matches Home top bar)
    paddingBottom: spacing.xxl,
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: "center",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    minHeight: 44,
    marginBottom: spacing.lg,
  },
  headerText: { flex: 1, minWidth: 0 },
  // web RouteHeader: text-[26px] font-extrabold tracking-[-0.5px]
  title: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5, color: colors.ink },
  // web: mt-1 text-sm leading-6 ink-2
  subtitle: { marginTop: 4, fontSize: 13, lineHeight: 19, fontWeight: "500", color: colors.ink2 },
  separator: { height: spacing.sm },
});
