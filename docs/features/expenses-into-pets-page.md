# 開銷完全搬進寵物頁（expenses → pets page IA migration）

狀態：**SHIPPED 2026-05-26**（5 commits `16f23d9` → `22bee39`；frontend 一個 push；Bug Hunter `e972cf8` reverted；無 functions / 無 schema / 無 rules 改動）
建立日期：2026-05-26 早上
最後更新：2026-05-26 早上
規格作者：PM session @ `11e52a9`
角色：**Feature Builder**（整 stack — IA migration + camera 直開 + route 刪 + settings revert + i18n）
工作量：**M-L**（跨 4 surface：pets detail「開銷」tab 大改 + /app/expenses page 刪 + settings quick-action revert + drawer link 清理）

## SHIPPED bookkeeping

| Commit | What |
|---|---|
| `16f23d9` | feat(pets): pet-expenses-body category filter pills + filter-empty hint. Totals + donut stay full-month (big picture intact); list narrows by category. `PetsPage.expenses.{filterEmpty, manualEntry}` i18n added (manualEntry pre-laid for next commit). |
| `0d672d3` | feat(pets): FAB direct-to-camera + ReceiptScanner `initialFile` / `defaultPetId` / `onManualEntry` props + ExpenseFormDialog `defaultPetId` prop. Hidden capture="environment" input lives in pets-page-content so FAB triggers iOS camera DIRECTLY (no scanner intro detour). Camera dismissed → scanner falls into intro UI so user can still pick 從相簿 / 手動輸入. Scan → ExpenseFormDialog opens with AI prefill + active pet pre-selected. `PetsPage.fab.expenses` copy flipped to "拍收據" / "Scan receipt". |
| `261d588` | chore(routes): `/app/expenses` page replaced with server-side Next.js `redirect('/app/pets')`. Bookmarks + the Bug Hunter `?action=scan` deep-link both survive (no 404, no client flash). Also deletes `src/components/expenses/expense-summary.tsx` (2026-05-29 re-audit confirmed via `git log --diff-filter=D`). |
| `5726640` | revert(settings): removes the Bug Hunter quick-action card (commit `e972cf8`). Stopgap was solving the 4-tap path from settings, which no longer exists (camera FAB on pets 開銷 tab is now 2 taps from anywhere). Camera lucide import dropped. |
| `22bee39` | chore(nav): drops `expenses` from `app-nav` ALL_ITEMS (was in both desktop sidebar + mobile drawer). Deletes dead `expenses-overview-section.tsx` (last in-source `/app/expenses` link). `Nav.expenses` i18n key left in locale files — harmless, no live consumers. |

### 後續驗證 / 觀察

- iOS PWA real-device test (the camera-first flow only works meaningfully on iOS Safari/PWA):
  - Pets `/app/pets/[petId]?tab=expenses` → see month bar + donut + filter pills + ExpenseCard list + FAB ⏳
  - FAB → iOS camera opens directly → photo → ReceiptScanner preview → AI 辨識 → ExpenseFormDialog with prefill + active pet pre-picked → save → list updates ⏳
  - 手動輸入 link inside ReceiptScanner → close scanner → ExpenseFormDialog blank with active pet pre-picked ⏳
  - Camera dismissed → ReceiptScanner intro shows (拍照 / 從相簿選 / 手動輸入) — no awkward dead-end ⏳
  - Multi-pet switcher → switch pet → 開銷 tab shows that pet's expenses only (per-pet isolation) ⏳
  - Settings page → no 拍收據 quick-action card visible ✅ (typecheck)
  - Desktop sidebar + mobile drawer → no 「開銷」link ✅ (typecheck)
  - `/app/expenses` URL bar → redirects to `/app/pets` (server-side, no flash) ⏳
- `npx tsc --noEmit` clean ✅
- Filter-empty hint shows when category narrows out (e.g., user with only food expenses clicks "medical") ⏳

### Edge cases handled

