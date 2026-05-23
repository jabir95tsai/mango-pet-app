# Mango Pet Roadmap

> PM 角色維護。其他角色想動這個檔案先停手，把想說的事寫到 `docs/team/backlog.md`。

最後更新：2026-05-23（🎉 **家庭 epic 全部完工** — 8/8 含 cancellation；下個 sprint 等使用者選方向）

## 進行中

> 這個 sprint 已經在做。每條連到 `docs/features/{slug}.md` 或具體 commit。

- **無 in-flight 項目** — 家庭 epic 100% closed，等使用者決定下個 epic

## 🎉 家庭功能 epic — 完整收尾紀錄（2026-05-22 → 2026-05-23）

| # | 項目 | 工作量 | 角色 | 結局 | Ship commit |
|---|---|---|---|---|---|
| 1 | [Reminder 完成歸屬顯示](../features/reminder-done-attribution.md) | S | Feature Builder | ✅ SHIPPED | `ec8c6fd` |
| insert | [刪除帳號功能](../features/delete-account.md) | M | Feature Builder | ✅ SHIPPED + user-verified | `d5ade48` (+4 follow-ups) |
| 1b | [Repeat reminder 歸屬顯示](../features/repeat-reminder-attribution.md) | S | Feature Builder | ✅ SHIPPED | `3282091` |
| 2 | [家庭 onboarding 重設計（解 B）](../features/family-onboarding-redesign.md) | L | Feature Builder | ✅ 全部 SHIPPED（B1-B3 + B4 rollback） | `60d820c` / `8ebcf72` / `347d71a` / `1a49653` |
| 3 | [家庭 leaderboard 切換](../features/family-leaderboard.md) | M | Feature Builder | ✅ SHIPPED（Phase 0 + 主體） | `32c4feb` + `37ac063` |
| ~~4~~ | Mango dedupe migration | M | Backend | ❌ NOT DOING（user 取消） | — |
| ~~5~~ | 開銷 payer 分析卡 | S | UI/UX | ❌ NOT DOING（user 取消） | — |
| 6 | [Legacy 路徑清理](../features/legacy-path-cleanup.md) | M | Backend | ✅ SHIPPED | `1e380b7` |
| insert | Mobile bottom nav 重組 | S | UI/UX | ✅ SHIPPED | `e34640a` |

**結算**：6 ship + 2 cancel + 2 insert = **8/8 有明確結局**

**Epic 期間 PM 觀察 / 學到的事**：
- **「不要把 edge case 當核心 user story 推導」** — B4 merge wizard、#4 dedupe 都因此被拿掉
- **「家庭是 optional feature」product principle** — 解 B personal mode 上線後讓單身飼主可正常用 App
- **「Push back when user choice mismatches description」** — B vs C / D1 anonymize vs hard delete cascade 都是 PM 義務 surface trade-off 的例子
- **Spec deviation 記錄文化**：每個 Feature Builder ship 後在 spec 末尾寫 deviations，回 PM 可一眼看到實作跟 spec 差在哪
- **Insert / 插隊管理**：delete-account 插隊家庭 epic、Mobile nav 重組從 backlog 升 P1，兩種都按使用者明確要求做，但 PM 都 surface 過 sequencing trade-off

## 下一個（候選 epic — 等使用者選方向）

### Option A: 上架 prerequisite epic（PRD §6 收尾）

PRD §6 列的上架條件未完成項目：

| 條目 | 工作量 | 角色 | 描述 |
|---|---|---|---|
| PWA icons | S | UI/UX | sprint 6 標 PWA SVG 完成但 PNG 用 realfavicongenerator.net 生成 — 沒做 |
| 自訂網域 | S | Backend / ops | 買 mango-pet.app 之類 + DNS + App Hosting 設定 |
| Lighthouse audit > 90 | M | Feature Builder | PWA / Perf / SEO 三軸都要 > 90，可能要 polish |
| App Check（防 API key 盜用） | M | Backend | 防爬 + 防 abuse |
| 資料 export（download my data）| M | Feature Builder | GDPR 平行於 delete-account 的「我的資料權」|
| 隱私 / 服務條款內容審查 | S | PM | 目前是 sprint 6 placeholder，需要實際內容 |

### Option B: 處理 backlog 殘留 P2 條目（quick wins）

| 條目 | 工作量 | 角色 | 描述 |
|---|---|---|---|
| PushToggle cross-context token bug | S | UI/UX or Feature Builder | 跨裝置切 PWA 時 fcmTokens 顯示為已啟用但 PWA 收不到推播 |
| Footer i18n 硬編碼 | XS | Feature Builder | 登入頁 footer「隱私權政策／服務條款」沒走 i18n |
| 好友搜尋 lowercase / 中段 match | M | Backend | 需要 schema 改（displayNameLower shadow field + backfill）|

### Option C: 新功能 / idea section

PM 之前列過：家庭 social push / 家庭活動 timeline / 家庭 leaderboard 週冠軍推播 / 餐廳 Google Places 整合 / 知識庫持續產出 / Analytics 接線

## 想做但還沒規格

> 想法階段。等下個 PM session 規格化或拒絕。

- **資料 export（download my data）**：上面 Option A 列了；GDPR 平行於 delete-account
- **餐廳 Google Places 整合**
- **知識庫持續產出**
- **Analytics / 北極星指標接線**
- **上架 prerequisite 收尾**（Option A 整套）

## 不做（拒絕清單）

> 比「做」更重要。寫下來防止反覆討論同一件事。

- **Web 內背景 GPS 解決方案**
- **AI 寵物顧問聊天**
- **私訊系統**
- **訂閱付費 / 廣告**（DAU 上百之前不討論）
- **強迫所有使用者必須建立家庭才能使用主功能**（PM 解 C 提議 2026-05-23 已被否決）— 違反「家庭是 optional feature」
- **加入家庭時自動 pet merge wizard**（B4 ship 後 2026-05-23 拿掉）— 使用者：「不直觀，因為一般不太有這種狀況」
- **刪帳號時 anonymize 共用資料**（2026-05-23 改 full hard delete cascade）
- **同 family 內同名 pet 合併 / dedupe migration**（#4 2026-05-23 取消）— 罕見情境
- **開銷 payer 分析卡**（#5 2026-05-23 取消）— 家庭 ≤ 5 人總額足用

## 北極星指標（每月看一次）

- 一週活躍家庭數
- 平均每家庭遛狗次數
- AI 收據掃描成功率
- 推播 opt-in 率

> 還沒接 analytics — 目前只能定性觀察。**接 analytics 這件事本身已進入「想做但還沒規格」**，等下個 PM session 決定要不要這個 sprint 規格化。
