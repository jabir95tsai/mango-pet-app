"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Camera, Loader2, Sparkles, X } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SaveToAlbumButton } from "@/components/ui/save-to-album-button";
import { extractReceipt } from "@/lib/firebase/ai-receipt";
import { IMAGE_PRESETS, processImage } from "@/lib/image-processing";
import type { ExtractedReceipt } from "@/lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  onExtracted: (data: ExtractedReceipt) => void;
  /** Skip the 拍照/從相簿選 intro and land straight on the preview /
   *  scan view with this file. Used by the pets-page-content
   *  camera-first FAB flow which captures the photo OUTSIDE the
   *  scanner and hands the resulting File in. Spec docs/features/
   *  expenses-into-pets-page.md D2. */
  initialFile?: File | null;
  /** Active pet on the calling surface — kept for spec compliance
   *  and forwarded to the manual-entry path so the form picks the
   *  right pet by default. The scanner itself doesn't read this for
   *  the AI scan (extractReceipt is pet-agnostic). */
  defaultPetId?: string;
  /** Optional secondary action under the scan UI: closes the scanner
   *  and signals the parent to open a blank ExpenseFormDialog instead
   *  (defaultPetId still applies). When absent, the link is hidden —
   *  /app/expenses legacy flows that pre-date this never showed it. */
  onManualEntry?: () => void;
};

export function ReceiptScanner({
  open,
  onClose,
  onExtracted,
  initialFile,
  defaultPetId: _defaultPetId,
  onManualEntry,
}: Props) {
  const tE = useTranslations("Expense");
  const tC = useTranslations("Common");
  const tPP = useTranslations("PetsPage");
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewURL, setPreviewURL] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Revoke any previously-created blob URL when previewURL changes or unmounts.
  useEffect(() => {
    return () => {
      if (previewURL) URL.revokeObjectURL(previewURL);
    };
  }, [previewURL]);

  // Camera-first flow: parent captures the photo (capture="environment"
  // input lives in pets-page-content) and hands it in via initialFile.
  // We process + preview it on open so the scanner lands directly on
  // the [開始辨識] view, skipping the 拍照/從相簿選 intro. Triggers
  // only on the open→initialFile transition so re-opens with the same
  // file don't re-process.
  useEffect(() => {
    if (!open || !initialFile) return;
    let cancelled = false;
    (async () => {
      setScanning(true);
      setError(null);
      try {
        const processed = await processImage(
          initialFile,
          IMAGE_PRESETS.receipt,
        );
        if (cancelled) return;
        setFile(processed);
        setPreviewURL(URL.createObjectURL(processed));
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "圖片處理失敗");
      } finally {
        if (!cancelled) setScanning(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, initialFile]);

  function reset() {
    setFile(null);
    setPreviewURL(null); // useEffect cleanup will revoke the previous URL
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    reset();
    setScanning(true); // shows loader while we run HEIC convert + light compress
    setError(null);
    try {
      // Preserve quality — receipt text needs to stay legible for OCR.
      const processed = await processImage(picked, IMAGE_PRESETS.receipt);
      setFile(processed);
      setPreviewURL(URL.createObjectURL(processed));
    } catch (err) {
      setError(err instanceof Error ? err.message : "圖片處理失敗");
    } finally {
      setScanning(false);
    }
  }

  async function handleScan() {
    if (!file) return;
    setScanning(true);
    setError(null);
    try {
      const data = await extractReceipt(file);
      onExtracted(data);
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} title={tE("scanReceipt")}>
      <div className="flex flex-col gap-4">
        {!previewURL ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-zinc-500">
              拍張收據照片，AI 自動抓出金額、商家、日期、類別。
            </p>

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              capture="environment"
              className="hidden"
              onChange={handlePick}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              className="hidden"
              onChange={handlePick}
            />

            <Button
              type="button"
              size="lg"
              onClick={() => cameraInputRef.current?.click()}
            >
              <Camera className="size-5" />
              拍照
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              從相簿選
            </Button>
            {onManualEntry && (
              <button
                type="button"
                onClick={onManualEntry}
                className="mt-1 text-center text-sm font-medium text-mango-brand-deep underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep"
              >
                {tPP("expenses.manualEntry")}
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-zinc-100">
              <Image
                src={previewURL}
                alt="receipt"
                fill
                sizes="(max-width: 640px) 100vw, 400px"
                className="object-contain"
                unoptimized
              />
              <button
                type="button"
                onClick={reset}
                disabled={scanning}
                aria-label={tC("cancel")}
                className="absolute top-2 right-2 size-8 rounded-full bg-black/60 text-white grid place-items-center disabled:opacity-50"
              >
                <X className="size-4" />
              </button>
              {/* Save-to-album — bottom-right corner so it doesn't
                  collide with the close X. Receipt scanning is the
                  most common use case where users want a copy on the
                  device for their own records, separate from the
                  parsed expense doc. */}
              <SaveToAlbumButton
                file={file}
                className="absolute bottom-2 right-2 size-8"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button
              type="button"
              size="lg"
              onClick={handleScan}
              disabled={scanning}
            >
              {scanning ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  AI 辨識中...
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  開始辨識
                </>
              )}
            </Button>
            {/* Mirror manual-entry link on the preview view too so
                users who decide mid-scan that AI isn't worth it can
                fall back without re-opening the dialog. */}
            {onManualEntry && (
              <button
                type="button"
                onClick={onManualEntry}
                className="text-center text-sm font-medium text-mango-brand-deep underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mango-brand-deep"
              >
                {tPP("expenses.manualEntry")}
              </button>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}
