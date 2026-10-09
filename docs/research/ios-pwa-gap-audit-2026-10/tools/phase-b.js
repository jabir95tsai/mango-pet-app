export const meta = {
  name: 'ios-pwa-impl-phase-b',
  description: 'Phase B: per-surface iOS→PWA fidelity + functional fixes, then per-lane review-and-fix',
  phases: [
    { title: 'Implement', detail: 'one engineer per surface lane (walks and pets lanes are 2-step chains)' },
    { title: 'Review', detail: 'per-lane reviewer re-reads the diff, verifies gap closure, fixes bugs in place' },
  ],
}

const W = 'C:/Users/jabir/Hacker_J/mango_pet_app-ios-pwa'
const SP = 'C:/Users/jabir/Hacker_J/mango_pet_app-ios-pwa/docs/research/ios-pwa-gap-audit-2026-10' // lane-*.json + foundation.md live here
const FOUNDATION = `READ ${SP}/foundation.md FIRST — exact APIs of the new primitives (apps/ios/src/components/ui), guest/auth components (apps/ios/src/components/auth), confirm helpers (apps/ios/src/lib/confirm.ts), family context + data hooks (apps/ios/src/state/family-context.tsx, apps/ios/src/lib/use-*.ts, feed-data.ts), language switcher, plus handoffs addressed to your lane (do the ones in files you own).`

const COMMON = `
You are an implementation engineer on the Mango Pet monorepo. Work ONLY inside the git worktree ${W} (absolute paths for every Read/Edit/Write/Grep/Glob; NEVER touch C:/Users/jabir/Hacker_J/mango_pet_app). Goal: make the iOS app (apps/ios, Expo SDK 52 / RN 0.76 / Expo Router 4 / @react-native-firebase) faithfully match the PWA (apps/web is the visual + behavioral reference) and improve iOS functionality. Several engineers work concurrently in this same worktree on DISJOINT files.

HARD RULES
1. Edit ONLY files in your OWNED list (you may create new files inside owned paths). If a needed change is in a file you don't own, do NOT edit it — put it in "handoffs".
2. A previous attempt of this exact task may have been interrupted: owned files may already be partially modified. Read current contents before editing and continue from the current state.
3. No mutating git commands (no add/commit/stash/checkout/reset/restore). Read-only git (diff/status/log) is fine.
4. Do NOT edit packages/** (shared-i18n catalogs included), functions/**, firestore rules/indexes, package.json, app.json, lockfiles. No new npm/native deps. Usable: expo-linear-gradient, react-native-svg, reanimated, gesture-handler, lucide-react-native, expo-router, async-storage, expo-image-picker/manipulator/camera/media-library/sharing/clipboard/file-system/location/localization/linking/constants, @react-native-community/datetimepicker, react-native-qrcode-svg, safe-area-context, @react-native-firebase/{app,auth,firestore,functions,messaging,storage}.
5. i18n: use t("Namespace.key", params?) from apps/ios/src/lib/i18n.ts over the SHARED catalog packages/shared-i18n/src/messages/{zh-TW,en}.json (read-only). Reuse the exact web key whenever web shows the same text (verify the key exists in BOTH catalogs; note keys added by the foundation phase are already merged). For text with no key, call t() with a NEW key (existing namespace if it is web-equivalent text, else namespace "Ios", e.g. "Ios.walks.permissionDenied") and list it in new_i18n_keys with zh-TW and en text. Single-brace placeholders "{name}". Replace every hard-coded CJK UI string in files you own (comments may stay). Relative times / weekdays / units must be locale-aware.
6. Design SoT (docs/design-system.md): colors.* / radius / shadows / type from apps/ios/src/theme/theme.ts (no new raw hex unless web uses that exact hex), primary = Button variant="primary" (btn-mango gradient, WHITE text), tabs = simple toggle (ui Tabs, NO sliding indicator), reduced motion mandatory (useReducedMotion), lucide-react-native icons with the SAME names the web component imports. Tailwind→RN: text-xs 12, text-sm 14, text-base 16, text-lg 18, text-xl 20, text-2xl 24; font-medium 500, semibold 600, bold 700, extrabold 800; spacing unit 4.
7. Use the shared foundation (already built): ${FOUNDATION}
   Prefer these primitives over hand-rolled equivalents (RouteHeader for page titles, Dialog for every bottom sheet/modal, Input/Textarea/FieldLabel for fields, EmptyState for empty states, Tabs for toggles, IconButton for icon-only buttons, confirm()/alertError() for confirmations/errors, GuestLockedNotice/useGuestUpgrade for guest gating, family-context + data hooks for scope/refresh/error).
8. a11y: icon-only Pressables need accessibilityRole="button" + i18n accessibilityLabel; ≥44pt hit target (hitSlop ok).
9. Accepted platform differences (don't "fix"): APNs push, PhotosKit save, Apple Sign-In, background GPS, Expo Router stack navigation, iPad CONTENT_MAX_WIDTH centered column. Restaurants/Knowledge are NOT ported (omit links to them). Do NOT change R11 semantics (per-pet progress currently uses all family walks, same as web) — that needs a PM decision.
10. Gap list: JSON file below; each gap has web_ref/ios_ref/current_ios/target/fix_plan (+ verdict/corrected_fix_plan for verified surfaces — prefer corrected_fix_plan). Most surfaces were NOT independently verified: before implementing each gap, open the cited web + iOS code, confirm it is real and that the target matches what web renders TODAY; skip with a reason if not. Implement every P0 and P1; P2 where reasonable. Read the web reference component for every UI change (don't work from summaries).
11. Keep behavior correct: do not change Firestore document shapes except to match web byte-for-byte; no backend changes (if a gap needs one, skip + handoff). Keep exports used by other files backward compatible (grep apps/ios before changing a signature).
12. Finish with: cd ${W}/apps/ios && npx tsc --noEmit . Fix every error in files you own; errors in other lanes' files may be transient — report them only.
Return the structured result; api_notes = anything other lanes/reviewers must know.
`

