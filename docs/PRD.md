# Mango Pet App — 產品需求文件 (PRD)

> 版本：v0.1 / 建立日期：2026-05-11 / 狀態：草案

## 1. 產品定位

一站式寵物照護與社交平台 (Web first → PWA → 未來 iOS)。
讓飼主能記錄寵物生活、找寵物友善餐廳、參與遛狗排行、與其他飼主交流。

- 主要使用者：飼主 (主打狗主人，也支援其他寵物)
- 商業模式：完全免費 (短期靠 Firebase 免費額度 + GCP $300 credit)
- 語系：繁體中文 + 英文

## 2. 技術棧

| 層 | 技術 |
|---|---|
| 前端 | Next.js 15 (App Router) + React 19 + TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| 狀態 | Zustand / React Context |
| 表單 | React Hook Form + Zod |
| i18n | next-intl |
| PWA | next-pwa / Service Worker |
| 認證 | Firebase Auth (Google / Apple / Facebook) |
| 資料庫 | Firestore |
| 檔案 | Firebase Storage (照片) |
| 推播 | Firebase Cloud Messaging + 站內提醒 |
| 排程 | Firebase Cloud Functions (Blaze) |
| 地圖 | Google Maps JavaScript API |
| 部署 | Vercel (前端) + Firebase (後端) |

## 3. 核心功能 (MVP 全塞)

### 3.1 寵物檔案
- 一個帳號可建立多隻寵物 (狗/貓/其他)
- 寵物資料：名字、品種、出生日、性別、體重、照片、簡介
- 每隻寵物有獨立的健康紀錄與相簿

### 3.2 照片與相簿
- 上傳照片到 Firebase Storage
- 公開度設定：私人 / 好友 / 公開
- 自動關聯至寵物個檔
- 不支援影片 (Phase 1)

### 3.3 健康紀錄 + 提醒
紀錄類型 (可擴充):
- 體重 (時間序列圖)
- 餵食 (品牌/份量/時間)
- 疫苗 (種類/施打日/下次到期)
- 就醫 (醫院/醫生/診斷/處方)
- 用藥 (藥名/頻率/起迄日)

提醒機制:
- Firebase Cloud Functions 定時掃描 → FCM Web Push
- 使用者可設定提前 N 天提醒

### 3.4 寵物友善餐廳地圖
- Google Maps JS API 顯示地圖
- 資料來源混合：
  - 初始種子資料 (自建)
  - 使用者新增 (送審或直接上)
  - Google Places API 標籤過濾
- 功能：搜尋、收藏、評分、評論

### 3.5 遛狗 GPS + 加權排行榜
- App 開啟時用 `navigator.geolocation.watchPosition` 追蹤
- 接受 PWA 限制：鎖屏可能停止追蹤
- 手動補登：使用者可後補不完整的紀錄

加權公式 (v1):
```
score = (distance_km * type_factor)
      + (duration_min * 0.5)
      + (streak_days * 5)
```
其中 `type_factor` 依寵物體型/年齡調整 (小型犬係數較高，公平化)。

排行類型：週榜 / 月榜 / 總榜，可篩選 (全平台 / 好友 / 同城)。

### 3.6 動態牆 + 社交
- 貼文：照片 + 文字 + 寵物 tag
- 公開度：私人 / 好友 / 公開 (每篇可選)
- Emoji 回應 (無留言、無私訊)
- 好友系統：搜尋 (帳號/email)、發送邀請、確認/拒絕

### 3.7 知識庫
- 編輯內容 (你/管理者後台維護)
- 分類：餵食、訓練、健康、品種特性...
- Markdown 文章 + 圖片
- 收藏 / 分享
- **AI 寵物顧問已從 Phase 1 移除** (成本考量，未來再加)

## 4. 登入
- Google OAuth
- Apple Sign-In
- Facebook Login
- (不做 Email/Password)

## 5. 不在 Phase 1 範圍
- 影片上傳
- AI 寵物顧問 (聊天)
- 私訊
- 訂閱付費
- 廣告
- 知識庫依品種客製化
- iOS 原生 App (改用 PWA)

## 6. 上架條件
- 自訂網域 (建議 mango-pet.app 或類似)
- 隱私權政策 + 服務條款
- GDPR / 個資法基本合規
- Firebase Security Rules
- Google Maps API key 限制 (按 referer)

## 7. 風險與待釐清
- ⚠️ Web 無背景 GPS → 排行榜公平性靠手動補登
- ⚠️ 完全免費 + 用戶成長 → Firebase 超額後資金來源
- ⚠️ 餐廳資料品質 → 使用者新增需審核機制
- ⚠️ Apple Sign-In 在 Web 需設定 Service ID + Return URL
- ⚠️ Facebook 開發者帳號審核 (App Review 才能拿基本資料)
