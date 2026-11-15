/**
 * Dev-only fake leaderboard crowd, merged into the boards' visible lists so
 * the podium, rows #4+ and the pinned MyRankBar can be checked with a full
 * board. Never touches Firestore; `__DEV__` keeps it out of release builds.
 */
import type { DogLeaderboardEntry, LeaderboardEntry } from "@mango/shared-types";

/** Flip to true to preview a crowded board in dev. */
export const LEADERBOARD_DEMO = __DEV__ && false;

const NAMES = ["小橘", "阿毛", "Jamie", "豆豆", "Mika", "小白", "Leo", "奶茶", "Kiki", "布丁", "Ray", "芝麻", "Nana", "黑糖", "Ben", "可可", "Yuki", "麻糬", "Tom", "湯圓", "Ivy", "饅頭", "Sam", "花生", "Zoe", "Lucky", "Momo", "大福"];
const BREEDS = ["柴犬", "柯基", "米克斯", "貴賓", "黃金獵犬", "臘腸", null];

// Deterministic so rows don't reshuffle on every snapshot.
const crowd = NAMES.map((name, i) => {
  const score = 1500 - i * 52 - ((i * 37) % 23);
  return {
    i,
    name,
    score,
    km: Math.round(score / 7) / 10,
    walks: Math.max(1, Math.round(score / 160)),
    streak: (i * 5) % 8,
    previousRank: i + 1 + (((i * 7) % 5) - 2),
  };
});

const byScore = <T extends { totalScore: number }>(list: T[]) =>
  [...list].sort((a, b) => b.totalScore - a.totalScore);

export function withDemoHumans(real: LeaderboardEntry[]): LeaderboardEntry[] {
  if (!LEADERBOARD_DEMO) return real;
  const fake = crowd.map(
    (c) =>
      ({
        uid: `demo-${c.i}`,
        displayName: c.name,
        photoURL: null,
        totalScore: c.score,
        totalDistanceKm: c.km,
        totalDurationMin: c.walks * 30,
        walkCount: c.walks,
        streakDays: c.streak,
        previousRank: c.previousRank,
      }) as unknown as LeaderboardEntry,
  );
  return byScore([...real, ...fake]);
}

export function withDemoDogs(real: DogLeaderboardEntry[]): DogLeaderboardEntry[] {
  if (!LEADERBOARD_DEMO) return real;
  const fake = crowd.map(
    (c) =>
      ({
        petId: `demo-${c.i}`,
        petName: c.name,
        petPhotoURL: null,
        breed: BREEDS[c.i % BREEDS.length],
        species: "dog",
        ownerUid: `demo-owner-${c.i}`,
        ownerName: NAMES[(c.i + 5) % NAMES.length],
        familyId: null,
        totalScore: c.score,
        totalDistanceKm: c.km,
        totalDurationMin: c.walks * 30,
        walkCount: c.walks,
        streakDays: c.streak,
        ownerVisibility: "public",
        previousRank: c.previousRank,
      }) as unknown as DogLeaderboardEntry,
  );
  return byScore([...real, ...fake]);
}
