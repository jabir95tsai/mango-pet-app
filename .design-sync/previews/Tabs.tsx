import { useState } from "react";
import { Tabs } from "@mango/web";

type Range = "week" | "month" | "year";

/** Two-option toggle (active = white pill, amber text; no sliding indicator by design). */
export const TwoOptions = () => {
  const [v, setV] = useState<"list" | "map">("list");
  return (
    <Tabs
      value={v}
      onChange={setV}
      options={[
        { value: "list", label: "列表" },
        { value: "map", label: "地圖" },
      ]}
    />
  );
};

/** Three options — the walks statistics range switch. */
export const ThreeOptions = () => {
  const [v, setV] = useState<Range>("month");
  return (
    <Tabs<Range>
      value={v}
      onChange={setV}
      options={[
        { value: "week", label: "本週" },
        { value: "month", label: "本月" },
        { value: "year", label: "今年" },
      ]}
    />
  );
};

/** Controlled tabs driving a panel underneath. */
export const WithPanel = () => {
  const [v, setV] = useState<"records" | "reminders">("records");
  return (
    <div className="flex w-80 flex-col gap-3">
      <Tabs
        value={v}
        onChange={setV}
        options={[
          { value: "records", label: "健康紀錄" },
          { value: "reminders", label: "提醒" },
        ]}
      />
      <div className="rounded-[var(--radius-lg)] border border-mango-hairline bg-mango-card p-4 text-sm text-mango-ink-2">
        {v === "records" ? "最近一次看診：2026/09/02 · 狂犬病疫苗" : "下一個提醒：心絲蟲藥 · 10/01"}
      </div>
    </div>
  );
};

/** Full-width (`className="w-full"`), each tab still sized by its label. */
export const FullWidth = () => {
  const [v, setV] = useState<"all" | "friends">("all");
  return (
    <div className="w-80">
      <Tabs
        className="w-full"
        value={v}
        onChange={setV}
        options={[
          { value: "all", label: "全部" },
          { value: "friends", label: "好友" },
        ]}
      />
    </div>
  );
};
