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

_2026-05-29 PWA PM session 已清空一輪：原 Inbox 10 條全 triage 完 — 4 條 SHIPPED/RESOLVED 收進「已處理（audit trail）」、1 條 doc-accuracy 當場修掉、2 條升到對應角色待接、3 條(QR scanner / B4 dormant / settings onboarding link)歸 Deferred。下一個角色 session 新發現的事丟這裡。_

### 📋 全專案健檢 audit-2026-06 — 發現清單待 PM triage（索引條目）
- **發現於**：2026-06-11、audit session（獨立 worktree，唯讀掃描 + 抽查驗證）
- **類型**：技術債 / 安全 / 成本 / 設計一致性（綜合）
- **重現 / 觀察**：完整報告在 [`docs/research/audit-2026-06.md`](../research/audit-2026-06.md)。**P0 新發現 0 條 / P1 1 條 / P2 6 條 / P3 13 條**。重點：App Check 殘餘三件（enforce + GCP key 限制 + iOS）、btn-mango 對比矛盾（見下條）、users rules 無欄位白名單（見下條）、`doc.data() as X` 無 runtime 驗證（40+ 處）、aggregateLeaderboards 成本成長（見下條）、design-system drift 量化（zinc 59 檔 / amber 44 檔 / rounded ~170 處，§7 範圍應擴大到 `ui/` primitives）、walk 統計 helpers 重複 4 份（roadmap 既有 follow-up「stat helpers 收 shared-business」的精確檔位已補在報告 P2-6）。報告含「已排除誤報」與「合格亮點」區（a11y/reduced-motion 全面合格），未來 audit 不用重查。
- **建議交付給**：PM（讀報告 §1 排序、§4 per-角色摘要直接派工）
- **優先級提示**：P1（內含 P1/P2 條目，索引本身下個 PM session 處理）

### 🎨 btn-mango 白字對比 2.6:1（AA fail）+ SoT/註解/實作三方矛盾 — 待 PM 裁決
- **發現於**：2026-06-11、audit session
- **類型**：設計 / a11y / 文件矛盾
- **重現 / 觀察**：`.btn-mango`（`apps/web/src/app/globals.css:145-152`）`color:#fff` on mango 漸層，white on #f39800 = 2.6:1 < AA 4.5:1。但 `globals.css:26` a11y 註解寫「CTAs put ink #231B14 on brand instead」（與實作矛盾），而 design-system §4 拍板「主鈕漸層**白字**」、iOS re-skin 也拍板 white-on-gradient → 三方不一致。**不可單方面改**（雙平台品牌決策）。
- **✅ PM 裁決（user 2026-06-03）= 選項 b**：**保留白字、漸層加深讓白字達大字 AA ≥3:1**（字落在 brandDeep 為主的深橘區；不改成 ink）。已鎖進 `docs/design-system.md` §4。
- **建議交付給**：UI/UX 執行 —（1）`.btn-mango`（`globals.css:145-152`）漸層加深至白字 ≥3:1；（2）**修正 `globals.css:26` 那句錯誤註解**「CTAs put ink on brand」（與 SoT/實作不符）；（3）雙平台一致（iOS 同步）。改後 Chrome MCP 量對比驗 ≥3:1。
- **優先級提示**：P2

### 🔒 users/{uid} update rule 無欄位白名單（可寫任意欄位進自己 doc）
- **發現於**：2026-06-11、audit session
- **類型**：技術債 / 安全硬化
- **重現 / 觀察**：`firestore.rules:47` `allow update: if request.auth.uid == uid;` 無 `hasOnly()`/型別約束 → user 可往自己 public profile doc 寫任意欄位（垃圾欄位、偽 `isGuest` 顯示值、超大 doc）。緩解：rules `isGuest()` 是 token-based 不受 doc 欄位影響、PII 已移 private 子集合（#2 done）→ 影響限資料品質非權限突破。
- **建議交付給**：Backend（加欄位白名單，對齊 pets/photoDownloadState 既有寫法；可掛 security-hardening spec 補 #5）
- **優先級提示**：P2

