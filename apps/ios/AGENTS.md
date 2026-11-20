# apps/ios

- Expo Router + `@react-native-firebase/*`（native SDK，不要換成 Firebase Web SDK）。不能用 Expo Go，要用 dev client。
- Typecheck：`npm run typecheck -w apps/ios`。回歸測試：`node --test apps/ios/scripts/*.test.cjs`（說明見 `scripts/README.md`）。
- 開發機是 Mac mini。

## 模擬器

`npx expo run:ios` 會把 iOS 27 模擬器誤判成實機並要求簽章。改用：

```bash
xcodebuild -workspace ios/MangoPet.xcworkspace -scheme MangoPet -sdk iphonesimulator -destination id=<udid> -derivedDataPath ios/build CODE_SIGN_IDENTITY=- CODE_SIGN_STYLE=Manual DEVELOPMENT_TEAM= PROVISIONING_PROFILE_SPECIFIER=
```

然後 `xcrun simctl install booted <.app>`，再 `npx expo start --dev-client`。要用 ad-hoc `-` 簽章，不要用 `CODE_SIGNING_ALLOWED=NO`：沒簽章會掉 entitlements，expo-notifications 一啟動就跳 keychain 錯誤。

Firestore emulator 測試需要 JDK：`export PATH=/opt/homebrew/opt/openjdk@21/bin:$PATH`。

## TestFlight

- 在本機跑 `apps/ios/scripts/release-ios-local.sh <buildNumber>`：expo prebuild → xcodebuild archive/export → 用 Transporter 開啟 .ipa，由使用者登入並按 Deliver。
- buildNumber 必須大於上一次上傳的版本。
- 不要跑 `eas build`、`eas submit`（排隊太久，已改成本機 build）。
- 內部測試群組是「Mango Team」，已開啟自動派送。

## 實機驗收

一個 phase 的所有 code 都進 main 之後，再出一個 build 讓使用者一次走完驗收清單。不要每個 sub-phase 都請使用者裝機。push、相機、Photos、APNs、Apple 登入這類只能在實機驗證的項目，要標明模擬器沒辦法驗。
