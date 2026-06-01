/**
 * Auto-photo-share orchestrator (P1c) — runs PhotoPromptSheet → camera →
 * PostComposer for either the START or END of a walk, then calls onDone (the
 * caller proceeds: START → begin tracking; END → close the session). The START
 * and END posts cross-link to the SAME walkId (pre-minted via newWalkId), so a
 * START post published before the walk doc exists still points at the right id.
 * Mirrors web walks-auto-photo-share flows A + B.
 *
 * onDone fires on every exit path (skip / camera-cancel / posted / composer
 * cancel) so the walk flow never gets stuck behind the share UI.
 */
import { useEffect, useState } from "react";
import type { Pet } from "@mango/shared-types";

import { PhotoPromptSheet } from "@/components/walks/photo-prompt-sheet";
import { CameraCaptureModal } from "@/components/walks/camera-capture-modal";
import { PostComposer } from "@/components/feed/post-composer";

type Step = "prompt" | "camera" | "composer";

type Props = {
  visible: boolean;
  phase: "start" | "end";
  pet: Pet | null;
  pets: Pet[];
  walkId: string;
  walkMinutes?: number;
  onDone: () => void;
};

export function PhotoShareFlow({
  visible,
  phase,
  pet,
  pets,
  walkId,
  walkMinutes,
  onDone,
}: Props) {
  const [step, setStep] = useState<Step>("prompt");
  const [photoUri, setPhotoUri] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (visible) {
      setStep("prompt");
      setPhotoUri(undefined);
    }
  }, [visible]);

  if (!visible) return null;

  const petName = pet?.name ?? "Mango";
  const caption =
    phase === "start"
      ? `${petName} 出發遛狗囉 🐾`
      : `${petName} 今天走了 ${walkMinutes ?? 0} 分鐘 🐾`;

  return (
    <>
      <PhotoPromptSheet
        visible={step === "prompt"}
        phase={phase}
        petName={petName}
        walkMinutes={walkMinutes}
        onTake={() => setStep("camera")}
        onSkip={onDone}
      />

      <CameraCaptureModal
        visible={step === "camera"}
        onCaptured={(uri) => {
          setPhotoUri(uri);
          setStep("composer");
        }}
        onCancel={onDone}
      />

      <PostComposer
        visible={step === "composer"}
        pets={pets}
        initialPhotoUri={photoUri}
        initialCaption={caption}
        walkId={walkId}
        onClose={onDone}
        onPosted={() => {
          /* onClose (== onDone) fires right after; no extra work */
        }}
      />
    </>
  );
}
