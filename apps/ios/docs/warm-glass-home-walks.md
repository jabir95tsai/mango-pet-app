# Warm mango glass — approved A direction

User approved the A comparison and direct implementation on 2026-11-14.
Scope: iOS Home and Walks presentation only. Keep authentication, Firebase,
feed actions, pet selection, progress calculation, recovery, tracking, manual
logging, deletion and photo flows unchanged. Preserve existing app.json change.

Approach: retain React Native/Expo and existing native glass dependency. Add
an iOS-local warm canvas/surface palette; use actual glass for small controls,
readable softly tinted surfaces for feed/history; no blur on every list row.
The rejected B direction was cool/neutral Apple minimalism. A keeps cream,
apricot ambience, warm brown type and orange emphasis.

The concept's demo reminders/distance target are illustrative: do not invent
new care features or change existing minute-based goals. Preserve translated
copy, dynamic data, empty/loading/error states and safe-area layout.

## Implementation plan
- [ ] Add warm canvas and glass control primitive with Reduce Transparency fallback.
- [ ] Refine Home header, stories, feed heading and opt-in home feed card treatment.
- [ ] Refine Walks hierarchy: pet controls, week strip, numeric progress dial,
      recent activity surfaces and compact primary action; preserve handlers.
- [ ] Compare typecheck against known two route errors; run auth regression tests.
- [ ] Verify Home and Walks on iPhone 18 Pro, read-only production session;
      capture actual screens and review interactions without saving data.

Review focus: narrow screens/long names, text contrast and transparency,
zero pets/loading, scroll bottom clearance, no changes to write callbacks.

Execution: in-place feature branch to preserve working native build and the
user-requested repo location; no dependency updates or worktree relocation.
No synthetic tests of style constants; verify layout on simulator. No commit
or push requested. Existing auth routing type errors remain out of scope.

## Execution result — 2026-11-14
Implemented iOS-only ambient canvas, native glass header/pet controls with Reduce Transparency fallback, opt-in Home feed cards, numeric progress dial with Reduce Motion support, week strip, recent cards and compact CTA. Data controllers and write callbacks remain unchanged. Existing app.json scene-support setting preserved.

Verified on iPhone 18 Pro / iOS 27.2 using the running development client and Metro Fast Refresh. Home renders real feed/photos; Walks renders real history. Switched Mango (45 min goal) to 錢錢 (30 min) and restored Mango. No walk/post/delete writes performed. Combined progress accessibility label/value observed in simulator AX tree.

28/28 auth-push tests pass. Typecheck remains at the two pre-existing _layout.tsx route-string errors (104,137), with no new errors. git diff --check passes. Fresh reviewer found empty-day contrast and progress grouping issues; both fixed. Full Dynamic Type and OS Reduce Transparency toggle testing remain outside the completed smoke checks. Native binary reused; no dependency or native changes required.

Screenshots and typecheck log are in this chat's outputs directory: warm-home.png, warm-walks.png, warm-glass-typecheck.log. Changes are local and uncommitted on feat/ios-warm-glass-home-walks.
