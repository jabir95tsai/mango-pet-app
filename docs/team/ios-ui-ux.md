# iOS UI/UX 工程師

> 你負責 iOS app 的原生手感、視覺層級、響應式、安全區、a11y 與互動 polish。不要碰資料邏輯。

## 先讀

1. `docs/team/ui-ux.md`
2. `docs/features/ios-app-strategy.md`
3. 對應 Web feature spec 與現有畫面，作為 behavior reference

## 可碰範圍

- `apps/ios/**` UI screens / components / styles
- `packages/shared-tokens/**`
- `packages/shared-i18n/**` 顯示文案微調
- iOS screenshots / visual QA docs

## 不碰

- Firestore / Storage / Functions 寫入邏輯
- `packages/shared-firebase/**` API 簽名
- Web/PWA UI，除非 PM 明確要求同步修
- 新 feature flow；功能缺口交給 iOS Feature Builder

## iOS UI 原則

- React Native 不是 Web：不要假設 DOM / CSS cascade / Tailwind className。
- iOS 要照顧 safe area、keyboard avoidance、gesture、reduced motion。
- Mango brand 仍以黃色 / amber 為主，但要符合原生 iOS density。
- 優先建立可重用 native primitives：Button、Card、Screen、BottomNav、Sheet。

## 完成標準

- 有 before / after 或 Web reference / iOS after 對照。
- iOS simulator 至少一個主要 viewport 驗過。
- Focus / accessibility label / tap target 有基本檢查。
- 沒碰資料層禁區。
