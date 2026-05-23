# 提醒從首頁搬到「我的寵物」頁

狀態：READY-FOR-DEV（user 2026-05-24 主動要求；PM 補 edge cases）
建立日期：2026-05-24
最後更新：2026-05-24
規格作者：PM session
角色：UI/UX 工程師 — 動 `src/app/app/page.tsx`、`src/app/app/pets/page.tsx`、`src/app/app/pets/[petId]/page.tsx`、`messages/*`；**不碰** firebase lib / functions / schema / rules

## User 原話

> 把提醒從首頁搬到我的寵物

## Why now

- Walk-core 已升級 /app/walks 為「開始頁」(2026-05-23 ship)，首頁 (`/app`) 該對應改成更高層概覽 — reminder 是 pet-specific operational info，更適合貼近寵物
- Settings → /app/pets nav 已是 mobile primary nav（之前 nav 重組 ship）— reminder 放 /app/pets 動線更自然
- /app/pets 已有 per-pet 列表，順手在 pet card 或 pet detail 顯示「該寵物的提醒」是 UX 對齊
- 不擋 walk-experience-v2 (兩個工作不同檔案，可並行)

## 完成標準

### A. 首頁 (`/app`) — 拿掉 reminder section

- [ ] `src/app/app/page.tsx` 移除既有「即將到期提醒」/「Upcoming reminders」section（含 `listUpcomingReminders` query 呼叫 + UI render）
- [ ] 移除後首頁應仍正常運作（不破壞 home page layout / 其他 sections）
- [ ] 「今日已完成」reminder sub-section（如有）也搬走或拿掉 — **PM 決策**：跟 upcoming 一起搬到 /app/pets 對應位置

### B. 「我的寵物」頁 (`/app/pets`) — 加 reminder section

選擇 1 個實作（**PM 預設選 B2**）：

#### B1. Per-pet card 內顯示

- 每張 pet card 底部小區塊顯示「下個提醒：餵藥 daily / 6/5 07:00」
- 點 pet card 進 detail 看完整列表
- 缺點：列表頁卡片變高，scrolling 變長

#### B2. **PM 預設** — 頁面頂部統一區塊 + per-pet detail 詳細

- `/app/pets` 頁面頂部加「即將到期 / 今日已完成」section（pets list 上方）
- 顯示**全部 pets 的 reminders 混合**（跟首頁原本一樣，但搬到這頁）
- 每張 reminder card 上仍標明屬於哪隻 pet（既有實作已 cover）
- `/app/pets/[petId]` detail 頁加 reminders tab（per-pet filter — 既有 tab 結構應已支援，補一個 tab 即可）
- 優點：列表頁 visual 不變太多，per-pet detail 也有 deep dive

### C. 共用

- [ ] 既有 `reminder-card.tsx` / `listUpcomingReminders` / `listOverdueReminders` 等 lib helpers 不動 — UI/UX 只搬位置不動邏輯
- [ ] i18n：可能需要小調，沿用既有 `Reminders.*` namespace
- [ ] `npx tsc --noEmit` pass
- [ ] Chrome MCP iPhone + desktop 對照 light/dark
- [ ] **既有家庭使用者完全無感**：reminder data + 操作不變，只是位置變

## 不在這次範圍

- 改 reminder 行為 / schema / lib
- 加新 reminder type
- 改完成歸屬（已 ship）
- 改 repeat reminder 邏輯
- 加 reminder 過期通知 UX
- 改 pet detail tab 結構 (除了補一個 reminders tab)

## 技術筆記

### 動到的檔案

- `src/app/app/page.tsx`：拿掉 reminder section
- `src/app/app/pets/page.tsx`：加 reminders section（PM 預設 B2 — 頁面頂部）
- `src/app/app/pets/[petId]/page.tsx`：補 reminders tab（per-pet filter）
- `messages/zh-TW.json` + `messages/en.json`：可能小幅調整（如 Home → Pets 的 nav hint）

### 部署順序

純前端：`git push origin main` → App Hosting auto-build

### Edge cases

| Edge | 處理 |
|---|---|
| Pet 0 個 | /app/pets 頂部 reminder section 不顯示（無 pet 沒 reminder）|
| Reminders 0 個 | section 顯示 empty state「目前沒有提醒」+ 「新增提醒」CTA |
| 從 home 連到 reminder 的舊路徑 / bookmark | 不擋（無深度連結到 reminder section）|

### 跟其他 spec 的關聯

- **walk-experience-v2.md**：兩個工作不同檔案（reminder 在 pets/，walks 在 walks/），可並行
- **walk-core-redesign**：首頁 /app 改 layout 後 walks 仍是獨立頁，無關聯

## 開放問題

- [x] B1 vs B2 → PM 預設 B2（頂部統一 section + per-pet detail tab）
- [ ] 首頁 (/app) 拿掉 reminder section 後要不要補別的？建議：不補（讓首頁更精簡，留給未來 dashboard / overview）— 若 user 想補 quick links 跟我說
