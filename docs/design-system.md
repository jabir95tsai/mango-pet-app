# Mango Pet 設計系統 / 品牌樣式（單一真相來源 SoT）

> **狀態**：v1 STANDARD（PM 2026-06-03 拍板）。**這是品牌樣式的單一真相來源**。
> 任何 session 做 UI 前先讀這份；不要「各自照各自來源對齊」（那正是先前 drift 的根因：兩套主題、兩套圓角、被退掉的 Reanimated 滑動 tab）。
> **跨平台**：token 數值的 SoT = `packages/shared-tokens/src/index.ts`（web + iOS 共用）。web 透過 `apps/web/src/app/globals.css` 落地。iOS（RN）用同一組數值。
> **遷移策略（user 2026-06-03）**：設標準 + 漸進。**新 code 一律遵守**；既有未對齊頁面列「§7 遷移清單」進 backlog 慢慢收，不阻擋其他進度。

---

## 1. 顏色 / 主題 — 全 app 一套 mango 暖色

**規則：整個 app 統一 mango 暖色票。不准再用 zinc / amber 中性色當主色。**（user 2026-06-03 拍板「全部 mango 化」）

色票（web 在 `globals.css @theme inline`，token 名即真相）：

| 用途 | token | 值 |
|---|---|---|
| 主黃 brand | `--color-mango-brand` | #f39800 |
| 深橘 brandDeep | `--color-mango-brand-deep` | #d77b00 |
| amber | `--color-mango-amber` | #ffc25c |
| brandTint | `--color-mango-brand-tint` | #ffe7bf |
| 底 bg | `--color-mango-bg` | #fbf1dd |
| bg-alt | `--color-mango-bg-alt` | #f6e7c8 |
| card | `--color-mango-card` | #ffffff |
| card-soft | `--color-mango-card-soft` | #fff8e8 |
| hairline | `--color-mango-hairline` | #eadfc4 |
| ink / ink-2 / ink-3 | `--color-mango-ink*` | #231b14 / #5a4a38 / #9a8a74 |

- Tailwind class 用 `bg-mango-*` / `text-mango-*` / `border-mango-*`（由 @theme 生成），**不要寫死 hex**、不要用 `zinc-*` / 原生 `amber-*` 當主色。
- success/leaf 綠（既有 emerald 系）仍可用於「達標 / 成功」語意；peach/pink/sky 僅作慶祝紙花等裝飾。

## 2. 圓角 — 統一用 `--radius-*` 自訂 scale

**規則：app surface 一律用 `--radius-*`，不要用 Tailwind 預設 `rounded-lg`（=8px）等當卡片圓角。**（user 2026-06-03 拍板）

| token | 值 | 用途 |
|---|---|---|
| `--radius-sm` | 8px | 小元件 |
| `--radius-md` | 12px | |
| `--radius-lg` | 14px | card 預設 |
| `--radius-xl` | 18px | mockup Card |
| `--radius-2xl` | 22px | 大卡 / 頭像框 |
| `--radius-pill` | 9999px | 膠囊鈕 |

- 寫法：`rounded-[var(--radius-lg)]`（卡片）、`rounded-[var(--radius-xl)]` 等。
- ⚠️ **為什麼不放進 @theme**：放進去會覆蓋 Tailwind 的 `rounded-sm/md/lg/...` 預設、regress 所有既有用 `rounded-*` 的地方。所以 radius 維持 plain CSS var，用 `rounded-[var(--radius-*)]` 取值。
- 既有散落的 `rounded-lg`（8px）→ 列遷移清單逐步換成對應 `--radius-*`。

## 3. 字體

- stack：`-apple-system, "SF Pro Text", "SF Pro Display", "PingFang TC", "Noto Sans TC", system-ui, sans-serif`（即 `--font`）。
- 數字用 `font-variant-numeric: tabular-nums`（計時 / 分數 / 統計）。

## 4. 元件慣例

