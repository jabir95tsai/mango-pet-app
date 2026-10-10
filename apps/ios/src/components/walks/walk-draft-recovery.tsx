/**
 * Pending walk-draft recovery on the walks home — iOS port of web
 * apps/web/src/app/app/walks/page.tsx (recoverWalks / discardRecoveredWalk /
 * recoveryNotice, lines 212-312 + 498-518).
 *
 * `useWalkDraftRecovery` lists this account's local drafts (walks that were
 * stopped but never acknowledged by the server), retries them once when the
 * screen opens and again whenever the app returns to the foreground (the iOS
 * stand-in for web's online event — no polling), and serialises every retry
 * through one in-flight promise so overlapping triggers never run parallel
 * writes. Discard asks for confirmation and only removes the LOCAL draft.
 *
 * `WalkDraftRecoveryNotice` is the web status card: card-soft surface,
 * hairline border, radius-lg, p-4, 14pt ink; Retry pill (primary) and one
 * row per draft with a secondary "discard local draft" pill.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { Button } from "@/components/ui/Button";
import { confirm } from "@/lib/confirm";
import { getActiveLocale, t } from "@/lib/i18n";
import {
  discardWalkDraft,
  listWalkDrafts,
  onWalkRetryHint,
  removeWalkDraft,
  SAVE_TIMEOUT_MS,
  wasWalkDraftDiscarded,
  withTimeout,
  type WalkDraft,
} from "@/lib/walk-drafts";
import { createWalk } from "@/lib/walks";
import { colors, radius, spacing } from "@/theme/theme";

type RecoveryError = "saveFailed" | "discardDraftFailed" | null;

/** Locale-aware "date time" for a draft row (web `startedAt.toLocaleString()`). */
export function formatDraftTime(d: Date): string {
  const locale = getActiveLocale() === "en" ? "en-US" : "zh-TW";
  try {
    return d.toLocaleString(locale, {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
}

export type WalkDraftRecovery = {
  drafts: WalkDraft[];
  recovering: boolean;
  error: RecoveryError;
  discardingId: string | null;
  retry: () => Promise<boolean>;
  discard: (draft: WalkDraft) => Promise<void>;
  /** Re-read the local drafts (e.g. after the tracking overlay closed). */
  reloadList: () => void;
};

/**
 * @param uid      signed-in account (drafts are per-account)
 * @param paused   true while a walk overlay is open — recovery steps aside
 *                 (web `recoveryScope.sessionOpen`)
 * @param onRecovered called after at least one draft was saved (reload data)
 */
export function useWalkDraftRecovery({
  uid,
  paused,
  onRecovered,
}: {
  uid: string | null;
  paused: boolean;
  onRecovered?: () => void;
}): WalkDraftRecovery {
  const [drafts, setDrafts] = useState<WalkDraft[]>([]);
  const [recovering, setRecovering] = useState(false);
  const [error, setError] = useState<RecoveryError>(null);
  const [discardingId, setDiscardingId] = useState<string | null>(null);
  const [listNonce, setListNonce] = useState(0);

  const scope = useMemo(() => ({ uid, paused }), [uid, paused]);
  const scopeRef = useRef<typeof scope | null>(scope);
  const inFlight = useRef<{ scope: typeof scope; promise: Promise<boolean> } | null>(null);
  const discardInFlight = useRef<{ scope: typeof scope; walkId: string } | null>(null);
  const onRecoveredRef = useRef(onRecovered);
  onRecoveredRef.current = onRecovered;

  const refreshList = useCallback(async (s: typeof scope) => {
    if (!s.uid) return;
    try {
      const list = await listWalkDrafts(s.uid);
      if (scopeRef.current === s) setDrafts(list);
    } catch {
      // Storage unavailable — keep whatever is visible.
    }
  }, []);

  const recover = useCallback(
    (s: typeof scope): Promise<boolean> => {
      if (!s.uid || s.paused || scopeRef.current !== s || discardInFlight.current) {
        return Promise.resolve(false);
      }
      if (inFlight.current?.scope === s) return inFlight.current.promise;
      const uidNow = s.uid;
      const promise: Promise<boolean> = Promise.resolve()
        .then(async () => {
          let failed = false;
          let savedAny = false;
          let list: WalkDraft[] = [];
          try {
            list = await listWalkDrafts(uidNow);
          } catch {
            return false;
          }
          if (list.length === 0) {
            if (scopeRef.current === s) setDrafts([]);
            return true;
          }
          if (scopeRef.current === s) {
            setRecovering(true);
            setError(null);
          }
          for (const draft of list) {
            if (scopeRef.current !== s || discardInFlight.current) return false;
            try {
              if (await wasWalkDraftDiscarded(uidNow, draft.walkId)) continue;
              await withTimeout(createWalk({ ...draft, scorePet: null }), SAVE_TIMEOUT_MS);
              await removeWalkDraft(uidNow, draft.walkId).catch(() => {});
              savedAny = true;
            } catch (err) {
              if (__DEV__) console.warn("[walk-drafts] recovery failed", err);
              failed = true; // An unrecoverable draft must not block later ones.
            }
          }
          if (savedAny) onRecoveredRef.current?.();
          if (scopeRef.current === s) {
            setError(failed ? "saveFailed" : null);
            await refreshList(s);
          }
          return !failed;
        })
        .finally(() => {
          if (inFlight.current?.promise === promise) inFlight.current = null;
          if (scopeRef.current === s) setRecovering(false);
        });
      inFlight.current = { scope: s, promise };
      return promise;
    },
    [refreshList],
  );

  useEffect(() => {
    scopeRef.current = scope;
    setDrafts([]);
    setRecovering(false);
    setError(null);
    setDiscardingId(null);
    discardInFlight.current = null;
    const s = scope;
    const invalidate = () => {
      if (scopeRef.current === s) scopeRef.current = null;
    };
    if (!s.uid || s.paused) return invalidate;
    void refreshList(s);
    let queued = false;
    const unsubscribe = onWalkRetryHint(() => {
      if (scopeRef.current !== s || discardInFlight.current || queued) return;
      const running = inFlight.current;
      if (running?.scope === s) {
        queued = true;
        // A hint during an unsuccessful request buys one follow-up, not
        // parallel writes or an unbounded retry loop.
        void running.promise.then((ok) => {
          queued = false;
          if (!ok && scopeRef.current === s && !discardInFlight.current) void recover(s);
        });
      } else {
        void recover(s);
      }
    }, true);
    return () => {
      unsubscribe();
      invalidate();
    };
  }, [scope, recover, refreshList]);

  // Explicit list refreshes (no retry).
  useEffect(() => {
    if (listNonce === 0) return;
    const s = scopeRef.current;
    if (s && s.uid && !s.paused) void refreshList(s);
  }, [listNonce, refreshList]);

  const retry = useCallback(() => recover(scope), [recover, scope]);

  const discard = useCallback(
    async (draft: WalkDraft) => {
      const s = scope;
      if (
        scopeRef.current !== s ||
        s.uid !== draft.walkerUid ||
        inFlight.current?.scope === s ||
        discardInFlight.current
      ) {
        return;
      }
      const op = { scope: s, walkId: draft.walkId };
      discardInFlight.current = op;
      setDiscardingId(draft.walkId);
      try {
        const ok = await confirm({
          title: t("Walks.core.discardDraftTitle"),
          message: t("Walks.core.discardDraftBody"),
          confirmLabel: t("Walks.core.discardDraft"),
          cancelLabel: t("Common.cancel"),
          destructive: true,
        });
        if (!ok || scopeRef.current !== s) return;
        await discardWalkDraft(draft.walkerUid, draft.walkId);
        setDrafts(await listWalkDrafts(draft.walkerUid));
        setError(null);
      } catch {
        if (scopeRef.current === s) setError("discardDraftFailed");
      } finally {
        if (discardInFlight.current === op) discardInFlight.current = null;
        if (scopeRef.current === s) setDiscardingId(null);
      }
    },
    [scope],
  );

  const reloadList = useCallback(() => setListNonce((n) => n + 1), []);

  return { drafts, recovering, error, discardingId, retry, discard, reloadList };
}

export function WalkDraftRecoveryNotice({
  recovery,
  uid,
  style,
}: {
  recovery: WalkDraftRecovery;
  uid: string | null;
  style?: StyleProp<ViewStyle>;
}) {
  const visible = recovery.drafts.filter((d) => d.walkerUid === uid);
  if (visible.length === 0) return null;
  const busy = recovery.recovering || recovery.discardingId !== null;
  return (
    <View style={[styles.card, style]} accessibilityLiveRegion="polite">
      <Text style={styles.text}>{t("Walks.core.pendingRecovery", { count: visible.length })}</Text>
      {recovery.error ? (
        <Text style={styles.text} accessibilityRole="alert">
          {t(`Walks.core.${recovery.error}`)}
        </Text>
      ) : null}
      <Button
        label={recovery.recovering ? t("Walks.core.savingWalk") : t("Common.retry")}
        pill
        onPress={() => {
          void recovery.retry();
        }}
        disabled={busy}
        style={styles.retry}
      />
      <View style={styles.list}>
        {visible.map((draft) => (
          <View key={draft.walkId} style={styles.row}>
            <Text style={[styles.text, styles.rowText]}>
              {`${draft.petName ?? draft.petId} · ${formatDraftTime(draft.startedAt)}`}
            </Text>
            <Button
              label={t("Walks.core.discardDraft")}
              variant="secondary"
              pill
              onPress={() => {
                void recovery.discard(draft);
              }}
              disabled={busy}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // web: mb-4 rounded-[var(--radius-lg)] border border-mango-hairline bg-mango-card-soft p-4 text-sm
  card: {
    marginBottom: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.cardSoft,
    padding: spacing.lg,
  },
  text: { fontSize: 14, lineHeight: 20, color: colors.ink },
  retry: { marginTop: spacing.sm, alignSelf: "flex-start" },
  list: { marginTop: spacing.sm, gap: spacing.sm },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  rowText: { flexShrink: 1 },
});
