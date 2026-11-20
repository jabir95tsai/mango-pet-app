# Mango Pet

以「遛狗」為核心的寵物 app。Web/PWA 與 iOS 兩端共用同一個 Firebase project `mango-pet-app`（Auth、Firestore schema、Storage、Cloud Functions）。不要另建 Firebase project。

## Repo 地圖

- `apps/web`：Next.js PWA，部署在 Firebase App Hosting。改這裡先看 `apps/web/AGENTS.md`。
- `apps/ios`：Expo Router + `@react-native-firebase/*`，資料層在 `apps/ios/src/lib`。改這裡先看 `apps/ios/AGENTS.md`。
- `packages/shared-{types,business,i18n,tokens}`：兩端都要用的 type、純邏輯、文案、design token 放這裡，不要各寫一份。
- `functions/`、`firestore.rules`、`firestore.indexes.json`：共用 backend。
- `docs/roadmap.md`（優先序）、`docs/features/*.md`（spec）、`docs/team/`（角色）、`docs/team/backlog.md`（bug／技術債）。

## 角色

每個 session 固定一個角色，用來劃定這次能動哪些檔案、做到哪裡算完成。

- 使用者有指定角色就照指定。沒指定就依 `docs/team/README.md` 的決策樹自己選，不要叫使用者填模板。例如：bug → Bug Hunter；畫面、樣式、a11y → UI/UX；有 spec 的新功能 → Feature Builder；沒 spec 或要排優先 → PM；rules、index、functions → Backend；兩端要不要一起改 → Cross-platform PM。提到 iOS、App、iPhone、Expo 就用 `ios-*` 版本。
- 第一句回覆用一行說明：平台／角色／本次任務／完成標準（推定），然後直接開始。只有在角色會實質改變範圍、產品決策或權限（部署、push、刪資料）時才先問。
- 讀 `docs/team/<角色>.md`；做任何 UI 前讀 `docs/design-system.md`（品牌樣式的唯一依據，不要每次重新推導）。
- 超出角色的事：先做本角色能做的部分，其餘寫進 backlog、spec 或 roadmap，寫清楚問題、證據、接手角色和驗收條件。

## 現況判斷

以 code、package scripts、設定檔為準。roadmap 或 spec 上打勾、寫 SHIPPED，不代表已部署或已實機驗證；兩者矛盾時列出差異。

## 檢查

改 code 後、commit 前，對受影響的專案跑 typecheck：

```bash
npm run typecheck -w apps/web
npm run typecheck -w apps/ios
npm --prefix functions run build
```

- 根目錄的 `npm run typecheck` 只檢查 web，不代表全 repo 通過。
- 改 `packages/*` 時，web 和 iOS 兩端都要檢查。
- iOS 回歸測試：`node --test apps/ios/scripts/*.test.cjs`。
- `npm run lint` 原本就有很多既有警告，不當成完成門檻，但本次新增的問題要處理。
- `npm run build` 預設不跑。

## Git：預設直接用 main

- 直接在 main 上改、commit，用 `git pull --rebase origin main && git push origin main` 推上去。不要自己開 feature branch，功能比較大、要分好幾個 commit 也一樣。這條規則優先於 agent 內建的「在 default branch 上要先開 branch」。push main 會觸發 Web App Hosting 重新 build。
- 只有兩種情況開 branch：
  1. 改到 `package.json`、lockfile、原生依賴或 repo 結構：開 branch，跑過 Linux build gate 才 merge，merge 完刪掉 branch（見 `docs/team/README.md` 規則 4）。
  2. 使用者明確要求。
- 開工時如果 checkout 停在別的 branch，不要在上面疊新工作，先問使用者要不要切回 main。
- 同時有兩個以上 session 會寫檔時，第二個 session 開一個不帶 branch 的 worktree：`git worktree add --detach ../mango-pet-app-2 origin/main`，做完一樣 `git pull --rebase origin main && git push origin HEAD:main`。
- commit、push、deploy 只在使用者授權後才做。

## 部署（已授權時）

- Web：push main → App Hosting。Production 網址：https://mango-pet--mango-pet-app.asia-east1.hosted.app
- Backend：依 rules → indexes → functions → 前端 的順序部署，例如 `npx firebase deploy --only firestore:rules`、`--only firestore:indexes`、`--only functions:<函式名>`。
- iOS TestFlight：見 `apps/ios/AGENTS.md`。不用 EAS。

## 回報

用繁體中文簡短說明：做了什麼（附檔案路徑）、驗證結果（通過／失敗／沒跑，以及原因）、handoff（沒有就寫「無」）。
