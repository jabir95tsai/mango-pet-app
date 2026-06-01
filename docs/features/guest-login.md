# 訪客登入（Guest / Anonymous Auth）

> **狀態**：READY-FOR-DEV — PM spec（2026-06-01；user 3 決策已拍板）。
> **角色分工**：Backend（rules + 排行榜/feed 排除 guest + 匿名 GC + 升級 link 後端考量）→ Feature Builder（訪客登入按鈕 + 升級 linkWithCredential 流程 + 社群 gating + 升級提示 UI）。PM 另需更新隱私頁文案。
> **依賴**：實作排在 iOS P0 / 並行期 main 乾淨時；動 production code 前讀近期 commit 避免撞檔。

## 背景（現況，立基於 code）

- 登入方式：Google / Apple / Facebook OAuth（`signInWithProvider` @ `apps/web/src/lib/firebase/auth.ts`；UI `sign-in-buttons.tsx`）。**無匿名登入**。
- `auth-provider.tsx` 建 `users/{uid}` profile（排行榜 / 好友 / feed 都讀它），從 provider 回填 displayName / photoURL。
- 隱私頁（`src/app/privacy/page.tsx`）寫「帳號資料透過 Google / Apple / Facebook OAuth」。
- 對齊 roadmap「不做」精神：**不強迫所有使用者建家庭才能用主功能**（2026-05-23）→ guest 降低嘗試門檻一致。

## User Story

> 作為還沒想登入的新使用者，我想**不用註冊就先試用**——建寵物、記遛狗；之後想要的話再用 Google/Apple 綁定帳號，而且**不希望先前建的資料消失**。

## 範圍（user 2026-06-01 拍板）

1. **Guest 限個人功能**：能用寵物記錄 / 遛狗（自己的）。**社群（發動態 / 排行榜 / 家庭 / 好友）需要真實身份 → guest 一律不開**。
2. **升級保留**：guest 之後綁 Google/Apple → `linkWithCredential` 升級**同一個 uid**，寵物 / 遛狗資料原封保留。
3. **主動提示升級**：guest 建第一筆資料後，適時提示「綁定帳號以免資料遺失」（匿名帳號清快取 / 換裝置就消失）。

---

## A. 訪客登入入口（Feature Builder）

- `sign-in-buttons.tsx` 在 Google/Apple/Facebook 下方加「**以訪客身分繼續**」按鈕（次要樣式，弱於 OAuth 主按鈕）。
- `auth.ts` 加 `signInAsGuest()` → `signInAnonymously(auth)`。
- i18n（zh-TW + en）。

## B. Guest profile + 身份顯示（Feature Builder + Backend）

- 匿名 user `isAnonymous === true`、無 displayName / photoURL。
- 建**最小** `users/{uid}` profile：`displayName = "訪客"`（i18n）、預設頭像（paw / initials fallback，沿用 Avatar 元件 — 它無 src 即顯示 initials）、**新欄位 `isGuest: true`**（給後端/前端判斷）。
- 既有讀 `users/{uid}` 的程式碼（leaderboard/friends）需容忍 guest profile 存在但被排除（見 D）。

## C. 社群功能 gating（Feature Builder）

guest（`isAnonymous` / `isGuest`）在以下入口**隱藏或停用**，並顯示「綁定帳號後才能使用」提示 + 升級 CTA：
- 發動態（PostComposer / feed 發文、walks 自動發動態）。
- 排行榜（人榜 + 狗榜都不參加、可看但不上榜 — 或整個入口隱藏，見開放問題）。
- 家庭（建立 / 加入 family）。
- 好友（加好友 / 搜尋）。
- 留言 / 表情（feed-comments-and-reactions-v2）— guest 不能留言/按表情（需真實身份）。

guest **可用**：`/app/pets`（建寵物、記錄、開銷、健康）、`/app/walks`（遛自己的狗、看自己的紀錄）。

## D. 排行榜 / feed 排除 guest（Backend）— ⚠️ 跨 spec 衝突，必處理

- **leaderboard-v2 spec 已定「狗榜納入 personal-mode 狗」**；guest 必為 personal-mode → **若不處理，guest 的狗會出現在全 app 狗榜**（無身份污染）。
- **要求**：排行榜聚合（人榜 + 狗榜 cron / trigger）**排除 `isGuest` / 匿名 uid 的 walk**。或在 dog entry / walker entry 寫入時跳過 guest。
- feed 查詢同理：guest 的貼文本來就不該存在（C 已 gate 發文），但 rules 仍要擋 guest 寫 posts。

