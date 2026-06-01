"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import QRCode from "qrcode";
import { Copy, Check } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";

type Props = {
  open: boolean;
  onClose: () => void;
};

/** Builds the deep link target. We send people to /app/friends/add?uid=X
 *  which the AddFriendPage parses and confirms before firing the request.
 *  Using NEXT_PUBLIC_SITE_URL so the QR works even when scanned offline
 *  and opened later. */
function buildInviteUrl(uid: string): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (typeof window !== "undefined" ? window.location.origin : "");
  const params = new URLSearchParams({
    uid,
    openExternalBrowser: "1",
  });
  return `${base}/app/friends/add?${params.toString()}`;
}

export function MyQrDialog({ open, onClose }: Props) {
  const tC = useTranslations("Common");
  const tF = useTranslations("Friends");
  const { user } = useAuth();
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    const url = buildInviteUrl(user.uid);
    QRCode.toDataURL(url, {
      // High error correction so the QR still scans with the avatar
      // overlay or print scaling.
      errorCorrectionLevel: "H",
      margin: 2,
      width: 320,
      color: {
        // Match brand amber + soft white so the QR feels on-brand
        // rather than stock-black.
        dark: "#b45309",
        light: "#ffffff",
      },
    }).then(setDataUrl).catch(() => setDataUrl(null));
  }, [open, user]);

  async function handleCopy() {
    if (!user) return;
    try {
      await navigator.clipboard.writeText(buildInviteUrl(user.uid));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard denial — ignore */
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={tF("qrTitle")}>
      <div className="flex flex-col items-center gap-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-400 text-center">
          {tF("qrInstructions")}
        </p>

        <div className="relative grid size-72 place-items-center rounded-2xl border border-zinc-200/80 bg-white p-3 shadow-sm shadow-zinc-200/40 dark:border-zinc-800 dark:bg-zinc-100">
          {dataUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={dataUrl}
                alt={tF("qrAlt")}
                className="size-full"
              />
              {/* Centre logo overlay — survives the H-level error correction. */}
              <div className="absolute grid size-14 place-items-center overflow-hidden rounded-2xl bg-white shadow ring-2 ring-amber-500">
                <Image
                  src="/icons/mango-pet-logo.png"
                  alt="Mango Pet"
                  width={56}
                  height={56}
                  className="size-full object-cover"
                />
              </div>
            </>
          ) : (
            <p className="text-xs text-zinc-400">{tC("loading")}</p>
          )}
        </div>

        <p className="text-sm font-medium">{user?.displayName ?? "Me"}</p>

        <div className="flex w-full gap-2">
          <Button
            variant="secondary"
            onClick={handleCopy}
            className="flex-1"
          >
            {copied ? (
              <>
                <Check className="size-4" /> {tF("copied")}
              </>
            ) : (
              <>
                <Copy className="size-4" /> {tF("copyLink")}
              </>
            )}
          </Button>
          <Button onClick={onClose} className="flex-1">
            {tC("back")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