const RESULT_SCHEMA = {
  type: 'object',
  properties: {
    lane: { type: 'string' },
    fixed: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, summary: { type: 'string' } }, required: ['id', 'summary'] } },
    skipped: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, reason: { type: 'string' } }, required: ['id', 'reason'] } },
    files_changed: { type: 'array', items: { type: 'string' } },
    new_i18n_keys: { type: 'array', items: { type: 'object', properties: { key: { type: 'string' }, zh: { type: 'string' }, en: { type: 'string' } }, required: ['key', 'zh', 'en'] } },
    api_notes: { type: 'string' },
    handoffs: { type: 'array', items: { type: 'object', properties: { to: { type: 'string' }, file: { type: 'string' }, item: { type: 'string' } }, required: ['item'] } },
    typecheck: { type: 'object', properties: { passed_own_files: { type: 'boolean' }, remaining_errors: { type: 'string' } }, required: ['passed_own_files'] },
  },
  required: ['lane', 'fixed', 'skipped', 'files_changed', 'new_i18n_keys', 'api_notes', 'handoffs', 'typecheck'],
}

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    lane: { type: 'string' },
    bugs_fixed: { type: 'array', items: { type: 'object', properties: { file: { type: 'string' }, issue: { type: 'string' }, fix: { type: 'string' } }, required: ['file', 'issue', 'fix'] } },
    gaps_not_closed: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, reason: { type: 'string' }, fixed_now: { type: 'boolean' } }, required: ['id', 'reason', 'fixed_now'] } },
    remaining_concerns: { type: 'array', items: { type: 'string' } },
    new_i18n_keys: { type: 'array', items: { type: 'object', properties: { key: { type: 'string' }, zh: { type: 'string' }, en: { type: 'string' } }, required: ['key', 'zh', 'en'] } },
    typecheck_passed_own_files: { type: 'boolean' },
  },
  required: ['lane', 'bugs_fixed', 'gaps_not_closed', 'remaining_concerns', 'new_i18n_keys', 'typecheck_passed_own_files'],
}

const WALK_FILES_TRACK = 'apps/ios/src/components/walks/{walk-tracking-view,photo-share-flow,photo-prompt-sheet,camera-capture-modal,walk-confetti}.tsx, apps/ios/src/components/walks/walk-draft-*.tsx (new), apps/ios/src/components/walks/tracking-*.tsx (new), apps/ios/src/lib/{walk-tracking-service,walks,photos}.ts, apps/ios/src/lib/walk-drafts.ts (new), and in apps/ios/app/(tabs)/walks.tsx ONLY the tracking/stop/save/draft-recovery/photo-prompt integration code'
const WALK_FILES_ALL = 'apps/ios/app/(tabs)/walks.tsx, apps/ios/src/components/walks/** , apps/ios/src/lib/{walk-tracking-service,walks,photos,walk-drafts,walk-stats}.ts'
const PET_FILES_A = 'apps/ios/src/components/pets/{pet-expenses-body,expense-row,expense-form,pet-expense-card,expense-donut,receipt-scanner,health-record-card,pet-health-body,weight-chart,health-form}.tsx, new files apps/ios/src/components/pets/expense-*.tsx and health-*.tsx, apps/ios/src/lib/{expense-ui,ai-receipt,health-write,expenses-write}.ts'
const PET_FILES_ALL = 'apps/ios/app/(tabs)/pets.tsx, apps/ios/src/components/pets/** , apps/ios/src/lib/{expense-ui,ai-receipt,health-write,expenses-write,pets-write,reminders-write,pets}.ts'