### 💰 aggregateLeaderboards 每日全量掃 walks，讀量隨歷史資料無上限成長
- **發現於**：2026-06-11、audit session
- **類型**：技術債 / 成本（成本即優先級）
- **重現 / 觀察**：`functions/src/index.ts:406-409` 每日 cron `collectionGroup("walks").where("familyId","!=",null).get()` 無時間下界全量讀，+ 每 walker × 3 期間重查（all_time 每天重讀該 walker 全部 walks）。code 註解自承是共用 realtime codepath 的刻意 tradeoff — 現在量小可忽略，但這是 app 內唯一隨總 walk 數單調成長的每日全量掃描，量大前要還。選項見報告 P2-4。
- **建議交付給**：Backend
- **優先級提示**：P2（觸發條件：walks 總數上萬或 Firestore 帳單可見時升 P1）

### 🚨 production 早上/下午斷續「進不去」（2026-05-30 user 回報）
- **發現於**：2026-05-30、PWA PM session（user 回報「今天早上下午好像 app 進不去」）
- **類型**：bug / production incident / availability
- **重現 / 觀察**：
  - User 主觀回報 2026-05-30 早上+下午時段 app 進不去（未提供確切時間 / 錯誤畫面 / 是哪個 URL）。
  - PWA PM 當下(下午稍晚) triage：prod `https://mango-pet--mango-pet-app.asia-east1.hosted.app/` **HTTP 200 / 0.2s，已恢復**。
  - origin/main 今天**無任何 production code commit**（最後 code = `23ad3a0`，數天前；今天全是 `docs(pm)` 系列：`4086e93` `ea00f37` `901d010` `0b72bd4` 等）。
  - working tree 的 `apps/web` 是空目錄、未追蹤、不在 origin/main → 排除「monorepo 搬家弄掛 prod」。
- **PM 主要假設（待 Bug Hunter 用 App Hosting build log 證實/推翻）**：今天為 docs 連續多次 `git push origin main`，每次都觸發 App Hosting auto-build（~5-8 min/次）。多個 rebuild 窗口期間 revision 切換可能短暫 503 → 對應 user「早上下午斷續進不去」。純 docs 改動觸發前端重部署是 root process 問題。
- **建議交付給**：Bug Hunter（查 App Hosting build / request log 在 user 回報時段是否有 failed build / 503 / cold-start；確認是否每次 docs push 都重建）；若證實流程問題 → 回 PM 評估「docs-only 改動不該重部署前端」(e.g. App Hosting ignore paths / docs 改走非 main 路徑)
- **優先級提示**：P0（app 進不去 = 核心可用性；雖當下已恢復，需確認是否會復發 + 是否每次 push 都中斷）
- **待 user 補充**（幫 Bug Hunter 縮範圍）：確切時間區間？看到的是白畫面 / 轉圈 / 錯誤訊息 / 連不上？手機 PWA 還是瀏覽器？只有自己還是家人也中？

### ✅ 使用者頭像在首頁 + 設定頁顯示成文字（initials）— RESOLVED `7a61b2c`（2026-06-01 Bug Hunter）
- **發現於**：2026-06-01、PWA PM session（user 回報）
- **類型**：bug / UI / 系統性（已證實）
- **重現 / 觀察**：user 回報「首頁、設定頁我的頭像圖片沒正確顯示，顯示文字」。Chrome MCP 在 prod `/app` 重現：首頁「發文」slot 顯示「YO」(= `initialsOf("You")`)，無 `<img>`；同帳號 feed 貼文頭像、Mango/錢錢 寵物頭像照片**正常載入**。
- **✅ 真 root cause（推翻 PM 假設）**：不是「photoURL 為 falsy 因 profile doc 沒存」，也不是網域白名單 / 載圖失敗。讀取 prod IndexedDB `firebaseLocalStorage` 的 auth user 物件：
  - **top-level `user.photoURL` = null、`user.displayName` = null**
  - 但 `providerData[0]`（google.com）`photoURL` 在（len 98）、`displayName` = "蔡智博Jabir"；`providerData[1]` = apple.com（兩者皆 null）。
  - → 這是**多 provider 連結帳號（Google + Apple，經 `auth.ts` 的 `linkWithCredential`）**的 Firebase 典型坑：linkWithCredential 後 top-level 聚合欄位被清成 null（Apple 不給 photoURL、name 只給一次），但 provider 子項還留著 Google 的真值。
  - 自己頭像讀取路徑直接用 top-level `user?.photoURL`（null）→ src falsy → 顯示 initials；`displayName`（null）→ fallback "You" → "YO"。feed 頭像正常是因為它讀 Firestore post doc 的 denormalized `authorPhotoURL`，不是 live auth。
