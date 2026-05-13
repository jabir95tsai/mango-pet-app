"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Trophy } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { RouteHeader } from "@/components/nav/route-header";
import { Tabs } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { LeaderboardRow } from "@/components/leaderboard/leaderboard-row";
import { listLeaderboard } from "@/lib/firebase/leaderboards";
import type { LeaderboardEntry, LeaderboardPeriod } from "@/lib/types";

export default function LeaderboardPage() {
  const t = useTranslations("Nav");
  const tC = useTranslations("Common");
  const { user } = useAuth();

  const [period, setPeriod] = useState<LeaderboardPeriod>("weekly");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setEntries(await listLeaderboard(period));
    } catch (err) {
      console.error(err);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <RouteHeader title={t("leaderboard")} subtitle="加權公式：距離×體型係數 + 時長 + 連續天數" />
      </div>

      <div className="mb-4">
        <Tabs<LeaderboardPeriod>
          value={period}
          onChange={setPeriod}
          options={[
            { value: "weekly", label: "本週" },
            { value: "monthly", label: "本月" },
            { value: "all_time", label: "總榜" },
          ]}
        />
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">{tC("loading")}</p>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="排行榜計算中"
          description="Cloud Function 每天午夜 (Asia/Taipei) 聚合一次。先去遛狗累積分數！"
        />
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map((e, idx) => (
            <LeaderboardRow
              key={e.uid}
              rank={idx + 1}
              entry={e}
              highlight={e.uid === user?.uid}
            />
          ))}
        </div>
      )}
    </>
  );
}
