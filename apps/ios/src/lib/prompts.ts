import { t } from "@/lib/i18n";

type Action = { text: string; style?: "cancel" | "destructive" | "default"; onPress?: () => void };
type Prompt = { title: string; message?: string; actions: Action[]; dismissible: boolean; size: "sheet" | "center" };

const pending: Prompt[] = [];
const listeners = new Set<() => void>();
export const currentPrompt = () => pending[0];
export function subscribePrompts(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function enqueue(prompt: Prompt) {
  pending.push(prompt);
  listeners.forEach((notify) => notify());
}

export function showPrompt(title: string, message?: string, actions: Action[] = [{ text: t("Common.confirm") }], options = { dismissible: true }) {
  enqueue({ title, message, actions, ...options, size: "center" });
}

export function showMenu(title: string, actions: Action[]) {
  enqueue({ title, actions: [...actions, { text: t("Common.cancel"), style: "cancel" }], dismissible: true, size: "sheet" });
}

export function chooseAction(prompt: Prompt, action?: Action) {
  if (currentPrompt() !== prompt) return;
  pending.shift();
  listeners.forEach((notify) => notify());
  action?.onPress?.();
}
