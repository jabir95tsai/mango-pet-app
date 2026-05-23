# Mango Pet Roadmap

> PM 角色維護。其他角色想動這個檔案先停手，把想說的事寫到 `docs/team/backlog.md`。

最後更新：2026-05-23（#3 leaderboard spec 升級含 prereq + personal mode；#6 legacy cleanup 規格化；家庭 epic 剩 2 條全 ready-for-dev）

## 進行中

> 這個 sprint 已經在做。每條連到 `docs/features/{slug}.md` 或具體 commit。

- **無 in-flight production 工作** — 家庭 epic 剩 #3 + #6 都已規格化，等對應角色 session 接手
- **插隊 (UI/UX backlog 條目)**：mobile bottom nav 重組（P1，等 UI/UX session 接）
  - 👉 **下個動工選擇**：見「Handoff 順序建議」（下方）

## 家庭功能 epic — 收尾順序

> 使用者明確要求「先把家庭功能做完，一個一個」。剩 2 條，都已規格化。

| # | 項目 | 工作量 | 角色 | 狀態 |
|---|---|---|---|---|
| 1 | [Reminder 完成歸屬顯示](../features/reminder-done-attribution.md) | S | Feature Builder | ✅ **SHIPPED** @ `ec8c6fd`(spec-gap ACCEPTED by PM)|
| insert | [刪除帳號功能](../features/delete-account.md) | M | Feature Builder | ✅ **SHIPPED + user-verified** — `d5ade48`(callable+UI) / `02d16f9`(index fix) / `e261fef`(push fg fix) / `8d430d1`(docs) / `6aa7137`(user verify) |
| 1b | [Repeat reminder 歸屬顯示](../features/repeat-reminder-attribution.md) | S | Feature Builder | ✅ **SHIPPED** @ `3282091` |
| 2 | [家庭 onboarding 重設計（解 B）](../features/family-onboarding-redesign.md) | L | Feature Builder | ✅ **全部 SHIPPED** — B1 `60d820c` / B2 `8ebcf72` / B3 `347d71a` / B4(merge) `f450ad0` / B4 rollback `1a49653` |
| **3** | **[家庭 leaderboard 切換](../features/family-leaderboard.md)** | **M** | **Feature Builder** | ✅ **READY-FOR-DEV**（2026-05-23 PM update：spec 加 Phase 0 prereq personal walks 防刷 + personal mode empty state；prereq backlog 條目已升級）|
| ~~4~~ | ~~Mango dedupe migration~~ | ~~M~~ | ~~Backend~~ | ❌ NOT DOING（user 取消）|
| ~~5~~ | ~~開銷 payer 分析卡~~ | ~~S~~ | ~~UI/UX~~ | ❌ NOT DOING（user 取消）|
| **6** | **[Legacy 路徑清理](../features/legacy-path-cleanup.md)** | **M** | **Backend** | ✅ **READY-FOR-DEV**（2026-05-23 PM 規格化；獨立工作不再依賴 #4）|

**為什麼這個順序**：

- **#1 / delete-account / #1b / #2** ✅ 全 SHIPPED
- **#3 家庭 leaderboard（下個 FB 動工）**：spec 含 Phase 0 prereq (`aggregateLeaderboards` filter `familyId != null` 防刷) + 完整 personal mode 行為（沒家庭使用者進頁看到 empty state + CTA，不顯示 toggle/ranking/tab）
- **~~#4 Mango dedupe~~** / **~~#5 Payer 分析~~**：user 取消
- **#6 Legacy 清理（下個 Backend 動工）**：spec 含 4 phases — Phase 1 grep 確認 client 不依賴 → Phase 2 admin-only cleanup callable (dryRun → real) → Phase 3 rules 移除 legacy match blocks → Phase 4 client lib + schema doc cleanup。完全獨立，跟 dedupe 無關（dedupe 是 family-scoped 內重複，legacy 是老 sub-collection 刪除）

