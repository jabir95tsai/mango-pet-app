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

_2026-05-22 PM session 已清空。2026-05-23 Feature Builder #2 ship 後新增 2 條 deviation。2026-05-23 Bug Hunter session 加 1 條 push UX。2026-05-25 Feature Builder 加 1 條家庭邀請連結 follow-up。_

### `/join/{code}` 在 LINE→iOS Safari context 下偶發 React #300（cannot reproduce desktop）
- **發現於**：2026-05-25、Bug Hunter session（修完 `getNextPath` allowlist 後實測抓到）
- **類型**：bug / 環境相依 / 未確認是否真實
- **重現 / 觀察**：使用者從 LINE 點分享出去的 `/join/{6位數}` 連結 → LINE 把 user 帶到 iOS Safari（網址列頂端有「◀LINE」返回鍵）→ 頁面跳 `🥭💔 出了點狀況` + `Minified React error #300; visit https://react.dev/errors/300`。React 19 的 #300 = 「Rendered fewer hooks than expected. This may be caused by an accidental early return statement.」典型成因是某個 component render 之間 hook 數量不同。
  Bug Hunter 已 audit `/join` render tree 全部 component（`RootLayout` providers / `RequireAuth` / `JoinInner` / `ConfirmProvider` / `Dialog` / `AuthProvider` / `FamilyProvider`）— 全都無條件呼叫 hooks、順序固定。Desktop Chrome MCP 訪問 `/join/123456` 完全不重現（顯示「邀請碼無效」是 expected）。SSR HTML 用 iOS UA spoof curl 出來內容也正常（含 `joining` / `loading` / `signIn` 各分支）。
  使用者最後**成功加入**（不確定走哪條路徑 — 可能 React #300 是 stale chunk transient、可能改走 settings 內手動輸入 6 位數 dialog 繞過）。
- **建議交付給**：Bug Hunter（如果之後再復發）
  - 必要：先請使用者連 Mac Web Inspector 抓 **unminified** stack trace、或在 `src/app/error.tsx` 暫加 `console.error(error.stack)` 並 deploy 後叫使用者重現
  - 可能 root cause 排查方向：(a) iOS Safari 從 LINE 過來時 `navigator.language` / cookies / `referer` 觸發某個 `typeof window` / `useSyncExternalStore` race；(b) firebase 在 LINE referer 的 Safari context 下 init 行為不同導致 `useFamily` / `useAuth` 在某 render hook count diff；(c) Next.js 16 + React 19 hydration race 在 cold iOS Safari 才會中
  - workaround（user 已知）：被邀請的人到 settings → 加入家庭 dialog → 手動貼 6 位數邀請碼，完全繞過 `/join/{code}` 路由
- **優先級提示**：P2 暫定（user 已能加入；但分享連結是核心邀請 UX，下次有人回報就要升 P1）
- **PM 排序**：下個 PM session 看是否升 spec — 如果只是 stale chunk transient 就 dismiss 入 Deferred；如果再有人回報，升 Bug Hunter 接

### 家庭邀請連結 follow-up — minimal slice 已 ship，PM 後續排序「進階版」
- **發現於**：2026-05-25、Feature Builder session（user 直接要求 minimal slice 動工 + 同時要 backlog 條目留 paper trail）
- **類型**：體驗 / 新功能想法（v1.5 polish）
- **重現 / 觀察**：本 session 已 ship 的 minimal slice：
  - `/join/{6位 inviteCode}` deep-link route
  - 點 → 自動 `joinFamilyByCode` → 成功 redirect `/app`
  - 沿用既有 already-member / not-found 錯誤訊息
  - Share UX：`navigator.share` + clipboard fallback (已加 button in family-section)
  - 用既有 inviteCode（無新 schema）— 完全 additive，零既有 user 影響
- **沒做（PM 之後決定的 ambiguous 點）**：
  - **Preview page**：點開 link 是否顯示「{family.name} 邀請你加入，有 N 人 + N 隻寵物」preview，按確認才 join？ 需要新 callable 給 unauthenticated preview（rules 限 member 才能讀 family doc）
  - **Link 過期**：schema 預留 `inviteCodeExpiresAt` 但從未實作；要不要 regenerate 連動連結失效？
  - **濫用防範**：連結比手動 6 位數 一鍵 join 摩擦低，是否要 owner approval 步驟？
  - **QR code 顯示**：既有 backlog Deferred 的「內建 QR scanner」是 scan 方向；display QR 是不同方向，工作量低
  - **多家庭 currentFamilyId 切換**：join 後該 family 不一定設成 active；UX 上要不要自動切？
