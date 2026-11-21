import { showPrompt } from "@/lib/prompts";
import { t } from "@/lib/i18n";

export type ConfirmOptions = {
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** Web alias of `confirmLabel`. */
  confirmText?: string;
  /** Web alias of `cancelLabel`. */
  cancelText?: string;
  /** Web alias of `destructive`. */
  danger?: boolean;
};

export function confirm(opts: ConfirmOptions): Promise<boolean> {
  const title = opts.title ?? t("Common.confirm");
  const confirmLabel = opts.confirmLabel ?? opts.confirmText ?? t("Common.confirm");
  const cancelLabel = opts.cancelLabel ?? opts.cancelText ?? t("Common.cancel");
  const destructive = opts.destructive ?? opts.danger ?? false;

  return new Promise<boolean>((resolve) => {
    showPrompt(title, opts.message, [
      { text: cancelLabel, style: "cancel", onPress: () => resolve(false) },
      { text: confirmLabel, style: destructive ? "destructive" : "default", onPress: () => resolve(true) },
    ]);
  });
}

/**
 * Generic failure alert: title = Error.title ("出了點狀況" / "Something went
 * wrong"), optional detail message. Use instead of hard-coded "失敗" alerts.
 */
export function alertError(message?: string): void {
  showPrompt(t("Error.title"), message);
}

/** Alias of alertError (name used in the SHELL-12 gap plan). */
export const notifyError = alertError;

/**
 * Plain informational alert with a single OK-style button (Common.confirm),
 * resolving when dismissed.
 */
export function notify(title: string, message?: string): Promise<void> {
  return new Promise<void>((resolve) => {
    showPrompt(title, message, [{ text: t("Common.confirm"), onPress: () => resolve() }]);
  });
}
