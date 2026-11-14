# iOS App 瀏覽器預覽（react-native-web）

> **狀態**：已整合 main（2026-11-14，`f3dbe0a` / `ced740c`）。當日 Web／iOS typecheck、兩平台 Metro export 與 Linux App Hosting gate 通過；2026-10-11 的瀏覽器互動紀錄保留為歷史驗證，未代替 iPhone 真機驗收。
> **用途**：沒有 Mac / iOS 模擬器時，在 Windows 瀏覽器用手機尺寸看 `apps/ios` 的畫面，給 Claude Design / UI 調整用。
> **不是**：上架用的 web 版，也不是 PWA（PWA 是 `apps/web`）。不能代替 dev-client 真機驗收。

## 怎麼啟動

在 repo root 執行一行指令：

```bash
npm run web -w apps/ios
```

接著用一般桌面瀏覽器打開 **`http://localhost:8081/iphone.html`**（推薦）：

- App 會放在 iPhone 外框裡，以 iPhone 15 / 16 的 **393×852** 尺寸執行。外框有動態島、即時時鐘的狀態列和 home indicator，大小會自動縮放到適合視窗。
- 在外框裡，App 會拿到跟真機一樣的 safe area（上 59 / 下 34），所以頁首、浮動 tab bar、底部按鈕的位置都跟 iPhone 一致；捲軸也會隱藏。
- 外框下方有按鈕可以切換 Liquid Glass / 凹口 tab bar、只重新載入 App、或在新分頁開無外框版本。
- `?path=/feed` 可以指定開啟的頁面，例如 `iphone.html?path=/feed`。

不用外框時直接開 `http://localhost:8081`，再用瀏覽器的手機模式設成 390×844。這種模式下瀏覽器沒有瀏海，safe area 為 0。

- 第一次編譯大約需要 20–30 秒，之後改 code 會用 Fast Refresh 自動更新。
- 登入頁選「**以訪客身分繼續**」，會走既有的匿名登入（guest）流程。訪客狀態存在瀏覽器（IndexedDB），重新載入不會再建立新的匿名帳號。
- 要換 port：`npm run web -w apps/ios -- --port 8091`。
- 預設顯示 **iOS 26 的 Liquid Glass 樣式**（浮動玻璃 tab bar、玻璃鏡片切換器），用 CSS 毛玻璃模擬。想看 iOS 26 以前的凹口 tab bar，在網址加上 `?glass=0` 後重新載入。

### Firebase 設定來源（不寫死在 repo）

瀏覽器版透過 Firebase JS SDK 連到同一個 `mango-pet-app` 專案，需要 **web app** 設定。啟動腳本 `apps/ios/web-preview/start.mjs` 的讀取順序：

1. 環境變數 `EXPO_PUBLIC_FIREBASE_*`
2. `apps/ios/.env.local`（gitignored，可自行建立）
3. `apps/web/.env.local` 的 `NEXT_PUBLIC_FIREBASE_*`（PWA 本機開發本來就有）
4. 在 git worktree 裡執行時，會自動改讀**主 checkout** 的 `apps/web/.env.local`（透過共用的 `.git` 找到位置）。也可以用 `WEB_PREVIEW_ENV_FILE=<路徑>` 手動指定。

需要的 key：`API_KEY`、`AUTH_DOMAIN`、`PROJECT_ID`、`STORAGE_BUCKET`、`MESSAGING_SENDER_ID`、`APP_ID`。啟動時終端機會印出 `[web preview] Firebase web config from <檔案>`。只要缺任何一個 key，腳本就會列出它找過的位置並直接停止，不會啟動一個只剩 Firebase 錯誤畫面的預覽。

### 成本

- 訪客登入（Anonymous Auth）、Firestore 讀取 / 少量寫入（建立訪客 profile）都屬一般用量，和在手機上開 App 一樣。
- **不會**呼叫任何新的付費第三方 API。原本就會計費的收據 AI 掃描（Firebase AI Logic / Gemini）在 web 上被替身擋掉，不會發出請求。
- 推播：web 上不會取得 FCM token，也不會寫入 `private/contact.fcmTokens`。

## 運作方式（全部只在 web 生效）

