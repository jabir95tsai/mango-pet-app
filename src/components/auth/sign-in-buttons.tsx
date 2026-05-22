"use client";

import { useState, useEffect, type ReactNode } from "react";
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

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z" />
    </svg>
  );
}

const PROVIDERS: {
  kind: AuthProviderKind;
  labelKey: string;
  className: string;
  icon: ReactNode;
}[] = [
  {
    kind: "google",
    labelKey: "signInWithGoogle",
    className: "bg-white text-zinc-900 border border-zinc-200 hover:bg-zinc-50",
    icon: <GoogleIcon className="size-5 shrink-0" />,
  },
  {
    kind: "apple",
    labelKey: "signInWithApple",
    className: "bg-black text-white hover:bg-zinc-800",
    icon: <AppleIcon className="size-5 shrink-0" />,
  },
  {
    kind: "facebook",
    labelKey: "signInWithFacebook",
    className: "bg-[#1877F2] text-white hover:bg-[#1464d0]",
    icon: <FacebookIcon className="size-5 shrink-0" />,
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
    <div className="mx-auto flex w-full max-w-xs flex-col gap-3">
      {PROVIDERS.map((p) => {
        const isSuggested =
          linkHint?.existingKind === p.kind ? true : false;
        const isPending = pending === p.kind;
        return (
          <button
            key={p.kind}
            type="button"
            onClick={() => handleSignIn(p.kind)}
            disabled={pending !== null}
            aria-label={t(p.labelKey)}
            className={cn(
              "relative flex h-12 items-center justify-center gap-3 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60",
              p.className,
              isSuggested &&
                "ring-4 ring-amber-300 ring-offset-2 ring-offset-background",
            )}
          >
            {isPending ? (
              <span aria-hidden="true">...</span>
            ) : (
              <>
                {p.icon}
                <span>{t(p.labelKey)}</span>
              </>
            )}
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
