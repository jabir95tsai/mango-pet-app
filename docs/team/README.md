# Mango Pet 開發角色分工

開新 Claude / Codex session 前，先決定**這個 session 是哪個平台軌道 + 哪個角色**。把通用初始 prompt 和對應角色檔案塞進 context（複製貼上，或叫 agent `read docs/team/{role}.md`）。**一個 session 只當一個角色**，跨角色的事丟到該角色的 backlog 等下次。

通用初始 prompt：[`session-start-prompt.md`](./session-start-prompt.md)

## 決策樹

> 我手上有 bug 想修 →

→ **[Bug Hunter](./bug-hunter.md)** — 重現 / 證據 / 最小修法 / 部署驗證

> 我想加一個新功能 →

→ 規格寫好了嗎？
- 沒寫好 → 先當 **[PM](./pm.md)** 寫 spec
- 寫好了 → **[Feature Builder](./feature-builder.md)** 端到端做完

> 畫面看了不舒服 / 響應式壞了 / a11y 有問題 →

→ **[UI/UX 工程師](./ui-ux.md)** — 截圖 baseline / 改 / 截圖 after

> Firestore 慢、規則有疑慮、index 缺、function 出錯 →

→ **[Backend / 資料工程師](./backend.md)** — 風險盤點 / 一次一個 / 對的部署順序

> 不知道下一步該做什麼、覺得進度有點散 →

→ **[PM / 策略](./pm.md)** — 排序、決定不做什麼、寫 spec 給其他角色

> 我要決定 Web/PWA 與 iOS 兩邊是否要一起改、誰先做、如何保持同一個產品 →

→ **[Cross-platform PM](./cross-platform-pm.md)** — 雙平台共同規格、parity、取捨與 handoff

> 我要開始 iOS app / React Native / Expo / monorepo / TestFlight →

→ 先選 iOS 五角色之一：
- 沒寫好 phase / scope → **[iOS PM](./ios-pm.md)**
- 要做 iOS 新 feature parity → **[iOS Feature Builder](./ios-feature-builder.md)**
- 要調 iOS 原生畫面 / safe area / a11y → **[iOS UI/UX](./ios-ui-ux.md)**
- iOS simulator / 真機 bug → **[iOS Bug Hunter](./ios-bug-hunter.md)**
- Firebase native / APNs / shared data layer → **[iOS Backend](./ios-backend.md)**

## 5 個角色一覽

| 角色 | Web/PWA role file | iOS role file | 一句話 |
|---|---|---|---|
| **PM / 策略** | [`pm.md`](./pm.md) / [`cross-platform-pm.md`](./cross-platform-pm.md) | [`ios-pm.md`](./ios-pm.md) / [`cross-platform-pm.md`](./cross-platform-pm.md) | 規格、優先序、roadmap、不做清單；Cross-platform PM 管雙平台共同真相 |
| **Bug Hunter** | [`bug-hunter.md`](./bug-hunter.md) | [`ios-bug-hunter.md`](./ios-bug-hunter.md) | 重現 + 最小修法 + 回驗 |
| **UI/UX 工程師** | [`ui-ux.md`](./ui-ux.md) | [`ios-ui-ux.md`](./ios-ui-ux.md) | 視覺層級、響應式 / safe area、a11y、動效 |
| **Feature Builder** | [`feature-builder.md`](./feature-builder.md) | [`ios-feature-builder.md`](./ios-feature-builder.md) | 端到端新功能 / iOS parity feature |
| **Backend / 資料** | [`backend.md`](./backend.md) | [`ios-backend.md`](./ios-backend.md) | schema、rules、indexes、functions、native Firebase / shared data |

## 為什麼這樣分

過去整個 vibe-coding session 在一個對話裡做完一切：UI/UX、bug 修、feature、backend、push debug。結果：

1. 對話塞爆（一次 conv 250k tokens 是正常）
2. 一個 commit 順手改了 UI + migration + rules，無法 partial rollback
3. 沒人主動驗證 → 上線後使用者才回報「家庭功能裡寵物消失了」
4. 「下一步要做什麼」永遠沒人問，只回應「下一個 bug 是什麼」

分角色不是為了形式 — 是為了**護欄**：每個 session 有明確的「該做什麼」「不該做什麼」「什麼叫做完了」。

## 跨角色協作規則

- **Bug Hunter** 不修的 bug → 寫進 `docs/team/backlog.md`，下次 PM session 排序
- **UI/UX** 改的時候看到 bug → 不修，記下來丟 backlog
- **Feature Builder** 做到一半發現 schema 不夠 → 暫停，回到當下 session 寫一段「需要 Backend 先做 X」，丟出去等 Backend 處理完再繼續
- **Backend** 跑完 migration → 通知所有角色舊路徑可以清了
- **PM** 是 fan-out 端點：所有「想做但沒人實作」最終都要回到 PM 排序
- **Cross-platform PM** 管 Web/PWA 與 iOS 的共同規格、platform policy、parity checklist；不寫 code
- **iOS Feature Builder / UI/UX / Bug Hunter** 需要 backend/schema change → 先寫 handoff 給 iOS Backend 或 Backend；需要產品取捨 → 回 iOS PM；看到 Web bug → 丟 Web Bug Hunter

