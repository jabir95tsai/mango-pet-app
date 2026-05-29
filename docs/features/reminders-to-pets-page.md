# Home + Pets 頁 IA 重組（reminders + expenses 搬到 pets / feed 整合首頁）

> 檔名 `reminders-to-pets-page.md` 是歷史殘留 — 2026-05-24 user 加 2 個需求後 PM 擴展為「Home + Pets IA 重組」epic-level spec，但保留檔名以維持 roadmap link 連續性。

狀態：**SUPERSEDED / SPLIT-SHIPPED 2026-05-29 audit**（原 IA 重組被拆到 pets-v2、home-v3、expenses-into-pets、nav reshuffle 等 spec；本檔保留歷史脈絡，不再給 Feature Builder 直接動工）
建立日期：2026-05-24
最後更新：2026-05-29 PM audit sync
規格作者：PM session
角色：UI/UX 工程師 — 動 `src/app/app/page.tsx`、`src/app/app/pets/page.tsx`、`src/app/app/pets/[petId]/page.tsx`、`src/components/nav/app-nav.tsx`、`messages/*`；**不碰** firebase lib / functions / schema / rules

## User 原話（2 個 message 合計 3 個 IA 重組需求）

> 「把提醒從首頁搬到我的寵物」（2026-05-24）
> 「開銷也加入我的寵物頁面,動態可以整合到首頁並從更多刪掉」（2026-05-24）

## Why now

- Mobile nav 重組已 ship（2026-05-23 `e34640a`）— 5 primary nav items 確定後，頁面內容該對齊新導航邏輯
- /app/walks 升級為「開始頁」（walk-core v1 已 ship）— 首頁 (/app) 該變成更高層概覽（家庭動態），不是 operational 細節 list
- Reminders + Expenses 本質是 **pet-specific operational data** — 跟寵物綁在一起更直觀
- Feed 本質是 **社交動態** — 比起埋在「更多」drawer，放首頁當作每天打開的「家裡發生什麼」更自然
- 這三個改動本質是同一個 IA 重組故事，**一個 UI/UX session 一條龍跑完比較有節奏**

## 3 個改動概覽

| # | 改動 | 動到 | 工作量 |
|---|---|---|---|
| A | /app 拿掉 reminder section + 加 feed timeline | `page.tsx` | S |
| B | /app/pets 加 reminder + expense section | `pets/page.tsx` + `pets/[petId]/page.tsx` | S |
| C | 更多 drawer 拿掉 feed 入口 | `app-nav.tsx` 的 overflow items 列表 | XS |

**total 工作量**：M（pure UI 重組，無 schema / lib 改動）

## 5 個 product decisions（PM 預設 + 2 個開放問題待 user 確認）

### Decision 1: /app/pets 內顯示 reminders / expenses 的位置

**PM 預設**：**B2 — 頁面頂部統一 section + per-pet detail 詳細**
- `/app/pets` 頁面頂部依序顯示「即將到期 reminder」+「最近 expenses」兩個 section（pets list 上方）
- 全部 pets 的資料**混合顯示**（跟首頁原本一樣，但搬到這頁）
- 每張 reminder / expense card 上仍標明屬於哪隻 pet（既有實作已 cover）
- `/app/pets/[petId]` detail 頁加 **reminders tab + expenses tab**（per-pet filter）

替代 B1：每張 pet card 內嵌 reminder / expense 預覽 — pet card 變很高，scrolling 變長

### Decision 2: 首頁 (/app) feed 的內容範圍

**PM 預設**：**家庭內 posts + friends posts + public posts 混合**（沿用 /app/feed 現有 query 邏輯，限制 latest 10）
- 不分流家庭 vs friends（首頁是「概覽」性質）
- 顯示 latest 10 篇 + 「查看更多」CTA 連到 `/app/feed` full timeline

替代：只顯示家庭 posts（首頁變家庭 timeline）— 但這弱化 social value；friends 動態看不到

### Decision 3: 更多 drawer 拿掉 feed 入口後剩什麼

**PM 預設**：剩 **4 items**：`[expenses, restaurants, knowledge, friends]`
- Feed 從 drawer 拿掉 ✓（user 明說）
- Expenses 從 drawer 保留 ✓（user 沒說刪，且 /app/expenses 提供「跨寵物 expense 總覽」價值）

### Decision 4: /app/feed 整頁是否保留？（⚠️ 開放問題，等 user 確認）

PM 預設：**保留**（首頁顯示 latest 10 + 「查看更多」連 /app/feed full timeline）
- 理由：full timeline 需要分頁 / filter，首頁塞不下完整功能
- 替代 A：刪 /app/feed → 首頁就是 full timeline（簡化但首頁很長）
- 替代 B：保留 /app/feed 但 drawer 沒入口（隱形 page，靠首頁「查看更多」CTA 進入） ← **PM 主推**

### Decision 5: /app/expenses 整頁是否保留？（⚠️ 開放問題，等 user 確認）

