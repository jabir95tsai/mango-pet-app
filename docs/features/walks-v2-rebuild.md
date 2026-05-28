# Walks page v2 — 全頁結構重建（Phase 1 v2）

狀態：**SHIPPED 2026-05-25**（Phase 1 v2；元件 `c98c939` + page `984be5b` + i18n `110601e` + SHIPPED record `33fef7b`；2026-05-28 follow-up `d633d3d` 讓 recent「全部」可互動並顯示遛狗人）
建立日期：2026-05-24
最後更新：2026-05-28 PM status sync
規格作者：PM session @ `134016f`
角色：**UI/UX**（整 stack — 元件設計 + 寫 src/ + 自驗 + per-phase commit + ship）
工作量：**M**（整頁結構重建，但不影響 walks logic / tracking flow / done screen）

## 背景

原 Phase 1（palette swap，commits `37d1ec4` + `8aebe14`）SHIPPED 後 user 在 production 看到實際效果，希望從 palette polish **升級為整頁結構重建**。

User 用 prototype-first workflow 從 Claude Design 拿 `mango pet.zip`（4 prototype 檔，已展開到 [`docs/design/walks-v2-prototype/`](../design/walks-v2-prototype/)），含 incomplete + complete 兩種狀態 mockup。PM review 後 surface 3 issues，user decisions：

| Issue | User decision |
|---|---|
| Walking dog 6 keyframes 動畫違反 Q11 not-do | **推翻 Q11，圈內限定（dial 中心 232px 內）走路狗 OK**；roadmap not-do 已 retract |
| 失去 user 真實寵物照片 → 改 hardcoded 卡通狗 | 隨 Issue 1 一併接受 — 卡通狗 + 走路動畫 OK |
| 多 pet 家庭只剩 top-bar 1 個 Mango pill（沒 chips）| **只顯示主寵物**（createdAt 最早 pet），多 pet picker UX **DEFERRED** 另開 spec |
| Scope 從 polish 升 structural rebuild | **刪原 Phase 1 design intent，v2 取代**（commits 不 rollback，視覺由 v2 覆蓋）|