- **最小修法（已 ship）**：`lib/firebase/auth.ts` 新增純 helper `resolveUserPhotoURL` / `resolveUserDisplayName`（top-level 優先，null 時 fallback 到第一個有值的 `providerData`），套到兩個回報點（your-story-avatar、settings page）。純讀取路徑、不動 auth state。Chrome MCP 部署後回驗通過。
- **🆕 衍生 handoff（系統性寫入側，未修，交 Backend / Feature）**：見下方「已分類 — Backend 接」新條目「多-provider 帳號 top-level photoURL/displayName=null 污染所有 denormalized 寫入」。同一個 root cause 也讓 `upsertUser` 與所有 author/walker/payer denormalized 寫入點存 null；本次只修了「自己頭像顯示」，寫入側＋既有髒資料 backfill 不在 Bug Hunter 範圍。
- **優先級提示**：顯示 bug 已 RESOLVED（原 P2）。衍生寫入側建議 P1（系統性、影響多人看到的 denormalized 名字/頭像）。

---

## 已分類 — Bug Hunter 接

### `/join/{code}` 在 LINE→iOS Safari context 下偶發 React #300（推測已根治，待 user 驗）
- **發現於**：2026-05-25、Bug Hunter session
- **類型**：bug / 環境相依 / 未確認是否仍存在
- **✅ 2026-05-26 推測已根治**：真兇 = `src/app/app/walks/page.tsx` confetti `useEffect` 寫在 0-pet 早 return **之下**，hook count 38 vs 37 在 transition path mismatch → React #300。Fix `ad90acf` 把 useEffect 搬到早 return 上面。推測 5/25 `/join` 那次也是同條 — `/join` 自身 render tree 乾淨，撞的是成功 redirect 落地 `/app/walks` 的 cold-start race（loading false + pets [] 瞬間）。Desktop Chrome MCP 訪 `/join/123456` 無法重現；iOS UA spoof curl SSR 也正常。
- **建議交付給**：Bug Hunter（僅在 user 清完 PWA cache 重裝後仍復發才再開挖；若不復發 → 移到「已處理」關閉）
- **優先級提示**：待 user 驗證；不復發即關閉
- **PM 排序（2026-05-29）**：保留待 user 實機驗證。iOS P0 期間不動 `src/`，本條等 user 回報結果再決定關閉或重開。

---

## 已分類 — UI/UX 接

### walks-auto-photo-share：短 walk (< 1 min) 結束 prompt 顯示「走了 0 分」
- **發現於**：2026-05-26、Bug Hunter session（跑 0.4 分鐘 test walk 觸發）
- **類型**：體驗 / polish
- **重現 / 觀察**：`/app/walks` 開始遛狗 → [跳過] → 任意秒數 → 停止 → 1s 後 end prompt body「Mango 今天走了 0 分，留個紀念」。只在 walk durationMinutes < 1 觸發。Root：`WalksPhotoPrompt.captionEndDefault` interp `{min}` 拿到 `Math.floor(seconds/60) = 0`。
- **建議交付給**：UI/UX（i18n copy）或 Bug Hunter（一行 `Math.max(1, Math.floor(...))` 或 `Math.round`）
  - 改點：`src/components/walks/walk-tracking-view.tsx` end-photo flow 傳 `walkMinutes` 給 `PhotoPromptSheet` 那行；或 `PhotoPromptSheet` 內 clamp
- **優先級提示**：P3（真實使用者不會走 0.4 分鐘）
- **PM 排序（2026-05-29）**：保留 P3。下個 UI/UX session 順手一行；iOS P0 freeze 期間不動 `src/`，不插隊。

