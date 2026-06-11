# 安全強化（Security Hardening）— Storage 讀取 / PII / AI key / 金鑰防呆

> **狀態**：READY-FOR-DEV — PM spec（2026-06-03，安全審計 4 findings）。grounding 已核對屬實（見各項）。
> **角色**：Backend / 安全（rules / storage rules / GCP / schema migration）。PM 不實作。**#4 .gitignore 已由 PM 完成**。
> **歸屬**：上架前安全 / 隱私(roadmap「下個方向候選 Option A」的 App Check + 隱私審查具體化)。

## 背景 / 為何

審計抓到 4 項。grounding（PM 已核對）：
- `storage.rules`：`match /users/{uid}/{allPaths=**} { allow read: if request.auth != null; }` → **任何登入者可讀所有人檔案**。
- `firestore.rules:34` users/{uid}：規則註解自承「email + tokens 私密但 Firestore 不能 field-filter，for now allow any signed-in user，tighten later」→ **email + fcmTokens 對全登入者可讀**。
- iOS Firebase AI Logic（Gemini）key：缺 App Check + GCP API key 應用限制。
- `.gitignore`：原僅 `*.pem`，缺其他金鑰 pattern。

---

## #1 Storage 讀取收斂（P0，正在漏）

⚠️ **不可一刀 owner-only** —— 貼文/遛狗照要在 feed 給家人/朋友看、pet 頭像在排行榜/家庭顯示。blanket owner-only 會弄壞 feed/leaderboard 照片。

**做法：先盤點 path → 誰看，再按 path 收斂**（Backend 先 grep 各上傳路徑 + 哪些 UI 顯示給誰）：
- **收據 / 私人照**（如 `users/{uid}/receipts/**`、私人圖庫）→ **owner-only**：`allow read: if request.auth.uid == uid`。
- **貼文 / 遛狗分享照**（feed 會給 family/friends 看）→ 維持較寬讀取，但盡量收到「登入者」而非公開；理想是對齊 post 可見度（但 Storage rules 無法讀 Firestore 貼文可見度 → 實務常維持 authenticated-read，可接受，因為這些本就是要分享的照片）。
- **pet 頭像**（排行榜/家庭顯示）→ authenticated-read 可接受。
- 關鍵是把**收據/財務/私人**那類從「全登入者可讀」收成 owner-only。
- 驗證：登入者 A 試讀 B 的收據 path → denied；A 仍能看到 feed 裡 B 的貼文照。

## #2 users PII 拆私有子集合（P0/P1）

⚠️ **不能靠「前端只取欄位」**（Firestore 讀 doc 全有全無，直接 SDK 就拿到全部）。

**做法：把敏感欄位搬出 public profile doc**：
- `users/{uid}`（public）保留：`displayName` / `photoURL` / `displayNameLower` / `authProvider` / `isGuest`（排行榜/好友/feed 需要）。
- 新 **私有子集合** `users/{uid}/private/contact`（或同義）放：`email`、`fcmTokens`。rules：`allow read, write: if request.auth.uid == uid`（**只 owner**）。
- 連帶改：
  - `upsertUser`（`apps/web/src/lib/firebase/users.ts`）寫入拆分（public 欄位 → users doc；email/tokens → private 子集合）。
  - `messaging`（fcmTokens 讀寫路徑）改指向 private 子集合；reconcileCurrentToken 等一併。
  - 任何讀 email 的地方改讀 private（多半只有本人 settings）。
  - 後端 functions 用 Admin SDK 讀 fcmTokens（push）→ 改讀 private 子集合路徑。
- **既有資料 migration**：一次性 callable / script 把現有 users doc 的 email/fcmTokens 搬到 private 子集合 + 從 public doc 移除（先 dry-run）。
- 驗證：登入者 A 讀 B 的 `users/{uid}` → 只拿到 public；讀 B 的 `users/{uid}/private/*` → denied；push 仍能送達（functions 讀得到 private tokens）。

## #3 AI key App Check + GCP 限制（P1，成本/盜用）

- **App Check**：web（reCAPTCHA / reCAPTCHA Enterprise）+ iOS（App Attest / DeviceCheck）client SDK 初始化 → 對 **Firebase AI Logic** 服務 enforce App Check（未驗證請求擋掉）。
- **GCP 端 API key 應用限制**：對驅動 Gemini 的 API key 加「應用程式限制」(HTTP referrer for web / iOS bundle id) + 「API 限制」(只開該用到的 API)。
- 目的：避免 key 被盜刷 Gemini 額度（= 錢；對齊成本即優先級）。
- 多段、跨 web+iOS+GCP console；Backend 主導,需 user 在 GCP console 配合設定限制。
- 驗證：未帶 App Check token 的請求被拒;正常 app 請求正常。

## #4 .gitignore 金鑰防呆（P2，✅ 已完成）

- PM 2026-06-03 已加 `*.key` / `service-account*.json` / `*-adminsdk*.json`（+ `.design-tmp/`）到 `.gitignore`。
- Backend 額外確認：`git log --all --full-history -- '*adminsdk*.json' '*service-account*.json'` 確認過去**沒有**誤 commit 過私鑰;若有 → 該 key 視為外洩,GCP 上撤銷重簽。

---

## 優先序 / Handoff
- **→ Backend / 安全**（建議順序）：#1 Storage（P0,正在漏)→ #2 PII 子集合 + migration（P0/P1)→ #3 App Check（P1,需 user 配合 GCP)。每項獨立可分 commit;改 rules / storage rules 後 `firebase deploy --only storage,firestore:rules`。
- **→ user**：#3 需要你在 GCP console 設 API key 應用限制 + 開 App Check（Backend 會給步驟）。
- **→ PM**：記進 roadmap「上架前安全」；#4 已完成。
- ⚠️ 並行紀律：動 rules / functions 前 `git fetch && git rebase origin/main`(README 規則 6)；建議獨立 worktree。

## 驗證清單（上線後）
- [ ] A 讀 B 收據 → denied;A 看 feed B 貼文照 → 正常。
- [ ] A 讀 B `users/{uid}` → 無 email/tokens;讀 private → denied。
- [ ] push 仍送達（functions 讀 private tokens OK）。
- [ ] 未帶 App Check 的 AI 請求被拒;app 內 AI 收據掃描正常。
