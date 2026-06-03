/**
 * 0-pet empty state — now a thin wrapper over the shared EmptyState primitive
 * (gradientHero paw disc + title/body + gradient-family CTA + hint). The bespoke
 * gradient implementation moved into the primitive during the UX-0 pass.
 */
import { EmptyState } from "@/components/ui/EmptyState";
import { scoped } from "@/lib/i18n";

const tPP = scoped("PetsPage");

export function PetsEmptyState({ onAddPet }: { onAddPet?: () => void }) {
  return (
    <EmptyState
      gradientHero
      emoji="🐾"
      title={tPP("empty.title")}
      body={tPP("empty.body")}
      ctaLabel={tPP("empty.cta")}
      onPressCta={onAddPet}
      hint={tPP("empty.hint")}
    />
  );
}