- **建議交付給**：PM（升 spec 後再 Feature Builder）
- **優先級提示**：P3（minimal slice 已可用；polish 等使用者實際反映摩擦再排）
- **PM 排序提示**：在 user 實測 minimal slice 後，挑 1-2 個 polish 項合一個 spec（preview page + QR display 是最自然的下一步）
- **發現於**：2026-05-23、Bug Hunter session
- **狀態**：✅ SHIPPED `9f1dc67`（Feature Builder 2026-05-23）— 新 `reconcileCurrentToken(uid)` helper in `src/lib/firebase/messaging.ts` 主動 `getToken({ vapidKey, swReg })` 拿當前 context 的 token，arrayUnion 進 `user.fcmTokens`（idempotent）。`push-toggle.tsx` probe 改在 `perm === "granted"` 時呼叫 reconcile，不再僅看 `tokens.length > 0`。Cost: 多一次 ~1s getToken 網路 call per Settings 開啟（acceptable，使用者不常開）。原本「PWA 內停用→啟用」 workaround 不需要了 — 新 context 第一次進 settings 自動 reconcile

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

### Default landing 改為 /app/walks（剛打開 app 直接到遛狗頁）
- **發現於**：2026-05-24、user 主動要求
- **類型**：UI 體驗 / routing
- **重現 / 觀察**：User 原話「我想要剛打開 app 就是遛狗那一頁」。對齊 walks-core
  principle「Mango Pet 的核心是遛狗」。目前登入後 default landing 是 `/app`
  （home），但 walks 是核心動作 — 應該直接打開就到遛狗頁
- **建議交付給**：UI/UX（routing 改動 + PWA manifest）
- **改到的檔案**：
  - 登入 callback / `(auth)` 路徑：redirect target 從 `/app` 改為 `/app/walks`
    （grep `redirect.*\/app` 看實際 in 哪個 file — 通常在 sign-in callback / router push 處）
  - `public/manifest.json`：`start_url` 從 `/app` 改 `/app/walks`（PWA 加主畫面 → 開啟直接 walks）
  - `src/components/auth/require-auth.tsx`（如有 default route logic）
- **PM 預設**：
  - 登入後 default landing → `/app/walks`
  - PWA `start_url` → `/app/walks`
  - `/app` 直接訪問 **不 redirect**（user 從 nav 點 home icon 仍能進去看 feed timeline）
  - Mobile bottom nav 第一個 **仍是 home icon → /app**（不破壞既有導航習慣）
- **不在範圍**：
  - 重組 mobile bottom nav primary slots
  - 改 /app home page 內容（feed timeline 不變）
  - 改 desktop sidebar order
- **優先級提示**：P1（user 主動要 + 對齊 product vision）
- **PM 排序（2026-05-24）**：UI/UX session 可立即接，工作量 S。獨立工作，不擋其他
- **✅ SHIPPED** `5856e18`（UI/UX session 2026-05-24）— 4 個 touchpoint 全翻 `/app/walks`：
  - `src/app/page.tsx` `getNextPath` default fallback（無 `?next=` query 時的 fresh sign-in 路徑）
  - `src/components/auth/sign-in-buttons.tsx` Props default（belt-and-suspenders）
  - `src/app/onboarding/page.tsx` 3 處：skip / 完成 import / already-in-family fallback Link
  - `public/manifest.json` `start_url`
  - **未動**（spec 明確要求保留）：`app-nav.tsx` 的 home icon `href="/app"`；`/app` 頁本身（不 redirect）；`RequireAuth` 的 `?next=` 保留邏輯
  - **Chrome MCP 驗證 production**：
    - `/manifest.json` curl → `"start_url": "/app/walks"` ✓
    - 已登入 user 訪問 `/` → finalUrl `/app/walks`（SignInButtons useEffect 用新 nextPath default）✓
    - 訪問 `/app` → finalUrl `/app`、`didNotRedirect: true`、heading「🥭 芒果寵物」、feed + pets sections render ✓
    - 確認 nav home icon 仍 `/app`：sidebar `href="/app"` + bottomBar `href="/app"` ✓
  - **未直接驗證**（環境限制）：實際 sign-out + OAuth sign-in flow（需要使用者互動）+ PWA add-to-home-screen install（需要 OS）— 但已透過已登入 user 訪問 `/` 走 SignInButtons useEffect 同條 redirect path 證明 default landing 正確

### walks 頁加 sticky bottom CTA（解 A — user 2026-05-24 確認）
- **發現於**：2026-05-24、PM session push-back of user「按鈕移到下方」原始需求 → user 選解 A
- **類型**：體驗 / UI
- **重現 / 觀察**：User 原本想「把開始遛狗按鈕移到下方」，PM push-back 因為違反 walk-core spec 的「3 秒看到開始」核心 principle。User 選**解 A**：
  - **上方仍是 Hero 大按鈕「開始遛狗」**（保留 walk-core v1 設計，不動）
  - **新增 sticky bottom CTA「開始遛狗」**固定在 mobile viewport 底部，符合 iPhone thumb reach
  - Desktop 不顯示 sticky bottom（sidebar 已含 walks link，沒必要）
- **建議交付給**：UI/UX
  - 改 `src/app/app/walks/page.tsx`：加 sticky bottom button container（`fixed bottom-0 left-0 right-0 md:hidden` + safe-area-inset-bottom）
  - 按鈕跟既有 Hero 按鈕點擊行為相同（都觸發 walk-tracking-view 開啟）
  - 追蹤中 (tracking-view 開啟) 時 sticky bottom **隱藏**（已是 full-screen tracking）
  - 完成畫面 / 0-pet empty state / 0-寵物 disabled 狀態都對齊既有 Hero 按鈕邏輯
  - 沿用既有 i18n key `Walks.core.startWalk`（不新增）
