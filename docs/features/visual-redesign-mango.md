# 視覺重設計 — 芒果主題（Mango Visual Redesign）

狀態：**PARTIAL SHIPPED / SUPERSEDED BY PHASE SPECS**（Phase 0/0.5/1/1v2/2v2 已 ship；後續頁面以 `walks-v2-rebuild.md`、`pets-v2-rebuild.md`、`home-v3-feed-first.md` 等 granular specs 為準）
建立日期：2026-05-24
最後更新：2026-05-29 PM audit sync（v2.1 仍保留 Claude Design adapt notes；此檔不再作為單一 READY-FOR-DEV launch spec）

## ⚠️ Claude Design 2026-05-24 的 6 個 resolutions（PM 全接受）

Claude Design 環境讀 patches/ 三檔（README.md / globals.css / app-nav.tsx）時做了 6 個 design decisions / spec 修正，PM 全接受。Spec 原文有以下需修正：

1. **Tailwind v4，沒 tailwind.config.ts** — Phase 0 tokens 合進 `globals.css @theme inline`，不另建 config file。Spec 原寫「tailwind.config.ts theme.extend.colors」是錯的（PM 沒 verify v3 vs v4）
2. **Radius/motion 不放 @theme** — 避免 silently override Tailwind defaults (rounded-md/lg etc) 全 app 視覺漂移。改用 `:root` plain CSS vars + 後續 phase 用 `rounded-[var(--radius-lg)]` arbitrary values consume
3. **Raised button icon = `text-mango-ink` (#231B14) 不是白色** — Spec a11y table 明確說「白字 on #F39800 不過 AA」，但 Phase 0.5 描述卻寫「white Footprints icon」自相矛盾。Claude Design 抓到並選 a11y 一致（ink-on-brand 7.6:1 AAA）
4. **Border 4px → `ring-4 ring-mango-bg`** — Tailwind atomic ring 取代 `border 4px solid mango.bg`；no layout shift + 視覺等效
5. **Raised label 永遠 brand-colored 不跟 active state 切換** — 中間 disc 本身是 destination indicator；gating label color 會 navigation 時 flicker。其他 4 tab 仍 respect active 狀態
6. **Mobile nav surface = `bg-mango-card-soft/92 backdrop-blur-md`** — 對齊 mockup TabBar 1:1 (`rgba(255,247,228,0.92) + blur(20px)`)，不是純白
規格作者：PM session @ d6e9955
角色：UI/UX 工程師（主，整 stack 視覺範圍）— 可動 `src/app/**/*.tsx`、`src/components/**`、`src/app/globals.css`、`tailwind.config.ts`、`messages/*`；**不碰** `src/lib/firebase/*` / `functions/` / `firestore.rules` / schema / indexes
工作量：**XL**（6 phases，可獨立 ship per phase）

## User Vision（原話 + mockup reference）

> 「以『芒果』為主題的溫暖配色（芒果黃、橘、搭配草地綠），給人活潑、親切、適合家庭與寵物的感覺。含微動畫與互動效果。」（2026-05-23）
>
> 「我喜歡 B · 分頁聚焦 (Tabbed) 這樣，然後底部用中間凸顯出來的這種感覺。」（2026-05-24，附 ZIP mockup `mango_app.zip`）

**Reference**：`mango_app.zip/my-pets-variant-b.jsx` + `my-pets-shared.jsx`（warm cream + brown + mango orange + leaf 整套 palette）

## ⚠️ PM v2 對 Q5/Q6 答案的 swap surface

User 看 ZIP mockup 前回答 Q5 = `#FFCA28`、Q6 = 沿用 emerald；但 mockup 用更暖色系。「我喜歡 B」隱含採用 mockup palette。

| Token | Q5/Q6 原答案 | Mockup (採用 v2) | Why swap |
|---|---|---|---|
| 主黃 | `#FFCA28` | **`#F39800`** | Mockup 更熟成感（深橘 mango），#FFCA28 偏冷亮 |
| 副綠 | tailwind emerald | **`#5FA858` (warm olive)** | Mockup 用 warm olive 跟 cream bg 和諧；emerald 太鮮藍 |
| 背景 | 白 | **`#FBF1DD` warm cream** | Mockup 整體 warm 系，白底會破壞氛圍 |
| Text | zinc-900 | **`#231B14` warm brown** | 對 warm cream 對比夠 + 整體暖系 |

⚠️ **若 user 仍要 #FFCA28 / 白底**：跟 PM 說，我改回 Q5/Q6 原答案。**未說則 v2 採用 mockup palette。**

## 20 個 product decisions（v2 update）

| # | 採用 | v2 變動 |
|---|---|---|
| Q1 | 全 10+ 頁一次性大改 | ✓ |
| Q2 | walks → home → pets → onboarding → settings → 其他 | ✓ |
| Q3 | 先抽 tokens 再套 | ✓ |
| Q4 | 100% 保留功能 | ✓ |
| **Q5** | ~~#FFCA28~~ → **`#F39800` (mockup)** | ⚠️ v2 swap |
| **Q6** | ~~沿用 emerald~~ → **`#5FA858` warm olive (mockup)** | ⚠️ v2 swap |
| Q7 | 桃粉 accent | ✓（沿用）|
| Q8 | rounded-2xl + 按鈕 rounded-full | ✓ |
| Q9 | 保留 system font | ✓ |
| Q10 | medium 動效 | ✓ |
| Q11 | 不做寵物 wiggling | ✓ |
| Q12 | 沒有 page transition | ✓ |
| Q13 | scale 0.97 press feedback | ✓ |
| Q14 | flat illustration + emoji | ✓ |
| Q15 | 不做 mascot | ✓ |
| Q16 | empty state illustration + 鼓勵 + CTA | ✓ |
| Q17 | fun but 不過度 | ✓ |
| Q18 | 跳過 dark mode 第一輪 | ✓ |
| Q19 | WCAG AA | ✓ |
| Q20 | Phase 0 tokens → Phase by phase | ✓ |

## Phase 0: Design tokens（mockup palette 整套）

### Color palette — 100% 對齊 mockup `shared.jsx`

```ts
// tailwind.config.ts theme.extend.colors
mango: {
  bg:        '#FBF1DD',   // app 背景 (warm cream)
  bgAlt:     '#F6E7C8',   // section tint
  card:      '#FFFFFF',   // card 仍可純白（在 cream 背景上 pop）
  cardSoft:  '#FFF8E8',   // soft card variant
  hairline:  '#EADFC4',   // 邊框
  ink:       '#231B14',   // primary text (warm dark brown)
  ink2:      '#5A4A38',   // secondary text
  ink3:      '#9A8A74',   // tertiary text
  brand:     '#F39800',   // ★ PRIMARY — CTAs, 高亮, active states
  brandDeep: '#D77B00',   // hover state on primary
  brandTint: '#FFE7BF',   // light chip / hover bg
  amber:     '#FFC25C',   // gradient mid / secondary highlight
  leaf:      '#5FA858',   // ★ SUCCESS — 達標、進度條 fill、streak
  leafTint:  '#E7F2DC',   // light success bg
  success:   '#7DD699',   // bright success (alt)
  successTint:'#D8F2DE',
  bellTint:  '#FFE9A8',   // reminder accent bg
  cookieTint:'#FFE0CC',   // expense accent bg
  cookie:    '#D77B3F',   // expense icon color
  peach:     '#FFB3BA',   // ★ ACCENT (Q7) — 寵物 badge / family chip / reaction
  peachTint: '#FFE4E6',
  paw:       '#3B2A1D',   // dark brown for paw marks
}
```

**對齊規則**：
- 既有 `amber-400/500` 用法 → `mango.brand / mango.amber`
- 既有 `emerald-500/600` 用法 → `mango.leaf / mango.success`
- 既有純白底 (`bg-white`) → `mango.bg` (warm cream) 為頁面背景；`mango.card` 純白保留給 card
- 既有 zinc text → `mango.ink / ink2 / ink3` (warm brown)

### Typography（Q9 沿用 system）

```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI',
             'Microsoft JhengHei', '微軟正黑體',
             Roboto, sans-serif;
```

### Border radius

```css
--radius-sm:    8px;
--radius-md:   12px;
--radius-lg:   14px;   /* card 主用 (mockup Card 用 borderRadius: 18，但 18 太大 — 14 對齊 spec) */
--radius-xl:   18px;   /* mockup Card 實際值 */
--radius-2xl:  22px;   /* MangoPhoto 22 */
--radius-pill: 9999px; /* buttons / chips */
```

### Shadow（warm tone 對齊 mockup）

```css
/* Card — 1px hairline + soft drop */
--shadow-card: 0 1px 0 rgba(0,0,0,0.02), 0 8px 20px -16px rgba(80,50,10,0.18);

/* Elevated (modal / drawer / tracking-view) */
--shadow-elevated: 0 12px 24px -8px rgba(80,50,10,0.25);

/* Mango brand emphasis (primary CTA / floating + button) */
--shadow-mango: 0 12px 24px -8px rgba(243,152,0,0.55);
```

### Motion

```css
--motion-fast:    100ms ease;
--motion-default: 200ms ease;
--motion-slow:    400ms ease;
--motion-spring:  cubic-bezier(0.34, 1.56, 0.64, 1);
```

### A11y（Q19 WCAG AA）

| 配色組合 | contrast | 通過 |
|---|---|---|
| ink #231B14 on bg #FBF1DD | 12.5:1 | AAA ✓ |
| ink2 #5A4A38 on bg | 6.8:1 | AA ✓ |
| ink3 #9A8A74 on bg | 2.9:1 | **不過 AA** — 只能用在 large text or decorative |
| brand #F39800 on bg | 2.4:1 | **不過 AA** — 大字 / icon OK，**body text 用 brandDeep #D77B00 (4.5:1)** |
| leaf #5FA858 on bg | 3.1:1 | UI 3:1 ✓，body text **不過** → 用 darker leaf 變體 |
| White text on brand #F39800 | 2.6:1 | **不過** — CTA 按鈕用 white 字要慎重；可用 ink #231B14 on brand bg (5.2:1 ✓) |

⚠️ **白字 on 橘底**不過 AA → primary CTA 按鈕內文用 `ink #231B14` 而非白字（mockup 也是這做法）。

`prefers-reduced-motion`：所有動效 → 0ms; confetti hidden。

## Phase 0.5: Raised center tab bar pattern（new in v2）

User 圖片明確要「底部中間凸顯」。Pattern：

```
┌────────────────────────────────────────┐
│                                        │
│            (page content)              │
│                                        │
└────┬─────┬─────╔═════╗─────┬─────┬────┘
     │ 🏠  │ 🐾  ║ 🦶  ║  🏆 │ ⚙️  │
     │首頁 │寵物 ║遛狗 ║ 排  │ 設  │
                 ╚═════╝
                  ↑ raised circle button，
                    mango brand bg + white footprints icon
                    比其他 tab 大 ~30%，向上突出
```

### 實作

- Tab bar 高度仍 `~3.75rem (60px)` + safe-area-inset-bottom
- 5 個 slot 用 `grid grid-cols-5`
- 中間 slot 內放 `relative` 容器 + `absolute -top-4` 的圓形 button
  - 圓形大小：56-64px diameter
  - bg: `mango.brand #F39800` + `--shadow-mango`
  - icon: `Footprints` white, size 26
  - border: 4px solid `mango.bg` (warm cream) — 製造「從 nav 跳出來」視覺效果
  - 點擊 → `router.push('/app/walks')`
- 其他 4 個 tab：sticky to existing pattern，icon + label（11-12px 字）
- Active state：用 `mango.brand` 上色（其他用 `mango.ink3`）
- 中間 button 在任何 active 狀態都保持 raised + brand 配色

### Nav items mapping（PM 預設 + 開放問題）

**v2 預設（保留現有 5 nav items）**：
```
[home/app, pets/app/pets, walks/app/walks ★center, leaderboard/app/leaderboard, settings/app/settings]
```

**Alternative（對齊 user 圖片 labels）**：
```
[首頁/app, 動態/app/feed, 遛狗/app/walks ★center, 家庭/app/pets, 我的/app/settings]
```

差異：
- 「動態」→ `/app/feed`（feed 升 primary，從 drawer 拿出來）
- 「家庭」→ `/app/pets`（label 改成「家庭」涵蓋 pets + family member 概念）
- `/app/leaderboard` 從 primary nav 拿掉 → 進 drawer 或 family hub 內

⚠️ **開放問題 Q-N1**：保留現有 nav mapping vs 對齊圖片 labels？PM 主推**保留**（最少 IA 動 + 上次 ship 的 nav 結構穩定）；user 若要 reshuffle 跟我說，我升級為獨立 nav-reshuffle-v2 spec。

## Phase 2 (pets) pattern: Variant B「分頁聚焦」(Tabbed)

對應 `mango_app.zip/my-pets-variant-b.jsx`：

### 結構（單寵物聚焦 + sticky pill tabs）

1. **頂部 bar**：`我的寵物` h1 + 右側 `+ 寵物` button（brandTint bg + brand text + pill）
2. **Pet header**：avatar (radius 22, size 64) + name 22pt 800 + 3 個 chip (品種/性別年齡/體重) + 右側 pencil edit icon
3. **Sticky pill tabs**：segmented control `[概覽/提醒/開銷/健康]`，active tab = card bg + soft shadow
4. **「概覽」內容**：
   - 2-col stat grid: `下次提醒 / 本月開銷 / 體重 / 散步天數`
   - 每 tile: tinted icon (12-tinted bg) + label + 大數字 + sub-text
5. **Inline 「即將到期」strip**：1 個 reminder card (bell icon + title + repeat chip + 時間 + check button)
6. **Inline 「最近開銷」strip**：1 個 expense card (cookie icon + 標題 + AI chip + 日期/付者 + NT$ 數字)
7. **Floating +** button：右下角 56x56 圓形 + mango brand + shadow-mango

### 多寵物切換（v2 加 — mockup 是單寵物示意）

Pet header 旁邊加 chevron-down icon → 點開 dropdown 切換寵物（沿用 walks page 的 lastPetId localStorage）

### Pet detail tabs (`/app/pets/[petId]`)

跟 Variant B 一樣 4 個 tabs：概覽 / 提醒 / 開銷 / 健康
- 概覽 = 上面 stat grid + inline strips
- 提醒 = 完整 reminder list（per-pet filter）
- 開銷 = 完整 expense list（per-pet filter）
- 健康 = healthRecords list（既有實作）

## 6 個 Phase（v2 update）

| Phase | 內容 | 工作量 | 狀態 |
|---|---|---|---|
| **0** | Design tokens（mockup palette + radius + shadow + motion）| S | ✅ READY |
| **0.5** | Raised center tab bar pattern in `app-nav.tsx`（5 tab + 中間 walks 凸顯）| S | ✅ READY |
| **1** | `/app/walks` 套 mockup tone（warm cream bg + brand CTA + leaf success）| S | 等 Phase 0+0.5 |
| **2** | `/app/pets` + `/app/pets/[petId]` 整頁重做為 Variant B Tabbed pattern | **M-L** | 等 Phase 0 |
| **3** | `/app` (home) + `/onboarding` + Landing + sign-in | M | 等 Phase 0 |
| **4** | `/app/settings` + `/app/leaderboard` | M | 等 Phase 0 |
| **5** | Drawer pages: `/app/feed` + `/app/restaurants` (+detail) + `/app/knowledge` (+detail) + `/app/friends` (+/add) + `/app/expenses` | L | 等 Phase 0 |
| **6** | Polish + a11y audit + reduced-motion verify | S | 等 Phase 1-5 |

## 完成標準（v2 update）

### Phase 0 — tokens
- [ ] tailwind.config.ts extend `mango.*` palette per mockup
- [ ] globals.css 加 CSS variables (radius/shadow/motion)
- [ ] 既有頁面**無 regression**（tokens additive）
- [ ] `npx tsc --noEmit` pass

### Phase 0.5 — raised center tab
- [ ] `src/components/nav/app-nav.tsx` mobile bottom bar 中間 slot 改 raised circular button（56-64px, mango.brand bg, white Footprints, 4px border solid mango.bg, shadow-mango）
- [ ] 其他 4 slot 保留原 layout
- [ ] Desktop sidebar 不動
- [ ] Tracking view 開啟時隱藏整個 nav bar（既有行為）
- [ ] Chrome MCP iPhone 視覺確認 raised 浮出 + tap 進 /app/walks

### Phase 1 — /app/walks 套 mockup tone
- [ ] 頁面背景 `mango.bg` warm cream（替代純白）
- [ ] Hero CTA 主黃 `mango.brand #F39800` + ink #231B14 文字（不是白字 — a11y）+ shadow-mango
- [ ] Sticky bottom CTA 同 brand 配色
- [ ] 進度條：empty bg `mango.hairline`；fill `mango.amber → mango.leaf`（達標 leaf）
- [ ] Streak badge 沿用 walks-v2 SHIPPED 行為 + 改顏色到 mockup tone
- [ ] 鼓勵文案 sub-text 用 ink2 color
- [ ] Pet picker chips：default `mango.brandTint`/`brandDeep` text；selected `mango.brand` + ink

### Phase 2 — pets 套 Variant B Tabbed pattern
- [ ] `/app/pets` 重做：頂部 bar + Pet header + sticky pill tabs + 「概覽」內容（2-col stat grid + inline strips + floating +）
- [ ] 多寵物切換：pet header 旁邊 chevron-down dropdown
- [ ] `/app/pets/[petId]` 改 sticky pill tabs 結構（概覽/提醒/開銷/健康）
- [ ] 健康 tab 內保留既有 healthRecords UI
- [ ] 提醒 / 開銷 tabs 顯示 per-pet 內容（既有 sections from IA reorg 升級為 tab content）

### Phase 3-5 — 其他頁
- 各 page 套 token + 對齊 mockup tone（card 用 white on cream bg）
- Empty state 用 mockup 風格 (emoji + simple SVG + 鼓勵文案 + CTA)
- 各 page detail 對應 phase

### Phase 6 — polish
- [ ] 跨 page 一致性 audit（card padding / radius / shadow 統一）
- [ ] WCAG AA contrast verify（特別是 brand on white bg 要謹慎）
- [ ] `prefers-reduced-motion` 全 app
- [ ] Chrome MCP iPhone + desktop light mode 全頁對照

## 成功指標
- 質性：自己 + 家人實測「視覺一致 + 像 mockup Variant B」
- 質性：「中間凸顯按鈕讓『遛狗』很想按」
- 量性：bundle size 增加 < 5KB（純 CSS tokens）
- 量性：Lighthouse Visual / A11y > 90

## 不在這次範圍
- Dark mode（Q18 延後）
- 寵物 wiggling 動效（Q11）
- Mascot 角色（Q15）
- Page transition（Q12）
- Material ripple（Q13）
- Google Font（Q9）
- Animation library（Q10 全 CSS）
- 改 schema / lib / functions（Q4）
- 改 functional behavior
- Custom illustration commission
- **Nav items reshuffle**（暫保留現有 mapping；如 user 確認要對齊圖片 labels [首頁/動態/遛狗/家庭/我的] 才另開 nav-reshuffle-v2 spec）

## 技術筆記

### 動到的檔案

**Phase 0/0.5**：
- `tailwind.config.ts` — palette extend
- `src/app/globals.css` — CSS variables + page bg default
- `src/components/nav/app-nav.tsx` — raised center tab

**Phase 1-5**：對應 page + components（見 phase 表格）

**Phase 6**：全部 final pass

### 部署順序

每 phase 獨立 commit + push origin main。

⚠️ **Phase 0 + 0.5 必先 ship**（後續 phase 引用 token className + raised nav）。

### Edge cases

| Edge | 處理 |
|---|---|
| 既有 dark mode 元素 | Q18 延後；既有 dark: classes 不動，等 dark follow-up spec |
| Tailwind purge | mango.* 全列在實際 className 用到（safelist 如需）|
| Raised center button 跟 safe area | 中間 button 用 absolute -top-4，nav bar 仍 safe-area-inset-bottom |
| Tracking view 全屏時 nav 隱藏 | 既有行為保留（中間 raised 也跟著隱藏）|
| 既有 walks streak/confetti animation | 沿用 SHIPPED；只 verify 新 palette 下視覺對齊 |

### 跟其他 spec 的關聯

- **walk-core-redesign / walks-photo-and-celebration**：Phase 1 沿用既有結構 + 套 tokens；confetti/streak 動效不動
- **Home + Pets IA reorg**：Phase 2 pets 重做為 Variant B Tabbed；既有 reminder/expense sections 升級為 tab content（IA reorg 把 sections 從 home 搬到 pets，本 spec 把 sections 整合成 tab）
- **既有 nav 結構**：Phase 0.5 中間凸顯改動；nav items mapping 保留（除非 user 啟動 nav reshuffle alternative）

## 開放問題

- [x] Q1-Q20 user 已答 ✓
- [ ] **Q-v2-1**：採用 mockup palette swap（`#F39800` + warm cream）vs 原 Q5/Q6 答案（`#FFCA28` + emerald + 白底）？PM 預設**採 mockup**（user 「我喜歡 B」隱含）
- [ ] **Q-v2-2 (nav reshuffle)**：保留現有 nav items mapping vs 對齊圖片 labels [首頁/動態/遛狗/家庭/我的]？PM 預設**保留**（最少 IA 動）。若要 reshuffle → 另開 nav-reshuffle-v2 spec（PM 寫）
- [ ] **Q-v2-3**：raised center button 大小？建議 60px diameter + 4px border。若太大太小 user 看到 Phase 0.5 ship 後反饋
- [ ] **Phase 0/0.5 ship 後**是否 user 先 review Phase 1 才動 Phase 2？建議：是（節奏對齊 user「一個一個修」偏好）

## Phase 0 + 0.5 SHIPPED 紀錄

**Ship 時間**：2026-05-24 ~13:54 push → App Hosting build live ~3 分鐘後（這次 build 異常快）

### 3 個 commit（user 要 2 個 phase boundary commit；patches/ folder + tsconfig 抽 chore commit 對齊「不混 phase 內容」原則）

| Commit | SHA | 內容 |
|---|---|---|
| Chore | `202889c` | import `patches/` folder（README + globals.css + app-nav.tsx 全套）+ `tsconfig.json` exclude `patches`（避免 patches/app-nav.tsx 被 tsc 抓到 `./nav-drawer-context` 解不到的 relative import） |
| Phase 0 | `7baff73` | `src/app/globals.css` 全檔換 patches 版 — `@theme inline` 加 mango 18 個 color tokens + 3 個 shadow utilities (`shadow-card / shadow-elevated / shadow-mango`)；`:root` 加 radius + motion plain CSS vars；body bg `#fff8e1` → `#fbf1dd` |
| Phase 0.5 | `e1a7b60` | `src/components/nav/app-nav.tsx` 全檔換 patches 版 — mobile nav surface 改 `bg-mango-card-soft/92 backdrop-blur-md`、warm hairline；walks (index 2) raised treatment：`absolute -top-4 size-[60px] rounded-full bg-mango-brand ring-4 ring-mango-bg shadow-mango`，icon `Footprints text-mango-ink size-[26px]`；其他 4 tab `text-mango-ink-2` / active `text-mango-brand`；desktop sidebar + mobile drawer 0 變動 |

### Claude Design 6 個 resolutions（全 adopted，from `patches/README.md`）

1. ✅ **Tailwind v4 no config file** — tokens 合進 `globals.css @theme inline`，不建 `tailwind.config.ts`（spec 原文錯）
2. ✅ **Radius/motion 不放 @theme** — 避免 silently override Tailwind defaults (`rounded-md/lg` 等)；改 `:root` plain CSS vars，後續 phase 用 `rounded-[var(--radius-lg)]` arbitrary values consume
3. ✅ **Raised icon = `text-mango-ink` 不是白色** — Phase 0.5 spec 內部矛盾（同時要求「白字」+「a11y 表明白字 on #F39800 不過 AA」），Claude Design 選 ink (7.6:1 AAA) 對齊 a11y rule
4. ✅ **`ring-4 ring-mango-bg`** 取代 `border 4px solid` — no layout shift + atomic Tailwind class
5. ✅ **Raised label 永遠 brand-colored** — 中間 disc 是 destination indicator；gating active state 會 navigation flicker
6. ✅ **Mobile nav surface `bg-mango-card-soft/92 backdrop-blur-md`** — 對齊 mockup TabBar (`rgba(255,247,228,0.92) + blur(20px)`)，不是純白

### Chrome MCP 驗證結果（desktop @ 1456×819 / production）

**`/app/walks` 載入後 DOM probe**：
- ✅ `bodyBg: rgb(251, 241, 221)` = `#fbf1dd` mango.bg
- ✅ `--background: #fbf1dd` CSS var
- ✅ Mobile nav class 含 `border-mango-hairline bg-mango-card-soft/92 shadow-[0_-8px_24px_rgba(80,50,10,0.10)] backdrop-blur-md`
- ✅ `hasRaisedDisc: true`

**Force-show mobile nav probe**（screen wide so `md:hidden` removed）：
- nav 高 61px、disc 60×60px、`topRelToNav: -15px`（≈ `-top-4`/-16px ±1 rounding）
- disc bg `rgb(243, 152, 0)` = `#F39800` mango.brand ✓
- disc text color `rgb(35, 27, 20)` = `#231B14` mango.ink ✓（**a11y 7.6:1 AAA**，非白字）
- 5 tabs 順序與 href 正確：`首頁→/app, 我的寵物→/app/pets, 遛狗→/app/walks (center), 排行榜→/app/leaderboard, 設定→/app/settings`

**`/app` home（同 build verify）**：
- ✅ bodyBg cream 一致
- ✅ heading `🥭 芒果寵物`、pets + feed sections render，無 layout 破
- ✅ sidebar「首頁」amber→mango.brand 高亮（既有 `text-amber-800 bg-amber-100/80` 沒爆，但 sidebar 在 desktop 沒 touch 是預期）

### 跟 spec 的 deviations（已修正）

1. **Spec line 175「white Footprints icon」改 `text-mango-ink`**：spec a11y table 自相矛盾（白字 on #F39800 不過 AA），Claude Design resolution #3 正確修正。Spec 已在 v2.1 ⚠️ section 反映。
2. **Spec line 187「border 4px solid」改 `ring-4 ring-mango-bg`**：視覺等效 + atomic class + no layout shift。Resolution #4。
3. **Spec line 318「`tailwind.config.ts` palette extend」改 `globals.css @theme inline`**：Tailwind v4 不用 config file（PM 沒 verify v3 vs v4）。Resolution #1。

### 未直接驗證（環境限制）

- ⚠️ Mobile 真實 viewport (iPhone 14 Pro Max 430×932)：Chrome window maximized，`resize_window` 對 maximized window 不生效；force-show 已模擬視覺結構（disc + ring + nav surface 全正確）
- ⚠️ Dark mode：Q18 此次跳過（spec 明確）；`dark:` classes 保留在 globals.css 跟 nav 內，未驗證視覺
- ⚠️ Tracking view 開啟時 nav 隱藏：既有行為（在 walks page 控制 nav visibility），patch 沒動，未重新驗證

### STOP at Phase 0 + 0.5（spec instruction）

Phase 1 (`/app/walks` mockup tone) 需要 user review 視覺 + ping Claude Design 拿 Phase 1 patch package 才接。本 session 不主動跑。

## Phase 1 SHIPPED 紀錄

**Ship 時間**：2026-05-24 ~20:54 push → App Hosting build ~5 分鐘後

### 2 個 commit

| Commit | SHA | 內容 |
|---|---|---|
| Phase 1 | `37d1ec4` | `src/app/app/walks/page.tsx` + `src/components/walks/walk-card.tsx` + `src/components/walks/walk-tracking-view.tsx` 三檔全替換為 Claude Design Phase 1 patch（mango token 套色 + `phase === "tracking"` palette pass + Button/EmptyState 不動繞道處理） |
| Chore | `a8bc8b7` | `patches/` 更新 — README 改寫成 Phase 1 + 加入 3 個 source patch；保留作 Phase 2+ history reference |

### Claude Design 6 個 deviations（全 PM-accepted，from `patches/README.md`）

1. ✅ **`text-green-800` (Tailwind default) on `bg-mango-leaf-tint`** for ≥7 day streak badge — `mango-leaf` on `mango-leaf-tint` 是 2.6:1 fail AA。`green-800 #166534` on leaf-tint = 8.4:1 AAA，single-class isolated deviation。Future fix: 加 `mango.leaf-deep` token via Phase 0.1
2. ✅ **Selected pet chip 加 `shadow-mango/30`** — 不在 spec 文字內，但 reinforce「選了這隻寵物 → CTA 會 walk this pet」因果。視覺上輕 shadow 跟 Hero CTA shadow-mango full opacity 形成階層
3. ✅ **Hero CTA `font-bold`（從 `font-semibold` 升級）** — 14px ink-on-orange 比 white-on-amber 視覺重量略輕，bold 補回。Sticky CTA 跟著用
4. ✅ **No-pets empty-state inline link 改 mini-Button via Tailwind classes** — `Button` component 不動（Phase 6 polish），inline link 自帶 `bg-mango-brand text-mango-ink shadow-mango` 對齊 CTA family。EmptyState 的 icon container 仍 amber（Phase 6 處理）
5. ✅ **Streak compact tile 大數字保留 brand-deep（不切換 leaf at ≥7d）** — 隔壁 streak badge 已 swap to leaf-tint + green-800；tile 跟 badge 配對 = 「橘色 achievement number + 綠色 milestone badge」雙重視覺敘事，比 tile 也跟著切 leaf 乾淨
6. ✅ **Tracking-view palette pass 嚴格 scoped to `phase === "tracking"`** — `phase === "done"` 完整保留 walks-v2 SHIPPED 的 emerald celebration + confetti + gradient wash + recap tiles。Source grep 確認 15 個 marker 仍在（Trophy / emerald / walk-confetti / finalGoalHit / walk-streak-pop）

### Chrome MCP 驗證結果（production /app/walks）

| Checklist item | 方式 | 結果 |
|---|---|---|
| `npx tsc --noEmit` | 本地 build | ✅ PASS |
| Hero card 在 cream body 上 pop | DOM `getComputedStyle` | ✅ bg `rgb(255,255,255)` mango.card on `rgb(251,241,221)` mango.bg body；border `rgb(234,223,196)` mango.hairline |
| Hero CTA mango tone | DOM | ✅ bg `rgb(243,152,0)` = `#F39800` brand + color `rgb(35,27,20)` = `#231B14` ink（**7.6:1 AAA**） |
| Today progress bar | DOM | ✅ track `rgb(234,223,196)` hairline + fill `rgb(255,194,92)` `#FFC25C` amber |
| Tracking status pill | force start + DOM | ✅ pill warm peach (`#FFE7BF` brand-tint) + text `rgb(215,123,0)` brand-deep + pulsing dot `rgb(243,152,0)` brand |
| Tracking live progress | DOM | ✅ same hairline+amber pattern |
| Camera CTA pill | DOM | ✅ bg `rgb(255,231,191)` brand-tint + border `rgb(243,152,0)` brand |
| Stop button | DOM | ✅ red `lab(...)` 保留（destructive，Q19） |
| Done screen celebration | source grep | ✅ 15 個 marker（Trophy / emerald / walk-confetti / finalGoalHit / walk-streak-pop）全保留 — patch 沒動 `phase === "done"` |
| Desktop sticky hidden | viewport=desktop, render | ✅ sticky `md:hidden`, hero CTA visible |
| Sticky bottom CTA (force-show 模擬 mobile) | DOM | ✅ surface `mango.card-soft/92` + border `mango.hairline` + 73px tall + button orange ink |

### 未直接驗證

- ⚠️ Lighthouse a11y on `/app/walks` ≥ 90：Chrome MCP 環境無 Lighthouse CDP 整合；過去 deploy 的 token 對比 (ink-on-brand 7.6:1 / ink-2 on cream 6.8:1 / hairline 3.1:1 ring) 都 ≥ AA，預期 ≥ 90 但需 user 用 DevTools 跑一次確認
- ⚠️ Goal-hit done screen + confetti 視覺：需 30 分鐘 walk 觸發；source grep 確認 code 未動，trust patch scope notice
- ⚠️ Mobile 真實 viewport (iPhone 14 Pro Max)：Chrome MCP maximized window，force-show 已覆蓋 sticky structure + colors
- ⚠️ Pet picker chip tap visual：user 單寵物（Mango），chip 邏輯不渲染；code path 正確（per patch）

### STOP at Phase 1（spec instruction）

不主動跑 Phase 2 — 需要 user 看完 Phase 1 視覺後 ping Claude Design 拿 Phase 2 patch package 才接。本 session 收尾。
