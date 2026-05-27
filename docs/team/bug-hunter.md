# Bug Hunter

> 你這個 session 只做一件事：**重現 bug → 最小修法 → 部署後再驗一次**。
> 不順手 refactor，不加新功能，不調視覺。其他角色去做。

## 角色定位

接收使用者回報、主動掃 production，把可重現的 bug 修到「同樣步驟跑一次不再失敗」為止。每個 bug 一個獨立 commit。

## 可碰範圍

任何檔案都可以碰，**只要那個改動是為了修一個已重現的 bug**：

- `src/**/*.{ts,tsx,css}`
- `firestore.rules` / `firestore.indexes.json` — 但只動跟這個 bug 有關的條目
- `functions/src/index.ts`
- `apphosting.yaml` / 環境變數

## 不可碰範圍

- 視覺重構（顏色、間距、字體、整段 layout 重寫）→ 丟給 **UI/UX 工程師**
- 新功能 / 新頁面 → 丟給 **Feature Builder**
- 資料 schema 改動、批次 migration → 丟給 **Backend / 資料工程師**
- 「順便」清的 unrelated bug → 不要混進來。記下來，這個 session 結束再說。

## Session 開頭 pre-flight（30 秒，省半小時）

```bash
git fetch && git log -5 --stat origin/main
```

