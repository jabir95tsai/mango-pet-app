"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
};

export function Dialog({ open, onClose, title, children, className }: Props) {
  const tC = useTranslations("Common");

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={cn(
          "max-h-[90vh] w-full overflow-y-auto rounded-t-lg bg-white shadow-xl sm:max-w-lg sm:rounded-lg dark:bg-zinc-950",
          className,
        )}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="sticky top-0 flex items-center justify-between border-b border-zinc-100 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="font-semibold">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={tC("close")}
              className="rounded-lg p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <X className="size-5" />
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
