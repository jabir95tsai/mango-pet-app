"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Bell, BellOff, BellRing, Info, Send } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import {
  currentPermission,
  disablePush,
  enablePush,
  isPushSupported,
  sendTestPush,
} from "@/lib/firebase/messaging";
import { getAppUser } from "@/lib/firebase/users";

type Status =
  | { kind: "checking" }
  | { kind: "unsupported" }
  | { kind: "disabled" }
  | { kind: "denied" }
  | { kind: "enabled"; token: string };

/** True for iOS Safari running in a regular browser tab (not added to home screen). */
function isIosBrowserNotPwa(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua);
  if (!isIos) return false;
  // PWA on iOS: navigator.standalone === true
  const standalone =
    "standalone" in navigator &&
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return !standalone;
}

export function PushToggle() {
  const tP = useTranslations("Push");
  const { user } = useAuth();
  const [status, setStatus] = useState<Status>({ kind: "checking" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function probe() {
      if (!user) return;
      if (!(await isPushSupported())) {
        if (!cancelled) setStatus({ kind: "unsupported" });
        return;
      }
      const perm = currentPermission();
      if (perm === "denied") {
        if (!cancelled) setStatus({ kind: "denied" });
        return;
      }
      const appUser = await getAppUser(user.uid);
      const tokens = appUser?.fcmTokens ?? [];
      if (perm === "granted" && tokens.length > 0) {
        if (!cancelled) setStatus({ kind: "enabled", token: tokens[0] });
      } else {
        if (!cancelled) setStatus({ kind: "disabled" });
      }
    }

    probe();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function handleEnable() {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      const result = await enablePush(user.uid);
      if (result) {
        setStatus({ kind: "enabled", token: result.token });
      } else {
        setStatus({ kind: "disabled" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed";
      if (msg.includes("denied")) setStatus({ kind: "denied" });
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable() {
    if (!user || status.kind !== "enabled") return;
    setBusy(true);
    setError(null);
    try {
      await disablePush(user.uid, status.token);
      setStatus({ kind: "disabled" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    setError(null);
    try {
      const res = await sendTestPush();
      if (res.ok && res.sent > 0) {
        setTestResult(
          `已送出 ${res.sent} 條推播${res.failed > 0 ? `（${res.failed} 失敗）` : ""}`,
        );
      } else {
        setTestResult(`送出失敗：${res.failed} 失敗`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "測試推播失敗");
    } finally {
      setTesting(false);
    }
  }

  const showIosHint = isIosBrowserNotPwa() && status.kind !== "enabled";
  const isVapidMissingError = error?.includes("NEXT_PUBLIC_FIREBASE_VAPID_KEY");

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
            {status.kind === "enabled" ? (
              <BellRing className="size-4" />
            ) : status.kind === "denied" || status.kind === "unsupported" ? (
              <BellOff className="size-4" />
            ) : (
              <Bell className="size-4" />
            )}
          </span>
          <div className="min-w-0">
            <p className="font-medium text-sm">{tP("title")}</p>
            <p className="text-xs leading-5 text-zinc-500">{tP(`status.${status.kind}`)}</p>
          </div>
        </div>

        {status.kind === "enabled" ? (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleTest}
              disabled={testing || busy}
            >
              <Send className="size-3.5" />
              {testing ? "..." : "測試"}
            </Button>
            <Button size="sm" variant="secondary" onClick={handleDisable} disabled={busy || testing}>
              {busy ? "..." : tP("disable")}
            </Button>
          </div>
        ) : status.kind === "disabled" ? (
          <Button size="sm" onClick={handleEnable} disabled={busy}>
            {busy ? "..." : tP("enable")}
          </Button>
        ) : null}
      </div>

      {testResult && (
        <p className="text-xs text-emerald-700 dark:text-emerald-400">
          {testResult}
        </p>
      )}

      {showIosHint && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          <Info className="size-4 shrink-0 mt-0.5" />
          <span>
            iPhone 需先把 App 加到主畫面（Safari 分享 → 加入主畫面）才能收推播。
          </span>
        </div>
      )}

      {isVapidMissingError && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
          <Info className="size-4 shrink-0 mt-0.5" />
          <span>
            未設定 VAPID Key。請到 Firebase Console → 專案設定 → Cloud Messaging → Web push certificates 產生金鑰，並設為 <code className="font-mono">NEXT_PUBLIC_FIREBASE_VAPID_KEY</code>。
          </span>
        </div>
      )}

      {error && !isVapidMissingError && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
