/**
 * confirm() / alertError() — the iOS counterpart of web's useConfirm()
 * (apps/web/src/components/ui/confirm-provider.tsx).
 *
 * Web: `await confirm({ title, message, confirmText, cancelText, danger })`
 * → Promise<boolean>, rendered as a Dialog with a ghost cancel and a primary
 * (or danger) confirm. iOS uses the native UIAlertController (Alert.alert) as
 * the accepted platform equivalent: cancel = style "cancel", confirm =
 * "destructive" when `destructive`/`danger`, otherwise "default".
 *
 * Defaults mirror web through the shared catalog: title → Common.confirm,
 * confirm label → Common.confirm, cancel label → Common.cancel.
 *
 * Both the lead-spec names (confirmLabel / cancelLabel / destructive) and the
 * web names (confirmText / cancelText / danger) are accepted.
 */
import { Alert } from "react-native";

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
    let settled = false;
    const settle = (v: boolean) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };
    Alert.alert(
      title,
      opts.message,
      [
        { text: cancelLabel, style: "cancel", onPress: () => settle(false) },
        {
          text: confirmLabel,
          style: destructive ? "destructive" : "default",
          onPress: () => settle(true),
        },
      ],
      // Android only (iOS alerts always need a button); keeps the promise settled.
      { cancelable: true, onDismiss: () => settle(false) },
    );
  });
}

/**
 * Generic failure alert: title = Error.title ("出了點狀況" / "Something went
 * wrong"), optional detail message. Use instead of hard-coded "失敗" alerts.
 */
export function alertError(message?: string): void {
  Alert.alert(t("Error.title"), message);
}

/** Alias of alertError (name used in the SHELL-12 gap plan). */
export const notifyError = alertError;

/**
 * Plain informational alert with a single OK-style button (Common.confirm),
 * resolving when dismissed.
 */
export function notify(title: string, message?: string): Promise<void> {
  return new Promise<void>((resolve) => {
    Alert.alert(title, message, [{ text: t("Common.confirm"), onPress: () => resolve() }], {
      cancelable: true,
      onDismiss: () => resolve(),
    });
  });
}
