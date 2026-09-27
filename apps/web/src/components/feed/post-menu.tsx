"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { MoreVertical, Flag, UserX } from "lucide-react";
import { useConfirm } from "@/components/ui/confirm-provider";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { createReport, type CreateReportArgs } from "@/lib/firebase/posts";
import { blockUser } from "@/lib/firebase/users";
import { REPORT_REASONS, type ReportReason, type ReportTargetType } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  currentUid: string;
  targetType: ReportTargetType;
  /** postId of the parent post; equals targetId itself when reporting a post. */
  postId: string;
  targetId: string;
  targetAuthorUid: string;
  targetAuthorName: string;
  /** Called after a successful block so the caller can drop the blocked
   *  author's content from the current view without a full refetch. */
  onBlocked?: (blockedUid: string) => void;
};

/**
 * "⋯" menu attached to a post or comment — report content / block author.
 * Spec docs/features/ugc-moderation.md (App Store Guideline 1.2: UGC apps
 * must offer report + block). Hidden entirely for guests and for the
 * viewer's own content (nothing to report/block about yourself).
 */
export function PostMenu({
  currentUid,
  targetType,
  postId,
  targetId,
  targetAuthorUid,
  targetAuthorName,
  onBlocked,
}: Props) {
  const t = useTranslations("Moderation");
  const askConfirm = useConfirm();
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("spam");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<"reported" | "error" | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocPointerDown(e: PointerEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [menuOpen]);

  const isMine = targetAuthorUid === currentUid;

  async function submitReport() {
    setSubmitting(true);
    try {
      const args: CreateReportArgs = {
        reporterUid: currentUid,
        targetType,
        targetId,
        targetAuthorUid,
        reason,
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(targetType === "comment" ? { postId } : {}),
      };
      await createReport(args);
      setFeedback("reported");
      setReportOpen(false);
      setNote("");
      setReason("spam");
    } catch {
      setFeedback("error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleBlock() {
    setMenuOpen(false);
    const ok = await askConfirm({
      title: t("blockConfirmTitle", { name: targetAuthorName }),
      message: t("blockConfirmMessage"),
      confirmText: t("blockConfirmAction"),
      danger: true,
    });
    if (!ok) return;
    try {
      await blockUser(currentUid, targetAuthorUid);
      onBlocked?.(targetAuthorUid);
    } catch {
      setFeedback("error");
    }
  }

  return (
    <div ref={wrapperRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        aria-label={t("menu")}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className="grid size-8 place-items-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
      >
        <MoreVertical className="size-4" aria-hidden="true" />
      </button>

      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-1 w-44 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              setReportOpen(true);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            <Flag className="size-4" aria-hidden="true" />
            {targetType === "comment" ? t("reportComment") : t("reportPost")}
          </button>
          {!isMine && (
            <button
              type="button"
              role="menuitem"
              onClick={handleBlock}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              <UserX className="size-4" aria-hidden="true" />
              {t("block", { name: targetAuthorName })}
            </button>
          )}
        </div>
      )}

      <Dialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title={t("reportTitle")}
      >
        <div className="flex flex-col gap-3">
          <fieldset className="flex flex-col gap-2">
            {REPORT_REASONS.map((r) => (
              <label
                key={r}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                  reason === r
                    ? "border-mango-brand-deep bg-mango-brand-tint"
                    : "border-zinc-200 dark:border-zinc-700",
                )}
              >
                <input
                  type="radio"
                  name="report-reason"
                  value={r}
                  checked={reason === r}
                  onChange={() => setReason(r)}
                  className="accent-mango-brand-deep"
                />
                {t(`reportReason${r[0].toUpperCase()}${r.slice(1)}` as
                  | "reportReasonSpam"
                  | "reportReasonHarassment"
                  | "reportReasonInappropriate"
                  | "reportReasonOther")}
              </label>
            ))}
          </fieldset>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("reportNotePlaceholder")}
            rows={2}
            maxLength={300}
            className="resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus-visible:border-mango-brand-deep focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-mango-brand-deep dark:border-zinc-700 dark:bg-zinc-900"
          />
          <Button
            type="button"
            onClick={submitReport}
            disabled={submitting}
            className="self-end"
          >
            {t("reportSubmit")}
          </Button>
        </div>
      </Dialog>

      {feedback && (
        <p
          className={cn(
            "absolute right-0 top-full mt-1 w-max max-w-[12rem] rounded-lg px-2 py-1 text-xs shadow",
            feedback === "reported"
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
              : "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300",
          )}
        >
          {feedback === "reported" ? t("reportSubmitted") : t("reportFailed")}
        </p>
      )}
    </div>
  );
}
