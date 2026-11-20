# Smart Daily Walk Goal Recommendation (`recommendPetWalkGoal`)

狀態：**DEPLOYED (Backend + Web Live Verified) ／ CODE DONE (iOS，待下次實機批次驗收)**
建立日期：2026-11-19
規格 / 實作角色：Feature Builder（Web/PWA + 共用 Cloud Functions Backend）

## User Story

> 作為毛孩飼主，我想在新增或編輯寵物資料時，根據品種、年齡、體重、備註與最近遛狗紀錄一鍵取得 AI 建議的每日散步分鐘數與實務建議，並可自由微調後儲存，因為我希望能為不同體型與生命階段的毛孩設定安全且合適的運動目標。

## Gemini API 設計

- **SDK**：`@google/genai`（僅安裝於 `functions/`，不變動根目錄 `package.json` / `package-lock.json`）。
- **API 與 Model**：Interactions API (`client.interactions.create`) + `gemini-4-hydrogen`。
- **設定**：
  - `store: false`（無狀態推薦，不保存使用者寵物輸入紀錄）。
  - `generation_config: { thinking_level: "low" }`。
  - `response_format: { type: "text", mime_type: "application/json", schema: WALK_GOAL_RESPONSE_SCHEMA }`（強制回傳 `{ minutes, sessionsPerDay, rationale, tips }`）。
- **後端保護與收斂**：
  - 呼叫前驗證 Firebase Auth、`deletedAccounts/{uid}` 刪除柵欄、欄位格式/長度與每使用者每小時 20 次 rate limit（`aiRateLimits/walkGoal_{uid}`，僅伺服器可存取）。
  - 若帶入 `petId`，驗證呼叫者為個人寵物擁有者或家庭成員後，讀取最近 14 天最多 30 筆散步紀錄（單欄位查詢 `petId == ...`）作為活動基線。
  - 後端一律將 `minutes` 限制於 `[5, 180]` 且對齊 `5` 分鐘倍數，`sessionsPerDay` 限制於 `[1, 4]`。

## 契約與檔案變更

- **共用型別**：[`packages/shared-types/src/index.ts`](../../packages/shared-types/src/index.ts) 新增 `WalkGoalRecommendationInput` / `WalkGoalRecommendation`，由 [`apps/web/src/lib/types.ts`](../../apps/web/src/lib/types.ts) re-export。
- **共用文案**：[`packages/shared-i18n/src/messages/zh-TW.json`](../../packages/shared-i18n/src/messages/zh-TW.json) 與 [`en.json`](../../packages/shared-i18n/src/messages/en.json) 的 `PetEdit.walkGoal.*` 新增繁英雙語 key。
- **Cloud Function**：
  - [`functions/src/walk-goal-ai.ts`](../../functions/src/walk-goal-ai.ts)
  - [`functions/src/index.ts`](../../functions/src/index.ts) 匯出 `recommendPetWalkGoal`（region `asia-east1`，secret `GEMINI_API_KEY`）。
- **Web 前端**：
  - [`apps/web/src/lib/firebase/ai-walk-goal.ts`](../../apps/web/src/lib/firebase/ai-walk-goal.ts)
  - [`apps/web/src/lib/firebase/pets.ts`](../../apps/web/src/lib/firebase/pets.ts) 修正 `createPet` 寫入 `input.walkGoal`
  - [`apps/web/src/components/pets/pet-walk-goal-input.tsx`](../../apps/web/src/components/pets/pet-walk-goal-input.tsx) 新增「AI 建議」膠囊鈕、結果建議卡、一鍵重套用按鈕與 Mango token / reduced-motion 對齊
  - [`apps/web/src/components/pets/pet-form-dialog.tsx`](../../apps/web/src/components/pets/pet-form-dialog.tsx) 串接請求、錯誤對應與 `walkGoal.source`（`computed` / `manual`）保留