- **按鈕**：膠囊 `rounded-[var(--radius-pill)]`；主鈕漸層 `linear-gradient(180deg, brand, brandDeep)` **白字**（品牌定案，雙平台一致）+ `--shadow-mango`；按壓 `active:scale-[.97]`。
  - ⚠️ **白字對比要求（user 2026-06-03 裁決 P2-1）**：白字 on `brand`(#f39800) 僅 2.6:1，**漸層需加深到讓白字達大字 WCAG AA ≥3:1**（CTA 為 19px/800 大粗字，適用大字門檻；做法：字落在以 `brandDeep`(#d77b00) 為主的深橘區，或整體漸層下移）。**保留白字、不改成 ink**。
  - 📌 **三方矛盾已裁決**：以本條為準 → `globals.css` 頭部那句「CTAs put ink on brand」**註解是錯的**（與實作/SoT 不符），UI/UX 實作 P2-1 時一併修正該註解。
- **卡片**：`bg-mango-card`/`card-soft` + `1px hairline` + `--radius-lg/xl` + 暖色柔光 shadow。
- **Tabs**：**簡單 toggle（active/inactive 切換），不做滑動 indicator。**（codify：web 的 `pet-tabs` / `ui/Tabs` 都是 toggle；先前 session 加的 Reanimated 滑動 indicator 已退掉，**不要再加**。）
- **頭像**：沿用 `Avatar` 元件（無 src → initials fallback）。

## 5. 動效 / Motion

- medium 強度、**純 CSS keyframes**；**不引入動畫 library**（no Reanimated sliding / no Framer 之類當基礎 UI；canvas 慶祝引擎屬特例）。
- **強制尊重 `prefers-reduced-motion: reduce`**：所有動畫/transition 在 reduce 下關閉；粒子/紙花 reduce 下不生成。這是**硬規則**，每個有動效的元件都要做降級。

## 6. a11y

- WCAG AA：文字/icon 對比達標；互動元素有 aria-label / 可鍵盤聚焦 / `focus-visible` outline。
- long-press / hover 類互動要有鍵盤 + 螢幕閱讀器備援。

## 7. 遷移清單（未對齊 → 漸進收，已記 backlog）

> 新 code 直接遵守 §1–§6。以下既有 surface 未對齊，列為 backlog migration（不阻擋其他進度）。
> ⚠️ **drift 實際範圍經 audit-2026-06 量化遠大於原估**：`zinc-*` 59 檔 / `amber-*` 44 檔 / Tailwind 預設 rounded ~170 處（詳 [`docs/research/audit-2026-06.md`](research/audit-2026-06.md) P2-5）。

**收的順序（audit 建議）：**
1. **`ui/` primitives 先收一批**（button / input / textarea / select / dialog / tabs / empty-state / skeleton）——它們被所有頁複用，先對齊後，後續頁面遷移成本減半。**這是重災區且原清單漏列。**
2. 高頻頁元件：`walk-tracking-view`、`walk-card` / `reminder-card` / `health-record-card`、`family-section`、landing `app/page.tsx`、`onboarding/`。
3. 其餘頁：feed / leaderboard / settings 殘餘、`restaurants/[id]`（⚠️ 餐廳功能暫停＝不投入新功能，純 token 對齊是否做由 PM 視情況；不急）。

**逐項類型：**
- zinc/amber 原生色（含 `dark:` 變體）→ mango token（§1）。
- Tailwind 預設 `rounded-md/lg/xl/2xl` → `rounded-[var(--radius-*)]`（§2）。
- 寫死 hex `bg-[#f7c168]`（`app/walks/page.tsx`）→ `bg-mango-amber`。
- ✅ 已驗證無殘留（audit 確認）：Reanimated 滑動 tab indicator（web/iOS 皆 simple toggle）、動畫 library、reduced-motion guard。

> 策略仍是「動到哪頁順手收哪頁」，但 `ui/` primitives 值得獨立一批主動先做。

## 8. 跨平台備註

- token 數值改動 → 改 `packages/shared-tokens`（web + iOS 同步），不要單邊硬寫。
- iOS（RN）沒有 Tailwind / CSS var，但**數值與語意對齊本文**（同 mango 色票 + 同 radius 數值 + tabs toggle + reduced-motion via `useReducedMotion`）。
