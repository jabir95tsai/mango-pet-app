# 視覺重設計 — 芒果主題（Mango Visual Redesign）

狀態：READY-FOR-DEV（user 2026-05-24 vision + 20 個答案；PM 預設 + user 自訂全內建）
建立日期：2026-05-24
最後更新：2026-05-24
規格作者：PM session @ 368113c
角色：UI/UX 工程師（主，整 stack 視覺範圍）— 可動 `src/app/**/*.tsx`、`src/components/**`、`src/app/globals.css`、`tailwind.config.ts`、`messages/*`；**不碰** `src/lib/firebase/*` / `functions/` / `firestore.rules` / schema / indexes
工作量：**XL**（6 phases，可獨立 ship per phase）

## User Vision（原話保留）

> 以「芒果」為主題的溫暖配色（芒果黃、橘、搭配草地綠），給人活潑、親切、適合家庭與寵物的感覺。含微動畫與互動效果，手機與電腦皆能良好顯示。

## 20 個 product decisions（user 2026-05-24 全答完）

| # | 問題 | 採用 | PM 預設 | 變動 |
|---|---|---|---|---|
| Q1 | 範圍 | **全 10+ 頁一次性大改** | 核心 5 頁 | ⚠️ 升級 |
| Q2 | 優先順序 | walks → home → pets → onboarding → settings → 其他 | 同 | ✓ |
| Q3 | Design system vs 一頁一頁 | 先抽 tokens 再套 | 同 | ✓ |
| Q4 | 既有功能保留度 | 100% 保留 | 同 | ✓ |
| Q5 | 主黃色號 | **#FFCA28**（Material Amber 400 亮芒果黃） | #F5A623 暖橘黃 | ⚠️ User 自訂 |
| Q6 | 副綠 | **沿用既有 emerald palette** | #7DBE5B | ⚠️ User 自訂 |
| Q7 | Accent | 桃粉 #FFB3BA | 同 | ✓ |
| Q8 | 圓角 | rounded-2xl 為主 + 按鈕 rounded-full | 同 | ✓ |
| Q9 | 字體 | 保留 system font | 同 | ✓ |
| Q10 | 動效強度 | medium | 同 | ✓ |
| Q11 | 寵物 motion | **不做** | 要做（wagging）| ⚠️ 拿掉 |
| Q12 | Page transition | 沒有 | 同 | ✓ |
| Q13 | Touch feedback | scale 0.97 + 100ms | 同 | ✓ |
| Q14 | 插畫風格 | flat illustration + emoji | 同 | ✓ |
| Q15 | Mascot | 不做 | 同 | ✓ |
| Q16 | Empty state | illustration + 鼓勵 + CTA | 同 | ✓ |
| Q17 | Loading/error tone | fun but 不過度 | 同 | ✓ |
| Q18 | Dark mode | **跳過第一輪** | 完整重做 | ⚠️ 延後 |
| Q19 | A11y | WCAG AA | 同 | ✓ |
| Q20 | 節奏 | Phase 0 tokens → Phase by phase | 同 | ✓ |

## Why now

- Epic 1-3 完工 17 個 work item，**功能已豐富**，是時候 polish 視覺一致性
- Product vision 從「家庭照護 + 社交」進一步定錨在「芒果」品牌主題 — 視覺對齊
- User 上次提的「打開就想用」是 walks-only thesis，本 spec 延伸到全 app 一致體驗
- 此 epic 是上架前**最後一輪 visual polish** — 做完可以準備上架（隱私/ToS 內容 + 自訂網域）

## Phase 0: Design tokens（基礎，必先 ship）

### Color palette

#### Mango（主黃 — 取代 amber 成為主 CTA / 高亮）

```ts
// tailwind.config.ts theme.extend.colors
mango: {
  50:  '#FFFBEB',   // page background tint
  100: '#FFF4D6',   // light chip / hover bg
  300: '#FFE085',   // gradient mid
  400: '#FFCA28',   // ★ PRIMARY — CTAs, 高亮, active states
  500: '#F5B400',   // emphasis / icon
  600: '#E89F00',   // hover on primary
  700: '#C77A00',   // text on light bg
}
```

替換規則：既有 `amber-*` 用法逐一改為 `mango-*`（更亮、更黃、更芒果）

#### Grass（沿用既有 tailwind emerald — Q6 user 選定）

```
emerald-50 / 100 / 400 / 500 / 600 / 700  ← 已大量使用，不改
```

主要使用點：
- 達標 / success indicator (`emerald-500`)
- 進度條 fill 達標色 (`emerald-500`)
- 完成 reminders icon
- Streak ≥7 天 fire (`emerald-600`)

#### Peach（accent — highlight 不搶 primary）

