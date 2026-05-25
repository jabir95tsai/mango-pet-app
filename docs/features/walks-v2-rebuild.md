# Walks page v2 — 全頁結構重建（Phase 1 v2）

狀態：**GO**（user 2026-05-24 深夜 prototype review 後 3 個 decisions confirmed）
建立日期：2026-05-24
最後更新：2026-05-24
規格作者：PM session @ `134016f`
角色：Claude Design（產 production patch）→ Code session（apply + verify + ship）
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

## 完成標準

### Claude Design 產出

- [ ] `patches/walks-v2/` 資料夾，full-file replacements（同 Phase 1 pattern）：
  - `walks-page.tsx` → `src/app/app/walks/page.tsx`
  - `walks-dial.tsx` → `src/components/walks/walks-dial.tsx`（新檔，232px 放射 dial + 中央卡通狗 + 底部數字 pill）
  - `walks-week-strip.tsx` → `src/components/walks/walks-week-strip.tsx`（新檔，7 圓圈 + paw fill + today 高亮）
  - `walks-pet-walking.tsx` → `src/components/walks/walks-pet-walking.tsx`（新檔，卡通狗 SVG + 6 keyframes 含 `prefers-reduced-motion` skip）
  - `walks-confetti-decor.tsx` → `src/components/walks/walks-confetti-decor.tsx`（新檔，9 片靜態 confetti）
  - `walk-row.tsx` → `src/components/walks/walk-row.tsx`（新檔，row 樣式取代 WalkCard 在 walks page；WalkCard 自己留給歷史頁用）
  - `streak-chip.tsx` → `src/components/walks/streak-chip.tsx`（新檔，top-bar gradient flame chip 含 ≥7 天 leaf 變體 + flicker 動畫 + `prefers-reduced-motion` skip）
- [ ] `patches/walks-v2/README.md`：跟 Phase 1 README 同格式（檔案對應表 + 設計取捨 + deviations + 預驗收 checklist）

### Code session apply + ship

- [ ] Pet picker 邏輯改：top-bar Mango pill 顯示主寵物（user 的 createdAt 最早 pet）
- [ ] 既有 pet picker chips bar 在 walks page 拿掉
- [ ] WalkCard 在 walks page 換成 walk-row.tsx；WalkCard 元件本身不刪（歷史頁仍用）
- [ ] All walks logic 保持 — start/stop walk / photo capture / tracking / done screen / Screen Wake Lock 全不動
- [ ] `prefers-reduced-motion`：跑路 / flame / ground dots / wag 動畫全 stop
- [ ] mango tokens 沿用（不引入新 hex 除非 spec 已標）
- [ ] WCAG AA 對比保持（卡通狗 fill #e8a85a body + #b4773a ear 對 #fff5d8 belly highlight 要過；ink-on-brand pill 已過）
- [ ] i18n keys 新增：`WalksPage.heroIncomplete.title` / `heroComplete.title` / `heroSubLine` / `weekStrip.label` / `recentWalks.viewAll` / `cta.startWalk` / `cta.walkAgain`
- [ ] `npx tsc --noEmit` pass
- [ ] Lighthouse a11y on `/app/walks` ≥ 90
- [ ] Chrome MCP smoke：iPhone + desktop × incomplete + complete 兩種狀態都 render
- [ ] 開始遛狗 → 進 tracking 看 phase 1 既有 palette 不破
- [ ] 結束遛狗 → done screen confetti / 達標 celebration 全跟以前一樣（emerald palette 不被 mango leaf 覆蓋）

## 技術約束（給 Claude Design + Code session）

- **Tailwind v4 + `@theme inline`** — 不要建 `tailwind.config.ts`（per Phase 0 README）
- **不動 shared Button / EmptyState 元件** — per-instance className override（同 Phase 1 pattern）
- **不動 walk-tracking-view tracking phase 結構 + done screen** — v1/v2 已 SHIPPED 視覺保留
- **不動 confetti palette / animation 在 done screen**（emerald celebration 不變）
- **不動 walk-tracking.ts** — logic file 不碰
- 卡通狗 SVG path + keyframes 直接 inline 在元件（prototype 已 demo 寫法）
- 6 keyframes 範圍：`wd-bob` / `wd-swingA` / `wd-swingB` / `wd-wag` / `wd-ground` / `flame-flicker` —— 全 scope 在元件 `<style>` 內，不污染 globals.css

## Edge cases

| Case | 處理 |
|---|---|
| User 0 pets | 走原本 EmptyState「先建寵物」流程（不顯示 dial / week strip） |
| User 多 pets | top-bar 只顯示主寵物（createdAt 最早）；chevron 暫無功能（hover/aria 標「多 pet 支援開發中」）|
| Tracking 中重 load page | 跟既有邏輯一樣（不在本 spec 範圍 — backlog 有「追蹤中 reload 恢復 tracking state」） |
| Personal mode | 同 family mode（walks 頁不分模式）|
| Streak = 0 | streak chip 顯示「0 天」grey-out 或不顯示（Claude Design 自選；prototype 沒 demo）|
| 今日已達標但 user 想再遛 | 點「再遛一次」CTA → 進 tracking flow 跟「開始遛狗」一樣 |
| Confetti accessibility | 純裝飾，aria-hidden=true；不算 a11y 元素 |
| Reduced motion user | dial 進度環 transition 仍跑（600ms ease，不算動畫）；走路狗 / flame / ground dots / wag 全停（prototype CSS media query 已寫）|

## 跟其他 spec 的關聯

