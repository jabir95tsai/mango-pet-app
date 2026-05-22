# Mango Pet 開發角色分工

開新 Claude session 前，先決定**這個 session 是什麼角色**。把對應檔案塞進 context（複製貼上，或叫 Claude `read docs/team/{role}.md`）。**一個 session 只當一個角色**，跨角色的事丟到該角色的 backlog 等下次。

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

## 5 個角色一覽

| 角色 | 一句話 | 主要碰 | 主要不碰 |
|---|---|---|---|
| **Bug Hunter** | 重現 + 最小修法 + 部署驗證 | 任何檔案（但只為修一個重現過的 bug） | 不順手 refactor、不加新功能、不調視覺 |
| **UI/UX 工程師** | 視覺層級、響應式、a11y、動效 | `src/app/**/*.tsx`、`src/components/**`、`globals.css`、i18n | `src/lib/firebase/*`、`functions/`、rules |
| **Feature Builder** | 端到端新功能 | 整 stack（type → firebase lib → page → component → rules → index） | 別 piggyback 修 unrelated bug |
| **Backend / 資料** | schema、rules、indexes、functions、migration | `src/lib/firebase/*`、`functions/`、rules、indexes | UI、不亂改 API 簽名 |
| **PM / 策略** | 規格、優先序、roadmap、不做清單 | `docs/*` | 所有 production code |

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
| **PM** + 任何一個其他角色 | PM 只動 `docs/`，零碰 production code |
| ❌ 兩邊都 **Bug Hunter** | 都可動任何檔案，撞 src/ 機率高 |
| ❌ 兩邊都 **UI/UX** 或 **Feature Builder** | 同 lane 必撞 |

### 規則 3（會省下半小時痛苦）：Session 開頭 pre-flight

每個角色檔案頂端的「Session 開頭 pre-flight」段落都寫了同樣的指令：

```bash
git fetch && git log -5 --stat origin/main
```

讀對方最近 5 個 commit 改了什麼，再決定要不要動同一個檔案。Session 開頭花 30 秒做這件事，省下後面 30 分鐘解衝突。

### 進階選項：Git Worktree（真要長期雙開）

如果你預期長期雙開、想徹底隔離兩邊的 working tree（連 system-reminder「intentional change」狂噴都消除），用 git worktree：

```bash
cd /c/Users/jabir/Hacker_J
git -C mango_pet_app worktree add ../mango_pet_app-codex main
```

- Claude 開 `C:\Users\jabir\Hacker_J\mango_pet_app\`
- Codex 開 `C:\Users\jabir\Hacker_J\mango_pet_app-codex\`
- 兩邊獨立 working tree，共用 `.git`，push 時還是回到規則 1

家庭 epic 收尾期不必，等下一階段（同時多功能開發）再啟動。

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

## 第一次起跑：Bug Hunter

[bug-hunter.md](./bug-hunter.md) 已準備好「起手式」清單：

1. 驗證 Phase 3+4 已修 5 個 issue（寵物刪、提醒打勾、圓餅縫、遛狗按鈕、QR 加好友）
2. Production 全頁掃（10 個路由 × desktop + mobile）
3. Migration 健康度檢查
4. 整理 backlog
5. 修 3–5 個就停

開新 session 第一句說：「我是 Bug Hunter，幫我讀 `docs/team/bug-hunter.md` 然後跑起手式」即可。
