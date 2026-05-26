# 🐛 拍收據 AI 自動辨識功能不見了（regression hunt）

狀態：**✅ SHIPPED 2026-05-26**（Bug Hunter session — fix #1 settings quick-action ship `e972cf8`）
建立日期：2026-05-25 傍晚
最後更新：2026-05-26
規格作者：PM session @ `efa52a1`
角色：**Bug Hunter**（live reproduce + root cause + fix or 升級 spec）
工作量：**S**（純調查；若是 IA 入口問題，加 1 個 link / 移 button 即可）

## SHIPPED bookkeeping

Bug Hunter session 2026-05-26 走完 launch prompt 4 步：

- **Step 1 reproduce 結果**：root cause 鎖定 = mobile bottom-nav reorg (2026-05-23 `e34640a`) 拿掉「開銷」slot，drawer trigger 又被搬到 settings 頁右上角 = AI 拍收據 變成 4-tap 路徑（settings→更多 icon→drawer→開銷→拍收據）。Pets page 完全沒 expense 入口 — `ExpensesOverviewSection` 是 dead code（grep src/ 整個 codebase 只 self-reference、從未 import）。原 2026-05-23 backlog 條目 line 199-205 PM 已預警此 surface UX 風險，user 回報恰好證實預測。
- **Step 2 reachability 驗**：`/app/expenses` 直達 URL render 正常；點 [拍收據] CTA → ReceiptScanner Dialog 開啟、z-60 不被遮、標題 + 副文 + [拍照] [從相簿選] 全 render。**邏輯層 100% intact**。
- **Step 3 functions log**：skip（dialog 都開、callable wire-up 在 source code 完整、bug 純 IA 層、無 invocation 失敗線索價值）。
- **Step 4 fix**：選 PM #1（最小、不破 IA）。PM #2「pets 開銷 tab FAB」前提**不成立** — `ExpensesOverviewSection` 沒被任何頁 mount，要做 #2 等於先新建 mount 點 + 加 FAB = 工作量從 S 升 L，且 BH session 不該做新 feature。

### Commits

| Commit | What |
|---|---|
| `e972cf8` | fix(settings): 拍收據 quick-action — restore 1-tap path after nav reorg. 2 files：(a) settings page 帳號區下方加 Camera-icon quick-action card → `/app/expenses?action=scan`；(b) expenses page 加 `useSearchParams` + ref-guarded `useEffect` 等 pets 載完自動開 `setScannerOpen(true)`。 Ref guard 保證關 dialog 不重彈；full page reload 仍重彈（intended deep-link 行為）。 |

### Production verification

App Hosting build ~6.5 min（attempt 5 at 08:48:49 needle「一拍就辨識金額」found in chunk `_next/static/chunks/1143t1a2zksbj.js`）。Chrome MCP 走完：

- ✅ `/app/settings` render → 帳號區下方出現新 quick-action card（Camera icon + 「拍收據 AI 自動記帳」+ 「一拍就辨識金額、商家、類別」+ → arrow）
- ✅ 點 card → URL → `/app/expenses?action=scan` + ReceiptScanner Dialog **自動開啟**（user 沒點任何東西）
- ✅ 點 X 關 dialog → URL 仍 `?action=scan`、dialog 不重彈（ref guard work）+ page 正常 render 開銷列表 + 圓餅圖
- ✅ 原 expenses 頁的橘色「拍收據」CTA 仍在背景，無 regression

User 路徑：**4 tap → 2 tap**（settings→quick-action card→scanner 自動開）。

### 後續觀察 / 給 PM

- 修是 minimal patch；長期 IA 仍可考慮 PM #2 / #3 / #4 任一（pets overview / walks secondary CTA / bottom-nav reorg）— 但這條 OPEN BUG 已關，後續優化進 roadmap 排序
- `ExpensesOverviewSection` 死碼觀察寫進 backlog 給 PM 決定 (a) 刪除 dead code or (b) 終於 mount 到 pets page

## User Vision（原話保留）

> 「拍收據 AI 自動辨識的功能不見了」

## PM 初步 recon（給 Bug Hunter 起點）

### 代碼仍在

- `src/components/expenses/receipt-scanner.tsx` — **完整保留**：拍照 + 從相簿選 + AI 辨識中... + 開始辨識 button 都還在
- `src/lib/firebase/ai-receipt.ts` 的 `extractReceipt` callable — 仍 import
- `src/app/app/expenses/page.tsx` — ReceiptScanner 仍 mount（line 290+）+ `setScannerOpen(true)` 仍有 trigger（line 116）+ 2 個 `tE("scanReceipt")` 按鈕（line 176 + 271）

### 最近改動 expenses 相關 commits

- `fb0a120 feat(expenses): receipt-scanner preview → SaveToAlbumButton` — 純加 SaveToAlbumButton 在 preview，**未改 AI 流程**（已 diff verified）

### 結論

代碼層面 AI 辨識功能 100% 存在。**user 找不到 = entry/navigation/IA 問題**。

## 可能 root cause（Bug Hunter 排查順序）