## 並行模式（兩個 session 同時開的 git 紀律）

> Claude + Codex 雙開、或兩個 Claude 雙開時，commit 才不會撞車。

### 規則 1（永遠做）：Push 前三件套

不管有沒有並行，commit 完一律：

```bash
git fetch && git pull --rebase origin main && git push origin main
```

- 對方有新 commit → rebase 把你的 commit 重放在上面，沒衝突就順利推上
- 有衝突 → git 停下叫你解，你立刻知道對方改了同樣的地方
- 養成這個三件套肌肉記憶後，後面所有層都站得穩

**PowerShell 版本相同**（`git` 指令在 Bash / PowerShell 完全一致，不用換）。

### 規則 2（要並行就遵守）：角色分流不分檔

兩邊同時開 session 時，**刻意挑不重疊的角色**：

| 安全組合 | 為什麼 |
|---|---|
| **Backend / PM** + **UI/UX** | 一個動 `firestore/functions/lib/`、一個動 `app/components/`，撞檔案機率近 0 |
| **Bug Hunter (前端 bug)** + **Backend** | 一個查 UI、一個整 schema |
| **PM / Cross-platform PM** + 任何一個其他角色 | PM 只動 `docs/`，零碰 production code |
| **iOS Feature Builder** + **Web UI/UX** | P0 後一個主要動 `apps/ios/`，一個動 web UI；但 shared packages 要先溝通 |
| ❌ 兩邊都 **Bug Hunter** | 都可動任何檔案，撞 src/ 機率高 |
| ❌ 兩邊都 **UI/UX** 或 **Feature Builder** | 同 lane 必撞 |
| ❌ **iOS P0 monorepo migration** + 任何 production code session | P0 搬路徑期間會碰 repo shape，先暫停其他 code session |

### 規則 3（會省下半小時痛苦）：Session 開頭 pre-flight

每個角色檔案頂端的「Session 開頭 pre-flight」段落都寫了同樣的指令：

```bash
git fetch && git log -5 --stat origin/main
```

讀對方最近 5 個 commit 改了什麼，再決定要不要動同一個檔案。Session 開頭花 30 秒做這件事，省下後面 30 分鐘解衝突。

### 規則 4（血淚換來）：dep / lockfile / repo-shape 改動 → branch-first + linux build gate

> 2026-05-31 web production build 連紅 3 支 build 才發現的教訓。

monorepo 化之後，**任何動到 `package.json` / `package-lock.json` / native dep / repo 結構**的改動，**不准直推 main**。要：

1. **Branch-first**：開 branch 做，main 保持 live 可回滾。
2. **linux build gate**：push branch 後用
   ```bash
   npx firebase apphosting:rollouts:create -b <branch>
   ```
   讓 App Hosting 在 **linux** 對該 branch 跑一次真 build。**綠了才 merge main**；紅了留在 branch 改，production 全程穩在上一個 good build。
3. 嚴格走這套，紅 3 次都不會污染 main / production（已驗證）。

**為什麼一定要 linux gate**：本機是 **Windows**。`npm install` 在 Windows 生的 monorepo lockfile **會漏掉 linux 平台的 transitive optional native binary**（例：`@parcel/watcher-linux-x64-glibc`）。本地 `npm run build` 在 Windows 全綠，App Hosting（linux）卻紅在「找不到原生 binary」。**Windows 本地 build 過 ≠ App Hosting 會過** → 一定要 linux branch build 當 gate。

- 長期更穩：CI/lockfile 改在 linux 生成；或保留 `apps/web` 的 `optionalDependencies` 平台清單（已在 `_comment_optionalDependencies` 寫明）。任一 native dep 升版，記得同步那份 pin。
- 「直推 main 中招」在 P0 migration + 本次已連續發生 → 這條是硬規則，不是建議。

### 規則 5（iOS 驗收節奏）：實機驗收 per-phase 批次，不 per-sub-phase

> user 2026-06-01：「不想每個 sub-phase 都實機驗收，很麻煩，一次做完一次驗。」

**分清兩種「驗證」**：
- **自動關卡（dev session 自己跑，不需 user）**：`tsc --noEmit` + 碰 dep 的 **linux web-rollout gate**（規則 4，保護 web production）。**每個 sub-phase 都要做**，因為它保命且免費。
- **實機驗收（user 裝 iPhone 走查）**：**per-phase 一次**。一個 phase（如 P2）的所有 sub-phase code 全 merge 後，發**一顆** EAS build，user 一次走完整個 phase 的端到端清單。**不要每個 sub-phase 都叫 user 裝一次。**

