## How to build with MangoUI (read first)

MangoUI is the `apps/web` (Next.js + Tailwind v4) primitive set of **Mango Pet**, a zh-TW-first pet-care PWA. Everything below is what the app itself does; follow it exactly.

### Setup / wrapping

- `window.MangoUI` exposes 16 components plus `useConfirm`, `NextIntlClientProvider`, `mangoLocale`, `mangoMessages`.
- **Wrap every tree in `NextIntlClientProvider`** — `Dialog`, `PhotoLightbox`, `SaveToAlbumButton` (and `ConfirmProvider`, which renders a `Dialog`) call `useTranslations` and throw "No intl context" without it:
  ```jsx
  const { NextIntlClientProvider, mangoLocale, mangoMessages, ConfirmProvider } = window.MangoUI;
  <NextIntlClientProvider locale={mangoLocale} messages={mangoMessages}>
    <ConfirmProvider>{app}</ConfirmProvider>
  </NextIntlClientProvider>
  ```
  `mangoMessages` is the app's real zh-TW catalog; UI copy you write should also be zh-TW.
- `ConfirmProvider` is needed only where `useConfirm()` is called (`await confirm({ title, message, confirmText, danger })` → boolean).
- `Dialog` and `PhotoLightbox` portal to `document.body` and are controlled: `open` + `onClose`.
- `Avatar` is name-hashed initials until `src` is set; `EmptyState` takes a lucide icon **component** (`icon={PawPrint}`), not an element.
- `SaveToAlbumButton` renders nothing on desktop (Web Share with files is iOS/Android only) — don't rely on it for layout.

### Styling idiom: Tailwind utility classes — a **static** build

`_ds_bundle.css` is a compiled Tailwind v4 stylesheet. **Only classes present in it exist**; there is no runtime Tailwind, so an unlisted utility silently does nothing. The compiled set = every class the app's source uses + the design-system vocabulary below. Common layout utilities are all there (`flex grid inline-flex items-center justify-between gap-1…gap-8 p-0…p-6 px-*/py-* mt-*/mb-* w-full rounded-lg/xl/2xl/full text-xs…text-2xl font-medium/semibold/bold truncate border shadow-sm sticky fixed size-4/5/6/12 tabular-nums bg-white bg-black/50`, plus `sm:`/`md:`/`hover:`/`dark:` variants the app uses). When a utility you need is missing, use an inline `style` with the CSS variables below instead of inventing a class.

| Family | Real names (from `globals.css @theme`) |
|---|---|
| Surfaces | `bg-mango-bg` (page cream #fbf1dd) `bg-mango-bg-alt` `bg-mango-card` (white) `bg-mango-card-soft` `bg-mango-brand-tint` |
| Text | `text-mango-ink` (body) `text-mango-ink-2` (secondary) `text-mango-ink-3` (decorative only, low contrast) `text-mango-brand-deep` (accent text — never `text-mango-brand` for body) |
| Brand | `bg-mango-brand` #f39800 `bg-mango-brand-deep` #d77b00 `bg-mango-amber` `text-mango-brand` (icons/large headings only) |
| Lines | `border-mango-hairline` (1px card border) `divide-mango-hairline` `ring-mango-hairline` |
| Semantic | `bg-mango-leaf` / `bg-mango-leaf-tint` / `text-mango-leaf` (success / 達標), `bg-mango-success-tint`, `bg-mango-peach-tint` `bg-mango-cookie-tint` `bg-mango-bell-tint` (decorative/celebration only) |
| Radius | `rounded-[var(--radius-sm)]` 8px · `-md` 12px · `-lg` 14px (card default) · `-xl` 18px · `-2xl` 22px (big cards/avatar frames) · `-pill` 9999px (buttons). Prefer these over `rounded-lg` (8px) for app surfaces. |
| Shadow | `shadow-card` (cards) `shadow-elevated` (floating) `shadow-mango` (orange glow under primary CTAs) |
| Primary CTA | `btn-mango` = the raised mango gradient with **white** text (what `<Button variant="primary">` applies). Use `Button`; don't hand-roll orange buttons. |
| Font | Geist via `--font-geist-sans` (body default); numbers get `tabular-nums`. |

Rules the app follows: whole-app mango palette — never `zinc-*`/raw `amber-*` as a primary colour in new UI; cards = `bg-mango-card` + `border border-mango-hairline` + `rounded-[var(--radius-lg)]` + `shadow-card`; tabs are a simple toggle (`Tabs`) — no sliding indicator; every animation must respect `prefers-reduced-motion` (the stylesheet already neutralises durations globally).

### Where the truth lives

- `styles.css` → `_ds_bundle.css`: the `:root`/`@theme` block near the top defines every `--color-mango-*`, `--radius-*` and `--motion-*` variable (shadows exist only as the `shadow-card/elevated/mango` classes) (use them in inline `style` when no utility exists). `.btn-mango`, `.badge-disc-earned`, `.cta-sweep` are the app's few hand-written classes.
- `components/general/<Name>/<Name>.prompt.md` — verified compositions per component; `<Name>.d.ts` — the props contract.

### Idiomatic snippet (a verified preview)

```jsx
const { Avatar, Button } = window.MangoUI;
<div className="flex w-80 items-center gap-3 rounded-[var(--radius-lg)] border border-mango-hairline bg-mango-card p-3 shadow-card">
  <Avatar name="芒果" size={48} />
  <div className="min-w-0 flex-1">
    <div className="font-semibold text-mango-ink">芒果</div>
    <div className="text-sm text-mango-ink-2">柴犬 · 3 歲</div>
  </div>
  <Button size="sm">開始遛狗</Button>
</div>
```
