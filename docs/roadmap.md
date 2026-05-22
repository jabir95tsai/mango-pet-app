# Mango Pet Roadmap

> PM 角色維護。其他角色想動這個檔案先停手，把想說的事寫到 `docs/team/backlog.md`。

最後更新：2026-05-22

## 進行中

> 這個 sprint 已經在做。每條連到 `docs/features/{slug}.md` 或具體 commit。

- _目前沒有正式進行中項目 — 等下方「下一個」開始接手。_

## 下一個（已規格化，可直接交付）

> 有 spec、有完成標準。對應角色 session 開起來就能接手實作。

- **新功能** — [家庭 leaderboard 切換](../features/family-leaderboard.md) — Feature Builder 接（工作量 M）
- **體驗** — [Reminder 完成歸屬顯示](../features/reminder-done-attribution.md) — Feature Builder 接（工作量 S）
- **技術債** — [寵物去重 migration](../features/mango-dedupe-migration.md) — Backend 接（工作量 M）

建議交付順序：
1. 先 Backend 跑 Mango dedupe（dryRun → 真實）— 後面兩條 UI 工作如果不小心碰到 pets 資料，先有乾淨資料底
2. Feature Builder 接 Reminder 完成歸屬（工作量 S，當熱身）
3. Feature Builder 接家庭 leaderboard（工作量 M，sprint 收尾）

## 想做但還沒規格

> 想法階段。下個 PM session 決定要不要做、做的話怎麼做。

- **開銷 payer 分析卡**：哪個家庭成員花了多少（`aggregateByPayer` helper 已就緒，純前端 UI 改動）— 候選下下個 sprint 升級
- **Legacy 路徑清理**：family 完成 migration 後刪 `users/{uid}/pets|walks|reminders|expenses` + rule 中對應規則 — 等 dedupe migration 跑完再評估
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