**為何安全**：iOS 尚未上 App Store（無 production release），未實機驗的 iOS code 進 main 不影響線上；web 由 web-gate 保護。**tradeoff**：runtime bug 會在 phase 末一次浮現（較難逐項隔離）→ 末端驗完開 iOS Bug Hunter 收。

**dev session 紀律**：碰 dep → branch + tsc + web-gate 綠 → merge；**不主動發 device build、不要 user 中途驗**。phase 全 code 收齊 → iOS PM 發該 phase 唯一一顆 EAS build + 端到端清單給 user。

### 規則 6（血淚換來，2026-06-03）：並行 = 強制 git worktree 隔離，**不要共用同一個 working tree**

> 背景：一次 PWA PM + iOS/UI 並行期，兩邊共用同一個 working tree，連環肇事 — commit 落錯 branch、push 不到 main、merge 衝突擋住所有 commit，最後一個基於「舊 base」的並行 session 在共用 index 裡**逐一刪掉剛建立的 PM docs（design-system SoT / 多份 spec）**。全部只發生在本地、靠人工發現+還原才沒上 origin。根因都是**同一個 working tree 被多 session 同時動 + 切 branch**。

**規則**：只要有第二個 session 會動 code/docs，**第二個 session 一律用獨立 git worktree**（見下方指令），不要兩個 session 開同一個資料夾。

- 每個 worktree 從**當前 origin/main** 開（`git fetch` 後再 `worktree add`），自帶最新檔案（含 SoT / 最新 spec），不會基於 stale base。
- 共用 `.git`、各自獨立 working tree / index / 當前 branch → 不會互相落錯 branch、不會在彼此 index 留殘留。
- 各自 push 仍走規則 1 三件套。
- ⚠️ 若發現某 session 在共用 tree 裡顯示「刪掉一堆本來存在的檔」→ 多半是它基於 stale base。**先 `git fetch && git rebase origin/main`（或重開 worktree）對齊現況再繼續**，不要把刪除 commit/push 上去。

### 進階選項細節：Git Worktree 指令（規則 6 的具體做法）

如果你預期長期雙開、想徹底隔離兩邊的 working tree（連 system-reminder「intentional change」狂噴都消除），用 git worktree：

```bash
cd /c/Users/jabir/Hacker_J
git -C mango_pet_app worktree add ../mango_pet_app-codex main
```

- Claude 開 `C:\Users\jabir\Hacker_J\mango_pet_app\`
- Codex 開 `C:\Users\jabir\Hacker_J\mango_pet_app-codex\`
- 兩邊獨立 working tree，共用 `.git`，push 時還是回到規則 1

iOS 長期開發期間建議啟動 worktree。尤其 P0 完成後，Web/PWA 維護和 iOS feature parity 會長期並行。

## 共用工具備忘

每個角色都會用到：

```bash
# Typecheck（commit 前一律跑）
npx tsc --noEmit

# 部署（看你動了什麼）
git push origin main                                    # 前端 → App Hosting auto-build
npx firebase deploy --only firestore:rules
npx firebase deploy --only firestore:indexes
npx firebase deploy --only functions:函式名

# Chrome MCP 驗證 production
# mcp__Claude_in_Chrome__navigate / screenshot / read_console_messages
# URL: https://mango-pet--mango-pet-app.asia-east1.hosted.app
```

## iOS 階段新增工具備忘

```bash
# Firebase iOS app / config
npx firebase apps:list IOS --project mango-pet-app
npx firebase apps:create IOS "Mango Pet iOS" --bundle-id com.mangopet.app --project mango-pet-app
npx firebase apps:sdkconfig IOS <APP_ID> --project mango-pet-app

# Expo / EAS（P0 建立 apps/ios 後才用）
npx expo start
npx eas build --platform ios
```

P0 monorepo migration 前，這些指令只是目標狀態；實際 script 以 iOS 五角色文件和當時 `package.json` 為準。

## 第一次起跑：iOS 五角色

接下來進 iOS app 開發時，用 [`session-start-prompt.md`](./session-start-prompt.md) 的 iOS P0 起手範例。

第一個 iOS session 建議是 **Cross-platform PM** 或 **iOS PM**，不要直接大搬家，先做：

1. 讀 `docs/features/ios-app-strategy.md`
2. 檢查 repo shape / package scripts / App Hosting 設定
3. 列 P0 monorepo migration 的最小安全步驟
4. 確認 Web/PWA 回滾策略
5. 產出 handoff 給 iOS Feature Builder / iOS Backend，再開始 `apps/ios` / `packages/*` foundation

選擇方式：如果問題是「iOS 自己怎麼排 P0」用 iOS PM；如果問題是「Web/PWA 與 iOS 共同產品策略怎麼走」用 Cross-platform PM。

舊的 Bug Hunter 起手式仍在 [`bug-hunter.md`](./bug-hunter.md)；需要 production bug sweep 時再開 Bug Hunter session。
