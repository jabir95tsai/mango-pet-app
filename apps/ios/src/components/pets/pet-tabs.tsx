/**
 * 4-tab bar (概覽 / 提醒 / 開銷 / 健康). Same warm-glass ui/Tabs as the
 * leaderboard 本週/本月/總榜 toggle (user 2026-11-17), stretched full width.
 */
import { Tabs } from "@/components/ui/Tabs";
import { scoped } from "@/lib/i18n";

const tPP = scoped("PetsPage");

export const PET_TABS = ["overview", "reminders", "expenses", "health"] as const;
export type PetTabKey = (typeof PET_TABS)[number];

export function PetTabs({
  active,
  onChange,
}: {
  active: PetTabKey;
  onChange: (tab: PetTabKey) => void;
}) {
  return (
    <Tabs
      warm
      size="lg"
      fullWidth
      options={PET_TABS.map((key) => ({ value: key, label: tPP(`tabs.${key}`) }))}
      value={active}
      onChange={onChange}
    />
  );
}