---

## 已分類 — Feature Builder 接

_目前沒有 active 條目。已 SHIPPED 的見「已處理（audit trail）」。_

---

## 已分類 — Backend 接

### ⚠️ main working tree 卡未解 stash-pop conflict in `functions/src/index.ts`（#3 family-leaderboard）
- **發現於**：2026-06-01、Cross-platform PM session（user 回報）
- **類型**：技術債 / 工作流 blocker（**local-only,origin/main 乾淨、production 無影響**）
- **狀態（grounding）**：`git status` = `both modified: functions/src/index.ts`（unmerged）。conflict markers 在**行 350–369、374–388** 兩段。stash 仍有兩筆未處理:
  - `stash@{0}`：#3 family-leaderboard Phase 0 **v2**（newer Feature Builder iteration）
  - `stash@{1}`：#3 family-leaderboard Phase 0（`familyId != null` filter）— 註記「not mine」
  - 另有 untracked `docs/features/achievements-badges.md`（新 feature 草稿,不擋 commit;見下方 PM 註記）
- **為什麼要處理**：git 在有 unmerged paths 時**拒絕任何 commit**（不只 functions/）→ 這個 working tree 裡**所有 session 都 commit 不了**,含已放行的 iOS Feature Builder P0 Step 7。
- **建議交付給**：Backend（**不是 iOS P2**;這是既有 web/functions #3 family-leaderboard 的遺留,跟 iOS pets port 無關）。需判斷 `stash@{0}` v2 vs `stash@{1}` 哪個是要的版本、解 conflict、跑 `npx tsc --noEmit`（functions）、決定是否 `npx firebase deploy --only functions:<name>`,然後 `git stash drop` 清掉殘留。
- **優先級提示**：**P1**（不是 P0:無資料/安全/錢風險、origin 乾淨;但擋住本機所有 commit/push 工作流）。
- **PM 排序（2026-06-01 Cross-platform PM）**：
  - **iOS Feature Builder 不要在這個 working tree 開工**直到 conflict 解掉;或改用 **git worktree**（[`../team/README.md`](../team/README.md) §並行 / [`../features/ios-pwa-parallel-policy.md`](../features/ios-pwa-parallel-policy.md) §4）— 從 origin/main 開新 worktree 的 index 是乾淨的,可繞過此 local 卡點並行 iOS。
  - `achievements-badges.md` 看起來是**新 feature 探索**。iOS 開發期間依 parallel-policy §2 = 「新 feature 預設不做」;若要推進需先過「誰先做」決策樹（web-first / cross-platform / 延後）。交 PM 排序,不在本條範圍。

### ✅ 多-provider 帳號 top-level `photoURL`/`displayName`=null 污染所有 denormalized 寫入 — RESOLVED `c7a02a5`（2026-06-01 Bug Hunter，user 要求修根本原因）
- **觸發**：user 回報「排行榜頭像仍錯誤」。Chrome MCP prod 重現：人(walker)榜總榜自己那列顯示 initials「JA」+ 名字「jabir95tsai」，其他單一-provider 使用者正常。
- **證實的 root cause 鏈**：walker 榜聚合（`functions/src/leaderboard-helpers.ts:155-160`）直接讀 `users/{uid}` doc 的 `displayName`/`photoURL`；該 doc 由 `upsertUser` 用 top-level（null）寫入 → 存了 `displayName="jabir95tsai"`(email prefix fallback)、`photoURL=null` → 榜忠實顯示 null。
- **✅ 已 ship 的 root-cause 修法（`c7a02a5`，兩層）**：
  1. `auth.ts` `syncAuthProfileFromProviders()`：登入時（`upsertUser` 前）若 top-level null 但 providerData 有值，`updateProfile` 把 top-level 補回（idempotent guard，不覆寫既有非 null）。一併修好所有 action-time denormalized 寫入（post author / walk walker / expense payer）。
  2. `upsertUser` 改用 `resolveUserDisplayName`/`resolveUserPhotoURL`（providerData fallback）→ users doc（榜的來源）即使 updateProfile 失敗也正確。
