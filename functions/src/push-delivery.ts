/** FCM cannot confirm display. Only a definitive token rejection permits fallback. */
export async function deliverPush(
  tokens: string[],
  send: (token: string) => Promise<string>,
  removeInvalid: (tokens: string[]) => Promise<void>,
): Promise<{ ok: boolean; invalidCount: number }> {
  const invalid: string[] = [];
  let ok = false;
  try {
    for (const token of tokens) {
      try {
        await send(token);
        ok = true;
        break;
      } catch (error) {
        const code = (error as { code?: string })?.code;
        if (code !== "messaging/invalid-registration-token" &&
            code !== "messaging/registration-token-not-registered") throw error;
        invalid.push(token);
      }
    }
  } finally {
    if (invalid.length) await removeInvalid(invalid);
  }
  return { ok, invalidCount: invalid.length };
}
