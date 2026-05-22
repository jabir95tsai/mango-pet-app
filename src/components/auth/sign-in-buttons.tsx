"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FirebaseError } from "firebase/app";
import {
  NeedsLinkError,
  signInWithProvider,
  type AuthProviderKind,
} from "@/lib/firebase/auth";
import { useAuth } from "./auth-provider";
import { cn } from "@/lib/utils";

const PROVIDERS: { kind: AuthProviderKind; labelKey: string; className: string }[] = [
  {
    kind: "google",
    labelKey: "signInWithGoogle",
    className: "bg-white text-zinc-900 border border-zinc-200 hover:bg-zinc-50",
  },
  {
    kind: "apple",
    labelKey: "signInWithApple",
    className: "bg-black text-white hover:bg-zinc-800",
  },
  {
    kind: "facebook",
    labelKey: "signInWithFacebook",
    className: "bg-[#1877F2] text-white hover:bg-[#1464d0]",
  },
];

const PROVIDER_LABEL: Record<AuthProviderKind, string> = {
  google: "Google",
  apple: "Apple",
  facebook: "Facebook",
};

function friendlyError(err: unknown, t: (key: string) => string): string {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case "auth/popup-closed-by-user":
      case "auth/cancelled-popup-request":
        return t("errors.cancelled");
      case "auth/popup-blocked":
        return t("errors.popupBlocked");
      case "auth/network-request-failed":
        return t("errors.network");
      case "auth/operation-not-allowed":
        return t("errors.providerDisabled");
      case "auth/unauthorized-domain":
        return t("errors.unauthorizedDomain");
      case "auth/internal-error":
      case "auth/invalid-api-key":
      case "auth/app-not-authorized":
        return t("errors.config");
      default:
        return t("errors.generic");
    }
  }
  return err instanceof Error ? err.message : t("errors.generic");
}

type Hint = {
  existingKind: AuthProviderKind;
  newKind: AuthProviderKind;
};

type Props = {
  nextPath?: string;
};

export function SignInButtons({ nextPath = "/app" }: Props) {
  const t = useTranslations("Auth");
  const router = useRouter();
  const { user } = useAuth();
  const [pending, setPending] = useState<AuthProviderKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linkHint, setLinkHint] = useState<Hint | null>(null);

  useEffect(() => {
    if (user) router.replace(nextPath);
  }, [user, router, nextPath]);

  async function handleSignIn(kind: AuthProviderKind) {
    setPending(kind);
    setError(null);
    try {
      await signInWithProvider(kind);
      setLinkHint(null);
    } catch (err) {
      if (err instanceof NeedsLinkError) {
        setLinkHint({ existingKind: err.existingKind, newKind: err.newKind });
        setError(null);
      } else {
        setError(friendlyError(err, t));
      }
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex w-full max-w-xs flex-col gap-3">
      {PROVIDERS.map((p) => {
        const isSuggested =
          linkHint?.existingKind === p.kind ? true : false;
        return (
          <button
            key={p.kind}
            type="button"
            onClick={() => handleSignIn(p.kind)}
            disabled={pending !== null}
            className={cn(
              "relative h-12 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60",
              p.className,
              isSuggested &&
                "ring-4 ring-amber-300 ring-offset-2 ring-offset-background",
            )}
          >
            {pending === p.kind ? "..." : t(p.labelKey)}
          </button>
        );
      })}

      {linkHint && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-500/30 dark:bg-amber-500/10">
          <p className="mb-1 font-medium text-amber-950 dark:text-amber-200">
            {t("linkHint.title", {
              email: PROVIDER_LABEL[linkHint.existingKind],
            })}
          </p>
          <p className="text-xs text-amber-800 dark:text-amber-300">
            {t("linkHint.body", {
              existing: PROVIDER_LABEL[linkHint.existingKind],
              tried: PROVIDER_LABEL[linkHint.newKind],
            })}
          </p>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 text-center">{error}</p>
      )}
    </div>
  );
}
