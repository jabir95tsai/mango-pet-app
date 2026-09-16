# design-sync notes — Mango Pet (claude.ai/design import)

Project: `Mango Pet Design System` → https://claude.ai/design/p/be590e36-ff8d-4c2f-8953-cb1916d505a0
Scope (user decision 2026-09-14): the 13 files in `apps/web/src/components/ui/` only (16 exports). Feature components under `apps/web/src/components/*` are app screens, not synced.

## How this repo differs from a packaged DS

- **No library, no dist.** `apps/web` is a Next.js app. The converter runs in synth-entry mode: `cfg.entry` points at a non-existent `apps/web/dist/index.js` on purpose — that makes the converter walk up to `apps/web/package.json` (so PKG_DIR = apps/web) and synthesize the entry from `cfg.srcDir` (`src/components/ui`). The `[NO_DIST] --entry ... doesn't exist` line on every build is expected.
- **Types come from `.design-sync/gen-types.mjs`** (part of `cfg.buildCmd`): `tsc --emitDeclarationOnly` over `ui/*.tsx` → `apps/web/.design-sync-types/` (gitignored). `apps/web/package.json` `"types"` points at that barrel solely so the converter's ts-morph pass has a `.d.ts` tree; nothing imports `@mango/web` as a library. Without it every `<Name>Props` is `[key: string]: unknown`.
- `cfg.dtsPropsFor` pins `Button`, `Input`, `Textarea`, `Select`, `Tabs`: the extractor filters inherited React HTML attributes down to `className/id/style/children`, which loses `placeholder/type/disabled/value/onChange`, and `Tabs<T>` emitted a dangling `T`. Keep these in sync with the source when those components change.
- **Tailwind v4 is compiled statically** by `cfg.buildCmd` (`@tailwindcss/cli` installed into `.ds-sync/`) from `.design-sync/tailwind.css` → `apps/web/.design-sync.css` (gitignored, = `cfg.cssEntry`). Sources: all of `apps/web/src` + `.design-sync/previews` + `@source inline(...)` safelists for the whole mango palette / `--radius-*` / shadow vocabulary. **Run buildCmd before every converter build** — a preview that uses a new utility class renders unstyled until the CSS is recompiled.
- `--node-modules` must be `apps/web/node_modules`, not the repo root: root `react` is 18.3.1 (hoisted for the RN/Expo app), web is 19.2.4. The vendored `_vendor/react.js` must be 19.
- Full command: `node .ds-sync/resync.mjs --config .design-sync/config.json --node-modules apps/web/node_modules --out ./ds-bundle [--remote .design-sync/.cache/remote-sync.json]` (after `cfg.buildCmd`).

## Runtime substitutions (bundle-only; apps/web itself is untouched)

- `next/image` → `.design-sync/shims/next-image.tsx` (plain `<img>` honouring `fill`), via `paths` in `.design-sync/tsconfig.json`. `Avatar` uses `<Image fill unoptimized>`; the real next/image needs the Next runtime.
- `next-intl`: real package, real `NextIntlClientProvider`, real zh-TW catalog from `@mango/shared-i18n` — re-exported by `.design-sync/providers.ts` (`cfg.extraEntries`) and wired as `cfg.provider`. Dialog / PhotoLightbox / SaveToAlbumButton / ConfirmProvider need it.
- Fonts: the web app's body font is **Geist** via `next/font/google` (not the SF Pro / PingFang stack docs/design-system.md §3 describes — that doc predates the Geist decision or describes iOS; the web build is the truth here). `next/font` self-hosts the woff2 under `apps/web/.next/static/media/`; those files + `@font-face` rules were harvested into `.design-sync/fonts/geist.css` (`cfg.extraFonts`). The `--font-geist-sans/-mono` variables and the `local(Arial)` metric-fallback faces are declared in `.design-sync/tailwind.css` because the converter keeps only `url()`-backed `@font-face` rules from `extraFonts`. **Re-harvest** (run `next build`, copy from `.next/static/media`, regenerate the css) if the font setup in `apps/web/src/app/layout.tsx` changes.

## Playwright

- `~/.cache/ms-playwright` had `chromium-1217` → playwright **1.59.0** (installed into `.ds-sync/`). Other versions fail with "Executable doesn't exist".

## Previews (`.design-sync/previews/`, committed)

- 14 authored, all graded good on 2026-09-16. `_fixtures.ts` holds inline-SVG "pet photos" (offline).
- **ConfettiCanvas**: floor card by design — a full-screen canvas particle animation, nothing static to grade.
- **SaveToAlbumButton**: floor card by design — renders `null` unless `navigator.canShare({files})` (iOS 16.4+/Android Chrome only); headless desktop Chromium never shows it.
- Overlays use `cardMode: single` (Dialog, ConfirmProvider, PhotoLightbox at 640x520); wide sets use `cardMode: column` (Avatar, CardSkeleton, CardSkeletonList, EmptyState, Tabs).
- ConfirmProvider preview opens the confirm on mount (`useEffect`) so the card shows the dialog; the focused confirm button shows the app's real focus ring (autoFocus in the component) — expected.
- Disabled Input/Select/Textarea look identical to enabled (the components carry no disabled styling; only the native cursor changes) — faithful, not a preview bug.

## Known render warns

(none at the final validate — `[GRID_OVERFLOW]` warns were resolved with the cardMode overrides above.)

## Re-sync risks

- `apps/web/package.json` `types` pointer and `.gitignore` entries are the only repo-side changes; if someone removes the `types` key the contracts silently degrade to `[key: string]: unknown` — check `[DTS] parsed N .d.ts files from ...design-sync-types` in the build log.
- Geist woff2 copies in `.design-sync/fonts/` are a snapshot of one `next build`; file hashes change per build but the glyphs don't — only re-harvest on a font change.
- `dtsPropsFor` bodies are hand-maintained; a new prop on Button/Input/Textarea/Select/Tabs must be added there too.
- `cfg.overrides` viewports/cardModes are keyed into grades; changing them re-grades those components.
- The compiled CSS mirrors whatever `apps/web/src` uses at sync time; a design built earlier may depend on a utility later removed from the app — re-sync recompiles, so the DS project tracks the app.
- Build assumed: Node 24, TypeScript 5.9.3 (root), Tailwind 4.3.0, playwright 1.59.0 with cached chromium-1217.
