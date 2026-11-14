/**
 * Leaderboard segmented toggle — the shared ui/Tabs (inline md track, glass
 * lens motion via ui/LensTrack). Kept as its own export so the five leaderboard
 * call sites stay unchanged.
 */
import { Tabs } from "@/components/ui/Tabs";

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return <Tabs options={options} value={value} onChange={onChange} />;
}