PM 預設：**保留**（更多 drawer 仍有入口，當「跨寵物 expenses 總覽 + 月支出統計 + AI 收據掃描入口」）
- 理由：/app/expenses 已實作完整（月份切換 / 總額 / AI 收據），刪太可惜；user 沒明說要刪
- 替代 A：刪 /app/expenses，全部從 /app/pets 進入（一致 reminders 邏輯，但失去「跨寵物總覽」入口）
- 替代 B：保留 /app/expenses + drawer 仍有 ← **PM 主推**

## 完成標準

### A. 首頁 (/app)

- [ ] 移除既有「即將到期提醒」/「今日已完成」reminder sections
- [ ] 加新 feed timeline section（沿用 /app/feed 既有 post-card 樣式）
  - 顯示 latest 10 posts（混合家庭 + friends + public，採 Decision 2 預設）
  - 「查看更多」CTA 連到 /app/feed（採 Decision 4 預設）
- [ ] 既有家庭使用者**功能無 regression**（pets/walks/leaderboard 等其他連結 + summary cards 不變）

### B. 「我的寵物」頁 (/app/pets)

- [ ] 頁面頂部加 reminder section（沿用 reminder-card.tsx）
  - 「即將到期」+「今日已完成」（採家頁原本結構）
- [ ] reminder section 下方加 expense section（沿用 expense-card.tsx）
  - 顯示 latest 10 expenses（跨寵物混合，跟 reminder 一樣標明 pet）
- [ ] Pets list 區放在兩個 section 之下
- [ ] `/app/pets/[petId]` detail 頁 tabs 加 **reminders** + **expenses** 兩個 tab（per-pet filter）
  - 若 detail 頁已有 tabs 結構：補兩個 tab
  - 若沒 tabs：用 collapse section 替代

### C. 更多 drawer

- [ ] `src/components/nav/app-nav.tsx` 的 overflow drawer items 從 `[feed, expenses, restaurants, knowledge, friends]` 改為 `[expenses, restaurants, knowledge, friends]`（拿掉 feed entry）
- [ ] Desktop sidebar 不變（仍 10 個 nav items 一字排開）

### D. 共用

- [ ] 既有 lib helpers 不動（`listUpcomingReminders` / `listOverdueReminders` / `listExpenses` / `listFriendsPosts` 等都沿用）
- [ ] i18n：可能小幅調整 namespace（Home 跟 Pets 文案會變），沿用既有 keys 為主
- [ ] `npx tsc --noEmit` pass
- [ ] Chrome MCP iPhone + desktop 對照 light/dark
- [ ] **既有 family 使用者完全無感**：data + 操作邏輯不變，只是位置變

## 不在這次範圍

- 改 reminder / expense / post 的 schema / 行為 / lib
- 加新 feature
- 改 /app/feed full timeline 邏輯（沿用既有）
- 改 /app/expenses 跨寵物總覽（沿用既有）
- 改 mobile bottom nav 5 個 primary slots（之前 ship 不動）
- 改 PWA icons / branding（已 ship）
- 改寵物 detail 頁的 healthRecords / walks tabs（既有 tabs 保留）

## 技術筆記

### 動到的檔案

- `src/app/app/page.tsx`：拿掉 reminder + 加 feed timeline
- `src/app/app/pets/page.tsx`：加 reminder + expense sections
- `src/app/app/pets/[petId]/page.tsx`：補 reminders + expenses tabs
- `src/components/nav/app-nav.tsx`：overflow items 列表去除 feed
- `messages/zh-TW.json` + `messages/en.json`：sections 標題 i18n（可能新 keys 如 `Pets.remindersSection` / `Pets.expensesSection` / `Home.feedSection`）

### Edge cases

| Edge | 處理 |
|---|---|
| Pet 0 個 | /app/pets reminder + expense sections 都顯示 empty state 或不渲染 |
| Reminders 0 個 | section 顯示「目前沒有提醒」+ 「新增」CTA |
| Expenses 0 個 | section 顯示「目前沒有開銷紀錄」+ 「新增」CTA |
| Feed 0 個 posts | /app 首頁 feed section 顯示「目前沒有動態」+ 「發新 post」CTA |
| 從 home 連到 reminder 的舊路徑 / bookmark | 不擋（無深度連結到 reminder section）|
| Drawer 拿掉 feed 後使用者習慣性點「更多」找 feed | 短期內可能找不到；接受 — first impression 寫得清楚（首頁本身就是 feed）|

### 跟其他 spec 的關聯

- **walks-photo-and-celebration.md**：兩個工作不同檔案，可並行
- **walk-core-redesign**：/app/walks 不動
- **mobile-bottom-nav 重組**（已 ship `e34640a`）：本 spec 是 nav 重組後的「頁面內容對齊」延伸

### 部署順序

純前端：`git push origin main` → App Hosting auto-build

## 開放問題

- [x] D1 reminder/expense 位置：B2（頂部 unified section + per-pet detail tabs）✓
- [x] D2 首頁 feed 內容：家庭 + friends + public mixed latest 10 ✓
- [x] D3 更多 drawer 剩 4 items（feed 拿掉）✓
- [ ] **D4 /app/feed 整頁保留 vs 刪**（PM 預設保留 + drawer 沒入口；user 確認）
- [ ] **D5 /app/expenses 整頁保留 vs 刪**（PM 預設保留 + drawer 仍有入口；user 確認）
