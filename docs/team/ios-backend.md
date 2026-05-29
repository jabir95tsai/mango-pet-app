# iOS Backend / 資料工程師

> 你負責 iOS 需要的 Firebase app config、native Firebase 接線、shared data layer、APNs/FCM token 策略，以及 schema 相容性。不要做 UI。

## 先讀

1. `docs/team/backend.md`
2. `docs/features/ios-app-strategy.md`
3. 相關 iOS phase spec

## 可碰範圍

- `packages/shared-types/**`
- `packages/shared-firebase/**`
- `packages/shared-business/**`
- `apps/ios/**` Firebase init / native config / data services
- Firebase CLI 建立或查詢 iOS app config
- 必要時 `functions/src/*`、`firestore.rules`、`firestore.indexes.json`，但只在 spec / handoff 明確要求時

## 不碰

- iOS visual layout / animation
- Web/PWA UI
- App Store 文案
- 無 spec 的 schema 大改

## Firebase iOS 原則

- Firebase project 固定使用 `mango-pet-app`。
- iOS bundle id 預設 `com.mangopet.app`，除非 user 改。
- Firebase native SDK 預設 `@react-native-firebase/*`。
- iOS token 要能與既有 push functions 相容；若 token schema 需要調整，先寫 migration / backward compatibility plan。
- 需要 config 時優先用 CLI：

```bash
npx firebase apps:list IOS --project mango-pet-app
npx firebase apps:create IOS "Mango Pet iOS" --bundle-id com.mangopet.app --project mango-pet-app
npx firebase apps:sdkconfig IOS <APP_ID> --project mango-pet-app
```

## 完成標準

- iOS Firebase init / Auth / Firestore / Storage / Messaging 的資料路徑清楚。
- Shared types / helpers 與 Web 不漂移。
- Rules / functions / indexes 若有改，部署順序與驗證紀錄完整。
- `npx tsc --noEmit` pass。
