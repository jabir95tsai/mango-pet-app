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

_2026-05-22 PM session 已清空。2026-05-23 Feature Builder #2 ship 後新增 2 條 deviation。2026-05-23 Bug Hunter session 加 1 條 push UX。_

### PushToggle probe 把跨 context 的 token 當「已啟用」
- **發現於**：2026-05-23、Bug Hunter session（修 foreground push 之後實測抓到）
- **類型**：bug / 體驗
- **重現 / 觀察**：使用者先在 Windows Chrome 或 iOS Safari 啟用 push（token A 寫進
  `user.fcmTokens`）。之後在 iOS 把 App 加到主畫面、開 PWA、進 Settings。
  `push-toggle.tsx` L60-66 的 probe 看到「PWA 本身 Notification.permission ===
  "granted"」+「user.fcmTokens.length > 0」就直接 setStatus("enabled") 並顯示
  「測試」按鈕；但 fcmTokens 裡那一筆是 Safari/Chrome context 的 token，PWA 從來
  沒 call enablePush → 沒產生過 PWA-specific FCM token。按「測試」→ FCM 接受並回
  sent=1（token A 對 FCM 是 valid）→ APNs 派給 Safari 訂閱，PWA 完全收不到。
  Workaround：PWA 內「停用」→「啟用」重新跑 enablePush → 補上 PWA token。
- **建議交付給**：UI/UX 或 Feature Builder
  - 改 `src/components/settings/push-toggle.tsx` 的 probe：當 `perm === "granted"`
    時不要僅看 `tokens.length > 0`，而是主動呼叫 `getToken({ vapidKey, swReg })`
    拿當前 context 的 token，不在 `user.fcmTokens` 就 arrayUnion 補進去
  - 或較輕量：PushToggle 加一行提示「換裝置 / Safari 切 PWA 後請停用再啟用」
  - 注意 `getToken` 會走網路、可能讓 Settings 初次渲染慢 1–2s，可只在點「測試」
    時做 reconcile，不每次 probe 都跑
- **優先級提示**：P2（本 session 已 ship foreground handler、用戶可用「停用→啟用」
  繞過；但每次切裝置都要手動繞，UX 不順）

### Personal walks 不應進全 App leaderboard — ✅ 已升級到 #3 spec
- **發現於**：2026-05-23、Feature Builder unsupervised run #2 收尾
- **狀態**：✅ 已升級到 [`docs/features/family-leaderboard.md`](../features/family-leaderboard.md) 的 **Phase 0: Prerequisite** 段（PM 2026-05-23 update）。FB session 接 #3 時會一併處理。本 backlog 條目保留為 audit trail，可在 #3 ship 後刪除

### B4 merge callable + 共用 code（永久 dormant，不要順手刪）
- **發現於**：2026-05-23、PM session 接 user「拿掉 merge」決定後
- **類型**：技術債 / dormant code（不是真的「待清理」）
- **重現 / 觀察**：B4 ship + rollback 後 production 還留：
  - `functions/src/index.ts` 的 `mergeAndImportToFamily` callable（無 client caller）
  - 內部搬子集合 + reassign petId + 刪 personal pet doc 的共用 helper
- **建議交付給**：無（不要動）
- **優先級提示**：P3（無 client caller = 零 production 風險）
- **PM 排序（2026-05-23 update）**：**永久 dormant**。原本規劃「併入 #4 dedupe 動工 session 處理」— 但 #4 已被 user 取消（見 `docs/features/mango-dedupe-migration.md`）。Backend session 之後若動 functions/src/index.ts 看到那段 dormant code，**不要順手刪**（保留供未來如真需要 dedupe 時 reactivate）

### Settings 沒加直接到 /onboarding 的 link
- **發現於**：2026-05-23、Feature Builder unsupervised run #2 收尾（spec deviations 段）
- **類型**：體驗 / 小事
- **重現 / 觀察**：#2 spec B2 line 93 寫「Settings 頁顯示『邀請家人 / 加入家庭』入口」—
  Feature Builder 認為既有 family-section 的「加入」「新建」buttons 已滿足，沒額外
  加 `/onboarding` 的明確 link。實際上 `/onboarding` 目前只有「第一次登入」會自動
  進去，使用者後續想看 onboarding 介紹頁要直接輸入 URL
- **建議交付給**：UI/UX 或 Feature Builder（補 1 行 Link 的事）
- **優先級提示**：P3（onboarding 後就不會看了；除非使用者明確想要 settings 入口）
- **PM 排序（2026-05-23）**：等下次 PM session 看是否歸入 Deferred（onboarding 頁
  本來就是首次體驗）

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

### Mobile bottom nav 重組：開銷→排行榜、更多按鈕→設定 link + 更多 drawer 移到設定右上角
- **發現於**：2026-05-23、PM session（user 主動要求 UI 小修）
- **類型**：體驗 / UI 重組
- **重現 / 觀察**：使用者要 mobile bottom nav 5 個 slot 改為：
  - 原 `[home, pets, walks, expenses, more (drawer button)]`
  - 新 `[home, pets, walks, leaderboard, settings]`
  - 原本 bottom 的「更多」drawer 觸發按鈕**移到 settings page 右上角**
  - Desktop sidebar 不變（仍 10 items 一字排開）
- **建議交付給**：UI/UX
  - 改 `src/components/nav/app-nav.tsx`：
    - `MOBILE_PRIMARY_KEYS` 從 `["home", "pets", "walks", "expenses"]` 改成
      `["home", "pets", "walks", "leaderboard", "settings"]`
    - 拿掉 mobile bottom bar 第 5 個 more button — 5 slots 全是 nav link 一字排
    - Drawer state + render 邏輯保留，但觸發點挪走（建議拆到共用 component 或 context）
  - `src/app/app/settings/page.tsx` 或 `src/components/nav/route-header.tsx` 在 settings
    頁加右上角 MoreHorizontal icon button → 點開既有 drawer
  - Drawer 內 overflow items（10 - 5 = 5 個）：feed / expenses / restaurants / knowledge / friends
  - 沒新 i18n key（沿用 Nav.more / Nav.settings / Nav.leaderboard / Nav.expenses 等）
- **優先級提示**：P1（user 主動要求；非阻擋家庭 epic 但 quick win）
- **PM 排序（2026-05-23）**：插隊 — UI/UX session 可立即接，不擋 #3/#6 family epic 收尾
- **⚠️ PM surface UX 觀察**（user 可重新評估）：「更多」drawer 觸發從 bottom nav 移到
  **settings 頁右上角** = 「進入 feed / expenses / restaurants / knowledge / friends」
  變**兩步操作**（先 tap settings → 再 tap more icon → 再 tap 目的地）。原本是一步
  （tap More）。
  - **Alternative**：把 more icon 放在每頁全局 header 右上角（`route-header.tsx`），
    每頁都是一步 tap，更接近標準 mobile app 慣例（漢堡/overflow menu 通常在頂部）
  - 本條目仍按 user 明確要求「設定的右上角」實作；UX 觀察留給 user 實測後決定要不要 redirect

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
