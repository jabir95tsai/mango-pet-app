"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Tabs } from "@/components/ui/tabs";
import { HumanLeaderboard } from "@/components/leaderboard/human-leaderboard";
import { DogLeaderboard } from "@/components/leaderboard/dog-leaderboard";

type Dimension = "human" | "dog";
const DIMENSION_STORAGE_KEY = "mango.leaderboard.dimension";

/**
 * Leaderboard page — top-level 人/狗 dimension switch (leaderboard v2,
 * spec ③). The walker (human) board is the original surface, unchanged;
 * the dog board is the net-new dog-centric ranking. The switch lives
 * above both so it's reachable in personal mode too (the dog board
 * includes personal-mode dogs, unlike the family-gated human board).
 *
 * Each board is fully self-contained (own header + refresh + scope /
 * period tabs), so this container only owns the dimension choice and
 * persists it across visits.
 */
export default function LeaderboardPage() {
  const tLb = useTranslations("Leaderboard");
  const [dimension, setDimension] = useState<Dimension>("human");

  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    const saved = localStorage.getItem(
      DIMENSION_STORAGE_KEY,
    ) as Dimension | null;
    if (saved === "human" || saved === "dog") setDimension(saved);
  }, []);

  function handleDimensionChange(next: Dimension) {
    setDimension(next);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(DIMENSION_STORAGE_KEY, next);
    }
  }

  return (
    <>
      <div className="mb-4">
        <Tabs<Dimension>
          value={dimension}
          onChange={handleDimensionChange}
          options={[
            { value: "human", label: `🧑 ${tLb("dimension.human")}` },
            { value: "dog", label: `🐕 ${tLb("dimension.dog")}` },
          ]}
        />
      </div>

      {dimension === "human" ? <HumanLeaderboard /> : <DogLeaderboard />}
    </>
  );
}