| 檔案 | 作用 |
|---|---|
| `apps/ios/package.json` | 新增依賴 `react-dom` 19.2.3、`react-native-web` ~0.21、`@expo/metro-runtime` ~57（版本由 `npx expo install` 決定），以及 `web` 腳本 |
| `apps/ios/web-preview/start.mjs` | 把 Firebase web 設定轉成 `EXPO_PUBLIC_FIREBASE_*` 後執行 `expo start --web`，不會寫任何檔案 |
| `apps/ios/metro.config.js` | `platform === "web"` 時：① 把會在載入時就崩潰的原生套件換成 `web-preview/shims/*`；② 把所有 `@firebase/app` 統一成 RNFB 內嵌的那一份（否則會出現 "Component auth has not been registered yet"）；③ 把 RNFB 內部用的 `firebase/auth` 換成預設瀏覽器持久化的版本；④ 把 `react-native-safe-area-context` 內部的 `./NativeSafeAreaProvider` 換成能回報 iPhone 留白的版本 |
| `apps/ios/public/iphone.html` | iPhone 外框頁（Expo web dev server 會直接提供 `public/` 底下的檔案）。用 `<iframe data-device="iphone">` 載入 App |
| `apps/ios/web-preview/device-mode.js` | 從外框的 iframe 屬性判斷是否在 iPhone 外框裡、Liquid Glass 開或關（換頁或重新載入都不會遺失） |
| `apps/ios/src/lib/rnfb-setup.web.ts` | 取代 `rnfb-setup.ts`（只在 web）：補上 `setImmediate` polyfill、執行 `firebase.initializeApp(web config)`、過濾 RN 專用 prop 在 DOM 上產生的 dev 警告 |
| `apps/ios/src/lib/ai-receipt.web.ts` | 取代 `ai-receipt.ts`（只在 web）：收據掃描直接失敗並改成手動輸入，不呼叫 Gemini |
| `apps/ios/src/lib/liquid-glass.ts` | `detect()` 原本只放行 iOS，現在也放行 web，讓預覽走 Liquid Glass 版面。iOS 上 `Platform.OS` 是編譯期常數，這個條件會被摺疊掉 |
| `apps/ios/web-preview/shims/` | `expo-media-library`（拒絕權限）、`@react-native-firebase/messaging`（推播「未決定」、不給 token）、`@react-native-google-signin/google-signin`（Google 登入回報不可用）、RNFB `firebase/auth`（瀏覽器持久化）、`safe-area-native-provider`（在外框裡回報上 59 / 下 34，其他情況用套件原本的瀏覽器實作）、`expo-glass-effect`（回報 Liquid Glass 可用，`GlassView` 改用 CSS 毛玻璃；網址加 `?glass=0` 則回報不可用） |

**iOS 原生行為沒有改變的證據**：分別用目前分支和原始 `metro.config.js`（並拿掉 `.web.ts`）執行 `npx expo export --platform ios --no-bytecode`，兩次得到的 iOS JS bundle 內容雜湊相同（`entry-47c909f9…`），也就是 iOS 打包結果一個 byte 都沒變。原因是 `.web.ts` 檔與 metro 的 web 規則都不會被 iOS 平台解析到。加上 `liquid-glass.ts` 的 web 判斷之後重新匯出，雜湊仍然相同。

新增原生套件時：如果 `npm run web -w apps/ios` 出現 `Cannot find native module 'Xxx'`，就在 `web-preview/shims/` 加一個替身，再到 `metro.config.js` 的 `WEB_SHIMS` 註冊。**不要**為了讓 web 能跑而改 iOS 的程式碼路徑。

## 已知限制：web 和真機的差異

| 項目 | web 預覽 | 真機 |
|---|---|---|
| Liquid Glass（iOS 26 浮動 tab bar、鏡片切換器） | 版面和互動一樣，但玻璃只是 CSS 毛玻璃（模糊 + 半透明白），沒有真實的折射、光澤和果凍變形的光學效果；`?glass=0` 可切回凹口 bar | iOS 26+ 是原生 UIGlassEffect；iOS 26 以前是凹口 bar |
| 陰影 | RN `shadow*` 轉成 CSS box-shadow；漸層按鈕外層會出現方角的淡色底（例如首頁「新增第一隻寵物」） | 原生陰影會跟著圓角 |
| 字型 / 字重 | 用 Windows 系統字（微軟正黑體 / Segoe UI），行高與字寬和 SF Pro / PingFang 不同 | SF Pro + PingFang TC |
| Safe area | `iphone.html` 外框裡固定為 iPhone 15/16 的上 59 / 下 34（不含橫向、不含其他機型）；無外框時為 0 | 依機型而定 |
| 狀態列 / 動態島 | 外框畫上去的靜態圖案（時間會走），不會隨 App 的 `StatusBar` 樣式變色，動態島也不會有動畫 | 系統原生 |
| 觸覺回饋、原生 sheet / 手勢、轉場 | 沒有，或改成網頁行為 | 有 |
| Google / Apple 登入 | Apple 按鈕隱藏；Google 回報不可用。只能用訪客模式 | 正常 |
| 遛狗追蹤 | 背景定位（TaskManager）不支援；開始遛狗只能看到 UI，不能實際記錄路線 | 正常 |
| 相機 / 相簿 / 存到相簿 / 分享 | 相機依瀏覽器權限而定；存到相簿一律失敗；分享走 Web Share（不支援時顯示錯誤） | 正常 |
| 收據 AI 掃描 | 停用（顯示「無法辨識，請手動輸入」） | 正常（計費） |
| 推播 | 永遠是「未決定」，不能開啟 | 正常 |
| 資料 | 訪客帳號通常沒有寵物，寵物 / 遛狗頁多半是空狀態；動態頁會顯示真實的公開貼文 | 依帳號資料而定 |

驗證時的截圖（390×844）：首頁、寵物、散步、動態、設定都能正常顯示。詳細記錄在 2026-10-11 session 的回報中。