- **visual-redesign-mango.md**：本 spec 是其 Phase 1 v2 addendum；不替換原 spec，補充 walks 頁結構重建細節
- **walk-core / walks-v2 spec**：walks logic / tracking flow / done screen / photo capture / celebration 全不動，本 spec 只動 walks 頁外觀
- **engagement-push-notifications.md (Epic 5)**：A1/A2 push 內容跟 walks page 顯示協調（A1「{pet} 還沒走滿 30 分鐘」對應 walks page hero「再走 X 分鐘」）— 兩邊用詞風格對齊但獨立 i18n
- **Epic 4 後續 phases**：Phase 1 v2 ship 後再做 Phase 2 (pets page)；spec/視覺方向不變

## Claude Design launch prompt（user 開 Claude Design session copy 用）

```
本 session 固定角色：Claude Design — 把 walks v2 prototype 轉成 production patch
給 Code session apply。Repo: C:\Users\jabir\Hacker_J\mango_pet_app

⚠️ 必讀
- Spec: docs/features/walks-v2-rebuild.md（PM 寫好，含完成標準 + 約束）
- Prototype: docs/design/walks-v2-prototype/
  - Walks redesign.html（demo 入口）
  - walks-screen.jsx（核心 React 元件，含 Dial / PetAvatar / WeekStrip / TabBar / Confetti / WalkRow）
  - design-canvas.jsx + ios-frame.jsx（preview frame，不用拷到 production）
- 既有 design tokens: src/app/globals.css 的 @theme inline mango palette
- 既有 walks page: src/app/app/walks/page.tsx（原 Phase 1 palette swap — 你會替換它）
- 既有 元件: src/components/walks/walk-card.tsx, walk-tracking-view.tsx
- 必讀 AGENTS.md：Next.js 16 + Tailwind v4（用 @theme inline，NOT tailwind.config.ts）

護欄
- 動 src/app/app/walks/page.tsx + src/components/walks/* OK（包含新檔）
- 不動 walk-tracking-view 內部結構（done screen / tracking phase 已 SHIPPED 視覺）
- 不動 shared Button / EmptyState 元件
- 不動 src/components/ui/* 共用元件
- 不動 confetti palette in done screen（emerald 保留）
- 不動 walk-tracking.ts（logic）
- 不引入新 animation library
- 不建 tailwind.config.ts
- 不改 mango tokens（globals.css）
- 6 keyframes 全 scope 在元件本地 <style>，不污染 globals.css

產出格式
- patches/walks-v2/ 資料夾，full-file replacements（同 Phase 1 pattern）：
  - walks-page.tsx → src/app/app/walks/page.tsx
  - walks-dial.tsx → src/components/walks/walks-dial.tsx（新檔）
  - walks-week-strip.tsx → src/components/walks/walks-week-strip.tsx（新檔）
  - walks-pet-walking.tsx → src/components/walks/walks-pet-walking.tsx（新檔含 6 keyframes）
  - walks-confetti-decor.tsx → src/components/walks/walks-confetti-decor.tsx（新檔）
  - walk-row.tsx → src/components/walks/walk-row.tsx（新檔取代 WalkCard 在 walks page）
  - streak-chip.tsx → src/components/walks/streak-chip.tsx（新檔含 flame flicker）
- patches/walks-v2/README.md：跟 Phase 1 README 同格式
  - 檔案對應表
  - 設計取捨（為什麼這樣做 / 跟原 production 差在哪 / spec 哪幾條 cover 到 / 哪幾條 deviate）
  - Deviations 段：任何脫離 spec 的選擇都要列出來 + 理由
  - 預驗收 checklist for Code session（含 Chrome MCP / Lighthouse / tsc / 達標 + 非達標兩態 / tracking 不破 / done screen 不破）

關鍵實作筆記
- 卡通狗 SVG 直接從 prototype walks-screen.jsx 拷 PetAvatar 元件邏輯 + 6 keyframes
- prefers-reduced-motion media query 一定要保留
- Hero copy 用 i18n（zh-TW + en）：WalksPage.heroIncomplete.title / heroComplete.title / heroSubLine
- Mango pill 顯示主寵物 — 從 user pets 拿 createdAt 最早那隻；多 pet user chevron 暫 no-op + aria 標「多 pet 支援開發中」
- Confetti 靜態（9 片 div + transform rotate），no animation；顯示條件 = goalHit
- Week strip 7 天資料源：算這週 Mon-Sun 每天的 walk 達標 (today total >= 30 min) bool 陣列
- 「再遛一次」CTA 達標時顯示 — 點擊行為跟「開始遛狗」一樣（進 tracking flow）
- StatPill 元件 prototype 有寫但畫面沒用 — 不用 port

回報格式
- patches/walks-v2/README.md 寫好設計取捨
- 跟我（user）說 patches/walks-v2/ 已 ready
- 不 commit 也不 push（讓 Code session 接手 apply + 驗證 + ship）
```

## PM 觀察

Phase 1 v2 比原 Phase 1 工作量大（M vs S）但仍在合理範圍。Claude Design 把 prototype 轉 production 應該 1 個 session 內可完成，因為：
- 結構 prototype 已寫好（直接 port React 元件）
- 動畫 keyframes + a11y media query 已 demo 寫法
- 視覺 token 已對齊 mango palette
- 不需 design 決策（user decisions 已 confirm 完）

Code session apply 後驗收主要在「tracking flow 不破 + done screen 不破」— 這兩個是 Phase 1 v2 沒動但容易意外踩到的區域。
