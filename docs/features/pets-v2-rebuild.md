# Pets page v2 — 全頁結構重建（Phase 2 v2）

狀態：**GO**（user 2026-05-25 中午 prototype review 後 3 個 decisions confirmed — 全採 PM 推薦）
建立日期：2026-05-25
最後更新：2026-05-25
規格作者：PM session @ `d6fae58`
角色：**UI/UX**（整 stack — 元件設計 + 寫 src/ + 自驗 + per-phase commit + ship）
工作量：**L**（整頁重建 + multi-pet switcher + 4 detail tabs + donut chart + line chart + EmptyState；不影響其他頁面）

## 背景

Phase 2 對應 `visual-redesign-mango.md` Phase 2 (pets) 段（行 212-238），spec 已寫好結構（Variant B「分頁聚焦」Tabbed）。User 用 prototype-first workflow 拿 Claude Design pets v2 prototype，4 個檔已展開到 [`docs/design/pets-v2-prototype/`](../design/pets-v2-prototype/)，含 6 個 artboard 變體（單 pet / 多 pet switcher / detail 3 tabs / empty state）。

PM review 結果：
- ✅ Spec coverage 100%（structure / palette / tabs / FAB / switcher 全到位）
- ⭐ 3 個 spec 沒要求但 prototype 加值：FAB tab-aware tone / ExpensesBody donut chart + 月比較 / HealthBody 體重趨勢 line chart + 完整 EmptyState
- 🔴 1 個 critical issue：Pet avatar 採卡通插畫 SVG，不是 user 真實照片 → 不符 pets page「我的寵物」核心情感

User decisions：