```ts
peach: {
  50:  '#FFF5F6',
  100: '#FFE4E6',   // 寵物 card 淡背景 / family chip bg
  300: '#FFC9CB',   // hover state
  500: '#FFB3BA',   // ★ ACCENT — 寵物 badge / 反應 button highlight
  600: '#FF9BA4',
  700: '#E07A85',   // text on light bg
}
```

主要使用點：
- 寵物 card 的 ring / badge accent
- Family member chip background
- Photo viewer overlay tint
- React button hover (animal-feed)

### Typography（沿用，Q9 預設）

```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI',
             'Microsoft JhengHei', '微軟正黑體',
             Roboto, sans-serif;
```

### Border radius

```css
--radius-sm:   6px;
--radius-md:  12px;
--radius-lg:  16px;   /* 主用 — cards / panels */
--radius-xl:  20px;
--radius-2xl: 24px;   /* 大 modal / hero */
--radius-pill: 9999px; /* buttons / chips */
```

對應 tailwind:
- Buttons: `rounded-full`
- Cards: `rounded-2xl`
- Inputs: `rounded-xl`
- Modal: `rounded-2xl`
- Chips: `rounded-full`

### Shadow

```css
--shadow-card:     0 1px 3px rgba(24,24,27,0.05), 0 1px 2px rgba(24,24,27,0.04);
--shadow-elevated: 0 8px 24px rgba(24,24,27,0.08), 0 2px 6px rgba(24,24,27,0.04);
--shadow-mango:    0 4px 12px rgba(255,202,40,0.25), 0 1px 3px rgba(255,202,40,0.15);
```

### Motion

```css
--motion-fast:    100ms ease;      /* button press */
--motion-default: 200ms ease;      /* hover, focus, color */
--motion-slow:    400ms ease;      /* gradient fade, large layout */
--motion-spring:  cubic-bezier(0.34, 1.56, 0.64, 1);  /* bounce */
```

### A11y（Q19 WCAG AA）

- Text/bg contrast 4.5:1（mango-400 on white pass; emerald-500 on white pass; peach-500 on white **不 pass** → text 用 peach-700）
- UI/border contrast 3:1
- Focus visible: `outline-2 outline-mango-500 outline-offset-2`
- `@media (prefers-reduced-motion: reduce)`: 所有 transition / animation → 0ms; confetti hidden
- Keyboard nav: 沿用 existing
- Screen reader aria-labels：沿用 existing

## 6 個 phase（Phase 0 後可獨立 ship）

| Phase | 內容 | 工作量 | 動到的主要 file |
|---|---|---|---|
| **0** | Design tokens（tailwind config + globals.css）| S | `tailwind.config.ts`, `src/app/globals.css` |
| **1** | `/app/walks` (最高優先 — vision aligned) | S | `src/app/app/walks/*`, `src/components/walks/*` |
| **2** | `/app` (home) + `/app/pets` + `/app/pets/[petId]` | M | `src/app/app/page.tsx`, `pets/page.tsx`, `pets/[petId]/page.tsx`, `src/components/pets/*` |
| **3** | `/onboarding` + Landing (`/`) + sign-in flow | M | `src/app/onboarding/page.tsx`, `src/app/page.tsx`, `src/components/auth/*` |
| **4** | `/app/settings` + `/app/leaderboard` | M | `src/app/app/settings/page.tsx`, `leaderboard/page.tsx`, `src/components/settings/*`, `leaderboard/*` |
| **5** | Drawer pages 全套：`/app/feed` + `/app/restaurants` (+detail) + `/app/knowledge` (+detail) + `/app/friends` (+/add) + `/app/expenses` | L | 各 page + components |
| **6** | Polish — 跨 phase 一致性 audit + loading/error tone + reduced-motion verify + 補漏 hard-coded color | S | 全部 |

**獨立 ship 策略**：Phase 0 必 ship 給後續引用；Phase 1-6 之間獨立可調 / 並行（不同檔案範圍）。

## 完成標準

### Phase 0 — Design tokens

- [ ] `tailwind.config.ts` extend `mango` + `peach` palette（emerald 沿用 tailwind default）
- [ ] `src/app/globals.css` 加 `--radius-*` / `--shadow-*` / `--motion-*` CSS variables
- [ ] 既有頁面**無 regression**（tokens 是 additive，原 `amber-*` / `emerald-*` 不動還能用）
- [ ] `npx tsc --noEmit` pass
- [ ] 在 spec 末尾或 commit message 寫一段 token usage cheatsheet

### Phase 1-5 — 各 page redesign

每 phase 對應 page(s) 套用 design system：

