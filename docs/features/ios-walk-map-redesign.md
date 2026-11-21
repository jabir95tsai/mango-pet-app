# iOS 散步頁地圖改版

狀態：**READY-FOR-DEV**（未實作）
建立日期：2026-11-21
規格作者：iOS PM session（使用者 2026-11-21 逐題確認 Q1–Q14）
接手角色：iOS UI/UX（主）。可動 `apps/ios/app/(tabs)/walks.tsx`、`apps/ios/src/components/walks/*`、`packages/shared-i18n`。**不碰** `walk-tracking-service.ts` 的定位／存檔邏輯、schema、rules、functions。

## User Story

使用者給的參考：運動 app 的開始頁，數字在上、地圖在中間、開始按鈕在下。

> 我要更新散步頁，像這樣中間有地圖，開始的時候顯示位置。

只借版面，視覺照 `docs/design-system.md`（Mango 暖色系），不做黑白運動風。

## 現況（2026-11-21 code）

- `react-native-maps` 1.27.2、`expo-location` 已裝；**不需要新依賴**，不用開 branch。
- `RouteMap`（`src/components/walks/route-map.tsx`）只用於歷史路線 modal 與家庭即時位置，固定高 280、會 fit 整條路線。
- 散步 tab：本週條 → hero 文案 → `WalksDial` → 紀錄列表，底部固定 `WalksStartCta`。
- 追蹤 modal（`TrackingActivePanel`）：可捲動，只有 timer、距離、目標進度，**無地圖**。
- 即時路徑已在 `WalkTrackingState.path`；分段用 `routeSegments`（`src/lib/walk-route-read-policy.ts`）。
- 定位權限只在按開始時請求（`walk-tracking-service.ts` `requestForegroundPermissionsAsync`）。

## 決策（使用者已確認）

| # | 題目 | 採用 |
|---|---|---|
| Q1 | 地圖放哪 | 首頁（開始前）＋追蹤畫面都放 |
| Q2 | 權限時機 | 首頁不主動要權限；已授權才顯示位置，權限仍在按開始時請求 |
| Q3 | 首頁排版 | 地圖取代 `WalksDial`；本週條留上方，紀錄列表在地圖下方 |
| Q4 | 視覺 | 只借版面，照 Mango design system |
| Q5 | 地圖供應 | Apple Maps（`react-native-maps` 預設，無 API key） |
| Q6 | 平台 | 只做 iOS；Web 進 roadmap |
| Q7 | 追蹤排版 | 不捲動一頁：上 timer＋距離、中地圖填滿、下 暫停／停止／拍照；次要提示改成地圖上的浮動小條 |
| Q8 | 追蹤鏡頭 | 預設跟隨；使用者拖動後停止跟隨並出現「回到我的位置」按鈕 |
| Q9 | 追蹤路線 | 即時畫 polyline，暫停前後分段不相連 |
| Q10 | 首頁無權限／無位置 | **不顯示地圖**，顯示插圖卡片「按開始後顯示你的位置」；拿到位置後換成地圖 |
| Q11 | 首頁地圖互動 | 不可互動（純展示），高約 280，避免和頁面捲動搶手勢 |
| Q12 | 只記時間模式 | 追蹤畫面不顯示地圖，維持現在計時版面 |
| Q13 | 完成畫面 | 用 `RouteMap` 顯示整條路線 |
| Q14 | 照片標在地圖 | 這次不做（照片無座標），進 roadmap |

## 行為細節

### 首頁地圖

1. 進頁面時用 `Location.getForegroundPermissionsAsync()` 查狀態，**不呼叫 request**。
2. 已授權 → `getLastKnownPositionAsync()`，沒有再 `getCurrentPositionAsync({accuracy: Balanced})`；拿到座標顯示地圖（中心＝目前位置、`showsUserLocation`、`scrollEnabled/zoomEnabled/rotateEnabled/pitchEnabled=false`）。
3. 未授權／拒絕／取位置失敗／還在取 → 插圖卡片（沿用 `EmptyState` 卡片樣式，同高 280，版面不跳動）。
4. 從追蹤回來（剛授權過）或 app 回前景時重新檢查一次，讓卡片變成地圖。
5. 無寵物時（`pets.length === 0`）維持現有 EmptyState，不顯示地圖。

### 追蹤畫面

1. 版面固定一頁：上方 timer、距離、目標進度；中間地圖 `flex:1`；下方控制列。
2. `showsUserLocation`；`path` 經 `routeSegments` 畫 polyline（顏色 `colors.brandDeep`，寬 4），只有一個點的段不畫線。
3. 跟隨：新點進來時 `animateCamera` 到最新點；`onPanDrag` 後關閉跟隨並顯示「回到我的位置」浮動按鈕，按下恢復跟隨。
4. `reminderShown`、背景定位說明、`timingOnly` 提示 → 地圖頂端浮動小條（保留 `accessibilityRole="alert"`）。
5. `timingOnly` 或定位失敗 → 不顯示地圖，退回現有版面。

### 完成畫面

`TrackingDonePanel` 有路線點時插入 `RouteMap`（不是 live），沒點就不顯示。

## 文案（新增 i18n key，zh-TW / en）

- `Walks.map.noLocation`：按開始後顯示你的位置 / Start a walk to see where you are
- `Walks.map.recenter`：回到我的位置 / Back to my location
- `Walks.map.label`（a11y）：目前位置地圖 / Map of your current location

## 驗收條件

- [ ] 未授權定位的新使用者打開散步 tab：**沒有**權限彈窗，看到插圖卡片。
- [ ] 按開始授權後回到首頁：卡片換成地圖，藍點在目前位置。
- [ ] 首頁上下捲動時地圖不會攔截手勢。
- [ ] 追蹤畫面不用捲動就看得到 timer、距離、地圖、暫停／停止／拍照（iPhone SE 尺寸也一樣）。
- [ ] 邊走邊畫出路線；暫停後繼續，兩段不連線。
- [ ] 拖動地圖 → 停止跟隨、出現回到位置按鈕；按下 → 回到目前位置並恢復跟隨。
- [ ] 只記時間模式沒有地圖，計時正常。
- [ ] 完成畫面顯示整條路線。
- [ ] 原本的照片、背景定位、草稿恢復、6 小時上限行為不變。
- [ ] `npm run typecheck -w apps/ios`、`node --test apps/ios/scripts/*.test.cjs` 通過。
- [ ] 實機走一趟（模擬器定位不準，實機才算簽收），順便觀察耗電。

## 延後

- Web/PWA 同樣改版（已有 `@googlemaps/js-api-loader`）。
- 散步照片標在地圖上：需要在拍照時記座標，動到 walk 資料結構，先交 iOS Backend 定義。