- **iOS 前端**：
  - [`apps/ios/src/lib/ai-walk-goal-core.ts`](../../apps/ios/src/lib/ai-walk-goal-core.ts) 錯誤碼分類、payload 正規化與 `walkGoal.source` 狀態轉換純邏輯
  - [`apps/ios/src/lib/ai-walk-goal.ts`](../../apps/ios/src/lib/ai-walk-goal.ts) 透過 `@react-native-firebase/functions` 呼叫 `asia-east1` 的 `recommendPetWalkGoal`
  - [`apps/ios/src/lib/ai-walk-goal.web.ts`](../../apps/ios/src/lib/ai-walk-goal.web.ts) 瀏覽器預覽 stub（回傳 `functions/failed-precondition`，避免 preview 觸發計費請求）
  - [`apps/ios/src/lib/pets-write.ts`](../../apps/ios/src/lib/pets-write.ts) 修正 `createPet` 寫入 `input.walkGoal`
  - [`apps/ios/src/components/pets/walk-goal-field.tsx`](../../apps/ios/src/components/pets/walk-goal-field.tsx) 原生每日目標 stepper + 「AI 建議」按鈕 + 建議結果 `Card` + 重套用按鈕 + `useReducedMotion`
  - [`apps/ios/src/components/pets/pet-form.tsx`](../../apps/ios/src/components/pets/pet-form.tsx) 串接 AI 推薦、locale、stale guard 與 `walkGoal.source`（`computed` / `manual`）保留
  - [`apps/ios/scripts/walk-goal-ai.test.cjs`](../../apps/ios/scripts/walk-goal-ai.test.cjs) Node 單元測試

## 部署前設定（由授權部署時執行）

1. 在 [Google AI Studio](https://aistudio.google.com/apikey) 建立 `GEMINI_API_KEY`：**若使用免費額度（Free Tier），請務必選用或新建一個「未綁定 Cloud Billing 帳單帳戶」的獨立 Google Cloud 專案來產生 API Key**（切勿選用已啟用 Blaze 付費方案的 `mango-pet-app` 專案，因 API key 會繼承所屬專案的計費層級）。
2. 設定 Cloud Functions Secret：
   ```bash
   npx firebase-tools functions:secrets:set GEMINI_API_KEY --project mango-pet-app
   ```
3. 部署後端函式：
   ```bash
   npx firebase-tools deploy --only functions:recommendPetWalkGoal --project mango-pet-app
   ```
4. 確認 `GEMINI_API_KEY` 設定與函式部署完成後，再推送 Web 前端（`git push origin main`）。

## iOS Feature Builder Handoff

- **問題 / 背景**：Web 端已完成 `recommendPetWalkGoal` callable 與 `PetFormDialog` UI；為維持雙平台寵物目標一致，iOS 寵物表單可接上同一支 Cloud Function。
- **接手角色 / 平台**：iOS Feature Builder（iOS）
- **所需變更**：
  1. 在 [`apps/ios/src/components/pets/pet-form.tsx`](../../apps/ios/src/components/pets/pet-form.tsx) 與（若有需要）獨立 walk-goal stepper 加上「AI 建議」按鈕與建議卡顯示。
  2. 透過 `@react-native-firebase/functions`（region `asia-east1`）呼叫 `recommendPetWalkGoal`，共用 `@mango/shared-types` 的 `WalkGoalRecommendationInput` / `WalkGoalRecommendation` 與 `@mango/shared-i18n` 的 `PetEdit.walkGoal.*`。
  3. 確認新增寵物寫入時同樣保留 `walkGoal`（含 `source: "computed"` / `"manual"`），並依 `docs/design-system.md` 與 `useReducedMotion` 實作原生樣式。
- **驗收標準**：
  - 在 iOS 寵物表單點「AI 建議」可取得建議分鐘數、建議次數與理由/提醒並填入 stepper；手動修改後 `source` 切回 `manual`。
  - `npm run typecheck -w apps/ios` 與 `node docs/research/ios-pwa-gap-audit-2026-10/tools/check-keys.js .` 通過。
- **依賴 / 進度**：後端 `GEMINI_API_KEY` secret 與 `recommendPetWalkGoal` 部署及 Web 線上驗證已完成；iOS 程式碼實作、typecheck、`check-keys.js` 與 Node 單元測試已完成，僅餘 iOS 實機批次驗收（隨下一階段 build 一起測）。