1. 🥇 **Phase 2 pets v2 IA reorg 副作用** — pets-v2-rebuild SHIPPED 後，pets detail page「開銷」tab 顯示 per-pet 開銷列表，user 可能誤以為「開銷」全部 IA 在 pets page 內，找不到 expenses page 入口
2. 🥈 **Drawer / nav menu「開銷」入口被移除** — 早期 IA reorg 把 expenses page 從 nav 移到 drawer，但 user 可能完全沒看到那個 drawer
3. 🥉 **Phase 1 v2 walks 全頁重建副作用** — 新 walks page top bar 拿掉部分 link
4. **Settings 「拍收據」入口** — settings page 有沒有提供 quick action shortcut
5. **PWA cache stale** — user 的 PWA cache 還在舊版，需要強制 refresh

## 推測 user 實際嘗試的 user journey

```
1. 想記一筆消費 → 想拍收據
2. 開 app → 找不到「拍收據」入口（不知該去哪個 tab / page）
3. 點 bottom nav → 沒看到「開銷」
4. 進 pets page → 看到開銷 tab 但只有 per-pet list 沒有拍照 button
5. 進 settings → 沒有 shortcut
6. 結論：「不見了」
```

## 完成標準

### Bug Hunter 任務

- [ ] Chrome MCP / 真機 iPhone PWA reproduce：
  - 開 `/app/walks` （default landing）
  - 嘗試找「拍收據」入口
  - 紀錄要點幾下、走哪 1-3 個頁面才能到 `/app/expenses` page
- [ ] grep 確認 `/app/expenses` page 是否仍 reachable from bottom nav / drawer / settings
- [ ] 確認 ReceiptScanner Dialog 在 `/app/expenses` 真的能開（不被 z-index / 其他 modal 遮）
- [ ] 確認 `extractReceipt` callable 在 production deploy 狀態（functions log 看 2026-05-25 是否有 invocation）
- [ ] 找到 root cause 後，回 PM 1-2 個選項
- [ ] 如是純 UI 入口問題 → Bug Hunter 直接補 1 個 link / 移 button 到顯眼位置 + ship
- [ ] 如是 IA 設計缺陷 → 升 spec 給 PM 排序

### 如要 fix（PM 預設候選）

優先順序由低到高（最小 fix → 最大 fix）：

1. **加 settings shortcut**「拍收據」row → /app/expenses?action=scan（最小 fix）
2. **Pets detail「開銷」tab 加 floating action「拍收據」**（per-pet 開銷快速 entry）
3. **Walks page 加 secondary CTA「拍收據」**（高頻使用場景）
4. **Bottom nav 加回「開銷」tab 第 5 個 slot**（最大 IA 改）

PM 推薦 fix #2（pets「開銷」tab 加 FAB「拍收據」）— 對齊 user 心智 model「我的寵物的開銷」。Bug Hunter 若同意可直接 ship。

## 不在範圍

- AI receipt 辨識準確度提升
- 多收據批次掃描
- 收據 OCR 多語言支援
- ExpenseCard UI 改造（除非 root cause 跟它有關）

## 跟其他 spec 的關聯

- **pets-v2-rebuild.md (SHIPPED)**：可能此 ship 後 user 找不到原本入口（IA 副作用）
- **walks-v2-rebuild.md (SHIPPED)**：可能新 walks page 拿掉了 expenses link
- **save-photo-to-album.md (SHIPPED)**：純加 SaveToAlbumButton 不影響 AI 流（已 diff verified）

## Bug Hunter launch prompt（user 開 Bug Hunter session copy 用）

```
本 session 固定角色：Bug Hunter — user 回報「拍收據 AI 自動辨識的功能不見了」。
Repo: C:\Users\jabir\Hacker_J\mango_pet_app

⚠️ 必讀
- Spec: docs/features/bug-receipt-ai-missing.md（PM 寫好 recon + 5 個可能 root cause）
- PM 已 verify：receipt-scanner.tsx + ai-receipt.ts + expenses page 代碼 100% 完整；
  fb0a120 commit 純加 SaveToAlbumButton 不影響 AI 流
- 所以 root cause 必是 **UI 入口 / IA / nav** 層面，非邏輯 bug

任務 = live reproduce + root cause + fix (or 升 spec)

Step 1: Chrome MCP iPhone reproduce
- 開 production app（如 user 一樣的入口）
- 從 default landing /app/walks 開始
- 嘗試找「拍收據」 — 紀錄你要點幾下、走哪幾頁
- 截圖 user 看到的畫面（bottom nav / drawer / 各 tab）

Step 2: Confirm /app/expenses page 仍 reachable
- grep src/ 找 navigation 到 /app/expenses 的入口
- 確認 RoutePeer / Drawer / Settings 有沒有 link
- 確認 ReceiptScanner Dialog z-index 不被其他 modal 遮

Step 3: Functions deploy check (optional)
- npx firebase functions:log --only extractReceipt --limit 50
- 看 2026-05-25 是否有 invocation 或 error

Step 4: Pick root cause + fix path
- 若入口 missing → 補 link / 移 button 到顯眼位置（直接 ship）
- 若 IA 設計缺陷 → 升 spec 給 PM 排序

PM 推薦 fix（按工作量 S→L）：
1. settings shortcut「拍收據」row → /app/expenses?action=scan
2. pets 「開銷」tab 加 FAB「拍收據」(PM 主推 — 對齊 user「我的寵物的開銷」心智)
3. walks page 加 secondary CTA「拍收據」
4. bottom nav 加回「開銷」tab

回報格式
- Live reproduce 結果 + root cause
- 選擇的 fix path + commit hash
- 若升 spec，給 PM 完整 user journey diagram

開工。
```
