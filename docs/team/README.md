# Mango Pet 開發角色分工

每個 session 固定一個平台和一個角色。分角色是為了設護欄：每個 session 都清楚這次「該做什麼、不該做什麼、怎樣算做完」，commit 也才能各自回滾。共用規則（檢查指令、Git、部署）寫在根目錄的 [`AGENTS.md`](../../AGENTS.md)，這份只管角色和多個 session 怎麼協作。

不知道要開哪個角色時，直接描述任務，agent 會依下面的決策樹自己選。要指定角色見 [`session-start-prompt.md`](./session-start-prompt.md)。

## 決策樹

- 有 bug 要修 → **Bug Hunter**：重現、找證據、最小修法、回頭驗證
- 想加新功能 → spec 還沒寫就先開 **PM**；spec 寫好了就開 **Feature Builder**，從頭做到可用
- 畫面不舒服、響應式壞掉、a11y 有問題 → **UI/UX**
- Firestore 慢、rules 有疑慮、缺 index、function 出錯 → **Backend**
- 不知道下一步做什麼 → **PM**：排優先、決定不做什麼、寫 spec
- Web 和 iOS 要不要一起改、誰先做 → **Cross-platform PM**
- 只要提到 iOS、App、iPhone、Expo，就用對應的 `ios-*` 角色

## 角色一覽

| 角色 | Web/PWA | iOS | 一句話 |
|---|---|---|---|
| PM / 策略 | [`pm.md`](./pm.md) | [`ios-pm.md`](./ios-pm.md) | spec、優先序、roadmap、不做清單 |
| Cross-platform PM | [`cross-platform-pm.md`](./cross-platform-pm.md) | 同左 | 兩端的共同規格、parity、誰先做；不寫 code |
| Bug Hunter | [`bug-hunter.md`](./bug-hunter.md) | [`ios-bug-hunter.md`](./ios-bug-hunter.md) | 重現、最小修法、回頭驗證 |
| UI/UX | [`ui-ux.md`](./ui-ux.md) | [`ios-ui-ux.md`](./ios-ui-ux.md) | 視覺層級、響應式／safe area、a11y、動效 |
| Feature Builder | [`feature-builder.md`](./feature-builder.md) | [`ios-feature-builder.md`](./ios-feature-builder.md) | 端到端新功能、iOS 對齊 Web 的功能 |
| Backend / 資料 | [`backend.md`](./backend.md) | [`ios-backend.md`](./ios-backend.md) | schema、rules、indexes、functions、native Firebase |

iOS 角色檔只寫和 Web 版不同的地方，要搭配它指定的基底角色檔一起讀。

## 跨角色協作

- 做到一半發現屬於別的角色的事（例如 UI/UX 看到 bug、Feature Builder 發現 schema 不夠）：不要順手做，寫進 `docs/team/backlog.md` 或對應的 spec，寫清楚交給哪個角色。
- 所有「想做但還沒人做」的事，最後都回到 PM 排優先。
- Backend 做完 migration 後，要在 backlog 註明舊路徑可以清掉了。
- iOS 角色需要改 backend 或 schema → 交給 iOS Backend／Backend；需要產品取捨 → 交給 iOS PM；看到 Web 的 bug → 交給 Web Bug Hunter。

## 多個 session 同時開

1. **Push 前先同步**：`git fetch && git pull --rebase origin main && git push origin main`。有衝突時 git 會停下來，代表另一個 session 改了同一個地方。
2. **挑不會撞檔案的角色組合**：PM 搭任何角色都安全；Backend 搭 UI/UX 也安全。兩個 Bug Hunter、兩個 UI/UX、兩個 Feature Builder 一定會撞。
3. **開工先看別人最近改了什麼**：`git fetch && git log -5 --stat origin/main`。
4. **改依賴要先開 branch，跑 Linux build gate**：改到 `package.json`、lockfile、原生依賴或 repo 結構時，不能直接 push main。先開 branch，對那個 commit 用 App Hosting Build API 建置（只建 build，不建 rollout），結果是 `READY` 才 merge，merge 完刪掉 branch。除了這種情況和使用者明確要求，其他改動一律直接在 main 上做。注意 `npx firebase apphosting:rollouts:create -b <branch>` 會直接上線，不能拿來當純 build 檢查。
   - 原因：本機 macOS 產生的 lockfile 可能漏掉 Linux 平台才需要的原生 binary（例如 `@parcel/watcher-linux-x64-glibc`），本機 build 會過，App Hosting 卻會失敗。2026-05-31 曾因此連續失敗 3 次。
   - 升級任何原生依賴時，記得同步 `apps/web/package.json` 的 `optionalDependencies` 平台清單。
5. **一個 session 一個 worktree，但不用開 branch**：給第二個 session 開一個不帶 branch 的 worktree：`git worktree add --detach ../mango-pet-app-2 origin/main`，做完用 `git push origin HEAD:main` 推回 main，用完 `git worktree remove ../mango-pet-app-2`。不要兩個 session 共用同一個資料夾：2026-06-03 曾經因為共用工作目錄，commit 落到錯的 branch，PM 剛寫好的文件也被另一個 session 刪掉。如果看到某個 session 準備刪掉一堆原本存在的檔案，多半是它的 base 太舊，要先 `git rebase origin/main` 再繼續。
6. **iOS 實機驗收一個 phase 驗一次**：每個 sub-phase 只跑自動檢查（typecheck；有改依賴的話加跑 Linux build gate）。整個 phase 的 code 都進 main 後，再出一個 TestFlight build 讓使用者一次走完驗收（使用者 2026-06-01 的決定）。iOS 1.0 還沒正式上架，沒驗過的 code 進 main 不會影響線上使用者。