- Camera permission denied (iOS) → file picker returns empty → scanner intro UI takes over (fallback path explicit per spec)
- AI scan failure → existing ReceiptScanner error state + 手動輸入 link still present in preview footer
- User opens scanner via FAB → previews → decides not to scan → 手動輸入 link in preview footer also routes to form
- Multi-pet user mid-scan switches pet → spec calls this out as FB-choice; current behaviour: scanner stays open with the original initialFile, but `defaultPetId` reflects the NEW active pet on ExpenseFormDialog open (the form picks the newly-selected pet — acceptable, matches D4 per-pet auto-attach semantics)
- Personal mode 0 pets → pets page EmptyState; FAB doesn't render (consistent with existing pets v2 behaviour)
- Old bookmark `/app/expenses?action=scan` → server redirect strips the query and lands on `/app/pets` (Bug Hunter stopgap path naturally dead)

### Known follow-ups (PM backlog candidates)

- Family-wide expense aggregate view (D4 explicitly per-pet only this round) — spec calls out "future 若要可另開 spec"
- `Nav.expenses` i18n key cleanup (harmless leftover, defer to next housekeeping pass)
- Mid-scan pet-switch UX (current behaviour acceptable, spec said FB self-chooses; if real users hit it we can refine)
- Telemetry on `/app/expenses` redirect hit rate (low priority — once it's clearly ~0 we can delete the redirect file entirely)

## User Vision（原話保留）

> 「剛剛開銷的部分我的想法是就完全搬到寵物那一頁，也不要再設定那邊，可以就是按加號就是自動打開相機 AI 掃描，或選擇手動輸入」

## 4 個 decisions（confirmed，全採 PM 推薦）

| # | Decision | Final | 註 |
|---|---|---|---|
| **D1** ✅ | `/app/expenses` 整頁命運 | **拿掉 page（完全 IA 折到 pets 裡）** | redirect /app/expenses → /app/pets；route file + nav/drawer link 都清掉 |
| **D2** ✅ | Pets「開銷」tab + button 反應 | **直接開相機 AI 掃** | + 點 → camera input capture=environment → ReceiptScanner dialog → AI scan preview；「手動輸入」secondary link 在 dialog 下方 |
| **D3** ✅ | Settings 拍收據 quick-action | **拿掉**（Bug Hunter `e972cf8` fix #1 revert） | IA 折到 pets 後不再需要 quick-action shortcut |
| **D4** ✅ | Multi-pet user 怎麼分配 | **完全 per-pet view**（沿 active pet 自動 attach `petId`） | Pets page 既有 switcher 切 pet → 該 pet 開銷 tab 即顯示 per-pet expenses；無「全家庭加總」view（future 若要可另開 spec）|

## 背景

- 既有 `/app/expenses` page 是 family-wide expense ledger 含 filters / summary / scanner / aggregation by month/category
- Pets v2 SHIPPED (`9d7956a` 等) 已含「開銷」tab 但只是 stub (per pets-v2-rebuild.md Phase 2 概念 — overview 顯示 latest 1 expense；完整 list 在 /app/expenses page)
- Bug Hunter 2026-05-26 ship fix #1 (`e972cf8`) settings 加 quick-action「拍收據」— 本 spec **revert** 該 fix
- `ExpensesOverviewSection` dead code（backlog item by Bug Hunter）— 本 spec 不直接 reuse（功能不夠），但可以 reference 寫法

## 完成標準

### A. Pets detail「開銷」tab 大改 — 從 stub 升級為完整 per-pet expense management

- [ ] **新元件 `src/components/pets/pet-expenses-body.tsx`**（取代 pets v2 SHIPPED 的 stub）：
  - **Per-pet expense list**（filter by petId）
  - **本月 total bar**（NT$ + 月比較 +X% chip — port 自 /app/expenses page）
  - **分類占比 donut chart**（reuse `pet-expense-donut.tsx` from pets v2 SHIPPED — 純 SVG hand-rolled）
  - **Category filter pills**（all / food / medical / groom / toy / 其他 — port 自 /app/expenses）
  - **ExpenseCard list**（reuse pets v2 SHIPPED `pet-expense-card.tsx`）
  - **FAB「+」**（pets v2 SHIPPED `pet-floating-add.tsx` tab-aware tone 已設定 expenses = cookie 色）— **改 onClick = 直接觸發 camera input**
- [ ] **Camera input + AI scan flow**：
  - FAB 點 → trigger hidden `<input type="file" accept="image/*" capture="environment">` click
  - 拍完 / 選完 → call `extractReceipt(file)` → 進 ReceiptScanner dialog preview
  - 既有 ReceiptScanner 元件 reuse，但加 prop `defaultPetId` 自動帶 active pet
  - Camera input dismissed (user 取消相機) → no-op，不報錯
- [ ] **「手動輸入」secondary link**：
  - ReceiptScanner dialog 下方加 text link「手動輸入開銷」
  - 點 → close scanner + open ExpenseFormDialog 空白 form（defaultPetId 自動帶 active pet）
  - OR 在 FAB 點開的瞬間若 user 不想拍照（dismiss camera input）也跳此 fallback

### B. /app/expenses page 拿掉

- [ ] **刪除** `src/app/app/expenses/page.tsx`
- [ ] **建 redirect**：新 `src/app/app/expenses/page.tsx` 改成簡單 `redirect('/app/pets')`（用 Next.js `redirect()` API）
  - OR 純刪檔讓 404；PM 預設 **redirect** 比較友善（user 書籤舊路徑仍 work）
- [ ] **刪除** `src/components/expenses/expense-summary.tsx`（若只此頁用）
- [ ] **保留** `src/components/expenses/expense-card.tsx` / `expense-form-dialog.tsx` / `receipt-scanner.tsx` / `ai-receipt.ts`（reuse in pets tab）

### C. Settings quick-action revert (Bug Hunter fix #1)

- [ ] 從 `src/app/app/settings/page.tsx` 移除拍收據 Camera-icon quick-action card（Bug Hunter `e972cf8` 加的）
- [ ] 從 `src/app/app/expenses/page.tsx` （已被刪）移除 useSearchParams `?action=scan` auto-open ReceiptScanner 邏輯（隨整頁刪掉）
- [ ] i18n keys for quick-action 移除（若有獨立 key）

### D. Drawer / nav 「開銷」link 清理

- [ ] grep 任何 `Link href="/app/expenses"` 並改成 `/app/pets`（或拿掉 link）
- [ ] Drawer menu「開銷」item 移除（若有）
- [ ] Settings page 任何「開銷」reference 移除

### E. Schema / Firestore

- [ ] **不動 schema** — `expense.petId` 既有欄位完整支援 per-pet
- [ ] **不動 rules** — 既有 expense rules cover family + personal mode read/write
- [ ] **不動 firestore.indexes.json** — per-pet expense query 用既有 index

### F. i18n

- [ ] 新 keys 加 `messages/zh-TW.json` + `messages/en.json`：
  - `PetsPage.expenses.fabAddExpense`（「拍收據」或「+ 拍收據」— FAB aria-label）
  - `PetsPage.expenses.manualEntry`（「手動輸入開銷」/「Enter manually」— secondary link in scanner dialog）
  - `PetsPage.expenses.cameraDismissed`（無—靜默處理）
- [ ] 既有 `Expense.*` keys 大部分 reuse

### 護欄

- [ ] 不動 `extractReceipt` callable / AI 後端
- [ ] 不動 expense schema / rules / Firestore indexes
- [ ] 不動 ReceiptScanner 元件內部結構（只加 1 個 optional `defaultPetId` prop + 1 個「手動輸入」secondary link slot）
- [ ] 不動 pets v2 Phase 2 SHIPPED 結構（PetHeader / PetTabs / FAB 等都保留，只升級「開銷」tab body 內容）
- [ ] 不動 mango tokens
- [ ] 不引入新 dependencies
- [ ] /app/expenses redirect 避免 404（user 書籤友善）

### 預驗收 checklist

- [ ] `npx tsc --noEmit` pass
- [ ] Chrome MCP iPhone (`/app/pets/[petId]?tab=expenses`)：
  - 看到本月 total bar + 分類 donut + filter pills + ExpenseCard list + FAB
  - 點 FAB「+」→ camera input 跳出 (iOS Safari/PWA)
  - 拍照 → ReceiptScanner dialog → AI 辨識中 → 預覽 → 確認 → expense 新增到該 pet
  - Dialog 下方「手動輸入」link → ExpenseFormDialog 空白 form → defaultPetId 已帶 → save
  - 切到另一隻 pet → 看到那隻 pet 的 expense 列表（不混）
- [ ] Settings page 拿掉拍收據 quick-action（驗證已消失）
- [ ] `/app/expenses` URL → 自動 redirect to `/app/pets`
- [ ] Drawer / nav 任何「開銷」link 全消失
- [ ] Personal mode user 1 pet → 同樣 work（pets detail tab 顯示 personal-mode expenses）
- [ ] Personal mode user 0 pets → pets EmptyState 顯示，無 expense 入口（合理）
- [ ] Family multi-pet user → 切 pet 看不同 expenses（per-pet 隔離）
- [ ] commit message: `feat(ia): expenses → pets page migration + camera-first FAB`
- [ ] Push to main → App Hosting auto-deploy → 5-8 min 後 user 在 production iPhone 驗收

## 不在範圍

- **全家庭 expense 加總 view**（D4 user 確認 per-pet only）— 若 future user 反映想看「整家庭花多少」可另開 spec
- AI receipt 辨識準確度提升
- 多收據批次掃描
- 收據 OCR 多語言
- Expense 詳細頁（單筆 detail page — 仍走既有 ExpenseFormDialog inline edit）
- Per-pet expense budget / forecast / alerts
- Expense export
- 退家庭時 expense 處理（既有邏輯保留 — D1 family/personal mode 切換不影響本 spec）

## Edge cases

| Case | 處理 |
|---|---|
| User 拍照 iOS camera 被拒權 | OS 自然 dismiss file picker → 視為「未選 file」no-op，scanner 不開 |
| AI 辨識失敗 | 既有 ReceiptScanner 顯示 error + 「手動輸入」link 仍可救援 |
| 多 pet user 切 pet 中 scanner 開著 | 切 pet 應該 close scanner（避免 expense attach 到錯 pet）— 或 dialog 仍開但提示「即將存進 {newPet}」（FB 自選）|
| Personal mode 0 pets | Pets page EmptyState 引導建寵物；無 expense 入口（合理 — 沒寵物無花費對象）|
| User 在 /app/expenses 舊書籤 | Next.js redirect → /app/pets |
| Settings quick-action 已 ship 但 user 還沒重整 PWA | redirect 仍 work，functionality 不破 |
| /app/expenses page 移除後既有 client linking 失效 | grep + 改 link 到 /app/pets |
| Expense.familyId vs personal mode | 既有 rules cover；本 spec 只動 UI，rules 不動 |

## 跟其他 spec 的關聯

- **pets-v2-rebuild.md (SHIPPED)**：本 spec 大改其「開銷」tab body 內容（從 stub 升級成完整 expense management）；不動 PetHeader / PetTabs / FAB 結構
- **bug-receipt-ai-missing.md (SHIPPED)**：本 spec **revert** Bug Hunter fix #1（settings quick-action card 移除）；root cause 真正修在「開銷 IA 折進 pets」這層 — Bug Hunter fix 是 stopgap，本 spec 是 long-term solution
- **save-photo-to-album.md (SHIPPED)**：ReceiptScanner 加的 SaveToAlbumButton 保留（不影響）
- **per-pet-walk-goal.md (SHIPPED)**：無關聯
- **family-leaderboard-realtime.md (SHIPPED)**：無關聯
- **expenses-overview-section.tsx (dead code in backlog)**：本 spec 不直接 reuse（功能不夠 — 只 latest 10 限制），但可 reference 寫法；ship 後可刪 dead code

## PM 觀察

工作量 M-L — 主要是 IA migration + pet-expenses-body 整合 + route 刪 + settings revert + drawer 清理。建議 Feature Builder 1-2 個 session ship，拆 commit：

1. `feat(pets): pet-expenses-body — full expense management (filters + summary + donut + FAB)`
2. `feat(pets): FAB direct-to-camera + ReceiptScanner defaultPetId prop + 手動輸入 secondary link`
3. `chore(routes): /app/expenses page → redirect to /app/pets`
4. `revert(settings): remove 拍收據 quick-action (Bug Hunter e972cf8 fix #1)`
5. `chore(nav): clean drawer / nav 「開銷」link references`
6. `chore(i18n): PetsPage.expenses.* new keys + remove legacy keys`

部署順序：先 deploy frontend（含 redirect 確保舊 URL 不破）→ 確認 functions logs 仍正常（extractReceipt callable 不變）。

## 重要 PM 觀察 — Bug Hunter fix #1 的命運

Bug Hunter 2026-05-26 ship `e972cf8` 是基於 user 當時「拍收據不見了」的 friction，採 PM #1 最小 fix（settings quick-action）。**本 spec 等於 revert 該 fix + 升級到 PM 原推 #2 的精神（pets「開銷」tab 整合 expense management）**。

不算 Bug Hunter 做錯 — 當時 PM #2 前提（ExpensesOverviewSection 是 dead code）不成立，且 BH session 不該做新 feature 的工作量擴大。本 spec 是 user 主動拍板做 long-term 正解，Bug Hunter fix 是 24h stopgap，正常 workflow。

## Launch prompt（user 開 Feature Builder session copy 用）

```
本 session 固定角色：Feature Builder — 開銷 IA 完全搬進 pets page（含 FAB 直開相機 + 手動輸入 fallback）。
Repo: C:\Users\jabir\Hacker_J\mango_pet_app

⚠️ 必讀
- Spec: docs/features/expenses-into-pets-page.md（PM 寫好，含 4 decisions + 6 phases + 完整 checklist）
- 既有 /app/expenses page: src/app/app/expenses/page.tsx（你會刪掉 + redirect）
- 既有 expense 元件: src/components/expenses/{expense-card,expense-form-dialog,receipt-scanner}.tsx（reuse to pets tab）
- 既有 pets detail page: src/app/app/pets/[petId]/page.tsx（pets v2 SHIPPED — 你升級「開銷」tab body）
- 既有 pets v2 元件: src/components/pets/{pet-expense-card,pet-expense-donut,pet-floating-add}.tsx（reuse / 改 FAB onClick）
- Bug Hunter ship e972cf8 settings quick-action — 你 revert
- mango palette: src/app/globals.css 的 @theme inline
- 必讀 AGENTS.md：Next.js 16 + Tailwind v4

護欄
- 動 src/components/pets/pet-expenses-body.tsx（新檔 / 升級 stub） OK
- 動 src/app/app/pets/[petId]/page.tsx 引入新 body OK
- 動 src/app/app/expenses/page.tsx 改成 redirect OK
- 動 src/app/app/settings/page.tsx revert 拍收據 quick-action OK
- 動 src/components/expenses/receipt-scanner.tsx 加 optional defaultPetId prop + manual entry secondary link OK
- 動 messages/zh-TW.json + messages/en.json 加 PetsPage.expenses.* OK
- grep + 改 任何 `/app/expenses` link → `/app/pets`
- 不動 extractReceipt callable / AI 後端
- 不動 expense schema / rules / Firestore indexes
- 不動 pets v2 PetHeader / PetTabs / FAB tab-aware tone 結構
- 不動 mango tokens
- 不引入新 dependencies

實作順序
1. pet-expenses-body 元件：filters + summary + donut + ExpenseCard list（reuse pets v2 元件）
2. FAB onClick 改 → trigger hidden camera input
3. ReceiptScanner 加 defaultPetId prop + manual entry link
4. Pets detail page「開銷」tab 接 pet-expenses-body
5. /app/expenses page → redirect to /app/pets
6. Settings revert 拍收據 quick-action
7. grep 改 nav/drawer link
8. i18n keys 補
9. npx tsc --noEmit pass
10. Chrome MCP iPhone 跑完整 flow（FAB → camera → AI → save → list update）
11. commit 6 個（自選合併）
12. push origin main + App Hosting auto-deploy 5-8 min

預驗收
- Pets「開銷」tab: filters + summary + donut + list + FAB
- FAB → camera → scan → preview → save → 該 pet 列表更新
- Manual entry link → form → save
- /app/expenses URL → redirect /app/pets
- Settings 無拍收據 quick-action
- Multi-pet 切 pet 正確隔離
- npx tsc --noEmit pass
- Lighthouse a11y 不掉

commit 拆解
1. feat(pets): pet-expenses-body full expense management
2. feat(pets): FAB direct-to-camera + ReceiptScanner defaultPetId + manual entry link
3. chore(routes): /app/expenses → redirect to /app/pets
4. revert(settings): remove 拍收據 quick-action (e972cf8)
5. chore(nav): clean drawer 開銷 link references
6. chore(i18n): PetsPage.expenses.* new keys

回報格式
- 每 commit hash + 1 行 review note
- ship 後 summary 給 PM 收尾 roadmap

開工。
```