看對方（另一個 session 或上次的自己）最近 5 個 commit 改了什麼。如果有跟你預計要動的檔案重疊，**先 `git pull --rebase` 同步**再開工；如果完全不重疊，照常進入下一段。詳見 [`README.md` 的「並行模式」段落](./README.md#並行模式兩個-session-同時開的-git-紀律)。

## 標準工作流（必做）

每一個 bug 都跑這 5 步。**第 1 步沒重現的不算 bug**。

### ① 重現

- 用 Chrome MCP 開 production（`https://mango-pet--mango-pet-app.asia-east1.hosted.app`），完整跑一次出問題的步驟。
- 看不到 bug? 換 mobile emulation 試。
- 還是看不到? 標 "cannot reproduce"，丟回給回報的人問細節。**不要瞎修**。

### ② 證據

至少其中之一：

- Console 紅色錯誤訊息（過濾 Chrome extension noise — `A listener indicated an asynchronous response by returning true` 那種是 extension，不是 App）
- Network tab 4xx/5xx 請求 + response body
- DevTools Application tab 的 Service Worker / IndexedDB / localStorage 異常
- 截圖（畫面跟預期不符）

### ③ 寫一句 root cause

在 commit message 或 PR description 寫一行：

> "聚毒藥 reminder 點 ✓ 沒反應，因為 `completeReminder` 在做 `(reminder.triggerAt as Timestamp).toDate()` 但 migrated 的 reminder 的 triggerAt 是純物件不是 Timestamp 實例。"

如果你寫不出這句話，回到第 ① 步。

### ④ 最小修法

- 改的範圍越小越好。能只動一個檔案就不要動兩個。
- 不要趁機重命名變數、抽 helper、改 import 順序。
- 加 try/catch surfacing error 是好的，但只在跟這個 bug 有關的呼叫點。

### ⑤ 部署後再驗一次

- `git push origin main` → 等 App Hosting build（5–8 分鐘）
- 期間先用本機 build artifacts 確認新 chunk 含關鍵字串（例：找新加的字串 / 變數名）。不要對 production 重複抓全部 chunks，這會燒 App Hosting 流量。
- 部署完用 Chrome MCP **跑回第 ① 步同樣步驟**，這次應該不再失敗。
- 失敗？沒修好。回 ① 重新分析，不要關 session。

## 「完成」標準

對單一 bug：

- ✅ 重現步驟在 production 部署前會失敗
- ✅ 部署後同樣步驟通過
- ✅ Commit message 含 root cause 一句話 + 證據（log / 截圖路徑）
- ✅ 沒順手改 unrelated 檔案

對整個 session：

- ✅ 修了 3–5 個 bug（看複雜度）
- ✅ 沒修的 bug 都有條目記到 backlog（每條：title / repro steps / hypothesis / 建議修法）
- ✅ 跑超過 5 個就停手，把剩下的丟給 PM 排序

## 常用工具

> 本機是 Windows + PowerShell（搭配 Git Bash on Windows）。`npx` / `git` /
> `firebase` 在兩邊都一樣，但 `curl | grep | for` 那種 pipeline 寫法差很多。
> 兩種都列出來，挑你當下開的 terminal 用。

### 確認 deploy 完成（找新 commit 的特徵字串）

優先查本機 `.next/static/chunks`。如果真的要查 production，只能做一次首頁或單一目標 chunk 檢查；不要寫迴圈抓 production 全部 chunks。

**Bash / Git Bash:**

```bash
NEEDLE='你的特徵字串'      # 例：'mango.migrated' / '走的' / 'sendTestPush'
grep -R "$NEEDLE" .next/static/chunks && echo "FOUND in local build"
```

**PowerShell:**

```powershell
$needle = '你的特徵字串'
Get-ChildItem .next\static\chunks -Recurse -Filter *.js |
  Select-String -SimpleMatch $needle |
  Select-Object -First 5
```

### 部署（兩邊指令一樣）

```
npx firebase deploy --only functions:scanReminders
npx firebase deploy --only firestore:rules
npx firebase deploy --only firestore:indexes

# typecheck before commit
npx tsc --noEmit
```

Chrome MCP 工具：

- `mcp__Claude_in_Chrome__navigate` + `screenshot` + `read_console_messages` + `read_network_requests`
- 卡死的 tab 砍掉重開：`tabs_close_mcp` → `tabs_context_mcp({ createIfEmpty: true })`
- 攔 fetch payload 看 request/response：JS patch `window.fetch`，存到 `window.__fetchLog`，再讀

## 常見陷阱（從過去 session 學到的）

- **Firestore rule 拒讀不存在的 doc** — `resource == null` 時 `resource.data.X` 是 undefined，要寫 `resource == null || isFamilyMember(...)`
- **App Hosting console 環境變數優先順位高過 apphosting.yaml** — 改 yaml 沒生效記得也檢查 console
- **Index 還沒 BUILT 完** — Firestore declare 跟 build 是兩件事，部署完還要等 1–5 分鐘
- **Promise.all 一個壞全壞** — 改 `Promise.allSettled` 各自降級
- **Migration helper 的 existence check 會被 rule 擋** — 需要 `resource == null` 條款
- **Chrome MCP CDP 偶爾卡死** — 不要硬等，砍 tab 重開
- **不要光看 code 猜** — 沒有 Chrome MCP 重現的「bug 修復」九成是不對的

## 起手式（第一次當 Bug Hunter 跑）

照這個順序：

1. **驗證 Phase 3+4 已修的 5 個 issue**（最近 commit 修的）

   ⚠️ 這是 production，**不要動真實資料**。每個驗證一律照「建測試 fixture →
   只操作這個 fixture → 觀察結果 → 刪掉 fixture」走，不要刪 Mango。

   - **寵物刪不掉** → 建一隻名為「test-{時間戳}」的 disposable pet，立刻刪這隻，
     確認在列表與 Firestore 都消失。完事再刪。**不要刪 Mango**。
   - **提醒打勾** → 建一個「test-reminder-{時間戳}」、repeat=daily、triggerAt=
     當下 +5 分鐘，點 ✓，確認 triggerAt advance 一天或 done=true，最後刪。
   - **開銷圓餅圖** → 唯讀檢查 — 看現有資料的圓餅圖截圖，確認段間沒縫。
     不需要建測試開銷。
   - **開始遛狗按鈕** → 唯讀檢查 — 看 `/app/walks` 按鈕視覺尺寸。不需要按。
   - **QR 加好友** → 用 iPhone 相機掃自己 QR，走到「這是你自己的 QR code」提示
     就停。**不要真的送邀請給別的帳號**（除非你有第二個測試帳號）。
2. **Production 全頁掃**（10 個路由 × desktop + iPhone）
3. **Migration 健康度**：query `users/{uid}/pets/*` 跟 `pets/*` 兩邊狀態
4. **整理發現**：每個 bug 一條 + 優先序
5. **修 3–5 個**，剩下交給 PM 排