## E. 升級 linkWithCredential 流程（Feature Builder + Backend）

- guest 點 Google/Apple → 用 `linkWithCredential`（而非 `signInWithProvider`）綁到當前匿名 uid → uid 不變、資料保留。
- 綁定成功後：清 `isGuest` flag、回填真 displayName/photoURL、解鎖社群功能。
- ⚠️ **硬邊界 case（必處理 / 開放問題）**：若該 Google/Apple 帳號**已存在**（`credential-already-in-use` / `email-already-in-use`）→ 無法 link。
  - v1 預設：提示「此帳號已註冊，將登入既有帳號（訪客期間資料無法併入）」→ 改 `signInWithProvider` 登入既有帳號，guest 資料留原匿名 uid（孤兒，由 GC 清）。
  - 真正的「把 guest 資料 merge 進既有帳號」很複雜（類似已取消的 family merge）→ **v1 不做 merge**，明確告知 user。

## F. 匿名帳號 / 資料清理（Backend）— 控成本

- 匿名帳號會隨裝置增生（每裝置一個 uid），未升級的 guest 留下孤兒 user/pets/walks → 膨脹 Firestore + 可能被排行榜誤算（D 已排除）。
- **要求 GC 策略**：對「N 天未活動且未升級的匿名帳號」清除 auth user + 其資料（scheduled function 或手動 callable）。N 由 Backend 提案（如 30/60 天）。
- 不需新外部 API。**無新增外部 recurring API 成本**；增量是匿名帳號的 Firestore 用量（GC 控制）。

## G. 隱私頁文案（PM）

- `src/app/privacy/page.tsx` 補一段：訪客（匿名）模式不蒐集 OAuth 個資；匿名帳號資料僅存於該裝置 session，未綁定前清除即遺失；升級後依 OAuth 條款。

---

## 開放問題（PM 有預設）

1. **排行榜入口**：guest 是「看得到榜但不上榜」還是「整個入口隱藏」？PM 預設**可看不可上**（仍能看到排行激勵升級）。
2. **升級提示時機 / 形式**：banner 常駐 vs 建資料後一次性 modal？PM 預設「建第一筆寵物或第一次遛狗完成後，一次 dismissible 提示 + settings 常駐升級入口」。
3. **link 衝突**（E 的 credential-already-in-use）：v1 預設「登入既有帳號、不 merge、告知 user」。確認可接受。
4. **匿名 GC 天數**：交 Backend 提案（預設 30–60 天未活動）。

## Handoff

- **→ Backend**：rules（guest 可寫自己的 pets/walks；擋 guest 寫 posts/comments/reactions/family/friends）+ 排行榜聚合排除 `isGuest`（含狗榜，對齊 leaderboard-v2）+ 匿名 GC scheduled function/callable + link 升級的後端注意（uid 不變、profile 去 guest flag）。
- **→ Feature Builder**：訪客登入按鈕 + `signInAsGuest` + linkWithCredential 升級流程（含衝突 case）+ 社群入口 gating + 升級提示 UI + i18n。
- **→ PM（本人）**：更新隱私頁文案（G）；開放問題 1–4 收斂後升級此 spec 細節。
- **→ 跨 spec**：通知 leaderboard-v2 / feed-comments 的實作者：guest 排除規則要一起進它們的 rules/aggregation。

---

## ✅ Backend 已交付（Backend session 2026-06-01 — commit b742307）

**Deployed to `mango-pet-app`**：firestore:rules + functions（gcAnonymousUsers 新建；aggregateLeaderboards / recompute{Walker,Dog}Leaderboards{,OnDelete} / createFamily / joinFamilyByCode / acceptFriendRequest 更新）皆部署成功。**Prod e2e PASS**（合成 guest profile + personal-mode walk）：dog board 排除 guest（weekly + all_time 皆不寫 entry）、walker board 排除 guest、升級 de-flag 清掉 isGuest。trigger log 無 error。**未新增 index**。

