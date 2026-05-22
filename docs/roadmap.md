# Mango Pet Roadmap

> PM 角色維護。其他角色想動這個檔案先停手，把想說的事寫到 `docs/team/backlog.md`。

最後更新：2026-05-22（#1 SHIPPED，下一個動工是 #2 家庭 leaderboard）

## 進行中

> 這個 sprint 已經在做。每條連到 `docs/features/{slug}.md` 或具體 commit。

- **家庭功能 epic — 一個一個收尾**（使用者偏好：不並行，做完一條才開下一條）
  - 👉 **下個動工**：[家庭 leaderboard 切換](../features/family-leaderboard.md)（M, Feature Builder）

## 家庭功能 epic — 收尾順序

> 使用者明確要求「先把家庭功能做完，一個一個」。下面是執行順序與當前狀態。

| # | 項目 | 工作量 | 角色 | 狀態 |
|---|---|---|---|---|
| 1 | [Reminder 完成歸屬顯示](../features/reminder-done-attribution.md) | S | Feature Builder | ✅ **SHIPPED**（commit `ec8c6fd`，待 PM 驗收 spec gap）|
| 1b | [Repeat reminder 歸屬顯示](../features/repeat-reminder-attribution.md) | S | Feature Builder | ✅ 已規格化（接續 #1 的 spec gap，待 PM 排序）|
| 2 | [家庭 leaderboard 切換](../features/family-leaderboard.md) | M | Feature Builder | ✅ 已規格化 — **下個動工** |
| 3 | [寵物去重 migration](../features/mango-dedupe-migration.md) | M | Backend | ✅ 已規格化 |
| 4 | 開銷 payer 分析卡 | S | UI/UX 或 Feature Builder | 📝 未規格化（aggregateByPayer helper 已 ready）|
| 5 | Legacy 路徑清理 | M | Backend | 📝 未規格化（等 #3 dedupe 跑完再啟動）|

**為什麼這個順序**（給使用者一個一個做）：

- **#1 Reminder 完成歸屬**：✅ 已收尾。spec gap（已完成 reminder 在預設 list 不出現）以「今日已完成」sub-section 解決；待 PM 驗收這個入口或要不要換做 toggle / 歷史頁
- **#2 家庭 leaderboard 接著做**：social hook，把家庭功能從工具升級為日常使用習慣
- **#3 Mango dedupe 排第三**：技術債，影響面有限（少數 legacy 帳號），不擋使用者前進；但 #5 Legacy 清理依賴它先跑完
- **#4 Payer 分析**：純前端，等 #1 #2 做完後再規格化（保持 spec 新鮮度）
- **#5 Legacy 清理**：必須在 #3 完成且確認 family 路徑穩定後才動，否則風險高

每收尾一條，回 PM session 把它從這張表打勾、把下一條的 spec（若未規格化）寫好。

## 下一個（已規格化，可直接交付）

> 對應角色 session 開起來就能接手實作。家庭 epic 在上方獨立排序，這邊列其他主題的下一步（目前無）。

- _家庭 epic 期間，其他主題不另開新 spec。等 epic 收完再排下一波。_

## 想做但還沒規格

> 想法階段。家庭 epic 收尾後（或中間插隊評估），下個 PM session 決定。

- **開銷 payer 分析卡**（屬家庭 epic #4，等 #1 #2 完成後規格化）
- **Legacy 路徑清理**（屬家庭 epic #5，等 #3 完成後規格化）
- **餐廳 Google Places 整合**：目前餐廳僅手動建。Places API 可大幅擴大資料庫，但成本與審核機制要先想
- **知識庫持續產出**：目前只 seed 5 篇。要每月持續產出 1–2 篇還是放著？需要 PM 決策
- **Analytics / 北極星指標接線**：定性觀察不夠，要決定接 GA4 / Firebase Analytics / 自己開 minimal events collection

## 不做（拒絕清單）

> 比「做」更重要。寫下來防止反覆討論同一件事。

- **Web 內背景 GPS 解決方案**（service worker、定時 ping、wake lock 等繞道法）— PRD §7 已說 Web 不可能可靠背景追蹤。再花時間想辦法繞 = 浪費。手動補登是 v1 正式解。
- **AI 寵物顧問聊天**（PRD §3.7、§5 已排除）— 成本不可預測，沒有清楚的留存假設。等真正有付費漏斗後再評估。
- **私訊系統**（PRD §3.6、§5 已排除）— 飼主社交目標已被 Emoji 反應 + 動態牆覆蓋 80%。私訊會帶來 moderation / 通報 / 騷擾處理整套包袱，CP 值低。
- **訂閱付費 / 廣告**（PRD §5 已排除）— 在 DAU 上百之前不討論。免費 + Firebase 額度是現階段 thesis。

## 北極星指標（每月看一次）

- 一週活躍家庭數
- 平均每家庭遛狗次數
- AI 收據掃描成功率
- 推播 opt-in 率

> 還沒接 analytics — 目前只能定性觀察。**接 analytics 這件事本身已進入「想做但還沒規格」**，等下個 PM session 決定要不要這個 sprint 規格化。