- **部署驗證**：重登後 prod 實測 — Auth top-level 已補回（displayName="蔡智博Jabir"、photoURL len98）；`users/{uid}` doc 經 Firestore REST 讀回 **displayName="蔡智博Jabir"、photoURL=lh3...len98**（原 "jabir95tsai"/null）。榜的 entry 是快取投影，自然修復：今晚 00:30 cron 或下次遛狗的 realtime recompute 重讀 users doc 後即顯示照片（user 選自然修復，未手動觸發 cron — 手動觸發會重寫全使用者共用榜資料，已被 auto-mode classifier 擋下且 user 不需要）。
- **舊（未修時）的觀察記錄**：
- **發現於**：2026-06-01、Bug Hunter session（修「自己頭像顯示成文字」`7a61b2c` 時挖出的衍生 root cause）
- **類型**：bug / 系統性資料品質 / 技術債
- **重現 / 觀察**：多 provider 連結帳號（已實證：Google + Apple，經 `auth.ts` `linkWithCredential`）的 Firebase Auth **top-level `user.photoURL` / `user.displayName` 為 null**，真值只留在 `providerData[0]`（google.com）。Bug Hunter 已用 helper 修了「讀取顯示」側，但**寫入側全都直接讀 top-level `user.photoURL`/`user.displayName`**，會把 null 寫進 Firestore：
  - `lib/firebase/users.ts:50-51` `upsertUser`（users doc 的 `photoURL` / `displayName`）
  - `components/feed/post-composer.tsx:141-142`（post `authorName` / `authorPhotoURL`）
  - `app/app/walks/page.tsx:284-285`（walk `walkerName` / `walkerPhotoURL`）
  - `app/app/restaurants/[restaurantId]/page.tsx:96-97`（review author）
  - `components/friends/friend-search.tsx:50-51`、`app/app/friends/add/page.tsx:64-65`（friend 卡 displayName/photoURL）
  - `components/pets/pets-page-content.tsx:276`（expense `payerName`）
  - → 受影響帳號之後新建的貼文/遛狗/開銷/評論/好友卡，**別人看到的名字會 fallback、頭像會變 initials**。目前 feed 看起來正常是因為舊 doc 是 top-level 還沒被清成 null 時寫的。
- **建議修法（root cause，一次解讀+寫兩側）**：登入路徑（`AuthProvider` 的 `upsertUser` hook 附近）偵測 top-level 為 null 但 providerData 有值時，呼叫 `updateProfile(user, { displayName, photoURL })` 把 top-level 補回 → 所有讀/寫點自動正確、且持久化到 Auth。或最低限度：所有寫入點改用本次新增的 `resolveUserPhotoURL`/`resolveUserDisplayName` helper。
  - 另需評估：對既有已寫 null 的 Firestore docs 做一次性 backfill（migration）— 屬 Backend。
- **建議交付給**：Backend（updateProfile 同步 + 既有資料 backfill）；寫入點 helper 化可 Feature/Bug Hunter
- **優先級提示**：P1（系統性、影響多人可見的 denormalized 身分欄位；非單帳號）

---

## 新功能想法（待 PM 升 spec）

### 家庭邀請連結「進階版」（preview page + QR display）
- **發現於**：2026-05-25、Feature Builder session（minimal slice 已 ship，留 paper trail）
- **類型**：新功能想法（v1.5 polish）
- **已 ship 的 minimal slice**：`/join/{6位 inviteCode}` deep-link → 自動 `joinFamilyByCode` → 成功 redirect `/app`；沿用既有 already-member / not-found 訊息；Share UX（`navigator.share` + clipboard fallback button in family-section）；零新 schema、完全 additive。
- **沒做（PM 之後決定的 ambiguous 點）**：
  - **Preview page**：點 link 顯示「{family.name} 邀請你加入，有 N 人 + N 隻寵物」preview，確認才 join？需新 callable 給 unauthenticated preview（rules 限 member 才能讀 family doc）
  - **Link 過期**：schema 預留 `inviteCodeExpiresAt` 但未實作；regenerate 是否連動失效？
  - **濫用防範**：連結摩擦比手動 6 位數低，是否要 owner approval？
  - **QR code 顯示**：display QR（低工作量；與既有 Deferred「內建 QR scanner」是相反方向）
  - **多家庭 currentFamilyId 切換**：join 後是否自動設 active？