### 守門邏輯（rules，已部署）
- 新 helper `isGuest()`（token-based：`request.auth.token.firebase.sign_in_provider == "anonymous"`，client 無法用自己 user doc 的 isGuest 偽造）+ `isRealUser()`。
- **Guest 可寫**：自己的 personal-mode `pets` / `walks` / `reminders` / `expenses`（這些 create rule 本來就只要 authenticated + owner==self，匿名也通；已逐條確認，未改動）。
- **Guest 被擋**：`posts` create、`reactions` write、`comments` create、post `reactionCounts` bump update、`friends` / `friendRequests` write。`families` 維持 callable-only（client `if false`）。
- ⚠️ **驗證邊界**：rules 已 compile + deploy；leaderboard 排除為 prod 實測。但「真實匿名 token 下 guest 能建 pet、不能發 post」需要實際 `signInAnonymously` 才能跑（無 emulator/rules-unit-testing 設定）→ 這正是 workflow 指定的 Feature Builder 整合驗證項，請在接 UI 後跑一次。

### 排行榜排除（functions/src/leaderboard-helpers.ts）
- `computeWalkerPeriodScore` + `computeDogPeriodScore` 在讀到 walker/owner profile `isGuest === true` 時 return null → 單一 chokepoint 同時覆蓋 cron + 兩個 realtime trigger。
- 狗榜的 owner-isGuest 跳過是**關鍵**：狗榜含 personal-mode、guest 必為 personal-mode，沒這層 guest 的狗會上全 app 狗榜（leaderboard-v2 × guest 的跨 spec 衝突，已解）。

### 升級 de-flag（apps/web/src/lib/firebase/users.ts `upsertUser`）— Feature Builder 直接用
- **Guest profile create**：`displayName="訪客"/"Guest"`、`authProvider="anonymous"`、`isGuest:true`、**不寫 `displayNameLower`**（guest 不出現在好友搜尋）。
- **升級**：`linkWithCredential` 後 uid 不變、`isAnonymous` 變 false；下一次 auth-state callback 的 `upsertUser` 會偵測「doc 仍 isGuest 但已非匿名」→ **自動** `isGuest` 用 `deleteField()` 清除 + 回填真 `authProvider` / `displayName` / `photoURL` / `displayNameLower`。**Feature Builder 的 link 流程不需自己寫 profile 去 flag**——綁定成功後讓 auth provider 跑既有 upsert 即可。社群功能隨 isGuest 消失自動解鎖。
- `AppUser.isGuest?: boolean`、`authProvider` 型別加 `"anonymous"`。

### 匿名 GC（functions/src/index.ts `gcAnonymousUsers`）
- 每週一 03:30 Asia/Taipei 排程（不開外部 API、低頻控成本）。回收「仍匿名（providerData 空）且 ≥ **60 天**未活動（`lastSeenAt` fallback Auth metadata）」的 guest：硬刪 personal pets+healthRecords / walks / reminders / expenses + user doc + Auth user。單次上限 500（剩的下週續清）。
- ⚠️ **預設 DRY-RUN**（`GC_DRY_RUN = true`）：只寫 audit doc `anonymousGc/{ISO}` + log，**不刪任何東西**。請先看幾次 dry-run audit 的 candidate set 合理後，**另開一個 reviewed commit 把 `GC_DRY_RUN` 改 false** 才真正啟用刪除。
- N=60 天為 spec 30–60 區間保守端；要調改 `GC_INACTIVE_DAYS` 一處即可。

### 後端 callable defense-in-depth
- `createFamily` / `joinFamilyByCode` / `acceptFriendRequest` 加 `isGuestAuth(req)` 擋 guest（Admin SDK 會繞過 rules，故 callable 層也要擋），回 `permission-denied`。

### Feature Builder TODO（UI，本 session 不做）
- `signInAsGuest()` = `signInAnonymously(auth)`（auth.ts）+ 登入頁「以訪客身分繼續」按鈕（次要樣式）+ i18n。
- linkWithCredential 升級流程（含 `credential-already-in-use` → 開放問題#3 v1 預設：登入既有帳號、不 merge、告知 user）。
- 社群入口 gating（發文 / 排行榜上榜 / 家庭 / 好友 / 留言表情）對 guest 隱藏或停用 + 升級 CTA；排行榜 PM 預設「可看不可上」。
- 升級提示 UI（建第一筆資料後一次性 + settings 常駐入口）。
- **整合驗證**：真匿名登入後跑 workflow 指定的三項（能建 pet/walk、walk 不上人/狗榜、不能寫 post/comment）。
