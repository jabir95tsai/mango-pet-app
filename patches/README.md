# Phase 1 — `/app/walks` palette swap

For Claude Code to ship into `mango_pet_app/`.

## Files in this package

| File | Target path | Action |
|---|---|---|
| `walks-page.tsx` | `src/app/app/walks/page.tsx` | Replace |
| `walk-card.tsx` | `src/components/walks/walk-card.tsx` | Replace |
| `walk-tracking-view.tsx` | `src/components/walks/walk-tracking-view.tsx` | Replace (palette pass on `phase === "tracking"` only) |

All three are full-file replacements (not diffs).

## Scope reminder

Per spec:
- ✅ DO palette-swap walks page Hero / progress / chips / sticky CTA / recent-walks cards / empty state inline link
- ✅ DO palette-swap WalkCard
- ✅ DO palette-swap walk-tracking-view's `phase === "tracking"` UI (status pill, live progress bar, camera button, error chip)
- ❌ DO NOT touch confetti palette / animation
- ❌ DO NOT touch tracking-view structure or `phase === "done"` celebration screen
- ❌ DO NOT touch Screen Wake Lock anywhere
- ❌ DO NOT touch `Button` component (shared across app — Phase 6 polish)
- ❌ DO NOT touch `EmptyState` component (shared — Phase 6)
- ❌ DO NOT touch `walk-tracking.ts` (logic file, no UI)

The Button + EmptyState constraints mean walks page does per-instance
className overrides where needed (Hero CTA, sticky CTA, no-pets inline
link). Slight inconsistency: EmptyState's icon container stays
`bg-amber-100 text-amber-700` until Phase 6 — visible only on the "no
walks yet" + "no pet, create one" states. Flagged below.

---

## Visual changes (what review should look at)

### Page surface
- Body bg already cream from Phase 0 — Hero card now reads as a true
  white card on warm cream, not a "white on slightly-off-white" mush
- Hero card: `border-mango-hairline shadow-card bg-mango-card`
- Same for week / streak tiles and recent-walks WalkCards
- Spacing / radii preserved (`rounded-xl` from Tailwind defaults — not
  the new `--radius-*` vars, which would silently override every other
  `rounded-xl` in the app per Phase 0 README note)

### Hero CTA (desktop) + sticky bottom CTA (mobile)
- `bg-mango-brand text-mango-ink hover:bg-mango-brand-deep shadow-mango`
- ink-on-brand contrast = 7.6:1 AAA (same a11y call as the raised nav button)
- `active:scale-[0.99]` is already on the Button base — Q13 preserved
- Sticky CTA surface: `bg-mango-card-soft/92 backdrop-blur-md
  border-mango-hairline` (matches the nav-bar surface from Phase 0.5
  so they look like a continuous warm bottom band)

### Today's progress bar
- Empty: `bg-mango-hairline` (per spec)
- Fill: `bg-mango-amber → bg-mango-leaf` when `goalHit` (per spec)
- Same treatment on the week-progress mini bar

### Streak badge (in Hero, top-right)
- 0–2 days: `text-mango-ink-2` (passes AA against cream)
- ≥3 days: `bg-mango-brand-tint text-mango-brand-deep` + 🔥
- ≥7 days: `bg-mango-leaf-tint text-green-800` + 🔥
  ⚠️ See "Deviation" #1 below — `text-green-800` is Tailwind default,
  not a mango token, used here to clear AA on the leaf tint background
  (`mango-leaf` on `mango-leaf-tint` is only 2.6:1, fails)

### Streak compact card (under Hero, bottom-right tile)
- Big number: `text-mango-brand-deep` (replaces `text-amber-700`)
- ≥7 days variant: still uses brand-deep — the "warm achievement" feel
  reads better than swapping to leaf mid-card

### Pet picker chips
- Unselected: `bg-mango-brand-tint text-mango-brand-deep border-transparent`
- Selected: `bg-mango-brand text-mango-ink shadow-mango/30`
  (per spec; selected pet "lit up" like the CTA so the user feels their
  pick anchored the start button)
- Press feedback `active:scale-[0.98]` for parity with the CTA family

### Recent walks (WalkCard)
- Card: `border-mango-hairline bg-mango-card shadow-card`
- Non-manual avatar: `bg-mango-brand-tint text-mango-brand-deep` (warmer
  than amber-100/700)