const LANES = [
  { key: 'HOME', steps: [{ lane: 'HOME', gaps: 'lane-HOME.json', owned: 'apps/ios/app/(tabs)/index.tsx, apps/ios/src/components/home/**', task: 'Home tab 1:1 with web apps/web/src/app/app/page.tsx + components/home/*. Post card internals (incl. tagged-pet chips HOME-M2 / HOME-12) belong to the FEED lane — only change how Home uses PostCard. Mount GuestUpgradeNudge like web layout does on this tab. Wire pull-to-refresh + error/retry + focus refresh using the data layer API.' }] },
  { key: 'FEED', steps: [{ lane: 'FEED', gaps: 'lane-FEED.json', owned: 'apps/ios/app/feed.tsx, apps/ios/src/components/feed/**, apps/ios/src/lib/posts.ts, apps/ios/src/lib/format.ts (keep existing exports/signatures; add locale-aware variants)', task: 'Feed timeline, PostCard, composer, reactions, comments, post menu, lightbox 1:1 with web apps/web/src/app/app/feed/page.tsx + components/feed/* + ui/photo-lightbox. Convert the feed list to FlatList. Guest gating via GuestLockedNotice/useGuestUpgrade. Save-to-album: apps/ios/src/lib/save-photo.ts is owned by the SOCIAL lane — keep using its current exported API.' }] },
  { key: 'WALKS', steps: [
    { lane: 'TRACK', gaps: 'lane-TRACK.json', owned: WALK_FILES_TRACK, task: 'Active walk tracking, pause/resume, stop confirm, save + post-save recap, drafts/recovery (port web walk-drafts behavior), R16 start-failure + session identity persistence, in-walk photos, auto-photo prompts (guest-gated), confetti. Web refs: apps/web/src/components/walks/walk-tracking-view.tsx, photo-prompt-sheet.tsx, apps/web/src/app/app/walks/page.tsx, apps/web/src/lib/** walk draft/tracking modules, ui/confetti-canvas.tsx. TRACK-9: createWalk idempotency must work with the existing rules (read firestore.rules walks create/update rules to choose the approach; do NOT change rules).' },
    { lane: 'WALKS', gaps: 'lane-WALKS.json', owned: WALK_FILES_ALL, task: 'Walks home page 1:1 with web apps/web/src/app/app/walks/page.tsx and components/walks/* (dial, week strip, streak chip, walk rows with delete, pet picker, start CTA, manual walk dialog with start/end time pickers, empty states, home goal-hit confetti). The TRACK engineer already finished the tracking/draft work in these files (their notes are below) — integrate, do not undo it.' },
  ] },
  { key: 'PETS', steps: [
    { lane: 'PETSA', gaps: 'lane-PETSA.json', owned: PET_FILES_A, task: 'Pets expenses + health tabs 1:1 with web components/pets/pet-expenses-body.tsx, pet-expense-card.tsx, pet-expense-donut.tsx, expenses/*, pet-health-body.tsx, pet-health-record-card.tsx, health/*: month total bar + % chip, donut + legend, expense edit/delete, health delete, expense form parity (AI prefill, items, edit mode), receipt scanner (library pick, preview/retake, permission settings link), health form date fields. If pets.tsx (not yours yet) needs wiring (e.g. edit/delete callbacks), put exact instructions in handoffs — the PETSB engineer runs right after you and will wire them.' },
    { lane: 'PETSB', gaps: 'lane-PETSB.json', owned: PET_FILES_ALL, task: 'Pets page shell 1:1 with web apps/web/src/components/pets/pets-page-content.tsx, pets-top-bar, pet-header, pet-switcher-dropdown (floating panel), pet-tabs (sticky simple toggle), pet-overview-body, pet-reminders-body, reminder-card/form, pet-form-dialog (incl. delete pet via the same client write path web uses — check apps/web/src/lib/firebase/pets.ts), pets-empty-state, pet-floating-add (FAB position). Wire the data layer refresh/error/scope guard. The PETSA engineer finished the expenses/health parts (notes + handoffs below) — wire their handoffs into pets.tsx and do not undo their work.' },
  ] },
  { key: 'LEAD', steps: [{ lane: 'LEAD', gaps: 'lane-LEAD.json', owned: 'apps/ios/app/(tabs)/leaderboard.tsx, apps/ios/src/components/leaderboard/**, apps/ios/src/lib/leaderboards.ts', task: 'Leaderboard 1:1 with web apps/web/src/app/app/leaderboard/page.tsx + components/leaderboard/*. Replace segmented.tsx usage with the ui Tabs primitive (simple toggle). Pause realtime listeners when the tab is unfocused (useIsFocused/useFocusEffect). FlatList for rows, pull-to-refresh, error vs computing states, empty states via EmptyState.' }] },
  { key: 'SETTINGS', steps: [{ lane: 'SETTINGS', gaps: 'lane-SETTINGS.json', owned: 'apps/ios/app/(tabs)/settings.tsx, apps/ios/src/components/settings/** EXCEPT family-section.tsx (also you may adjust language-switcher.tsx and guest-upgrade-section.tsx only for layout fit), apps/ios/src/lib/{user-prefs,push,account,data-export}.ts', task: 'Settings page 1:1 with web apps/web/src/app/app/settings/page.tsx + components/settings/*: section ORDER, card shell (radius/padding/shadow), RouteHeader, achievements entry card linking to the route "/achievements" (another engineer creates apps/ios/app/achievements.tsx concurrently), language switcher section (component exists at components/settings/language-switcher.tsx), guest gating like web (GuestLockedNotice instead of hiding), push card states + icon disc (+ test push only if web has it AND it needs no backend change), engagement push section, prefs sections loading/pending/error, delete account (red warning box, keyboard-safe Dialog), export, blocked users, photos preview. Web overflow drawer (SHELL-16/SETTINGS-6): provide an iOS "more" entry (top-right MoreHorizontal) that lists the web drawer destinations iOS actually has (photos, feed, friends, achievements) — not restaurants/knowledge. Keep the family section mounted where web puts it (family-section.tsx itself is owned by FAMACH). Reduce duplicate users/{uid} reads where you own the code.' }] },
  { key: 'FAMACH', steps: [{ lane: 'FAMACH', gaps: 'lane-FAMACH.json', owned: 'apps/ios/app/family.tsx, apps/ios/src/components/settings/family-section.tsx, apps/ios/src/components/family/** EXCEPT invite-qr.tsx, apps/ios/src/lib/families-write.ts, apps/ios/app/achievements.tsx (new), apps/ios/src/lib/achievements.ts (new), apps/ios/src/components/achievements/** (new), apps/ios/app/onboarding.tsx (ONLY to hook the import wizard after create/join success), apps/ios/src/components/placeholder-screen.tsx (may delete if unused)', task: 'Family + achievements. (1) Family section 1:1 with web components/family/family-section.tsx (Dialogs with keyboard safety + cancel, error mapping, owner badge, copy feedback, regen spinner, member list states). De-duplicate app/family.tsx: make it a thin stack page (RouteHeader + the same FamilySection component) instead of a 450-line divergent copy — keep the /family route working for existing links. (2) Import wizard (web components/family/import-wizard-dialog.tsx) using the existing callables importPersonalToFamily / mergeAndImportToFamily via @react-native-firebase/functions region asia-east1 (see how apps/ios/src/lib/families-write.ts calls other callables) — shown after create/join success in family section and onboarding, like web. (3) Achievements screen 1:1 with web apps/web/src/app/app/achievements/page.tsx + components/achievements/badge-card.tsx + apps/web/src/lib/firebase/achievements.ts (reads users/{uid}/stats/lifetime, users/{uid}/achievements, count aggregations — use @react-native-firebase/firestore count() if available in v21, else the same query fallback documented in api_notes) and the shared achievement definitions (find where web imports them; if they are in apps/web only, copy the PURE definitions into apps/ios/src/lib/achievements.ts with a comment pointing to the web source — do not edit packages). Earned/locked states, progress, reduced-motion-safe shine.' }] },
  { key: 'SOCIAL', steps: [{ lane: 'SOCIAL', gaps: 'lane-SOCIAL.json', owned: 'apps/ios/app/friends/**, apps/ios/app/photos.tsx, apps/ios/src/components/photos/** (new), apps/ios/src/components/friends/** (new), apps/ios/src/components/family/invite-qr.tsx, apps/ios/src/lib/{friends-read,friends-write,photo-gallery,save-photo}.ts', task: 'Friends (list/requests/search/add, My QR dialog with logo overlay + display name) and Photos gallery 1:1 with web apps/web/src/app/app/friends/**, components/friends/*, apps/web/src/app/app/photos/page.tsx, components/photos/*. Photos: save-all-unsaved primary action, asset cards with footer + per-photo save + saved badge, filter pills style, empty/partial-error states, FlatList grid, batch save requesting permission once and keeping failed items selected. save-photo.ts: improve (no re-encode of already-JPEG remote images where possible, single permission request API) while keeping existing exports used by feed/lightbox working. Skip SOCIAL-M2 (in-app QR scanner; web has none).' }] },
]

