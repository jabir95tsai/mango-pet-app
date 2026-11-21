import { useSyncExternalStore } from "react";
import { currentPrompt, subscribePrompts, chooseAction } from "@/lib/prompts";
import { Dialog } from "./Dialog";
import { Button } from "./Button";

export function PromptHost() {
  const prompt = useSyncExternalStore(subscribePrompts, currentPrompt, currentPrompt);
  if (!prompt) return null;
  const cancel = prompt.actions.find((action) => action.style === "cancel");
  return (
    <Dialog
      windowOverlay
      visible
      title={prompt.title}
      description={prompt.message}
      size={prompt.size}
      dismissible={prompt.dismissible}
      onClose={() => chooseAction(prompt, cancel ?? (prompt.actions.length === 1 ? prompt.actions[0] : undefined))}
    >
      {prompt.actions.map((action, index) => (
        <Button
          key={index}
          label={action.text}
          fullWidth
          variant={action.style === "cancel" ? "ghost" : action.style === "destructive" ? "danger" : prompt.size === "sheet" ? "secondary" : "primary"}
          onPress={() => chooseAction(prompt, action)}
        />
      ))}
    </Dialog>
  );
}
