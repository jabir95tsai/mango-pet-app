# Phase 0 + 0.5 — Patch Package

For Claude Code session to ship into `mango_pet_app/`.

## Heads-up: no `tailwind.config.ts`

Spec assumed a `tailwind.config.ts` to extend `theme.extend.colors.mango.*`.
**There isn't one** — the project is on **Tailwind v4** with tokens declared
inline in `src/app/globals.css` via:

```css
@import "tailwindcss";
@theme inline { /* design tokens live here */ }
```

So Phase 0 collapses from two file changes to one. **All `mango.*` color
tokens + shadow utilities go into the existing `@theme inline { }` block
in `globals.css`.** Radius + motion vars stay as plain CSS variables at
`:root` (intentionally — see below).

> If a `tailwind.config.ts` later gets introduced, mirror the tokens
> there for parity, but for now there's nothing to mirror to.

---

## Files in this package

| File | Target path | Action |
|---|---|---|
| `globals.css` | `src/app/globals.css` | Replace |
| `app-nav.tsx` | `src/components/nav/app-nav.tsx` | Replace |

Both are full replacements (not diffs) — easier to verify with a single
`diff` against current. Original line counts: globals.css 102 → 145,
app-nav.tsx 227 → 246.

---

## Phase 0 — Design tokens (globals.css)

**Added inside `@theme inline { … }`** so Tailwind generates utilities:

- `--color-mango-bg / bg-alt / card / card-soft / hairline`
- `--color-mango-ink / ink-2 / ink-3` (warm browns)
- `--color-mango-brand / brand-deep / brand-tint / amber`
- `--color-mango-leaf / leaf-tint / success / success-tint`
- `--color-mango-bell-tint / cookie / cookie-tint`
- `--color-mango-peach / peach-tint / paw`
- `--shadow-card / shadow-elevated / shadow-mango`

Generates utilities like `bg-mango-brand`, `text-mango-ink-2`,
`shadow-mango`, `ring-mango-hairline`, etc.

**Added as plain CSS variables at `:root` (deliberately NOT in `@theme`):**

- `--radius-sm / md / lg / xl / 2xl / pill`
- `--motion-fast / default / slow / spring`

These would silently override Tailwind defaults (`rounded-sm` etc) if put
in `@theme`, because v4 reads `--radius-*` as the design-token namespace
for `rounded-*` utilities. Spec values (8/12/14/18/22) differ from
Tailwind defaults (2/6/8/12/16) → that would regress every existing
`rounded-sm/md/lg/xl/2xl` in the app. Consume them via arbitrary
values when needed: `rounded-[var(--radius-lg)]`,
`transition-[transform_var(--motion-default)]`.

