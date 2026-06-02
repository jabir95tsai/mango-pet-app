/**
 * Stories bar (P3a) — horizontal scroll: "Your story" composer entry first, then
 * one pet-story avatar per pet with its today walk-status ring. Mirrors
 * apps/web/src/components/home/stories-bar.tsx; the status map is computed
 * upstream (useFeedData → computeTodayWalkStatus) and passed in.
 */
import { ScrollView, StyleSheet } from "react-native";
import type { Pet } from "@mango/shared-types";
import type { WalkStatus } from "@mango/shared-business";

import { spacing } from "@/theme/theme";
import { YourStoryAvatar } from "./your-story-avatar";
import { PetStoryAvatar } from "./pet-story-avatar";

export function StoriesBar({
  pets,
  walkStatus,
  userName,
  userPhotoURL,
  onComposerOpen,
}: {
  pets: Pet[];
  walkStatus: Map<string, WalkStatus>;
  userName: string;
  userPhotoURL?: string | null;
  onComposerOpen: () => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      <YourStoryAvatar
        name={userName}
        photoURL={userPhotoURL}
        onPress={onComposerOpen}
      />
      {pets.map((p) => (
        <PetStoryAvatar
          key={p.petId}
          name={p.name}
          photoURL={p.photoURL ?? undefined}
          status={walkStatus.get(p.petId) ?? "pending"}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.md,
    alignItems: "flex-start",
  },
});
