# Pre-iOS Cleanup — audit 清理（monorepo migration 前）

狀態：**GO**（PM 2026-05-28 iOS pre-pivot audit 後開）
建立日期：2026-05-28
規格作者：PM session @ `fa1d39c` + general-purpose audit agent
角色：**Bug Hunter**（純刪除 dead code / orphan + build 驗證；無新 feature）
工作量：**S**（全是刪除 + 1 次 build verify）

## 為什麼

iOS pivot 第一步是 monorepo migration（src/ 搬到 apps/web/）。搬之前要把垃圾清掉，否則把 dead code / orphan / junk 一起帶進 monorepo，污染新結構 + 可能破本地 build。

PM audit（general-purpose agent + PM 驗證）發現以下 discrepancies。

## Audit 發現（PM 2026-05-28）

### 🔀 Route conflict（本地 build breaker）

- `src/app/app/knowledge/[id]/page.tsx` — **local untracked 孤兒**（git status `??`）
  - git 史：`2d9f1e8 ui(knowledge): swap [id] dynamic route to [slug]` 已正確 **D (delete)** 此檔，production 乾淨
  - 但某 session 在本地把它復活（沒 commit）→ 跟 `[slug]/page.tsx` 同層兩個 dynamic segment
  - Next.js error: "You cannot use different slug names for the same dynamic path"
  - **只 break 本地 `next dev` / `next build`；production 沒事**（remote 沒這檔）

### 🗑 Junk

- `src/components/walks/__pycache__/` — **local untracked** Python cache 資料夾誤建在 TS 元件夾（某工具跑 Python 留下）

### 🪦 Dead code（tracked，0 import）

- `src/components/expenses/expense-summary.tsx` — 0 外部 import
  - `261d588` commit message 聲稱已刪，**實際沒刪**（spec 已更正）
- `src/components/expenses/expenses-overview-section.tsx` — 0 外部 import
  - 早期 reminders-to-pets-page IA reorg 留下的 orphan（backlog 已有條目）

### 📄 Doc drift（PM 已修，無需 Bug Hunter 動）

- ✅ reminders-to-pets-page.md：READY-FOR-DEV → SUPERSEDED（功能分散 ship）
- ✅ visual-redesign-mango.md：READY-FOR-DEV → PARTIAL SHIPPED reconcile
- ✅ bug-receipt-ai-missing.md：標 fix #1 已 obsoleted by expenses migration
- ✅ expenses-into-pets-page.md：更正 expense-summary 假刪除聲稱

## 完成標準（Bug Hunter 執行）

- [ ] 刪 `src/app/app/knowledge/[id]/page.tsx`（untracked orphan）
- [ ] 刪 `src/components/walks/__pycache__/`（untracked junk）
- [ ] `git rm src/components/expenses/expense-summary.tsx`（tracked dead code）
- [ ] `git rm src/components/expenses/expenses-overview-section.tsx`（tracked dead code）
- [ ] `.gitignore` 加 `__pycache__/`（防止再被誤建 commit）
- [ ] **驗證**：`npx tsc --noEmit` pass（確認刪除沒漏 import）
- [ ] **驗證**：`npm run build`（或 next build）pass — 特別確認 knowledge route conflict 消失
- [ ] grep 確認刪掉的 4 個檔真的 0 import（雙保險）
- [ ] commit message: `chore(cleanup): pre-iOS audit — remove dead code + orphan routes`
- [ ] push origin main → App Hosting build 全綠

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
本 session 固定角色：Bug Hunter — pre-iOS cleanup，刪 dead code + orphan + junk + build 驗證。
Repo: C:\Users\jabir\Hacker_J\mango_pet_app

⚠️ 必讀
- Spec: docs/features/pre-ios-cleanup.md（PM audit 後寫好，含 4 個刪除目標 + 驗證步驟）
- 這是 monorepo migration 前的清理；純刪除，不改 live feature

任務（按順序）
1. 刪 untracked orphan: src/app/app/knowledge/[id]/page.tsx
   （git 史已刪除過，本地復活的孤兒；跟 [slug] 衝突 break 本地 build）
2. 刪 untracked junk: src/components/walks/__pycache__/
3. 刪前 grep 確認 0 import:
   - src/components/expenses/expense-summary.tsx
   - src/components/expenses/expenses-overview-section.tsx
   兩個都確認 0 外部 import 後 git rm
4. .gitignore 加 __pycache__/
5. npx tsc --noEmit pass
6. npm run build (or next build) pass — 確認 knowledge route conflict 消失
7. commit: chore(cleanup): pre-iOS audit — remove dead code + orphan routes
8. push origin main + verify App Hosting build 全綠

護欄
- 純刪除 + .gitignore + build verify
- 刪前每檔 grep 0 import 雙確認
- 若刪後 tsc/build 報錯 = 該檔有 import，停手回報 PM
- 不動 specs / functions / rules / indexes

回報
- 4 個刪除確認 + tsc + build 結果 + commit hash
```
