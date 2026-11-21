const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./auth-push-harness.cjs");

test("cancel and repeated taps cannot confirm the next queued action", async () => {
  const i18n = { "@/lib/i18n": { t: (key) => key } };
  const prompts = load("src/lib/prompts.ts", i18n);
  const { confirm } = load("src/lib/confirm.ts", { ...i18n, "@/lib/prompts": prompts });
  const first = confirm({ title: "Delete?", destructive: true });
  const second = confirm({ title: "Continue?" });
  const deletion = prompts.currentPrompt();
  prompts.chooseAction(deletion, deletion.actions.find((action) => action.style === "cancel"));
  prompts.chooseAction(deletion, deletion.actions.find((action) => action.style === "destructive"));
  assert.equal(await first, false);
  const next = prompts.currentPrompt();
  assert.equal(next.title, "Continue?");
  prompts.chooseAction(next, next.actions[1]);
  assert.equal(await second, true);
  assert.equal(prompts.currentPrompt(), undefined);
});
