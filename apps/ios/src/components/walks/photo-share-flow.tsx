/**
 * Auto-photo-share orchestrator (P1c) — runs PhotoPromptSheet → camera →
 * PostComposer for either the START or END of a walk, then calls onDone (the
 * caller proceeds: START → begin tracking; END → back to the saved recap).
 * The START and END posts cross-link to the SAME walkId (pre-minted via
 * newWalkId), so a START post published before the walk doc exists still
 * points at the right id. Mirrors web walks-auto-photo-share flows A + B
 * (apps/web/src/app/app/walks/page.tsx, walk-tracking-view.tsx).
 *
 * Guests never reach this flow (callers gate on `!isGuest`, web §C).
 *
 * onDone fires on every exit path (skip / camera-cancel / posted / composer
 * cancel) so the walk flow never gets stuck behind the share UI — but only
 * once the current modal has fully disappeared: iOS silently drops a modal
 * presented while another is still dismissing, so each hand-off (prompt →
 * camera → composer → caller's next modal) waits for the previous modal's
 * dismissal (with a timer fallback).
 */
import { useEffect, useRef, useState } from "react";
import type { Pet } from "@mango/shared-types";

import { PhotoPromptSheet } from "@/components/walks/photo-prompt-sheet";
import { CameraCaptureModal } from "@/components/walks/camera-capture-modal";
import { PostComposer } from "@/components/feed/post-composer";
import { t } from "@/lib/i18n";

type Step = "prompt" | "camera" | "composer" | "between";

/** Fallback when a dismissal callback never arrives. */
const DISMISS_FALLBACK_MS = 800;
/** PostComposer exposes no "closed" callback — wait out its slide-down. */
const COMPOSER_SETTLE_MS = 450;

type Props = {
  visible: boolean;
  phase: "start" | "end";
  pet: Pet | null;
  /** Overrides pet?.name (e.g. a recovered session whose pet left scope). */
  petName?: string;
  pets: Pet[];
  walkId: string;
  walkMinutes?: number;
  onDone: () => void;
};

export function PhotoShareFlow({
  visible,
  phase,
  pet,
  petName: petNameProp,
  pets,
  walkId,
  walkMinutes,
  onDone,
}: Props) {
  const [step, setStep] = useState<Step>("prompt");
  const [photoUri, setPhotoUri] = useState<string | undefined>(undefined);
  const pendingRef = useRef<(() => void) | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  function clearTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function runPending() {
    clearTimer();
    const next = pendingRef.current;
    pendingRef.current = null;
    next?.();
  }

  /** Close the current modal, then run `next` once it has gone. */
  function handOff(next: () => void, fallbackMs = DISMISS_FALLBACK_MS) {
    pendingRef.current = next;
    clearTimer();
    timerRef.current = setTimeout(runPending, fallbackMs);
    setStep("between");
  }

  const finish = () => onDoneRef.current();

  useEffect(() => {
    if (visible) {
      setStep("prompt");
      setPhotoUri(undefined);
    }
    return () => {
      pendingRef.current = null;
      clearTimer();
    };
  }, [visible]);

  if (!visible) return null;

  const petName = petNameProp ?? pet?.name ?? "Mango";
  const caption =
    phase === "start"
      ? t("WalksPhotoPrompt.captionStartDefault", { pet: petName })
      : t("WalksPhotoPrompt.captionEndDefault", { pet: petName, min: walkMinutes ?? 0 });

  return (
    <>
      <PhotoPromptSheet
        visible={step === "prompt"}
        phase={phase}
        petName={petName}
        walkMinutes={walkMinutes}
        onTake={() => handOff(() => setStep("camera"))}
        onSkip={() => handOff(finish)}
        onClosed={runPending}
      />

      <CameraCaptureModal
        visible={step === "camera"}
        presentation="modal"
        onCaptured={(uri) => {
          setPhotoUri(uri);
          handOff(() => setStep("composer"));
        }}
        // OS camera dismissed without a photo == skip (web flow A/B).
        onCancel={() => handOff(finish)}
        onDismissed={runPending}
      />

      <PostComposer
        visible={step === "composer"}
        pets={pets}
        initialPhotoUri={photoUri}
        initialCaption={photoUri ? caption : undefined}
        walkId={walkId}
        onClose={() => handOff(finish, COMPOSER_SETTLE_MS)}
        onPosted={() => {
          /* onClose fires right after; the hand-off continues from there */
        }}
      />
    </>
  );
}