剩下 2 條可**並行做**（#3 是 FB / #6 是 Backend，角色不衝突），也可 sequential。每收尾一條，回 PM session 把它打勾、評估後續。

## 下一個（已規格化，可直接交付）

> 對應角色 session 開起來就能接手實作。

- _家庭 epic 還有 #3 + #6（見上方表格）。其他主題等家庭 epic 收完再排下一波_

## 想做但還沒規格

> 想法階段。家庭 epic 收尾後，下個 PM session 決定。

- **資料 export（download my data）**：delete-account 上線後同樣是 GDPR 要求，但獨立 spec
- **餐廳 Google Places 整合**：目前餐廳僅手動建。Places API 可大幅擴大資料庫，但成本與審核機制要先想
- **知識庫持續產出**：目前只 seed 5 篇。要每月持續產出 1–2 篇還是放著？需要 PM 決策
- **Analytics / 北極星指標接線**：定性觀察不夠，要決定接 GA4 / Firebase Analytics / 自己開 minimal events collection
- **上架 prerequisite 收尾**：sprint 6 polish 段未做完的 PWA icons + 自訂網域 + Lighthouse audit + App Check（PRD §6）

## 不做（拒絕清單）

> 比「做」更重要。寫下來防止反覆討論同一件事。

- **Web 內背景 GPS 解決方案**（service worker、定時 ping、wake lock 等繞道法）— PRD §7 已說 Web 不可能可靠背景追蹤。再花時間想辦法繞 = 浪費。手動補登是 v1 正式解。
- **AI 寵物顧問聊天**（PRD §3.7、§5 已排除）— 成本不可預測，沒有清楚的留存假設。等真正有付費漏斗後再評估。
- **私訊系統**（PRD §3.6、§5 已排除）— 飼主社交目標已被 Emoji 反應 + 動態牆覆蓋 80%。私訊會帶來 moderation / 通報 / 騷擾處理整套包袱，CP 值低。
- **訂閱付費 / 廣告**（PRD §5 已排除）— 在 DAU 上百之前不討論。免費 + Firebase 額度是現階段 thesis。
- **強迫所有使用者必須建立家庭才能使用主功能**（PM 解 C 提議 2026-05-23 已被使用者否決）— 違反「家庭是 optional feature」principle；單身飼主應該能正常用 App
- **加入家庭時自動 pet merge wizard**（#2 B4 ship 後使用者 2026-05-23 反悔拿掉）— 使用者原話：「不直觀，因為一般不太有這種狀況」
- **刪帳號時 anonymize 共用資料**（user 2026-05-23 改變主意，改為 full hard delete cascade）— 「forget me」原則優先
- **同 family 內同名 pet 合併 / dedupe migration**（#4 user 2026-05-23 取消）— 罕見情境不值整套 admin tool
- **開銷 payer 分析卡**（#5 user 2026-05-23 取消）— 家庭 ≤ 5 人總額足用

## Handoff 順序建議

家庭 epic 剩 2 條 + 插隊條目 1 個，**並行不衝突**：

| 工作 | 角色 | 工作量 | 建議順序 |
|---|---|---|---|
| Mobile bottom nav 重組 | UI/UX | S | **先做**（純前端 quick win，不擋其他）|
| #3 家庭 leaderboard | Feature Builder | M | 次做（含 Phase 0 prereq + personal mode）|
| #6 Legacy 路徑清理 | Backend | M | 並行 / 最後（destructive cleanup，建議單獨 session）|

或全部並行 — UI/UX、FB、Backend 三個 session 同時開也行。

## 北極星指標（每月看一次）

- 一週活躍家庭數
- 平均每家庭遛狗次數
- AI 收據掃描成功率
- 推播 opt-in 率

> 還沒接 analytics — 目前只能定性觀察。**接 analytics 這件事本身已進入「想做但還沒規格」**，等下個 PM session 決定要不要這個 sprint 規格化。