- Manual avatar: `bg-mango-bg-alt text-mango-ink-2`
- Score line: `text-mango-brand-deep` (replaces `text-amber-600`)
- Walker name + relative timestamp: `text-mango-ink / ink-2` ladder
- Delete button hover: stays red — destructive intent semantically
  shouldn't be warmed (Q19 — red for danger)

### Encouragement sub-text under Hero status line
- `text-mango-ink-2` per spec

### Walk-tracking-view (tracking phase only)
- Status pill: `bg-mango-brand-tint text-mango-brand-deep`, pulsing dot
  `bg-mango-brand`
- Live progress bar: `bg-mango-hairline` empty + `bg-mango-amber → leaf`
- Camera CTA pill: `border-mango-brand bg-mango-brand-tint
  text-mango-ink hover:bg-mango-brand-tint/80` (matches the warm CTA
  family without competing with Stop)
- Error chip color stays warning-yellow (`text-mango-brand-deep`) for
  positioning errors, `text-red-600` for permission denied (semantic)
- `phase === "done"` screen UNTOUCHED — emerald celebration, confetti
  palette, gradient wash, and recap tiles are all walks-v2 SHIPPED

---

## ⚠️ Deviations from spec / design calls

1. **`text-green-800` (Tailwind default) on `bg-mango-leaf-tint`**
   in the ≥7-day streak badge. Tokens-only option (`text-mango-leaf` on
   `mango-leaf-tint`) measures 2.6:1, fails AA on small text. I considered
   adding `--color-mango-leaf-deep` to Phase 0 but that's already shipped
   and a token addition would mean a Phase 0.1. Tailwind `green-800`
   (`#166534`) on leaf-tint = 8.4:1 — clean AAA. Single-class deviation,
   isolated to one badge. Flag at review: if user wants strict
   mango-only palette, easiest fix is to add `mango.leaf-deep: #2E7D4F`
   in a Phase 0.1 and swap.

2. **Selected pet chip carries `shadow-mango/30`** — not in spec, but
   matches the Hero CTA shadow at lower opacity. Reinforces the "you've
   chosen this pet, the CTA below will start a walk for it" causality.
   Easy to remove if user finds it noisy.

3. **Hero CTA is now `font-bold` (not `font-semibold`)** on the desktop
   variant — at 14px ink-on-orange the heavier weight gives the CTA
   the same visual weight it had as `font-semibold` white-on-amber.
   Compensates for the lighter text-color contribution.

4. **No-pets empty-state inline link** styled as a mini-Button via
   Tailwind classes since we're not touching the `Button` component.
   Matches mango CTA family (`bg-mango-brand text-mango-ink shadow-mango`).
   EmptyState's *icon container* still renders amber — wrap-and-pray on
   Phase 6.

5. **Streak compact tile's big number stays brand-deep, not leaf**, even
   when streakDays >= 7. The numerical tile already lives next to the
   streak badge (which DOES swap to leaf at 7+), so the tile + badge
   pair tells the celebration story; the tile itself doesn't need to
   double-encode it. Consistent "achievement orange" reads cleaner than
   alternating colors on adjacent elements.

6. **Walk-tracking-view changes are scoped to `phase === "tracking"`.**
   The done screen (`phase === "done"`) has emerald celebration, a
   gradient wash, confetti, and recap tiles — all of which Phase 1 spec
   marks DO NOT TOUCH. Mixing emerald (done) with mango-leaf (tracking)
   isn't great consistency, but the user never sees both on the same
   screen, and the done screen is locked. Phase 6 polish.

---

## Pre-ship checklist for Claude Code

- [ ] `npx tsc --noEmit` passes
- [ ] Chrome MCP iPhone (`/app/walks`):
  - [ ] Hero card pops on cream body (clear white card + warm hairline)
  - [ ] Progress bar empty = warm hairline, fill = amber→leaf at 100%
  - [ ] Pet picker: tap a pet → orange fill + ink text + slight shadow
  - [ ] Sticky bottom CTA: warm cream blur surface + orange ink button
  - [ ] Start a walk → status pill is orange-tint + brand-deep text, dot pulses brand
  - [ ] Stop the walk → done screen still emerald + confetti UNCHANGED
- [ ] Chrome MCP desktop (`/app/walks`):
  - [ ] Hero CTA visible (sticky hidden on desktop — per spec preserved)
  - [ ] Mango CTA + last-walked-with subtext under it look balanced
- [ ] Empty-states render readably (amber icon container is expected to
      stay — Phase 6 will warm it)
- [ ] Lighthouse a11y on `/app/walks` ≥ 90
- [ ] Commit message: `feat(design): Phase 1 — /app/walks mango tone`