- **優先級提示**：P2（user 主動要求；不擋其他工作；純 UI 加 layer）
- **PM 排序（2026-05-24）**：walks-v2 已 ship 完，這條接著做收尾 user 的「按鈕位置」需求；UI/UX session 可立即接，工作量 S
- **✅ SHIPPED** `5c1429e`（UI/UX session 2026-05-24 ~11:19 push，App Hosting build 完成 ~11:30）
  - 單檔改 `src/app/app/walks/page.tsx`：加 `<div className="fixed inset-x-0 z-20 border-t bg-white/95 backdrop-blur md:hidden ..." style={{bottom: "calc(env(safe-area-inset-bottom) + 3.75rem)"}}>` 包住一顆 `<Button>` 重用 Hero 的 `setSessionOpen(true)` handler；以 `{!sessionOpen && ...}` 守 tracking view 開啟時 unmount
  - 配 `h-16 md:hidden` aria-hidden 的 spacer 避免 sticky 蓋住底部「手動補登」
  - 沿用 `Walks.core.startWalking` i18n key（無新增）
  - 0-寵物 自動跟著 Hero 同 path：page 早 `return <EmptyState />`，sticky 連同 Hero 都不渲染
  - 驗證（Chrome MCP DOM probe + 視覺）：
    - Desktop @ 2560×1317：`stickyFound: true`、`position: fixed`、`bottom: 60px`、**`md:hidden` → `display: none`**、`rect: 0×0`（正確隱藏，截圖無 sticky 視覺）
    - Force-show（移除 md:hidden 模擬 mobile）：sticky bar 浮在 viewport 底部 73px 高、border-top + bg-white/95 + 橘色「開始遛狗」全寬，與既有 bottom nav 視覺一致
    - Click Hero CTA → `trackingViewOpen: true`、`stickyStillInDom: false`，tracking view 接管全屏，sticky 自 DOM 完全 unmount（不只 hide）
  - **未直接驗證**：mobile 真實 viewport 視覺（resize_window 對 maximized Chrome window 不生效，跟 walk-core / nav-reshuffle session 同環境限制）— DOM + force-show 已覆蓋結構與樣式

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
- **✅ SHIPPED** `e34640a`（UI/UX session 2026-05-23 ~21:16 push、~21:22 App Hosting build 完成）
  - 5 files：新增 `src/components/nav/nav-drawer-context.tsx`、改 `app/app/layout.tsx`、
    `app-nav.tsx`、`route-header.tsx`（加 optional `action` slot）、`app/app/settings/page.tsx`
  - Drawer state 提升到 `NavDrawerProvider` (context)，AppNav 仍渲染 drawer，trigger 從
    bottom nav 挪到 settings page header 右上角
  - 驗證（Chrome MCP DOM probe，window maximized 無法縮 mobile viewport）：mobile 5 links
    `[/app, /app/pets, /app/walks, /app/leaderboard, /app/settings]`、`mobileButtonCount: 0`、
    drawer overflow 5 items `[feed, expenses, restaurants, knowledge, friends]` in
    `grid grid-cols-3`、desktop sidebar 10 links 不變、settings header trigger `aria-label="更多"`
    `md:hidden`、`dark:` classes 完整保留
  - Force-show mobile bottom nav 截圖確認 active state（home page → 首頁 amber 高亮）

---

## 已分類 — Feature Builder 接

### 未登入首頁 footer 連結文字硬編碼中文，沒走 i18n — ✅ SHIPPED
- **發現於**：2026-05-22、UI/UX session
- **狀態**：✅ SHIPPED `634e8c6`（Feature Builder 2026-05-23）— 加 `Common.privacy` / `Common.terms` (zh-TW + en)；`src/app/page.tsx` 改用 `getTranslations("Common")` 取代寫死字串。EN locale 從原本顯示「隱私權政策」改為「Privacy Policy」

---

## 已分類 — Backend 接

### 好友搜尋無法 case-insensitive / 中段 match — ✅ 已升級到 spec
- **發現於**：2026-05-22、Bug Hunter session
- **狀態**：✅ 已升級到 [`docs/features/friends-search-lowercase.md`](../features/friends-search-lowercase.md)（PM 2026-05-23）。
  動工順序見 roadmap「上架收尾 + backlog P2 epic」表 #5。中段 match 仍不在 spec 範圍（需 Algolia/Typesense）— 留 backlog 級觀察

_其他 Backend 項目見 `docs/roadmap.md` 的「下一個」與 `docs/features/mango-dedupe-migration.md`。_

---

## Deferred / 不做

> PM 決定不做的條目搬來這裡 + 寫理由。比刪掉好，下次有人想重提時直接擋下。

### [範例] 內建 QR scanner
- **理由**：iPhone / Android 原生相機都能掃 QR 並開 URL，App 內建 scanner
  增加 camera permission 摩擦 + bundle size，CP 值低。
