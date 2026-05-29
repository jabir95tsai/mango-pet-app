# Pre-iOS Cleanup — audit 清理（monorepo migration 前）

狀態：**RESOLVED 2026-05-29 audit sync**（re-audit 確認原列 4 個刪除目標目前皆不存在；本輪只補 `.gitignore` 防 `__pycache__/` 再進工作區）
建立日期：2026-05-28
最後更新：2026-05-29 PM audit sync
規格作者：PM session @ `fa1d39c` + general-purpose audit agent
角色：**Bug Hunter**（純刪除 dead code / orphan + build 驗證；無新 feature）
工作量：**S**（全是刪除 + 1 次 build verify）

## 為什麼

iOS pivot 第一步是 monorepo migration（src/ 搬到 apps/web/）。搬之前要把垃圾清掉，否則把 dead code / orphan / junk 一起帶進 monorepo，污染新結構 + 可能破本地 build。

PM audit（general-purpose agent + PM 驗證）曾發現以下 discrepancies。2026-05-29 re-audit 顯示原列 local orphan / junk 在此工作區已不存在，tracked dead code 也已由既有 commits 刪除；本檔保留為 iOS pivot 前的 audit trail。

## Re-audit 結論（PM 2026-05-29）

- ✅ `src/app/app/knowledge/[id]/page.tsx` 不存在；目前 knowledge route 只有 `page.tsx` + `[articleId]/page.tsx`，沒有 dynamic segment conflict。
- ✅ `src/components/walks/__pycache__/` 不存在。
- ✅ `src/components/expenses/expense-summary.tsx` 不存在；`261d588` 確認為 delete commit。
- ✅ `src/components/expenses/expenses-overview-section.tsx` 不存在；`22bee39` 確認為 delete commit。
- ✅ `docs/features/*` 內明顯 stale 的 `READY-FOR-DEV` headers 已同步為 SHIPPED / SUPERSEDED / PARTIAL SHIPPED。
- ✅ `.gitignore` 已補 `__pycache__/`，避免工具誤建 Python cache 後污染工作區。
- ✅ `npx tsc --noEmit` pass（2026-05-29 PM audit sync）。
- ✅ `npm run build` pass after network-enabled retry（2026-05-29 PM audit sync）；routes include `/app/knowledge/[articleId]` only, so the dynamic route conflict is gone.

## Audit 發現（PM 2026-05-28）

### 🔀 Route conflict（本地 build breaker）

- `src/app/app/knowledge/[id]/page.tsx` — **historical local untracked 孤兒 observation**
  - 2026-05-29 re-audit：此檔不在目前工作區，也沒有被 git 追蹤。
  - 目前 canonical route 是 `src/app/app/knowledge/[articleId]/page.tsx`。
  - 若未來 local build 再出現 "different slug names for the same dynamic path"，先檢查是否又有未追蹤 `[id]` / `[slug]` route 被工具復活。

### 🗑 Junk

- `src/components/walks/__pycache__/` — historical local untracked Python cache；2026-05-29 re-audit 已不存在，並已補 `.gitignore`。

### 🪦 Dead code（tracked，0 import）

- `src/components/expenses/expense-summary.tsx` — 2026-05-29 re-audit：已由 `261d588` 刪除。
- `src/components/expenses/expenses-overview-section.tsx` — 2026-05-29 re-audit：已由 `22bee39` 刪除。

### 📄 Doc drift（PM 已修，無需 Bug Hunter 動）

- ✅ reminders-to-pets-page.md：READY-FOR-DEV → SUPERSEDED（功能分散 ship）
- ✅ visual-redesign-mango.md：READY-FOR-DEV → PARTIAL SHIPPED reconcile
- ✅ bug-receipt-ai-missing.md：標 fix #1 已 obsoleted by expenses migration
- ✅ expenses-into-pets-page.md：更正 expense-summary 假刪除聲稱

## 完成標準（Bug Hunter 執行）

- [x] 確認 `src/app/app/knowledge/[id]/page.tsx` 不存在。
- [x] 確認 `src/components/walks/__pycache__/` 不存在。
- [x] 確認 `src/components/expenses/expense-summary.tsx` 不存在（`261d588`）。
- [x] 確認 `src/components/expenses/expenses-overview-section.tsx` 不存在（`22bee39`）。
- [x] `.gitignore` 加 `__pycache__/`（防止再被誤建 commit）。
- [x] **工程驗證**：`npx tsc --noEmit` pass（2026-05-29）。
- [x] **工程驗證**：`npm run build` pass（2026-05-29；first sandbox run failed on Google Fonts network, network-enabled retry passed）。
- [x] grep 確認已刪目標只剩 docs 歷史文字，無 src import。

## 護欄

- 純刪除 + .gitignore + build verify，**不改任何 live feature code**
- 刪前每個檔 grep 確認 0 import（避免誤刪 live code）
- 不動 specs（PM 已修 doc-side）
- 不動 functions / rules / indexes
- 若刪除後 tsc / build 報錯 → 該檔其實有 import，停手回報 PM

## 不在範圍

- Monorepo migration（iOS P0 第一步，本 cleanup 之後才做）
- 任何新 feature / refactor
- 其他 spec 的 follow-up（per-pet push / breed goal 等 — 各自 backlog）

## Launch prompt（user 開 Bug Hunter session copy 用）

```
本 session 固定角色：Bug Hunter — pre-iOS final verification，確認 cleanup 後 build 乾淨。
Repo: C:\Users\jabir\Hacker_J\mango_pet_app

⚠️ 必讀
- Spec: docs/features/pre-ios-cleanup.md（PM audit 後寫好，含 4 個刪除目標 + 驗證步驟）
- 這是 monorepo migration 前的清理；純刪除，不改 live feature

任務（按順序）
1. 確認以下路徑不存在：
   - src/app/app/knowledge/[id]/page.tsx
   - src/components/walks/__pycache__/
   - src/components/expenses/expense-summary.tsx
   - src/components/expenses/expenses-overview-section.tsx
2. 確認 .gitignore 含 __pycache__/
3. npx tsc --noEmit pass
4. npm run build (or next build) pass — 確認 knowledge route conflict 消失
5. 若有任何失敗，回報 PM / iOS PM；不要順手 refactor

護欄
- 純刪除 + .gitignore + build verify
- 刪前每檔 grep 0 import 雙確認
- 若刪後 tsc/build 報錯 = 該檔有 import，停手回報 PM
- 不動 specs / functions / rules / indexes

回報
- 4 個不存在確認 + tsc + build 結果
```
