# Sprint 計畫

> 全部塞 Phase 1，原預估 5-8 個月。實際完成於同一個 vibe-coding session（continuous mode）。

## ✅ Sprint 0 — Setup
- [x] Next.js 16 + TS + Tailwind 4 專案骨架
- [x] Firebase SDK 連線骨架
- [x] next-intl i18n (zh-TW + en)
- [x] Serwist PWA + manifest
- [x] 登入頁 + app shell + 9 個路由樣板
- [x] PRD + Firestore schema + 記憶系統

## ✅ Sprint 1 — Auth + Pets + Feed
- [x] Firebase 專案建立 + Auth keys
- [x] Google / Apple / Facebook OAuth (Google 啟用)
- [x] `users/{uid}` 自動建立 (upsert with throttle)
- [x] 寵物 CRUD + 頭像上傳
- [x] 動態牆發文 (文字 + 多張照片 + 公開度)
- [x] Emoji 反應 ❤️😂🐶👍🎉
- [x] Firestore Security Rules v1
- [x] RequireAuth 路由保護

## ✅ Sprint 2 — Health + Reminders
- [x] 健康紀錄表單 (體重/餵食/疫苗/就醫/用藥)
- [x] 時間軸 + 圖表 (體重 recharts)
- [x] 寵物詳情頁 + Tabs
- [x] 類型過濾 pill
- [x] 提醒設定 UI + 站內列表

## ✅ Polish loop 1 — UX bug fixes
- [x] upsertUser throttle
- [x] Avatar component (initials fallback)
- [x] a11y 修正
- [x] 日期欄位 local timezone
- [x] 健康紀錄類型過濾

## ✅ Sprint 2.5 — FCM Push
- [x] messaging.ts (request permission, get token, save/remove)
- [x] firebase-messaging-sw.js (auto-generated from .env.local)
- [x] PushToggle UI
- [x] Cloud Function: scanReminders (every 15 min)
- [x] 提醒 schema 加 notified flag

## ✅ Sprint 3 — Restaurants + Maps
- [x] Google Maps loader + map component
- [x] 餐廳 CRUD (manual)
- [x] 餐廳地圖頁 + 清單頁切換
- [x] 寵物友善程度 filter
- [x] 收藏功能
- [x] 評論 + 評分
- [x] 距離 sort (haversine)

## ✅ Sprint 4 — Walks + Leaderboard
- [x] GPS 即時追蹤 (`watchPosition`)
- [x] 手動補登
- [x] 加權公式 (體型係數 + 時長 + 連續天數)
- [x] /app/walks 含 streak 統計
- [x] /app/leaderboard 含週/月/總榜 tab
- [x] Cloud Function: aggregateLeaderboards (每日 00:30 Asia/Taipei)

## ✅ Sprint 5 — Knowledge + Friends
- [x] Markdown 文章渲染 (react-markdown + remark-gfm)
- [x] 文章分類 + 收藏
- [x] 5 篇示範文章 (seed script)
- [x] 好友搜尋 (by email / displayName)
- [x] 好友請求發送 / 接受 / 拒絕
- [x] Cloud Functions: acceptFriendRequest, removeFriend
- [x] 動態牆支援好友可見

## ✅ Sprint 6 — Pre-launch polish
- [x] 隱私權政策頁 (/privacy)
- [x] 服務條款頁 (/terms)
- [x] Error boundary + 404
- [x] PWA manifest 完整 (含 shortcuts)
- [x] PWA icons (SVG + PNG 待生成)
- [x] SEO meta (title template, OG, twitter)
- [x] sitemap.xml + robots.txt
- [x] 部署手冊 (docs/deploy.md)
- [x] README 完整化

## 🚧 上線前你要做
- [ ] 在 [realfavicongenerator.net](https://realfavicongenerator.net) 從 SVG 產 PNG icons
- [ ] 部署 Cloud Functions (`firebase deploy --only functions`)
- [ ] 部署 rules + indexes (`firebase deploy --only firestore:rules,firestore:indexes,storage`)
- [ ] 啟用 Google Maps + Places API
- [ ] 設定 GCP 預算警報 ($5/月)
- [ ] 部署 Vercel + 設定環境變數
- [ ] 買網域 + DNS
- [ ] App Check (防 API key 盜用)
- [ ] Lighthouse audit (PWA / Perf / SEO > 90)