**Body background changed:** `--background: #fff8e1` → `#FBF1DD` (mango.bg).
Dark-mode override (#09090b) preserved untouched.

**Naming note for downstream phases:**
- `mango.bgAlt` → `bg-mango-bg-alt` (kebab the camelCase)
- `mango.cardSoft` → `bg-mango-card-soft`
- `mango.brandDeep` → `text-mango-brand-deep`
- `mango.brandTint` → `bg-mango-brand-tint`
- `mango.leafTint` → `bg-mango-leaf-tint`
- `mango.successTint` → `bg-mango-success-tint`
- `mango.bellTint` → `bg-mango-bell-tint`
- `mango.cookieTint` → `bg-mango-cookie-tint`
- `mango.peachTint` → `bg-mango-peach-tint`
- `mango.ink2` → `text-mango-ink-2`
- `mango.ink3` → `text-mango-ink-3`

---

## Phase 0.5 — Raised center tab bar (app-nav.tsx)

**Untouched:** all imports, types, ALL_ITEMS, MOBILE_PRIMARY_KEYS,
MOBILE_DRAWER_EXCLUDE, isActive(), useEffect drawer close, the entire
desktop sidebar `<nav>`, and the entire mobile drawer JSX.

**Changed:** mobile bottom-bar `<nav>` only.

Mobile bar surface:
- `bg-white/95` → `bg-mango-card-soft/92 backdrop-blur-md`
- `border-zinc-200/80` → `border-mango-hairline`
- `shadow-[0_-8px_24px_rgba(24,24,27,0.08)]` → warmer `rgba(80,50,10,0.10)`

5-slot grid unchanged; primary key order unchanged
(`[home, pets, walks, leaderboard, settings]`). **`walks` is already at
index 2 (middle)** — clean fit for the raised treatment without IA churn.

Middle slot gets a special branch:
- `<li>` adds `relative` so the popped-out button can escape upward
- `<Link>` is `relative h-[3.75rem]` flex-col, label pinned to bottom
- Raised button: `absolute -top-4`, `size-[60px]`, `rounded-full`,
  `bg-mango-brand`, `ring-4 ring-mango-bg` (matches body cream — the
  "bursting out of the nav" effect), `shadow-mango`, `active:scale-95`
  press feedback
- Icon: **`Footprints` size 26 in `text-mango-ink`** (see ⚠️ below)
- Label "遛狗" stays below, always `text-mango-brand` (the raised button is
  the visual focus regardless of route)

Other 4 slots:
- Inactive `text-zinc-500` → `text-mango-ink-2` (passes AA 6.8:1)
- Active `text-amber-700` → `text-mango-brand`
- Focus ring `ring-amber-500` → `ring-mango-brand-deep`
- Dark-mode `dark:*` classes preserved as-is (Q18 — dark mode out of scope this round)

Tracking-view nav-hide behaviour is upstream of this file; unchanged.

---

## ⚠️ Resolved spec conflict — icon color on the raised button

Phase 0.5 body says **white Footprints icon**, but the same spec's a11y
table says **white on `#F39800` fails WCAG AA** (2.6:1), and the
brief explicitly tells me to apply "CTA 內文用 ink #231B14 而非白字".

I went with **`text-mango-ink` (#231B14) on `bg-mango-brand`** —
contrast 7.6:1 (AAA ✓), consistent with the rest of Phase 0's CTA rule.
The mockup `shared.jsx` doesn't render this button so there's no direct
source to violate.

If user explicitly wants white at review time, one-line flip:
`text-mango-ink` → `text-white` on the `<span>` wrapping the icon.

---

## Other design calls worth flagging on review

1. **Raised button size = 60px + 4px ring (mango-bg)** — Q-v2-3 default.
   Spec said "border", I used Tailwind `ring-*` (renders identically,
   no layout shift, atomic class). Visually a 4px solid ring of cream
   `#FBF1DD` between the orange disc and the cream nav surface, which
   produces the "popped out / floating above the bar" gestalt.
2. **Raised label always brand-colored**, not gated by `isActive`. The
   button is *the* visual destination indicator for walks; gating its
   label color creates a weak/strong flicker when navigating away. The
   other 4 tabs still respect active/inactive normally.
3. **Mobile bar surface is `mango-card-soft/92 backdrop-blur-md`**, not
   white. White-on-cream would still work, but the soft warm tint with
   blur matches the mockup `TabBar` exactly (`rgba(255,247,228,0.92)` +
   `backdropFilter: blur(20px)`).
4. **`active:scale-95`** press feedback added to the raised button only
   (Q13). Other 4 tabs unchanged.

---

## Pre-ship checklist for Claude Code

- [ ] `npx tsc --noEmit` passes
- [ ] Chrome MCP `iPhone 14 Pro Max`: raised disc visibly clears the nav
      top edge; ring of cream is visible between disc and bar surface
- [ ] Chrome MCP same viewport: tap raised disc → `/app/walks`
- [ ] Chrome MCP same viewport: tap other 4 tabs → still route correctly
- [ ] Chrome MCP desktop `1456×819`: sidebar appearance unchanged
- [ ] Chrome MCP dark-mode toggle: nothing crashes (cosmetic regressions
      expected — dark mode Phase 6 territory)
- [ ] Existing pages render on warm cream body without horizontal overflow
- [ ] Commit ship message: `feat(design): Phase 0 mango tokens + 0.5 raised center nav`