- **建議交付給**：PM（升 spec 後再 Feature Builder）
- **優先級提示**：P3（minimal slice 已可用）
- **PM 排序（2026-05-29）**：在 user 實測 minimal slice 反映摩擦後，挑 1-2 個 polish 合一個 spec（preview page + QR display 最自然）。iOS feature-parity 期間優先級低於 iOS P0。

---

## Deferred / 不做

> PM 決定不做（或暫不做）的條目搬來這裡 + 寫理由。比刪掉好，下次有人想重提時直接擋下。

### 內建 QR scanner
- **理由**：iPhone / Android 原生相機都能掃 QR 並開 URL，App 內建 scanner 增加 camera permission 摩擦 + bundle size，CP 值低。

### Settings 加直接到 `/onboarding` 的 link
- **發現於**：2026-05-23、Feature Builder（#2 spec B2 deviation）
- **理由（2026-05-29 PM 定案 Defer）**：`/onboarding` 是首次體驗頁，使用者後續幾乎不會回看；既有 family-section「加入」「新建」buttons 已滿足實際入口需求。低價值，歸 Deferred。若 user 明確要再重提。

### `mergeAndImportToFamily` callable + 共用 helper（永久 dormant — 不要順手刪）
- **發現於**：2026-05-23、PM session（user 拿掉 merge 決定後）
- **類型**：dormant code（不是待清理）
- **內容**：B4 ship + rollback 後 `functions/src/index.ts` 仍留 `mergeAndImportToFamily` callable（無 client caller）+ 內部搬子集合 / reassign petId / 刪 personal pet doc 的共用 helper。
- **PM 定案**：**永久 dormant**。原規劃併入 #4 dedupe session 處理，但 #4 已被 user 取消（見 `docs/features/mango-dedupe-migration.md`）。Backend / iOS Backend session 動 `functions/src/index.ts` 看到這段**不要順手刪**（保留供未來如真需要 dedupe 時 reactivate）。

---

## 已處理（audit trail）

> SHIPPED / RESOLVED / 已升級到 spec 的條目壓縮成一行收這裡。完整 ship 紀錄在 `docs/roadmap.md` 與各自 commit message。供日後追溯，不需再排序。

- **`ExpensesOverviewSection` dead code（從未被任何頁 import）** — ✅ 已刪除 `22bee39`（2026-05-26 Bug Hunter 修「拍收據不見了」時 grep 確認為 dead code；長期正解由 expenses-into-pets-page ship）。
- **walks-auto-photo-share spec「Privacy 預設 family-only」與實際 composer default `public` 不符** — ✅ 2026-05-29 PWA PM 已修 `docs/features/walks-auto-photo-share.md`（composer default 'public' 是 ui-polish-bundle 的 intentional behavior，非 epic regression）。
- **PWA 內 push token 不同 context 失效（要先停用再啟用 workaround）** — ✅ SHIPPED `9f1dc67`：新 `reconcileCurrentToken(uid)` in `src/lib/firebase/messaging.ts` 主動 `getToken` arrayUnion 進 `user.fcmTokens`（idempotent）；`push-toggle.tsx` 在 `perm === "granted"` 時呼叫 reconcile。
- **Personal walks 不應進全 App leaderboard** — ✅ 已升級到 `docs/features/family-leaderboard.md` Phase 0 prerequisite，隨 family-leaderboard epic SHIPPED。
- **未登入首頁 footer 連結文字硬編碼中文沒走 i18n** — ✅ SHIPPED `634e8c6`：加 `Common.privacy` / `Common.terms`（zh-TW + en），`src/app/page.tsx` 改用 `getTranslations("Common")`。
- **好友搜尋無法 case-insensitive** — ✅ 已升級到 `docs/features/friends-search-lowercase.md` 並 SHIPPED（中段 match 需 Algolia/Typesense，仍不在範圍，留觀察）。
- **Default landing 改為 `/app/walks`** — ✅ SHIPPED `5856e18`（UI/UX 2026-05-24）：`page.tsx getNextPath` default + `sign-in-buttons.tsx` + `onboarding/page.tsx` 3 處 + `manifest.json start_url`；`/app` 直接訪問不 redirect、nav home icon 仍 `/app`。
- **walks 頁加 sticky bottom CTA（解 A）** — ✅ SHIPPED `5c1429e`（UI/UX 2026-05-24）：`app/app/walks/page.tsx` 加 `fixed ... md:hidden` sticky bar 重用 Hero handler，tracking view 開啟時 unmount。
- **Mobile bottom nav 重組（開銷→排行榜、更多→設定右上角）** — ✅ SHIPPED `e34640a`（UI/UX 2026-05-23）：drawer state 提升到 `NavDrawerProvider`，trigger 移到 settings header；mobile 5 links `[home, pets, walks, leaderboard, settings]`，overflow 5 items 進 drawer。
- **[範例] 重複的 Mango pet** — 教學範例。已升級到 `docs/features/mango-dedupe-migration.md`（後被 user 取消，見該 spec）。保留當格式範例。

