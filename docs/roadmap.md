# Mango Pet Roadmap

> PM 角色維護。其他角色想動這個檔案先停手，把想說的事寫到 `docs/team/backlog.md`。

最後更新：2026-05-23（delete-account + B4 rollback SHIPPED；user 取消 #4 dedupe + #5 payer 分析；下個動工 #1b）

## 進行中

> 這個 sprint 已經在做。每條連到 `docs/features/{slug}.md` 或具體 commit。

- **無 in-flight 項目** — B4 rollback + delete-account 都 SHIPPED；下個動工是 #1b
  - 👉 **下個動工**：[Repeat reminder 完成歸屬](../features/repeat-reminder-attribution.md)（S, Feature Builder）

## 家庭功能 epic — 收尾順序

> 使用者明確要求「先把家庭功能做完，一個一個」— 2026-05-23 #4 dedupe + #5 payer 分析取消，剩下 3 條。

| # | 項目 | 工作量 | 角色 | 狀態 |
|---|---|---|---|---|
| 1 | [Reminder 完成歸屬顯示](../features/reminder-done-attribution.md) | S | Feature Builder | ✅ **SHIPPED** @ `ec8c6fd`(spec-gap ACCEPTED by PM)|
| **insert** | **[刪除帳號功能](../features/delete-account.md)** | M | Feature Builder | ✅ **SHIPPED + user-verified** — `d5ade48`(callable+UI) / `02d16f9`(index fix) / `e261fef`(push fg fix) / `8d430d1`(docs) / `6aa7137`(user verify) |
| **1b** | **[Repeat reminder 歸屬顯示](../features/repeat-reminder-attribution.md)** | S | Feature Builder | ✅ **已規格化 — 下個動工**（原排序「等 #3/#4 ship 後重評」失效，#4 取消後可直接做）|
| 2 | [家庭 onboarding 重設計（解 B）](../features/family-onboarding-redesign.md) | L | Feature Builder | ✅ **全部 SHIPPED** — B1 `60d820c` / B2 `8ebcf72` / B3 `347d71a` / B4(merge) `f450ad0` / B4 rollback `1a49653` / docs `bfd1360`/`21857dd` |
| 3 | [家庭 leaderboard 切換](../features/family-leaderboard.md) | M | Feature Builder | ✅ 已規格化（動工前 PM 需處理 prereq：personal walks 防刷 — 見 backlog Inbox）|
| ~~4~~ | ~~Mango dedupe migration~~ | ~~M~~ | ~~Backend~~ | ❌ **NOT DOING**（user 2026-05-23 取消；spec 保留供未來參考）|
| ~~5~~ | ~~開銷 payer 分析卡~~ | ~~S~~ | ~~UI/UX~~ | ❌ **NOT DOING**（user 2026-05-23 取消）|
| **6** | **Legacy 路徑清理** | M | Backend | 📝 未規格化（原依賴 #4 跑完，#4 取消後可獨立動工但需先評估 — 等 #1b/#3 ship 後 PM session 規格化）|

**為什麼這個順序**（給使用者一個一個做）：

- **#1 Reminder 完成歸屬**：✅ SHIPPED
- **delete-account**：✅ SHIPPED + user-verified（destructive flow 跑過 OK）。順手修了 2 個 bug：collection-group index 缺漏 (`02d16f9`)、推播前景 onMessage handler 沒接 (`e261fef`)
- **#1b Repeat reminder 歸屬（下個動工）**：原排序「等 #3/#4 ship 後重評」— 但 #4 取消後 prereq 消失，可直接做。工作量 S，是 #1 attribution UI 的補完（repeat reminder 在 active 卡片下顯示「上次：媽媽勾 · 3 小時前」）。data 已就緒，純 UI 改動
- **#2 家庭 onboarding 重設計**：✅ 全部 SHIPPED（B1-B3 + B4 rollback）
- **#3 家庭 leaderboard**：spec 已 ready；**動工前處理 backlog 內 personal walks 防刷條目**（aggregateLeaderboards filter `familyId != null`）
- **~~#4 Mango dedupe~~**：user 取消。B4 dormant callable + 共用 merge helper code 留在 production 不動（無 client caller = 零風險）
- **~~#5 Payer 分析~~**：user 取消
- **#6 Legacy 清理**：原本「#4 跑完且 family 路徑穩定後才動」— 現在 #4 不做了。Legacy 清理本身仍可獨立做（刪掉 `users/{uid}/pets|walks|reminders|expenses` 老路徑 + rule 對應 match block）。等 #1b/#3 ship 後 PM session 規格化

每收尾一條，回 PM session 把它從這張表打勾、把下一條的 spec（若未規格化）寫好、評估有沒有「ship 過程中發現的觀察」需要插隊。

## 下一個（已規格化，可直接交付）

> 對應角色 session 開起來就能接手實作。

- _家庭 epic 還有 3 條（#1b / #3 / #6）。其他主題等家庭 epic 收完再排下一波。_

## 想做但還沒規格

> 想法階段。家庭 epic 收尾後（或中間插隊評估），下個 PM session 決定。

- **Legacy 路徑清理**（屬家庭 epic #6，等 #1b/#3 ship 後規格化）
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
- **加入家庭時自動 pet merge wizard**（#2 B4 ship 後使用者 2026-05-23 反悔拿掉）— 使用者原話：「不直觀，因為一般不太有這種狀況」。實際使用流程是「一人先建家庭 + 寵物 → 邀請家人加入」，家人是被邀請的不會先自己建寵物，所以「兩人各自 personal mode 建 Mango 後合家庭撞名」這個 edge case 太罕見，不值做整套 wizard
- **刪帳號時 anonymize 共用資料**（user 2026-05-23 改變主意，改為 full hard delete cascade）— 「forget me」原則優先
- **同 family 內同名 pet 合併 / dedupe migration**（#4 user 2026-05-23 取消）— 與 B4 merge wizard 同樣理由：實際使用流程不太會有同 family 內重複 pet 的情境。dormant `mergeAndImportToFamily` callable + 共用 merge helper 保留在 production（無 client caller = 零風險），若未來情境真出現再 wire up
- **開銷 payer 分析卡**（#5 user 2026-05-23 取消）— `aggregateByPayer` helper 已 ready 但不暴露 UI。家庭內 expense 總額已足用，「誰花多少」的分析在當前家庭規模（≤ 5 人）價值有限

## 北極星指標（每月看一次）

- 一週活躍家庭數
- 平均每家庭遛狗次數
- AI 收據掃描成功率
- 推播 opt-in 率

> 還沒接 analytics — 目前只能定性觀察。**接 analytics 這件事本身已進入「想做但還沒規格」**，等下個 PM session 決定要不要這個 sprint 規格化。
