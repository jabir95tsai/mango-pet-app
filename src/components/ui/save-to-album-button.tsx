"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Download, Loader2 } from "lucide-react";
import { canSaveToAlbum, saveToAlbum } from "@/lib/save-to-album";
import { cn } from "@/lib/utils";

/**
 * Icon-button that pipes `file` through the OS share sheet so the user
 * can pick "Save Image" → Photos. Renders **only** when the browser
 * supports `navigator.canShare({ files })` for this file — per spec
 * D3 unsupported browsers (desktop / iOS <16.4 / Android Chrome <84)
 * see nothing rather than a disabled+tooltip combo.
 *
 * Post-save feedback is an inline icon swap (Download → Check) that
 * holds for 2 seconds, then reverts — no toast system, no portal.
 * Dismissed share sheet (user closed it) is a no-op: no error, no
 * check, button returns to idle immediately.
 *
 * `title` is the share-sheet caption (forwarded to navigator.share);
 * defaults are usually fine but a per-entry override (e.g., "{pet name}
 * 寵物照片") helps the share target render a recognisable preview.
 */
const FEEDBACK_DURATION_MS = 2000;

type State = "idle" | "saving" | "saved" | "failed";

type Props = {
  file: File | null | undefined;
  title?: string;
  /** Optional class merged onto the button — entry sites can size /
   *  position differently (16px corner button on a thumbnail vs 40px
   *  pill below an avatar) without each site re-skinning the base. */
  className?: string;
};

export function SaveToAlbumButton({ file, title, className }: Props) {
  const t = useTranslations("Common.saveToAlbum");
  const [state, setState] = useState<State>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Render gate — spec D3 says hide outright on unsupported browsers.
  // The probe is per-file because canShare also gates on MIME (HEIC
  // works on iOS but not desktop; desktop won't see the button either
  // way since canShare-with-files is rare on desktop).
  if (!file || !canSaveToAlbum(file)) return null;

  async function handleClick() {
    if (state === "saving" || !file) return;
    setState("saving");
    const res = await saveToAlbum(file, title);
    if (res.ok) {
      setState("saved");
    } else if (res.reason === "dismissed") {
      // User closed the share sheet — no UI noise, just revert.
      setState("idle");
      return;
    } else {
      setState("failed");
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setState("idle"), FEEDBACK_DURATION_MS);
  }

  const label =
    state === "saved"
      ? t("saved")
      : state === "failed"
        ? t("failed")
        : t("label");

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={state === "saving"}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-mango-card border border-mango-hairline text-mango-ink-2 shadow-sm transition-colors",
        "hover:bg-mango-bg-alt hover:text-mango-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep",
        state === "saved" && "border-mango-leaf bg-mango-leaf-tint text-mango-leaf",
        state === "failed" && "border-red-300 bg-red-50 text-red-600 dark:bg-red-950",
        state === "saving" && "opacity-70",
        className,
      )}
    >
      {state === "saving" ? (
        <Loader2 className="size-4 animate-spin" />
      ) : state === "saved" ? (
        <Check className="size-4" strokeWidth={2.6} />
      ) : (
        <Download className="size-4" />
      )}
    </button>
  );
}