### 成就頁缺「剛解鎖」hook → 無法做真正的解鎖瞬間慶祝動效
- **發現於**：2026-06-02、UI/UX session
- **類型**：新功能想法 / 設計
- **重現 / 觀察**：`/app/achievements` 只讀既有 `users/{uid}/achievements` grant，無法分辨「這次剛解鎖」vs「早就有」。UI/UX 已做進頁時的輕量光掃（reduced-motion 安全），但 spec §E 想要的「解鎖時慶祝動效」需要 newly-earned 訊號才能只對剛解鎖的徽章放 confetti/scale-pop，不誤觸舊徽章。
- **建議做法**：Feature Builder 提供 hook —— 例 (a) 前端用 localStorage 存上次已知 grant id 集合，load 後 diff 出新增；或 (b) 解鎖 push deep-link 帶 query（`/app/achievements?unlocked=walk-50`）。拿到訊號後 UI/UX 接慶祝動效（沿用既有 `.walk-confetti` / `.walk-streak-pop` + prefers-reduced-motion）。
- **建議交付給**：Feature Builder（出 hook）→ UI/UX（接動效）
- **優先級提示**：P2

### 🎨 設計系統對齊 — 既有頁面遷移（design-system.md §7）
- **發現於**：2026-06-03、iOS UI/UX session 審 web 時抓到 + PM 立 SoT
- **類型**：技術債 / 設計一致性
- **觀察**：web 有 drift，已立 `docs/design-system.md`（品牌 SoT）；以下既有 surface 未對齊，漸進收（新 code 已一律遵守 SoT，不阻擋其他進度）：
  - ~~settings~~ ✅ SHIPPED（UI/UX 2026-06-04）：`app/app/settings/page.tsx` + `components/settings/*`（7 元件）全 zinc/amber → mango token、`rounded-lg` → `rounded-[var(--radius-*)]`（卡片 xl / 小元件 md/sm）、focus ring → brand-deep、toggle 開 bg-mango-brand；danger 紅 + push 測試成功綠（emerald）語意保留；無 tabs（toggle/radio 本來就無滑動 indicator，§4 合規）。
  - feed / leaderboard 仍 zinc/amber → 換 mango token（design-system §1）— **待**
  - 散落 `rounded-lg`(8px) → 統一 `--radius-*`（§2）— settings 已收，feed/leaderboard 待
  - 確認 web/iOS tabs 都已回 simple toggle（先前 Reanimated 滑動 indicator 已退；§4）
- **建議交付給**：UI/UX（逐 surface 對齊，可一頁一 commit）— **feed + leaderboard 仍待**
- **優先級提示**：P2（不影響功能；視覺一致性 + 技術債。可在各 surface 下次有改動時順手對齊）
- **PM 排序提示**：不必一次做完；每次有人動到 feed/leaderboard/settings 就順手 mango 化 + 換 radius。