function implPrompt(step, prior) {
  return `${COMMON}

YOUR LANE: ${step.lane}
OWNED FILES/PATHS (relative to ${W}): ${step.owned}
GAP FILE (read fully first): ${SP}/${step.gaps}
Cross-cutting rules that also apply to your owned files: ${SP}/lane-XC.json (XCUT-16 a11y, XCUT-17 reduced-motion modals, XCUT-12 hard-coded strings, SHELL-23 re-tap tab scrolls to top — apply via useScrollToTop from @react-navigation/native if your lane owns a tab screen).

TASK:
${step.task}
${prior ? `\nPREVIOUS ENGINEER IN YOUR CHAIN FINISHED. Their result (fixed/skipped/api_notes/handoffs):\n${JSON.stringify({ fixed: prior.fixed, skipped: prior.skipped, api_notes: prior.api_notes, handoffs: prior.handoffs })}\n` : ''}`
}

function reviewPrompt(laneKey, steps, results) {
  return `${COMMON}

You are the REVIEWER-FIXER for lane ${laneKey}. The implementation is done (results below). Your job:
1. Run: git -C ${W} diff -- <each owned path> (and read new untracked files: git -C ${W} status --short) to see exactly what changed in this lane's owned files.
2. Hunt for real correctness bugs introduced or left: wrong hook deps / stale closures, setState after unmount, listeners not cleaned, unhandled promise rejections, broken navigation routes, Firestore writes with changed shapes or unknown scope, i18n keys that don't exist in the catalogs AND aren't listed in new_i18n_keys, layout bugs (FlatList inside ScrollView same orientation, missing keys, flex issues), reduced-motion not respected, a11y labels missing, regressions vs previous behavior. Fix them directly (you own the same files).
3. For each gap id in the gap file(s), check it is actually closed vs the web reference; if not closed and feasible, close it now (fixed_now=true), else explain.
4. Run cd ${W}/apps/ios && npx tsc --noEmit and fix errors in owned files.
OWNED FILES/PATHS: ${steps.map((s) => s.owned).join(' ; ')}
GAP FILES: ${steps.map((s) => SP + '/' + s.gaps).join(' , ')}
IMPLEMENTATION RESULTS: ${JSON.stringify(results.map((r) => r && { lane: r.lane, fixed: r.fixed, skipped: r.skipped, new_i18n_keys: r.new_i18n_keys, api_notes: r.api_notes, handoffs: r.handoffs }))}
Return the structured review result (new_i18n_keys = only keys YOU newly introduced).`
}

const SELECTED = args && Array.isArray(args.lanes) ? LANES.filter((l) => args.lanes.includes(l.key)) : LANES
log(`lanes this run: ${SELECTED.map((l) => l.key).join(', ')}`)
const out = await pipeline(
  SELECTED,
  async (L) => {
    const results = []
    let prior = null
    for (const step of L.steps) {
      const r = await agent(implPrompt(step, prior), { label: `impl:${step.lane}`, phase: 'Implement', schema: RESULT_SCHEMA })
      results.push(r)
      prior = r
    }
    return results
  },
  (results, L) => agent(reviewPrompt(L.key, L.steps, results), { label: `review:${L.key}`, phase: 'Review', schema: REVIEW_SCHEMA })
    .then((review) => ({ lane: L.key, results, review })),
)
return out
