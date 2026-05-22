# Backlog

> 跨角色的「之後再處理」清單。每個角色 session 看到不在自己範圍的事，**寫進這裡再繼續做手上的事**，不要當下分心去修。

## 怎麼用

- 寫入：Bug Hunter、UI/UX、Feature Builder、Backend 在 session 中遇到不該動的事，丟一條進這裡。
- 讀出 / 排序：每個 PM session 開頭看一次，分類、合併、決定下次哪些升到 `docs/roadmap.md`。
- 不要把這裡當 GitHub Issues 用 — 一旦超過 30 條就停下來做一輪 PM session 清理。

## 條目格式

每條一個 H3，照模板填：

```
### [簡短一句話標題]
- **發現於**：YYYY-MM-DD、哪個角色 session
- **類型**：bug / 體驗 / 技術債 / 新功能想法 / 設計
- **重現 / 觀察**：(怎麼觸發到 / 在哪裡看到)
- **建議交付給**：Bug Hunter / UI/UX / Feature / Backend / PM
- **優先級提示**：P0(立即) / P1(下個 sprint) / P2(可等) / P3(也許永遠)
```

P0 = 使用者資料/安全/錢有風險。
P1 = 影響核心功能體驗。
P2 = 小痛點。
P3 = 也許永遠不做的「想法」。

---

## Inbox（未分類）

> 新進來的條目都放這。PM session 會搬到下方分類區。

_2026-05-22 PM session 已清空 — 兩條新條目（好友搜尋 / footer i18n）已搬到對應分類區。_

### [範例] 重複的 Mango pet
- **發現於**：2026-05-21、Bug Hunter session
- **類型**：bug / 資料殘留
- **重現 / 觀察**：`/app/pets` 顯示兩隻 Mango，因為 legacy 路徑曾建立兩次，
  migration 忠實搬了過來
- **建議交付給**：Bug Hunter（手動刪一隻即可）或 Backend（寫去重 migration）
- **優先級提示**：P2
- **狀態**：✅ 已升級 → `docs/features/mango-dedupe-migration.md`（PM 2026-05-22）。保留條目當教學範例。

---

## 已分類 — Bug Hunter 接

（PM session 從 Inbox 搬過來）

_目前沒有條目。下一個 PM session 過 Inbox 時新增。_

---

## 已分類 — UI/UX 接

_目前沒有條目。下一個 PM session 過 Inbox 時新增。_

---

## 已分類 — Feature Builder 接

### 未登入首頁 footer 連結文字硬編碼中文，沒走 i18n
- **發現於**：2026-05-22、UI/UX session（登入頁加 icon + 置中時順手看到）
- **類型**：體驗 / 技術債
- **重現 / 觀察**：`/`（未登入首頁）右上切到 EN，標題與按鈕都英文，但 footer 仍顯示
  「隱私權政策／服務條款」。位置：`src/app/page.tsx` L65 與 L68，文字直接寫死，
  沒經過 `getTranslations`。
- **建議交付給**：Feature Builder
  - 在 `messages/zh-TW.json` 與 `messages/en.json` 新增 key（建議放 `Common`，
    例如 `Common.privacy` / `Common.terms`，或新開 `Legal` namespace）
  - 改 `src/app/page.tsx` 用 `getTranslations(...)` 取代寫死字串
  - UI/UX 角色約定不新增 i18n key，所以本次 session 沒順手修
- **優先級提示**：P2（不影響功能，但對英文使用者觀感不一致；登入頁是 first
  impression，建議在下次 i18n batch 一起補）
- **PM 排序（2026-05-22）**：家庭功能 epic 收完後找空檔順手做；不另寫 spec（backlog
  條目已足夠 Feature Builder 接手）

---

## 已分類 — Backend 接

### 好友搜尋無法 case-insensitive / 中段 match
- **發現於**：2026-05-22、Bug Hunter session（「無法加好友」修完之後留的限制）
- **類型**：技術債 / 體驗
- **重現 / 觀察**：`/app/friends` → 搜尋 → 輸入「jabir」（小寫）找不到 displayName
  是「蔡智博Jabir」的人；輸入「Jabir」也找不到，因為 Firestore range query 是
  case-sensitive 且只能 prefix-match，「蔡智博Jabir」prefix 是「蔡」不是「Jabir」。
  Bug Hunter 已修最明顯的 bug（強制 .toLowerCase() 讓任何含大寫字母的名字都搜
  不到 — 見 commit），但完整的 case-insensitive + 中段 match 需要 schema 改動。
- **建議交付給**：Backend
  - 加 `displayNameLower` shadow field 到 `users/*`
  - upsertUser 寫入時同步寫 lowercase 版本
  - 寫一次 backfill migration 補齊 existing docs
  - 改 `searchUsers` 改打 `displayNameLower` 欄位
- **優先級提示**：P2（社群人數還小、QR + 完整 displayName prefix 搜尋已 cover
  大多數使用情境）
- **PM 排序（2026-05-22）**：家庭功能 epic 之後排序；屬 PRD §3.6 social 區。
  動工前 PM session 需把這條升級為 `docs/features/friends-search-lowercase.md` spec
  （含 backfill 步驟 + schema 影響面）。目前不擋家庭 epic。

_其他 Backend 項目見 `docs/roadmap.md` 的「下一個」與 `docs/features/mango-dedupe-migration.md`。_

---

## Deferred / 不做

> PM 決定不做的條目搬來這裡 + 寫理由。比刪掉好，下次有人想重提時直接擋下。

### [範例] 內建 QR scanner
- **理由**：iPhone / Android 原生相機都能掃 QR 並開 URL，App 內建 scanner
  增加 camera permission 摩擦 + bundle size，CP 值低。
