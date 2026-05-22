# Mango Pet Roadmap

> PM 角色維護。其他角色想動這個檔案先停手，把想說的事寫到 `docs/team/backlog.md`。

最後更新：2026-05-23（#2 family-onboarding-redesign 解 B 確認動工，下個動工是 Phase B1 / Backend）

## 進行中

> 這個 sprint 已經在做。每條連到 `docs/features/{slug}.md` 或具體 commit。

- **家庭功能 epic — 一個一個收尾**（使用者偏好：不並行，做完一條才開下一條）
  - 👉 **進行中**：[家庭 onboarding 重設計 — 全 4 phases](../features/family-onboarding-redesign.md) — Feature Builder unsupervised run（使用者 2026-05-23 睡前 launch）

## 家庭功能 epic — 收尾順序

> 使用者明確要求「先把家庭功能做完，一個一個」。下面是執行順序與當前狀態。

| # | 項目 | 工作量 | 角色 | 狀態 |
|---|---|---|---|---|
| 1 | [Reminder 完成歸屬顯示](../features/reminder-done-attribution.md) | S | Feature Builder | ✅ **SHIPPED** @ `ec8c6fd`(spec-gap ACCEPTED by PM)|
| 1b | [Repeat reminder 歸屬顯示](../features/repeat-reminder-attribution.md) | S | Feature Builder | ✅ 已規格化（使用者排序：#3 #4 ship 後重評）|
| **2** | **[家庭 onboarding 重設計（解 B）](../features/family-onboarding-redesign.md)** | L（4 phases） | Feature Builder（整 epic 一條龍）| 🟢 **READY-FOR-DEV — unsupervised run 模式，使用者睡前 launch** |
| 3 | [家庭 leaderboard 切換](../features/family-leaderboard.md) | M | Feature Builder | ✅ 已規格化（#2 ship 後需補 personal mode edge case）|
| 4 | [寵物去重 migration](../features/mango-dedupe-migration.md) | M | Backend | ✅ 已規格化（merge logic 跟 #2 Phase B4 可共用，建議先做 #4 抽共用函式）|
| 5 | 開銷 payer 分析卡 | S | UI/UX 或 Feature Builder | 📝 未規格化（aggregateByPayer helper 已 ready）|
| 6 | Legacy 路徑清理 | M | Backend | 📝 未規格化（等 #4 dedupe 跑完再啟動）|

**為什麼這個順序**（給使用者一個一個做）：

- **#1 Reminder 完成歸屬**：✅ 已收尾。spec-gap ACCEPTED by PM
- **#1b Repeat reminder 歸屬**：data 已就緒，工作量 S。**使用者排序**：等 #3 #4 ship 後重評
- **#2 家庭 onboarding 重設計（PM 插隊 2026-05-23，解 B 確認動工）**：使用者要求「先沒家庭，可選擇創建或加入；養同一隻狗希望同步資料」。**最終 product principle**：「家庭是 optional feature — 單身飼主不該被強迫建單人家庭」（PM 解 C 提議因為違反此 principle 被否決）。Schema 改動 + onboarding + import + merge wizard。拆 4 phases (B1 schema/rules → B2 onboarding UI → B3 import wizard → B4 pet merge)。merge logic 跟 #4 dedupe 可共用
- **#3 家庭 leaderboard**：#2 ship 後接手；要補 edge case「personal mode 下隱藏 leaderboard 或顯示個人 stats only」
- **#4 Mango dedupe**：技術債；merge logic 跟 #2 B4 共用。**建議實作順序**：先 #4 把搬子集合 + 刪重複的 logic 拆成共用函式，#2 B4 直接重用（但 #2 整體優先級高於 #4，等 #2 B1+B2+B3 ship 後 + #4 抽函式 + #2 B4 收尾）
- **#5 Payer 分析**：純前端，等 #2 #3 做完後規格化
- **#6 Legacy 清理**：必須在 #4 完成且 family 路徑穩定後才動

每收尾一條，回 PM session 把它從這張表打勾、把下一條的 spec（若未規格化）寫好、評估有沒有「ship 過程中發現的觀察」需要插隊。

## 下一個（已規格化，可直接交付）

> 對應角色 session 開起來就能接手實作。家庭 epic 在上方獨立排序，這邊列其他主題的下一步（目前無）。

- _家庭 epic 期間，其他主題不另開新 spec。等 epic 收完再排下一波。_

## 想做但還沒規格

> 想法階段。家庭 epic 收尾後（或中間插隊評估），下個 PM session 決定。

- **開銷 payer 分析卡**（屬家庭 epic #5，等 #2 #3 完成後規格化）
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

## 北極星指標（每月看一次）

- 一週活躍家庭數
- 平均每家庭遛狗次數
- AI 收據掃描成功率
- 推播 opt-in 率

> 還沒接 analytics — 目前只能定性觀察。**接 analytics 這件事本身已進入「想做但還沒規格」**，等下個 PM session 決定要不要這個 sprint 規格化。
