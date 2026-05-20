"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Camera, Loader2, Sparkles, X } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { extractReceipt } from "@/lib/firebase/ai-receipt";
import type { ExtractedReceipt } from "@/lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  onExtracted: (data: ExtractedReceipt) => void;
};

export function ReceiptScanner({ open, onClose, onExtracted }: Props) {
  const tE = useTranslations("Expense");
  const tC = useTranslations("Common");
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

  function reset() {
    setFile(null);
    setPreviewURL(null); // useEffect cleanup will revoke the previous URL
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    reset();
    setFile(picked);
    setPreviewURL(URL.createObjectURL(picked));
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
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePick}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
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
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="relative aspect-[3/4] w-full rounded-xl overflow-hidden bg-zinc-100">
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
          </div>
        )}
      </div>
    </Dialog>
  );
}