| Issue | User decision |
|---|---|
| Pet avatar 卡通 vs 真實照片 | **採 user 上傳真實照片**，無 photoURL fallback 顯示 initial + brand-tint bg + paw icon |
| Workflow | **UI/UX 直接寫 src/**（跳過 patch 中介，同 Phase 1 v2 模式）|
| Scope | **一次 ship 全 6 個 artboard**（list 單/多 + detail 3 tabs + empty）— 包含 donut + chart + EmptyState |

## Prototype 結構（直接 port）

### Layout

```
TopBar（我的寵物 + 「+ 寵物」brandTint pill）
  ↓
PetHeader（avatar 64 + name + 3 chip + pencil edit）
  ↓（多 pet 時 PetSwitcher dropdown 從 pet name 下方展開）
  ↓
PetTabs（sticky pill 4-tab：概覽 / 提醒 / 開銷 / 健康）
  ↓
{tab body}
  ↓
FloatingAdd（右下 56×56 圓，顏色隨 tab）
  ↓
BottomNav（pets tab[1] active）
```

### Tab body 內容

| Tab | 內容 |
|---|---|
| **概覽** | StatGrid 2×2（下次提醒 brand / 本月開銷 cookie / 體重 leaf / 散步天數 brand）+「即將到期」reminder card x1 +「最近開銷」expense card x1 |
| **提醒** | 統計行（本月 X 條 · 已完成 Y）+ ReminderCard list（按到期時間排序）|
| **開銷** | 月 total bar（NT$ + 月比較 +12% chip）+ Donut chart + 分類占比 legend + ExpenseCard list |
| **健康** | 體重趨勢 SVG line chart（近 6 個月）+ kg delta + HealthRecord list（體重/疫苗/驅蟲）|

### EmptyState（無 pet）

- 140px 圓 + 漸層 brandTint → bgAlt
- 中央卡通 shiba avatar（旋轉 -6°）+ 右上小圓 + icon overlay
- 大字「還沒有寵物」+ 引導文案「新增第一隻寵物，開始追蹤散步、開銷與健康紀錄」
- 大 CTA「新增寵物」（gradient brand pill）
- 底部小字「之後可以隨時新增、編輯或切換」

### PetSwitcher dropdown

- Floating panel 從 pet header chevron-down 開
- List 各 pet：avatar 34 + name + breed/weight + active 打勾
- 底部「新增寵物」row（brandTint icon + brandDeep text）

## 完成標準

### 新元件（src/components/pets/）

- [ ] `pets-top-bar.tsx` — 「我的寵物」h1 + 「+ 寵物」pill button
- [ ] `pet-header.tsx` — avatar 64 + name 22pt 800 + 3 chip + pencil edit
  - **Avatar 改：用 `pet.photoURL`（既有 schema），若 undefined fallback：brand-tint 圓 + pet.name 第一字 + 小 paw icon overlay**
  - 多 pet 時 name 旁 chevron-down + onClick 開 PetSwitcher dropdown
- [ ] `pet-switcher-dropdown.tsx` — floating panel，列各 pet 含真照片，底部「新增寵物」row
  - Click outside / Esc 關閉
- [ ] `pet-tabs.tsx` — sticky pill 4-tab（概覽/提醒/開銷/健康），active = card bg + soft shadow + ease 200ms
- [ ] `pet-stat-tile.tsx` + `pet-stat-grid.tsx` — 2×2 grid 含 tinted icon + label + 大數字 + sub-text
- [ ] `pet-reminder-card.tsx` — 42×42 tinted icon + title + repeat chip + 到期 chip + 右側 check button
- [ ] `pet-expense-card.tsx` — 42×42 tinted icon + title + AI chip + date/payer + NT$ 數字（右）
- [ ] `pet-health-record-card.tsx` — 42×42 tinted icon + type label + title + date（右）+ dashed border 下方 detail + note
- [ ] `pet-expense-donut.tsx` — SVG donut chart 含 slices + 中央「本月合計 NT$ X」（直接 port prototype line 753-798）
- [ ] `pet-weight-trend-chart.tsx` — SVG line chart 含 area fill + circle markers + leafDeep stroke（直接 port prototype line 898-911）
- [ ] `pet-floating-add.tsx` — 56×56 圓，顏色隨 active tab 變：
  - overview / reminders: brand → brandDeep gradient
  - expenses: #ee9a5a → cookie gradient
  - health: #79c074 → leafDeep gradient
- [ ] `pets-empty-state.tsx` — 完整 hero 設計（替換既有 EmptyState 在 pets page 的位置；既有 EmptyState 元件不動，留給其他頁面用）

### 改既有頁

- [ ] `src/app/app/pets/page.tsx` — 整頁重建為 list view
  - TopBar + PetHeader（含 switcher）+ PetTabs + 概覽 tab body + FloatingAdd
  - URL state: `?tab=overview` 預設；switcher 切 pet 用 router.replace（不換頁，畫面 re-render）
  - 0 pets → render `<PetsEmptyState />`
- [ ] `src/app/app/pets/[petId]/page.tsx` — detail view
  - TopBar + PetHeader（含 chevron-down 切 pet）+ PetTabs + {tab body} + FloatingAdd
  - URL: `/app/pets/[petId]?tab=reminders|expenses|health`
  - tab 切換用 router.replace（保留 URL state）

### Schema 對齊

- [ ] `Pet.photoURL?: string` — **既有欄位**（不用新加；確認 src/lib/types.ts 已有）
  - 若不存在 fallback to brand-tint initial avatar
- [ ] 其他 schema **不動**（既有 Pet / Reminder / Expense / HealthRecord 結構）

### i18n（新 keys）

- [ ] `messages/zh-TW.json` + `messages/en.json` 加：
  - `PetsPage.title.list`（「我的寵物」/「My Pets」）
  - `PetsPage.title.detail`（「寵物資料」/「Pet Profile」）
  - `PetsPage.addPet`（「寵物」/「Add Pet」— button label after `+`）
  - `PetsPage.tabs.overview / reminders / expenses / health`（4 個 tab labels）
  - `PetsPage.overview.upcoming`（「即將到期」/「Upcoming」）
  - `PetsPage.overview.recentExpense`（「最近開銷」/「Recent Expense」）
  - `PetsPage.stat.nextReminder`（「下次提醒」/「Next reminder」）
  - `PetsPage.stat.monthSpend`（「本月開銷」/「This month」）
  - `PetsPage.stat.weight`（「體重」/「Weight」）
  - `PetsPage.stat.walkDays`（「散步天數」/「Walk days」）
  - `PetsPage.viewAll`（「全部」/「View all」）
  - `PetsPage.switcher.addPet`（「新增寵物」/「Add Pet」— in switcher dropdown）
  - `PetsPage.reminders.summary`（「本月 {total} 條 · 已完成 {done}」）
  - `PetsPage.reminders.sortHint`（「按到期時間排序」/「Sorted by due time」）
  - `PetsPage.expenses.monthTitle`（「{month}月開銷」）
  - `PetsPage.expenses.monthCompare`（「{sign}{pct}% 較上月」）
  - `PetsPage.expenses.byCategory`（「分類占比」/「By category」）
  - `PetsPage.health.weightTrend`（「體重趨勢」/「Weight trend」）
  - `PetsPage.health.weightTrend.range`（「近 6 個月」/「Last 6 months」）
  - `PetsPage.empty.title`（「還沒有寵物」）
  - `PetsPage.empty.body`（「新增第一隻寵物，開始追蹤散步、開銷與健康紀錄」）
  - `PetsPage.empty.cta`（「新增寵物」）
  - `PetsPage.empty.hint`（「之後可以隨時新增、編輯或切換」）

### 護欄

- [ ] 不動既有 Pet / Reminder / Expense / HealthRecord schema
- [ ] 不動既有 reminders / expenses / health firebase logic
- [ ] 不動 shared `Button` / `EmptyState` 元件（per-instance className override；新 `pets-empty-state.tsx` 不繼承 shared EmptyState 因為設計差異大）
- [ ] 不動 mango tokens（`globals.css`）— 跟 walks v2 同 family
- [ ] 不引入新 chart library（donut + line chart 全 hand-rolled SVG，1:1 port prototype）
- [ ] 不引入新 animation library
- [ ] Pet avatar 改 photoURL 真照片 — 既有寫真上傳邏輯不動，UI 只是改顯示
- [ ] Bottom nav 不動（Phase 0.5 已 ship，pets tab[1] active 自然由 router 處理）
- [ ] 不動 walks page / walk-tracking-view（Phase 1 v2 已 SHIPPED）
- [ ] 既有 `/app/pets/[petId]` 內 health records UI 是「概覽 + 提醒 + 開銷 + 健康」分散在 sections — 本 spec 改為 tab pattern，把既有 sections 升級成 tab content（IA reorg）

### 預驗收 checklist

- [ ] `npx tsc --noEmit` pass
- [ ] Chrome MCP iPhone (`/app/pets`)：
  - [ ] 單 pet：TopBar + PetHeader（真照片）+ PetTabs sticky + 概覽 grid + 即將到期 + 最近開銷 + FAB brand
  - [ ] 多 pet：PetHeader chevron-down → 點開 dropdown 含真照片各 pet + 「新增寵物」row
  - [ ] Switch pet → page re-render new pet 資料（URL state 換）
  - [ ] 點概覽以外的 tab → URL state 換 + body 換內容 + FAB 顏色變
  - [ ] 0 pets → render EmptyState 完整 hero
  - [ ] 各 tab body 都正確 render：提醒 list / 開銷 donut + cards / 健康 chart + records
  - [ ] sticky pill tabs scroll 時固定在頂部
- [ ] Chrome MCP iPhone (`/app/pets/[petId]`)：
  - [ ] URL `/app/pets/mango?tab=reminders` → 直接進 reminders tab
  - [ ] 各 tab body 正確 render
  - [ ] FAB 顏色對應 tab
- [ ] Chrome MCP desktop：layout 不破 + dial 對齊
- [ ] `prefers-reduced-motion` user：tab switch transition + chevron rotate 全停（prototype CSS media query 已 port）
- [ ] WCAG AA 對比：FAB 各 tone / brand-tint chip / tinted icon backgrounds 全過
- [ ] Lighthouse a11y on `/app/pets` ≥ 90
- [ ] commit message: `feat(design): Phase 2 v2 — pets 頁全頁結構重建（Variant B Tabbed + donut + 體重 chart）`
- [ ] Push to main → App Hosting auto-deploy → 5-8 min 後 user 在 production 驗收

## 不在 v2 範圍

- 真實 chart library 整合（donut + line chart 用 hand-rolled SVG）
- 多 pet sort / drag-to-reorder
- 動畫 swipe between tabs（tab switch 用 transition 即可）
- Pet detail 新增「家庭」tab（誰跟此 pet 互動）— 之後 spec
- Reminder / expense 編輯 inline（仍走既有 edit flow）
- Health 體重以外的 chart（疫苗 timeline / 驅蟲 frequency）
- Filter / search within tab
- Dark mode（Q18 跳過第一輪）
- Pet avatar upload / edit（用既有 pets edit flow）
- 多 pet 切換時的 page transition animation

## Edge cases

| Case | 處理 |
|---|---|
| Pet 沒 photoURL | Fallback：brand-tint 圓 64px + pet.name 第一字（白色 800 weight）+ 右下 paw icon 小 overlay |
| 0 reminders this month | 概覽「即將到期」section 顯示「目前無提醒」placeholder；提醒 tab 顯示 EmptyState「點 + 新增提醒」|
| 0 expenses this month | 概覽「最近開銷」section 顯示「本月還沒有開銷」placeholder；開銷 tab donut 不渲染，只顯示 EmptyState |
| 0 health records | 健康 tab 顯示 EmptyState「點 + 新增健康紀錄」；體重 chart 不渲染 |
| 體重 chart 資料 < 2 點 | Chart 不渲染，只顯示「資料不足，需 ≥ 2 次體重記錄」 |
| Tab switch URL state | 用 router.replace（不 push），避免 back button 跳過多 |
| Pet switcher dropdown click outside | onClick outside listener 自動關 + Esc 關 |
| 多 pet 但都是同名 | Switcher 顯示 name + breed 已可區分；photo 也幫助 |
| 圖片載入失敗 | next/image onError fallback → 同 0 photoURL 邏輯 |
| reduced-motion user | tab transition / chevron rotate / FAB hover 全停（spec line 982-985 對應 CSS media query 已 port）|
| 跨家庭 pets（multi-family user 未來）| 本 spec 不處理，當前 user.familyId 內 pets only |
| Pet detail 點 chevron 切 pet | router.push to `/app/pets/[newPetId]?tab=...`（保留當前 tab） |

## 跟其他 spec 的關聯

- **visual-redesign-mango.md (Phase 2)**：本 spec 是其 implementation；spec line 212-238 結構 1:1 對齊
- **walks-v2-rebuild.md (Phase 1 v2)**：palette / typography / bottom nav 共用，視覺風格 family；可 reuse `streak-chip` 元件邏輯思路（chip 風格相似）
- **photo-lightbox.md**：pets page 暫不接 photo lightbox（pet avatar 小尺寸；user 想看大圖去 pet edit page）；future 可加
- **walks-auto-photo-share.md**：無關聯
- **family-leaderboard-realtime.md**：無關聯
- **既有 `/app/pets/[petId]` health records UI**：本 spec 把既有 sections 升級成 tab content（IA reorg），不刪 health logic

## PM 觀察

工作量 L（最大 phase 之一）— 多個新元件 + 整頁重建 + multi-pet UX + 4 tab + donut + chart + EmptyState。**建議 UI/UX 1-2 個 session 完成**，拆 commit 建議：

1. `feat(pets): types + pet-header + pet-switcher 元件 + photoURL fallback`
2. `feat(pets): pet-tabs + pet-stat-grid + 概覽 tab body`
3. `feat(pets): pet-reminder-card + 提醒 tab body`
4. `feat(pets): pet-expense-card + expense-donut + 開銷 tab body`
5. `feat(pets): pet-health-record-card + weight-trend-chart + 健康 tab body`
6. `feat(pets): pets-empty-state + 整合 page.tsx + [petId]/page.tsx`
7. `feat(pets): floating-add tab-aware tone`
8. `chore(i18n): PetsPage.* keys (zh-TW + en)`

（或 user 自選合併）

Ship 後 Epic 4 進度：Phase 0 / 0.5 / 1 v2 / 2 v2 都 SHIPPED，剩 Phase 3 (onboarding + landing + sign-in) / Phase 4 (settings + leaderboard) / Phase 5 (drawer pages) / Phase 6 (polish)。

## UI/UX launch prompt（user 開 UI/UX session copy 用）

```
本 session 固定角色：UI/UX — 寫 production code 動 pets page 全頁結構重建 (Phase 2 v2)。
Repo: C:\Users\jabir\Hacker_J\mango_pet_app

⚠️ 必讀
- Spec: docs/features/pets-v2-rebuild.md（PM 寫好，含完整 6 artboard 變體 + 完成標準 + 護欄 + edge cases + i18n keys）
- Prototype: docs/design/pets-v2-prototype/
  - Pets redesign.html（demo 入口 — open in browser 看 6 個 artboard 全變體）
  - pets-screen.jsx（核心 React 元件 — 含 TopBar / PetHeader / PetSwitcher / PetTabs / StatGrid /
    ReminderCard / ExpenseCard / HealthRecord / ExpenseDonut / WeightTrendChart (在 HealthBody) /
    FloatingAdd / EmptyState / PetAvatar）— 你直接 port 這些元件邏輯
  - design-canvas.jsx + ios-frame.jsx（preview frame，不用拷到 production）
- 視覺風格參考（已 ship 在 production，要對齊）：
  - docs/design/walks-v2-prototype/walks-screen.jsx — 同 family 一致風格
  - src/components/walks/* — Phase 1 v2 已 ship 元件（streak-chip / walks-dial 等）
- 既有 design tokens: src/app/globals.css 的 @theme inline mango palette
- 既有 pets page: src/app/app/pets/page.tsx + src/app/app/pets/[petId]/page.tsx（你會重建）
- 既有 元件: src/components/family/family-section.tsx 等（不動）
- 既有 schema: src/lib/types.ts 的 Pet（含 photoURL? 既有欄位 — 確認後 wire 到 UI）
- 必讀 AGENTS.md：Next.js 16 + Tailwind v4

護欄
- 動 src/app/app/pets/page.tsx + src/app/app/pets/[petId]/page.tsx OK
- 動 src/components/pets/* OK（含新檔）
- 動 messages/zh-TW.json + messages/en.json 加 PetsPage.* keys OK
- 不動既有 Pet / Reminder / Expense / HealthRecord schema
- 不動既有 reminders / expenses / health firebase logic（src/lib/firebase/*）
- 不動 shared Button / EmptyState 元件
- 不動 mango tokens（globals.css）
- 不動 walks page / walk-tracking-view（Phase 1 v2 SHIPPED 視覺保留）
- 不動 bottom nav（Phase 0.5 SHIPPED）
- 不引入新 chart / animation library
- Pet avatar 用 user 上傳的真實照片（pet.photoURL）；無 fallback 顯示 brand-tint 圓 + name 第一字 + paw icon overlay

關鍵實作筆記
- PetAvatar 元件 **不要** 直接 port prototype 的 PetAvatar（卡通 SVG）；改寫成接 photoURL prop，用 next/image 顯示真照片，沒 photoURL fallback initial 邏輯
- ExpenseDonut SVG 從 prototype line 753-798 直接 port（hand-rolled SVG，no library）
- WeightTrendChart SVG 從 prototype HealthBody line 898-911 port
- FloatingAdd tab-aware tone 從 prototype line 574-593 port
- PetTabs sticky 用 position: sticky + top: 0 + gradient bg fade
- PetSwitcher click-outside detection 用 useEffect + ref
- URL state for tab + pet：useSearchParams + router.replace
- reduced-motion: prototype line 980-985 CSS injection 已寫，UI/UX 改為更乾淨的 component-scoped style or globals.css media query

實作順序
1. types check + helper fallback for avatar
2. 元件分批：top-bar / pet-header（含 photoURL fallback）/ pet-switcher
3. pet-tabs sticky + URL state hook
4. stat-grid + 概覽 tab body
5. reminder-card + 提醒 tab body
6. expense-card + expense-donut + 開銷 tab body
7. health-record-card + weight-trend-chart + 健康 tab body
8. floating-add tab-aware tone
9. pets-empty-state (0 pets case)
10. page.tsx + [petId]/page.tsx 整合
11. i18n keys 補
12. npx tsc --noEmit pass
13. dev server 跑 Chrome MCP 驗全 6 變體 + 0 pets state
14. commit 拆 8 個（或合併自選）
15. push origin main → App Hosting auto-deploy

預驗收（spec 內 checklist 跑完）
- 全 6 變體 render OK
- Pet 真照片顯示 + fallback 對
- URL state 對（tab + pet）
- Sticky tabs scroll 不破
- FAB 顏色隨 tab 變
- Donut + line chart render
- EmptyState 完整
- reduced-motion 全停動畫
- Lighthouse a11y 不掉

回報格式
- 每 commit hash + 1 行 review note
- 全部 ship 後 summary 給 PM 收尾 roadmap

開工。
```
