# iOS R03 / R07 / R09 登入與推播修補

日期：2026-10-06；角色：iOS Bug Hunter。基準 `248686f`。
範圍僅 native auth/profile/push 與必要錯誤 UI，未改 dependency、原生設定或發 EAS build。

## 問題與行為

- **R07**：原 auth listener 直接公開 Firebase user，未建立 `users/{uid}`。現在 profile transaction 成功才開放 app；寫入失敗維持未 ready 並顯示重試。Google/Apple/guest 都走相同入口；`onUserChanged` 涵蓋同 UID guest linking，舊 async 結果不能覆蓋新帳號，普通 token refresh 不會卸載進行中的散步。
- **R03**：iOS 原本把 FCM tokens 寫在所有登入者可讀的 public profile。現在只寫 `users/{uid}/private/contact`，bootstrap 會原子合併 legacy tokens/email 並清除 public PII。私人 email 優先序為有效 Auth email、現有私人 email、legacy public email；token 不會因登入清空別台裝置。Apple 只提供一次的姓名先保存在本機，profile 失敗可重試；無姓名者用 Friend／朋友，避免把 email 身份變成公開名字。
- **R09**：`NOT_DETERMINED` 原本被當成 denied，Switch 永遠不能呼叫 requestPermission。現在未詢問可啟用，已拒絕有 iOS 系統設定入口，註冊成功 ack 前不顯示 enabled。APNs / Firestore 失敗顯示錯誤和重試；回到前景也會重新檢查。

推播由 AuthProvider 管理整個登入 session 的 token-refresh listener，不依賴設定頁是否掛載。操作序列化並檢查 UID；refresh 只替換此裝置的舊 token，另在 transaction 內重新確認 globalDisabled，防止另一裝置剛關閉推播又被背景註冊加回。global disable 保持既有帳號層級語意；登出只移除此裝置，保留其他裝置。

登出／切帳號先暫停註冊、清除私人 token 並撤銷 installation token，失敗保留登入讓使用者重試。外部帳號切換若已失去原 UID 的寫入權限，會先撤銷舊 installation token，再註冊新的 UID。伺服器已成功刪帳時，不再寫回 profile/private；若原生 revoke 離線，仍可清除 Auth session，保留本機 metadata 供下次登入再撤銷，並留下不含 token 的警告。

## 驗證

- `apps/ios/scripts/auth-push.test.cjs`：**25/25**。實際 TS 模組＋小型 React hook scheduler；native API 與儲存 transport 邊界為 mock。
- `apps/ios/scripts/auth-push-emulator.test.cjs`：**6/6、0 skipped**。Java 21、Firebase CLI 15.32.1、demo-only 8193；native Firestore API 轉接真 Web SDK，使用整合 R03 public-PII guard 與 R05 marker freeze 的 rules。包括合法初次登入、legacy 原子搬移、token lifecycle、外人 private 讀寫拒絕、舊 client public token 寫入拒絕、刪帳中不得重建 profile。
- Web 與 iOS TypeScript 檢查通過。
- 原 `248686f` 的 push 模組跑同一 NOT_DETERMINED 測試如預期 **1 fail**：回傳 denied；修補後通過。
- 執行指令與測試邊界見 [`apps/ios/scripts/README.md`](../../apps/ios/scripts/README.md)。沒有以 mock / emulator 宣稱原生裝置驗收。

## 發布依賴與未驗項目

Backend 需先部署 public email/fcmTokens 禁寫規則、保留 private owner-only 權限與既有資料搬移。R05 `deletedAccounts/{uid}` freeze 會讓 bootstrap 明確失敗而不建立新 profile；中斷刪帳的 server marker trigger 續清理由 Backend 處理。此頁沒有另開刪帳 recovery UI。

**需要新 iOS App build 才送達使用者。** 目前 `app.json` 仍無 `aps-environment`／`remote-notification`；Apple capability、provisioning、Firebase APNs key/cert 並未在本工作驗證或更動。不能宣稱通知已在實機可用。iOS PM 於 phase 批次 build 驗：Google/Apple 首登、Apple 姓名、訪客升級、系統首次授權／拒絕後設定啟用、實際收到推播、token 更新、多裝置／切帳號／離線登出與刪帳。新 session 的 bootstrap transaction 需連線，離線時顯示可重試錯誤。

原生行為依據：[RNFirebase iOS permissions](https://rnfirebase.io/messaging/ios-permissions)、[token lifecycle](https://rnfirebase.io/messaging/server-integration)、[Firebase Apple Authentication](https://firebase.google.com/docs/auth/ios/apple)。
