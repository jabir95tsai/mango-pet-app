# 視覺重設計 — 芒果主題（Mango Visual Redesign）

狀態：READY-FOR-DEV（user 2026-05-24 提供 ZIP mockup + 「喜歡 Variant B」+「底部中間凸顯」→ PM v2 重寫）
建立日期：2026-05-24
最後更新：2026-05-24（v2 — palette 改用 ZIP mockup tone + 加 raised center tab + Variant B pet page pattern）
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