⚠️ **Workflow 註**：原本規劃 Claude Design 產 patches/walks-v2/ → Code session apply。**user 2026-05-24 改方向：UI/UX 直接寫 src/**（跳過 patch 中介），prototype 仍作為視覺/實作參考但不再產 patches/ 中間層。

## v2 vs 原 Phase 1（production）— delta

| 元素 | 原 Phase 1 production | v2 prototype | 處理 |
|---|---|---|---|
| **Hero** | Greeting card + last-walked-with + CTA | 拆掉，改 top bar (title「遛狗」+ Mango pill + streak chip 右) | 替換 |
| **進度顯示** | 線性 progress bar | **232px 放射狀 dial**（環 + 中央卡通狗 + 底部「{done} / {goal} 分」pill）| 替換 |
| **Pet picker** | chips bar 多 pet | 只剩 top-bar Mango pill + chevron（多 pet picker DEFERRED）| 簡化（單 pet only）|
| **Pet 中心元素** | User 上傳照片 | hardcoded 走路卡通狗 SVG + 6 個 keyframes 動效（圈內限定）| 替換（達標時嘴巴笑 + 吐舌頭）|
| **Week strip** | 沒有 | 7 個圓圈 一二三四五六日，完成日 paw fill，今日高亮 brand-tint | **新增** |
| **Encouragement** | sub-text 一行 | Hero 大字「再走 X 分鐘」或「達標了 🎉」+ sub-line「{petName} 今天走了 {n} 分 · 連續 {s} 天」 | 升級 |
| **Streak chip** | Hero 內右上 | Top-bar 右側 gradient flame chip（≥7 天 leaf gradient + leafDeep text）| 位置 + 視覺升級 |
| **Recent walks** | Card 樣式 | Row 樣式（icon + 名字 + km/min/score 一排）+「全部 →」link | 替換 |
| **Sticky CTA** | 一致 orange pill | incomplete: orange gradient + ▶「開始遛狗」/ complete: 白底 brand border + ＋「再遛一次」 | 升級（達標狀態變樣）|
| **Confetti** | 只在 done screen | walks 頁達標時 always show（top 區域，9 片靜態碎紙）| **新增**（靜態，無動畫）|
| **Tab bar** | 已 ship raised disc | 同（無需改）| ✅ 保留 |
| **Stat pills**（StatPill 元件）| Hero 內 week / streak 小 tile | prototype 內未呈現主畫面（Week strip 取代）| 暫不採用 StatPill |

## 不在 v2 範圍

- **多 pet picker UX**（top-bar pill tap → dropdown / 重做 chips bar）— 之後另開 spec
- **真實寵物照片**（用戶照片）— v2 採卡通狗；用戶照片仍在 pets page 顯示
- **walk-tracking-view 內部結構** — 仍是 Phase 1 palette（tracking phase 已 mango tone，done screen 不動）
- **Button / EmptyState 共用元件改造** — 仍 Phase 6 polish 處理
- **Confetti animation** — v2 用靜態 confetti decor，不加 animation library
- **WalkCard 元件改造** — 走 row 樣式請新 `walk-row.tsx`；WalkCard 在歷史頁仍可用原版

## 完成標準（UI/UX 直接寫 src/ → commit + ship）

### 新增元件（src/components/walks/）

- [ ] `walks-dial.tsx` — 232px 放射 dial + 中央卡通狗 slot + 底部「{done} / {goal} 分」pill
- [ ] `walks-week-strip.tsx` — 7 圓圈（一二三四五六日）+ 完成日 paw fill + today brand-tint 高亮
- [ ] `walks-pet-walking.tsx` — 卡通狗 SVG + 6 keyframes（`wd-bob` / `wd-swingA` / `wd-swingB` / `wd-wag` / `wd-ground` / `flame-flicker`）+ `prefers-reduced-motion` skip；prototype `PetAvatar` 元件邏輯直接 port
- [ ] `walks-confetti-decor.tsx` — 9 片靜態 confetti（div + transform rotate，no animation）+ aria-hidden
- [ ] `walk-row.tsx` — row 樣式（icon + 名字 + km/min/score）取代 WalkCard 在 walks page；WalkCard 元件自己留給歷史頁用
- [ ] `streak-chip.tsx` — top-bar gradient flame chip + ≥7 天 leaf 變體 + flame flicker + `prefers-reduced-motion` skip

### 改既有檔

- [ ] `src/app/app/walks/page.tsx` — 整頁結構重建（top bar / hero copy / dial / week strip / recent walks rows / sticky CTA）；舊 Hero card + linear progress bar + pet picker chips bar **拿掉**
- [ ] Pet picker 邏輯改：top-bar Mango pill 顯示主寵物（user pets 拿 createdAt 最早那隻）
- [ ] 多 pet user chevron 暫 no-op + aria 標「多 pet 支援開發中」
- [ ] WalkCard 在 walks page 換成 walk-row.tsx；WalkCard 元件本身不刪

### i18n

- [ ] 新 keys 加到 `messages/zh-TW.json` + `messages/en.json`：
  - `WalksPage.heroIncomplete.title`（「再走 {n} 分鐘」/「{n} more minutes」）
  - `WalksPage.heroComplete.title`（「達標了 🎉」/「Goal hit 🎉」）
  - `WalksPage.heroSubLine`（「{pet} 今天走了 {done} 分 · 連續 {streak} 天」/ en 對等）
  - `WalksPage.weekStrip.label`（「本週」/「This week」）
  - `WalksPage.recentWalks.viewAll`（「全部」/「View all」）
  - `WalksPage.cta.startWalk`（沿用既有 i18n key 即可）
  - `WalksPage.cta.walkAgain`（「再遛一次」/「Walk again」）

### 護欄

- [ ] All walks logic 保持 — start/stop walk / photo capture / tracking / done screen / Screen Wake Lock 全不動
- [ ] `walk-tracking-view` 內部結構不動（done screen / tracking phase 已 SHIPPED 視覺保留）
- [ ] 不動 shared `Button` / `EmptyState` 元件（per-instance className override，同 Phase 1 pattern）
- [ ] 不動 `walk-tracking.ts`（logic file）
- [ ] 不動 confetti palette in done screen（emerald celebration 保留）
- [ ] 6 keyframes 全 scope 在元件本地 `<style>`，**不污染 globals.css**
- [ ] 不動 mango tokens（`globals.css`）
- [ ] 不引入新 animation library
- [ ] 不建 `tailwind.config.ts`（Tailwind v4 用 `@theme inline`）

### 預驗收 checklist

- [ ] `npx tsc --noEmit` pass
- [ ] Chrome MCP iPhone (`/app/walks`)：
  - [ ] Incomplete 態：dial 18/30 顯示 + 走路狗動 + Hero「再走 12 分鐘」+ 「開始遛狗」CTA
  - [ ] Complete 態（模擬達標）：dial 環變綠 + check badge + Hero「達標了 🎉」+ Confetti decor 顯示 + 「再遛一次」CTA
  - [ ] Streak chip flame flicker 動（≥3 天）
  - [ ] Week strip 7 圓圈正確（完成日 paw + 今日高亮）
  - [ ] Top-bar Mango pill 顯示主寵物
  - [ ] 開始遛狗 → 進 tracking phase，phase 1 palette 不破
  - [ ] 結束遛狗 → done screen confetti / emerald celebration 全跟以前一樣
- [ ] Chrome MCP desktop (`/app/walks`)：layout 不破 + dial 居中
- [ ] `prefers-reduced-motion` user：dial transition 仍跑（不算動畫）；走路狗 / flame / ground dots / wag 全停
- [ ] Lighthouse a11y on `/app/walks` ≥ 90
- [ ] WCAG AA 對比：卡通狗 fill 顏色 + Mango pill + streak chip + CTA 全過
- [ ] commit message: `feat(design): Phase 1 v2 — walks 頁全頁結構重建（dial + week strip + 走路狗）`
- [ ] Push to main → App Hosting auto-deploy → 5-8 min 後 user 在 production 驗收

## 技術約束（給 UI/UX）

- **Tailwind v4 + `@theme inline`** — 不要建 `tailwind.config.ts`
- **不動 shared Button / EmptyState 元件** — per-instance className override（同 Phase 1 pattern）
- **不動 walk-tracking-view tracking phase 結構 + done screen** — v1/v2 已 SHIPPED 視覺保留
- **不動 confetti palette / animation 在 done screen**（emerald celebration 不變）
- **不動 walk-tracking.ts** — logic file 不碰
- 卡通狗 SVG path + keyframes 直接 inline 在元件（prototype 已 demo 寫法）
- 6 keyframes 範圍：`wd-bob` / `wd-swingA` / `wd-swingB` / `wd-wag` / `wd-ground` / `flame-flicker` —— 全 scope 在元件 `<style>` 內

## Edge cases

| Case | 處理 |
|---|---|
| User 0 pets | 走原本 EmptyState「先建寵物」流程（不顯示 dial / week strip） |
| User 多 pets | top-bar 只顯示主寵物（createdAt 最早）；chevron 暫無功能（hover/aria 標「多 pet 支援開發中」）|
| Tracking 中重 load page | 跟既有邏輯一樣（不在本 spec 範圍 — backlog 有「追蹤中 reload 恢復 tracking state」） |
| Personal mode | 同 family mode（walks 頁不分模式）|
| Streak = 0 | streak chip 顯示「0 天」grey-out 或不顯示（UI/UX 自選；prototype 沒 demo）|
| 今日已達標但 user 想再遛 | 點「再遛一次」CTA → 進 tracking flow 跟「開始遛狗」一樣 |
| Confetti accessibility | 純裝飾，aria-hidden=true；不算 a11y 元素 |
| Reduced motion user | dial 進度環 transition 仍跑（600ms ease，不算動畫）；走路狗 / flame / ground dots / wag 全停（prototype CSS media query 已寫）|

## 跟其他 spec 的關聯

- **visual-redesign-mango.md**：本 spec 是其 Phase 1 v2 addendum；不替換原 spec，補充 walks 頁結構重建細節
- **walk-core / walks-v2 spec**：walks logic / tracking flow / done screen / photo capture / celebration 全不動，本 spec 只動 walks 頁外觀
- **engagement-push-notifications.md (Epic 5)**：A1/A2 push 內容跟 walks page 顯示協調（A1「{pet} 還沒走滿 30 分鐘」對應 walks page hero「再走 X 分鐘」）— 兩邊用詞風格對齊但獨立 i18n
- **Epic 4 後續 phases**：Phase 1 v2 ship 後再做 Phase 2 (pets page)；spec/視覺方向不變

## UI/UX launch prompt（user 開 UI/UX session copy 用）

```
本 session 固定角色：UI/UX — 直接寫 production code 動 walks page 全頁結構重建。
Repo: C:\Users\jabir\Hacker_J\mango_pet_app

⚠️ 必讀
- Spec: docs/features/walks-v2-rebuild.md（PM 寫好，含完成標準 + 約束 + edge cases + i18n keys）
- Prototype: docs/design/walks-v2-prototype/
  - Walks redesign.html（demo 入口 — 你可以 open in browser 看效果）
  - walks-screen.jsx（核心 React 元件，含 Dial / PetAvatar / WeekStrip / TabBar / Confetti / WalkRow — 你直接 port 這些元件的邏輯）
  - design-canvas.jsx + ios-frame.jsx（preview frame，不用拷到 production）
- 既有 design tokens: src/app/globals.css 的 @theme inline mango palette
- 既有 walks page: src/app/app/walks/page.tsx（原 Phase 1 palette swap — 你會替換它）
- 既有 元件: src/components/walks/walk-card.tsx, walk-tracking-view.tsx
- 必讀 AGENTS.md：Next.js 16 + Tailwind v4（用 @theme inline，NOT tailwind.config.ts）

護欄
- 動 src/app/app/walks/page.tsx + src/components/walks/* OK（包含新檔）
- 動 messages/zh-TW.json + messages/en.json 加新 i18n keys OK
- 不動 walk-tracking-view 內部結構（done screen / tracking phase 已 SHIPPED 視覺）
- 不動 shared Button / EmptyState 元件
- 不動 src/components/ui/* 共用元件
- 不動 confetti palette in done screen（emerald 保留）
- 不動 walk-tracking.ts（logic）
- 不引入新 animation library
- 不建 tailwind.config.ts
- 不改 mango tokens（globals.css）
- 6 keyframes 全 scope 在元件本地 <style>，不污染 globals.css

實作順序建議
1. 新元件先做：walks-pet-walking → walks-dial → walks-week-strip → streak-chip → walks-confetti-decor → walk-row
2. 然後改 src/app/app/walks/page.tsx 串起來（top bar + hero + dial + week strip + recent walks rows + sticky CTA）
3. i18n keys 補 messages/*.json
4. npx tsc --noEmit pass
5. dev server 跑起來 Chrome MCP 驗 iPhone + desktop × incomplete + complete 兩態
6. tracking + done screen smoke test（開始遛狗 → 結束 → confetti / emerald celebration 不破）
7. commit 一個（或拆 2-3 個：新元件 commit / page 替換 commit / i18n commit，你自選）
8. push origin main → App Hosting auto-deploy → 5-8 min 後我（user）在 production 驗收

關鍵實作筆記
- 卡通狗 SVG 直接從 prototype walks-screen.jsx 拷 PetAvatar 元件邏輯 + 6 keyframes
- prefers-reduced-motion media query 一定要保留
- Mango pill 顯示主寵物 — 從 user pets 拿 createdAt 最早那隻；多 pet user chevron 暫 no-op + aria 標「多 pet 支援開發中」
- Confetti 靜態（9 片 div + transform rotate），no animation；顯示條件 = goalHit
- Week strip 7 天資料源：算這週 Mon-Sun 每天的 walk 達標 (today total >= 30 min) bool 陣列
- 「再遛一次」CTA 達標時顯示 — 點擊行為跟「開始遛狗」一樣（進 tracking flow）
- prototype 內 StatPill 元件有寫但畫面沒用 — 不用 port

commit message 建議
- 單 commit: feat(design): Phase 1 v2 — walks 頁全頁結構重建（dial + week strip + 走路狗）
- 拆 commit:
  - feat(design): Phase 1 v2 step 1 — 新 walks 元件（dial / week-strip / pet-walking / confetti / row / streak-chip）
  - feat(design): Phase 1 v2 step 2 — walks page 串新元件 + 拆掉舊 Hero / pet picker
  - chore(i18n): Phase 1 v2 — 新 WalksPage.* keys (zh-TW + en)

回報格式
- 每 commit hash + 1 行 review note
- 全部 ship 後最終 summary 給 PM 收尾 roadmap（標 Phase 1 v2 SHIPPED + commit hash 們）

開工。
```

## PM 觀察

Phase 1 v2 比原 Phase 1 工作量大（M vs S）但仍在合理範圍。**Workflow 改 UI/UX 直接寫 src/ 後**，預估 1 個 session 內可完成：
- 結構 prototype 已寫好（直接 port React 元件）
- 動畫 keyframes + a11y media query 已 demo 寫法
- 視覺 token 已對齊 mango palette
- 不需 design 決策（user decisions 已 confirm 完）
- 沒有 patches/ 中介層 = 少 1 步 hand-off

UI/UX session 自驗主要在「tracking flow 不破 + done screen 不破」— 這兩個是 Phase 1 v2 沒動但容易意外踩到的區域。

## Phase 1 v2 SHIPPED 紀錄

**Ship 時間**：2026-05-25 ~09:15 push → App Hosting build ~6 分鐘後

### 3 個 commit（user 給的 commit message 範本對齊 step boundary）

| Step | SHA | 內容 |
|---|---|---|
| 1 | `c98c939` | 6 個新元件：`walks-pet-walking` / `walks-dial` / `walks-week-strip` / `streak-chip` / `walks-confetti-decor` / `walk-row` — 全 scope 自己的 keyframes 與 prefers-reduced-motion media query，**0 行進 globals.css** |
| 2 | `984be5b` | `src/app/app/walks/page.tsx` 全頁重寫 — top bar (title + Mango pill + StreakChip) / Hero copy / WalksDial / WalksWeekStrip / WalkRow 列表 / 變體 sticky CTA (incomplete orange gradient ▶「開始遛狗」/ complete white pill +「再遛一次」) / desktop CTA / 條件 WalksConfettiDecor。舊 hero card + linear progress + pet picker chips bar 拿掉。Page-local helpers (`startOfWeekLocal` / `todayIdxLocal` / `getWeekDayDoneFlags` / `getWeekKm` / `getWeekWalkCount`) 因 spec 不動 `walk-tracking.ts` 而 inline |
| 3 | `110601e` | 9 個 `Walks.page.*` i18n keys (zh-TW + en) — heroIncomplete / heroComplete / heroSub / heroSubNoPet / weekLabel / recentTitle / viewAll / walkAgain / multiPetHint |

### Chrome MCP 驗收（desktop @ 1456×819 production，今天 user = Mango 主寵物 + 1 day streak + 0 today min）

| 驗收項 | 結果 |
|---|---|
| Hero copy「再走 30 分鐘」+ sub-line「Mango 今天走了 0 分 · 連續 1 天」 | ✅ heroText 對 |
| WalksDial (232px radial + 走路狗 SVG) | ✅ hasDial / hasRingSvg / hasDogSvg / dogLegs=4 |
| Dial numeric pill「0 / 30 分」 | ✅ numericText="0" |
| WalksWeekStrip 7 day cells | ✅ weekDayCells=7、今日 (一/Monday) 高亮 brand-tint + dot |
| Top-bar Mango pill (primary pet) | ✅ mangoPillText="🐶Mango" |
| StreakChip "1 天" muted variant (<3 days) | ✅ streakChipText="1 天" |
| Confetti not shown (goal not hit) | ✅ confettiCount=0 |
| WalkRow recent walks (1 entry from yesterday) | ✅ recentRowCount=1 |
| Sticky CTA incomplete = orange gradient ▶「開始遛狗」(force-show on desktop) | ✅ `background: linear-gradient(rgb(243,152,0) 0%, rgb(215,123,0) 100%)` |
| Tracking phase 1 palette 不破 | ✅ click 開始遛狗 → trackingOpen true、00:04 timer、status pill brand-tint + brand-deep + pulsing brand dot、camera + 紅停止全完整 |
| Done screen confetti / emerald celebration 不變 | ✅ source grep 15 個 markers 全保留 (walk-confetti / emerald / Trophy / finalGoalHit / walk-streak-pop) — 本 session 完全沒動 walk-tracking-view.tsx |
| Phase 0.5 raised disc + Phase 1 sticky 上移 + Phase 1 v2 sticky CTA 變體 三者堆疊正確 | ✅ sticky bottom 92px (5.75rem) + 73px tall + 透明 backdrop blur + disc top -16px 之上 |

### Phase 1 v2 沒能直接驗證

- ⚠️ **complete 變體** (goal hit + confetti decor + dial leaf 環 + WalkAgain CTA) — 今日 user 還沒走滿 30 分鐘無法觸發；需 user 真實達標後驗收
- ⚠️ Mobile 真實 viewport (iPhone 14 Pro Max 430×932) — Chrome MCP 老問題 maximized window 不能 resize；force-show 已模擬 sticky CTA + tab bar
- ⚠️ Dark mode — Q18 spec 跳過第一輪；`dark:` classes 在新元件中未補（spec 不要求）
- ⚠️ Streak chip ≥7 天 leaf gradient variant — user 還沒到 7 天

### Spec deviations

- **無**（user decisions 4 個全 adopted；prototype 元件 1:1 port；keyframes 全 scope；done screen 不動；shared Button / EmptyState 不動；walk-tracking.ts 不動）
- Note：spec 開放問題說「StatPill 元件不採用」— 已遵守，prototype 內 StatPill code 沒被 port
- Note：「全部 →」link 對應的 walks history 頁未實作（spec 不在 v2 範圍） — 目前是純標籤無 href
