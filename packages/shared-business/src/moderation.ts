// UGC moderation filtering — pure, cross-platform. Spec
// docs/features/ugc-moderation.md. Both apps/web and apps/ios call this to
// keep report/block behavior identical: hidden content and blocked authors
// disappear from every list render, client-side.

/** True if `authorUid` is on the viewer's own block list. */
export function isAuthorBlocked(
  authorUid: string,
  viewerBlockedUids: readonly string[] | null | undefined,
): boolean {
  return !!viewerBlockedUids?.includes(authorUid);
}

/** Should this piece of content (post or comment) render for the viewer?
 *  False if it's been auto-hidden (reportCount hit threshold) OR its
 *  author is on the viewer's block list. Hidden applies to everyone,
 *  including the author — v1 keeps this simple rather than building an
 *  "your post is under review" state (see spec §不做). */
export function isContentVisible(item: {
  authorUid: string;
  hidden?: boolean | null;
}, viewerBlockedUids: readonly string[] | null | undefined): boolean {
  if (item.hidden) return false;
  return !isAuthorBlocked(item.authorUid, viewerBlockedUids);
}

/** Filter a list of posts/comments down to what the viewer should see. */
export function filterVisible<T extends { authorUid: string; hidden?: boolean | null }>(
  items: readonly T[],
  viewerBlockedUids: readonly string[] | null | undefined,
): T[] {
  return items.filter((item) => isContentVisible(item, viewerBlockedUids));
}

// ── Pre-post / pre-comment objectionable content filter (Guideline 1.2) ──
// Shared pure helper so iOS, Web, and Cloud Functions enforce the same list.
// Keep multi-character ZH terms & whole-word EN boundaries so benign pet-care
// discussions (e.g., 公狗, 母狗, 發情, 結紮, 大便, 尿尿, cockapoo, shih tzu)
// are never falsely blocked.

export const OBJECTIONABLE_CONTENT_ERROR_CODE =
  "moderation/objectionable-content" as const;

export const OBJECTIONABLE_TERMS_ZH: readonly string[] = [
  "幹你娘",
  "操你媽",
  "他媽的",
  "草泥馬",
  "去死吧",
  "去自殺",
  "殺了你",
  "殺死你",
  "死全家",
  "強姦",
  "強暴",
  "性侵",
  "援交",
  "約炮",
  "裸聊",
  "色情網站",
  "傻逼",
  "賤人",
  "婊子",
  "雞巴",
];

export const OBJECTIONABLE_TERMS_EN: readonly string[] = [
  "fuck",
  "fucking",
  "fucked",
  "fucker",
  "motherfucker",
  "shit",
  "bullshit",
  "bitch",
  "asshole",
  "bastard",
  "cunt",
  "dickhead",
  "whore",
  "slut",
  "nigger",
  "nigga",
  "faggot",
  "retard",
  "rape",
  "rapist",
  "kill yourself",
  "suicide",
  "porn",
  "pornography",
];

const ZH_COMPACT_SEPARATOR_RE = /[\s\u200B-\u200D\uFEFF*._~•·\-]+/g;
const EN_OBFUSCATION_CHAR_RE = /[*._~•·\-]/g;
const EN_BOUNDARY_REGEXES = OBJECTIONABLE_TERMS_EN.map((term) => ({
  term,
  regex: new RegExp(`\\b${term.replace(/\s+/g, "\\s+")}\\b`, "i"),
}));

/** Returns the matched objectionable canonical term, or `null` if clean. */
export function findObjectionableTerm(text: string): string | null {
  if (!text) return null;
  const normalized = text.normalize("NFKC").toLowerCase();

  // Check ZH terms after collapsing whitespace/obfuscation separators.
  const compactZh = normalized.replace(ZH_COMPACT_SEPARATOR_RE, "");
  for (const term of OBJECTIONABLE_TERMS_ZH) {
    if (compactZh.includes(term)) return term;
  }

  // Check EN whole-word / phrase matches directly first.
  for (const { term, regex } of EN_BOUNDARY_REGEXES) {
    if (regex.test(normalized)) return term;
  }

  // Check obfuscated single-word tokens like f*u*c*k or f.u.c.k inside words.
  const deobfuscated = normalized
    .split(/\s+/)
    .map((tok) => tok.replace(EN_OBFUSCATION_CHAR_RE, ""))
    .join(" ");
  if (deobfuscated !== normalized) {
    for (const { term, regex } of EN_BOUNDARY_REGEXES) {
      if (regex.test(deobfuscated)) return term;
    }
  }

  return null;
}

/** True when `text` contains objectionable language that must be blocked pre-post. */
export function hasObjectionableContent(text: string): boolean {
  return findObjectionableTerm(text) !== null;
}
