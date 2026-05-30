"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Download } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { exportMyData } from "@/lib/firebase/users";

/** Settings → Privacy & Data → "下載我的資料" button. Runs the
 *  exportUserData callable, serialises the result to JSON, and triggers
 *  a same-tab browser download via a transient `Blob` URL. No upload
 *  step — the JSON lives only in memory until the browser writes it
 *  to disk, so we never touch Storage. */
export function ExportDataButton() {
  const t = useTranslations("Settings.privacyData");
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    if (!user || busy) return;
    setBusy(true);
    setDone(false);
    setError(null);
    let url: string | null = null;
    try {
      const data = await exportMyData();
      // Pretty-printed JSON — adds a few KB but matters for the "open
      // in a text editor and skim my data" use case the spec calls out
      // as a success criterion.
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      url = URL.createObjectURL(blob);
      // Filename embeds uid + ISO timestamp so multiple exports don't
      // clobber each other in the default Downloads folder.
      const iso = new Date().toISOString().replace(/[:.]/g, "-");
      const a = document.createElement("a");
      a.href = url;
      a.download = `mango-pet-data-${user.uid}-${iso}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      // Defer revoke so the click handler completes before the URL is
      // invalidated. Tiny memory blip from the Blob staying alive a
      // couple seconds is much cheaper than racing the download start.
      if (url) {
        const toRevoke = url;
        setTimeout(() => URL.revokeObjectURL(toRevoke), 5000);
      }
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        onClick={handleDownload}
        disabled={!user || busy}
        variant="secondary"
        className="self-start"
      >
        <Download className="size-4" />
        {busy ? t("downloading") : t("downloadAction")}
      </Button>
      {done && !error && (
        <p className="text-xs text-emerald-700 dark:text-emerald-400">
          {t("successToast")}
        </p>
      )}
      {error && (
        <p className="text-xs text-red-700 dark:text-red-300">
          {t("errorPrefix")}: {error}
        </p>
      )}
    </div>
  );
}