- [ ] **主 CTA**：mango-400 + `--shadow-mango`，hover mango-600，press scale 0.97
- [ ] **Highlight**：peach 用於寵物相關 chip / badge / reaction
- [ ] **Success / 達標**：sticking with emerald（既有）
- [ ] **Border radius**：cards `rounded-2xl`, buttons `rounded-full`, inputs `rounded-xl`
- [ ] **Shadow**：cards `--shadow-card`, modal `--shadow-elevated`
- [ ] **Motion**：transition tokens 全套（press / hover / progress 各對應）
- [ ] **Empty state**：emoji + simple SVG illustration + 鼓勵文案 + CTA
- [ ] **Loading**：mango spinner / progress bar + 「準備中...」(fun but 不過度)
- [ ] **Error**：amber/peach icon + 「再試一次」CTA (中性 minimal)
- [ ] **不**加寵物 wiggle / wagging 動效（Q11）
- [ ] **不**做 dark mode（Q18 延後 — 既有 dark classes 不刻意修也不刻意刪）
- [ ] WCAG AA contrast verified
- [ ] `prefers-reduced-motion` 全 page 支援
- [ ] Chrome MCP iPhone + desktop light mode 對照

### Phase 6 — Polish & audit

- [ ] 全 app regression test（每頁走一遍）
- [ ] 動效一致性 audit（transition duration / easing 統一）
- [ ] 漏網 hard-coded color refactor 為 token
- [ ] Lighthouse Visual / A11y 仍 > 90

## 成功指標

- 質性：自己 + 家人實測「看起來像一個 app，不是 sprint 拼出來的」
- 質性：「芒果主題明確，溫暖親切」
- 量性：bundle size 增加 < 5KB（純 CSS tokens，無新 library）
- 量性：Lighthouse Visual / A11y > 90

## 不在這次範圍

- **Dark mode**（Q18 延後 — light first ship 完評估 dark 是否需要；若需要另開 spec）
- 寵物頭像 wagging / wiggling 動效（Q11 拿掉）
- Mascot「芒果」角色（Q15）
- Page transition（Q12）
- Material ripple feedback（Q13）
- Google Font / Noto Sans TC（Q9 — 保留 system font）
- Animation library（framer-motion / GSAP — 全 CSS keyframes）
- 改 schema / lib / functions / rules / indexes（Q4 — 100% 保留功能）
- 改 functional behavior
- Custom illustration commission（用 SVG / emoji 為主）
- 新 page 內容 / 新 feature

## 技術筆記

### 動到的檔案

**Phase 0**：
- `tailwind.config.ts` — palette extension
- `src/app/globals.css` — CSS variables

**Phase 1-5**：
- 對應 page + components（見 phase 表格）
- `messages/*.json` — 新 empty state 鼓勵文案 i18n（如需要）

**Phase 6**：
- 全部 — final pass

### 部署順序

每個 phase 獨立 commit + push origin main → App Hosting auto-build。

⚠️ **Phase 0 必須先 ship**（否則 Phase 1+ 用 `mango-400` className 不認）。

### Edge cases

| Edge | 處理 |
|---|---|
| 既有 dark mode 元素 | Q18 延後 — Phase 1-5 不刻意 break dark；dark 變舊樣式（接受暫態），等 dark mode follow-up spec |
| Tailwind purge | mango / peach 全列在 safelist 或實際 className 用到 |
| Existing hard-coded color | Refactor 為 token；globals.css 內統一 |
| Performance | 純 CSS + class swap，no JS impact |
| Browser support | iOS Safari 15+, Chrome 100+, no exotic CSS features |
| Walks-v2 既有 confetti / streak animation | 已 ship 不動；只 verify 在 new motion tokens 下仍正常 |

### 跟其他 spec 的關聯

- **walk-core-redesign / walks-photo-and-celebration**：Phase 1 walks 沿用既有結構 + 套 tokens；既有 emerald confetti / streak 動效不動
- **Home + Pets IA reorg**：Phase 2 沿用既有 IA（feed timeline / pets sections），只改視覺
- **delete-account / data-export**：UI 內部按鈕配色更新，functional 不動
- **既有 nav 結構**：Phase 0 不動 nav；nav visual 在 Phase 4 settings 一併 polish

## 開放問題

- [x] Q1-Q20 全部 user 已回 ✓
- [ ] **Phase 0 ship 後是否要 user review tokens screenshot 才動 Phase 1？** 建議：不用 — Phase 0 是 tokens 文件，視覺差異要 Phase 1 才看得到。Phase 1 ship 後 user 看 walks 頁就知道 mango 主題感覺對不對
- [ ] **Phase 6 polish 時要不要 user feedback round？** 建議：Phase 1-5 ship 完一輪後 user 實測整 app → 提整體調整 → Phase 6 收尾
- [ ] **Dark mode follow-up spec 何時寫？** 建議：visual redesign 全部 ship + user 用 1-2 週後再決定（user 可能根本不需要 dark）
