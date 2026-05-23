# Mango Pet Roadmap

> PM 角色維護。其他角色想動這個檔案先停手，把想說的事寫到 `docs/team/backlog.md`。

最後更新：2026-05-23（#2 B1-B3 SHIPPED；使用者改變主意拿掉 B4 merge → UI rollback in progress；下個動工 = Feature Builder 接 B4 UI rollback）

## 進行中

> 這個 sprint 已經在做。每條連到 `docs/features/{slug}.md` 或具體 commit。

- **#2 B4 UI rollback** — 拿掉 ImportWizardDialog 的 merge candidates 偵測 + merge step，wizard 直接走純 import 路徑。指示在 [family-onboarding-redesign.md 末尾「Post-ship change」段](../features/family-onboarding-redesign.md)
  - 👉 **下個動工**：Feature Builder session（工作量 S，純 UI 改 + i18n 清理 + 1 commit）

## 家庭功能 epic — 收尾順序

> 使用者明確要求「先把家庭功能做完，一個一個」。下面是執行順序與當前狀態。

| # | 項目 | 工作量 | 角色 | 狀態 |
|---|---|---|---|---|
| 1 | [Reminder 完成歸屬顯示](../features/reminder-done-attribution.md) | S | Feature Builder | ✅ **SHIPPED** @ `ec8c6fd`(spec-gap ACCEPTED by PM)|
| 1b | [Repeat reminder 歸屬顯示](../features/repeat-reminder-attribution.md) | S | Feature Builder | ✅ 已規格化（使用者排序：#3 #4 ship 後重評）|
| 2 | [家庭 onboarding 重設計（解 B）](../features/family-onboarding-redesign.md) | L → 部分 rollback | Feature Builder | 🟡 **B1+B2+B3 SHIPPED / B4 UI rollback in progress** — `60d820c` / `8ebcf72` / `347d71a` / `f450ad0`(B4 dormant) / `bfd1360`(docs) / `fe5f9ab`(PM bookkeeping) |
| 3 | [家庭 leaderboard 切換](../features/family-leaderboard.md) | M | Feature Builder | ✅ 已規格化（動工前 PM 需處理 prereq：personal walks 防刷 — 見 backlog Inbox）|
| 4 | [寵物去重 migration](../features/mango-dedupe-migration.md) | M | Backend | ✅ 已規格化（callable + 共用 merge code 已在 `mergeAndImportToFamily` dormant — Backend session 動工時可重用）|
| 5 | 開銷 payer 分析卡 | S | UI/UX 或 Feature Builder | 📝 未規格化（aggregateByPayer helper 已 ready）|
| 6 | Legacy 路徑清理 | M | Backend | 📝 未規格化（等 #4 dedupe 跑完再啟動）|

**為什麼這個順序**（給使用者一個一個做）：

- **#1 Reminder 完成歸屬**：✅ SHIPPED
- **#1b Repeat reminder 歸屬**：data 已就緒，工作量 S。**使用者排序**：等 #3 #4 ship 後重評
- **#2 家庭 onboarding 重設計**：B1+B2+B3 SHIPPED。**B4 merge feature 使用者醒來後決定拿掉** — PM surface trade-off（「他那邊一隻我這邊一隻」split 情境會回來，需靠 #4 dedupe 處理），使用者接受。UI 層 rollback in progress，callable 暫保留 dormant 等下個 cleanup sprint。**Personal-mode live test 仍待跑**
- **#3 家庭 leaderboard**：spec 已 ready；動工前處理 backlog 內 personal walks 防刷條目
- **#4 Mango dedupe**：merge logic 已在 dormant callable，Backend session 動工時可重用；工作量仍估 M（trigger 機制不同：admin 觸發 vs B4 是 join 時觸發）
- **#5 Payer 分析**：純前端，等 #1b/#3/#4 做完後規格化
- **#6 Legacy 清理**：必須在 #4 完成且 family 路徑穩定後才動

每收尾一條，回 PM session 把它從這張表打勾、把下一條的 spec（若未規格化）寫好、評估有沒有「ship 過程中發現的觀察」需要插隊。

## 下一個（已規格化，可直接交付）

> 對應角色 session 開起來就能接手實作。家庭 epic 在上方獨立排序，這邊列其他主題的下一步（目前無）。

- _家庭 epic 期間，其他主題不另開新 spec。等 epic 收完再排下一波。_

## 想做但還沒規格

> 想法階段。家庭 epic 收尾後（或中間插隊評估），下個 PM session 決定。

- **開銷 payer 分析卡**（屬家庭 epic #5，等 #1b/#3/#4 完成後規格化）
- **Legacy 路徑清理**（屬家庭 epic #6，等 #4 完成後規格化）
- **餐廳 Google Places 整合**：目前餐廳僅手動建。Places API 可大幅擴大資料庫，但成本與審核機制要先想
- **知識庫持續產出**：目前只 seed 5 篇。要每月持續產出 1–2 篇還是放著？需要 PM 決策
- **Analytics / 北極星指標接線**：定性觀察不夠，要決定接 GA4 / Firebase Analytics / 自己開 minimal events collection

## 不做（拒絕清單）

> 比「做」更重要。寫下來防止反覆討論同一件事。

- **Web 內背景 GPS 解決方案**（service worker、定時 ping、wake lock 等繞道法）— PRD §7 已說 Web 不可能可靠背景追蹤。再花時間想辦法繞 = 浪費。手動補登是 v1 正式解。
- **AI 寵物顧問聊天**（PRD §3.7、§5 已排除）— 成本不可預測，沒有清楚的留存假設。等真正有付費漏斗後再評估。
- **私訊系統**（PRD §3.6、§5 已排除）— 飼主社交目標已被 Emoji 反應 + 動態牆覆蓋 80%。私訊會帶來 moderation / 通報 / 騷擾處理整套包袱，CP 值低。
- **訂閱付費 / 廣告**（PRD §5 已排除）— 在 DAU 上百之前不討論。免費 + Firebase 額度是現階段 thesis。
- **強迫所有使用者必須建立家庭才能使用主功能**（PM 解 C 提議 2026-05-23 已被使用者否決）— 違反「家庭是 optional feature」principle；單身飼主應該能正常用 App
- **加入家庭時自動 pet merge wizard**（#2 B4 ship 後使用者 2026-05-23 反悔拿掉）— 使用者原話：「不直觀，因為一般不太有這種狀況」。實際使用流程是「一人先建家庭 + 寵物 → 邀請家人加入」，家人是被邀請的不會先自己建寵物，所以「兩人各自 personal mode 建 Mango 後合家庭撞名」這個 edge case 太罕見，不值做整套 wizard。若罕見 split 情境真發生，靠 #4 dedupe migration 處理

## 北極星指標（每月看一次）

- 一週活躍家庭數
- 平均每家庭遛狗次數
- AI 收據掃描成功率
- 推播 opt-in 率

> 還沒接 analytics — 目前只能定性觀察。**接 analytics 這件事本身已進入「想做但還沒規格」**，等下個 PM session 決定要不要這個 sprint 規格化。
