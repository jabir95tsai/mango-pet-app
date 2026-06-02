# iOS Feature Parity Checklist — Web/PWA → React Native

狀態：**LIVE TRACKING**（Cross-platform PM 維護）
建立日期：2026-05-29
規格作者：Cross-platform PM session
配合：[`ios-app-strategy.md`](./ios-app-strategy.md)（戰略 + 8 phase plan）、[`ios-p0-monorepo-migration.md`](./ios-p0-monorepo-migration.md)（P0 細化）、[`../roadmap.md`](../roadmap.md)

> 這是 Web/PWA 與 iOS 的 **single source of truth for feature parity**。
> 每個 web 已 shipped 的 feature → 對應 iOS phase → iOS port 狀態 → platform policy。
> iOS Feature Builder / iOS PM 每完成一個 phase 回來更新 iOS 狀態欄。

## 怎麼用

- **Cross-platform PM**：維護這份表;新 web feature ship 後在此登記 + 指派 policy + phase。
- **iOS PM**：排 phase 時對照此表確認沒漏;phase 收尾更新狀態。
- **iOS Feature Builder**：做 parity feature 前先看本表確認該 feature 的 policy 與對應 web spec。
- **狀態值**：⬜ 未開始 / 🟡 進行中 / ✅ iOS 已達標(對齊 web behavior) / ⏸️ 本輪不做(見 policy) / ➖ 不適用 iOS。

## Platform policy 定義

| Policy | 意思 |
|---|---|
| **parity** | iOS 必須對齊 web behavior;在指定 P-phase 內做完。 |
| **parity + native upgrade** | 功能對齊 web,但 iOS 用 native 能力做得更好(可接受的「往上」差異,非 drift)。 |
| **deferred-v1** | web 有、但**第一版 iOS 不做**;ship 後另開 catch-up sprint。需 user 確認(見下方 Open Questions)。 |
| **web-only** | 平台本質差異,iOS 不做或由 OS 原生取代。 |

## Baseline snapshot

- 戰略 spec 鎖定的對齊基準 = web commit `f5c1732`（**2026-05-26**）。
- **晚於 snapshot 的 web ship**(屬「PWA 並行 ship、iOS catch-up」範疇,phase plan 未納)：
  - 照片圖庫 `/app/photos`（`e76f97c`,2026-05-27）— 見下方表 + Open Q3。
- 之後 PWA 每新 ship 一個 feature,Cross-platform PM 在本表新增一列並標 policy。

---

## A. Phase plan 已涵蓋的 parity 項目

> 這些 feature 在 [`ios-app-strategy.md`](./ios-app-strategy.md) 的 P0–P7 已有對應。policy 預設 **parity**,標註處為 native upgrade。
> 📐 **P2–P7 完整施工藍圖（data contract + native-dep gate inventory + 排序 + 風險）** → [`ios-port-master-plan.md`](./ios-port-master-plan.md)（workflow 並行盤點產出 2026-06-01）。下方 §A P2–P7 列為 parity 追蹤;每 phase 開工前依 master plan 的「待補列」補齊 + 初始化 ⬜。

### P0 — Foundation
| Web feature | Web spec / 來源 | iOS policy | iOS 狀態 |
|---|---|---|---|
| Auth(Google 登入) | `src/app/page.tsx` / sign-in | parity + **Apple Sign-In 必加**（Apple guideline 強制,native upgrade） | ✅ 實機驗（2026-05-31 Google + Apple 登入皆通） |
| BottomNav 5-tab + 中央 raised disc | Epic 4 Phase 0.5 `e1a7b60` | parity | ✅ 實機驗（2026-05-31 空白 5-tab nav 顯示） |
| Mango palette design tokens | Epic 4 Phase 0 `7baff73` / globals.css | parity（抽 `packages/shared-tokens`） | ✅ `apps/ios/src/theme/theme.ts` import `mangoColors` from `@mango/shared-tokens`（P0 stub；P1+ 漸進填充） |

### P1 — Walks（核心）
> 📋 spec → [`ios-p1-walks.md`](./ios-p1-walks.md)（sub-phase P1a–d + data contract + 背景 GPS + 三角色 handoff）。
> ✅ **P1a 核心 loop 實機簽收（2026-06-01 iPhone）** → [`ios-p1a-walks-screens.md`](./ios-p1a-walks-screens.md)（backend `7fe2438` + screens `a02289c`）：B/C/D 全過（WalksHome 顯示 / 前景 GPS timer+距離 / walk doc 落地 + leaderboard 反應）。
> 🔀 **下一棒重排序（user 2026-06-01）**：P1d 背景 GPS **插隊先做**（user 實機體感「背景不計時」= 核心缺口；遛狗手機常鎖屏/口袋）→ 之後 P1b（done/手動/recent 展開）→ P1c（拍照/自動分享）。

| Web feature | Web spec | iOS policy | iOS 狀態 |
|---|---|---|---|
| Walks 全頁(radial dial + week strip + 圈內走路狗) | [`walks-v2-rebuild.md`](./walks-v2-rebuild.md) `984be5b` | parity | ✅ P1a 實機簽收（分段環 dial 功能 OK；平滑 arc/動畫 polish → UI/UX follow-up） |
| GPS tracking + timer + stop | walk-core | **parity + 背景 GPS（committed,Q4 已拍板「要做且重要」2026-05-30）** — CoreLocation 背景追蹤,web PWA 做不到的 iOS-only 殺手能力。見 §F handoff(App Store 背景定位審查 + 耗電) | ✅ **前景**（P1a）+ ✅ **背景續跑 P1d 實機簽收（2026-06-01，EAS `4e875f0b`）** — 鎖屏/口袋走一段時間+距離續算;session-only + Always fallback。iOS-only 殺手能力達成 |
| Done screen + confetti + 達標變體 | walks-v2 | parity | 🟡 P1b code done（`8a14ce3`，hand-rolled confetti 無新 dep；emerald 慶祝 + recap）；待實機驗收 |
| 手動 walk dialog | walk-core | parity | 🟡 P1b code done（`8a14ce3`，isManual:true）；datetime picker **defer**（PM 2026-06-01，維持「往回推時長」）；待實機驗收 |
| Per-pet 自訂散步目標 + pet picker | [`per-pet-walk-goal.md`](./per-pet-walk-goal.md) | parity | ✅ P1a 實機簽收（picker + goal chip + 切 pet 換 goal；active-pet 持久化 → AsyncStorage follow-up） |
| Walk 拍照 + Storage 上傳 | walks-v2 | parity | 🟡 P1c code done（backend `18803fb` 壓縮/上傳 + FB `de2265c` 拍照 ≤5）；expo-camera/image-manipulator 新 dep 走 gate;待實機驗收 |
| 遛狗自動拍照 + 自動發動態(start/end prompt) | [`walks-auto-photo-share.md`](./walks-auto-photo-share.md) | parity | 🟡 P1c code done（`de2265c`，START/END post 同 walkId cross-link + createPost）;待實機驗收 |
| Walks history(recent) | walk-core | parity | ✅ P1a recent 列表；🟡 「全部」當頁展開 P1b code done（`8a14ce3`）待實機驗收 |

### P2 — Pets
> 📋 **完整 spec（前置決策 + sub-phase P2-pre/a/b/c/d + 全 session prompt）** → [`ios-p2-pets.md`](./ios-p2-pets.md)（iOS PM 2026-06-01）。sub-phase = 骨架(P2a,無 dep) → svg charts(P2b) → forms/picker(P2c) → camera(P2d)，每碰 dep 走 branch+linux gate。

| Web feature | Web spec | iOS policy | iOS 狀態 |
|---|---|---|---|
| Pets 全頁(list + switcher + header 真照片) | [`pets-v2-rebuild.md`](./pets-v2-rebuild.md) | parity | ⬜ P2a |
| 4-tab(概覽/提醒/開銷/健康) | pets-v2 | parity（自刻 pill tab，不用 tab-view dep） | ⬜ P2a |
| Overview tab(2×2 StatGrid + upcoming/recent cards) | pets-v2 | parity | ⬜ P2a |
| 開銷 donut + filter + list | [`expenses-into-pets-page.md`](./expenses-into-pets-page.md) | parity（手刻 react-native-svg donut） | ⬜ P2b |
| 健康(體重 trend chart + records) | pets-v2 | parity（手刻 svg area+line chart） | ⬜ P2b |
| 提醒(list + form) | pets-v2 | parity（datetimepicker + repeat + notifyBefore） | ⬜ P2c |
| Pet edit form(含 avatar picker + walkGoal stepper) | per-pet-walk-goal | parity（expo-image-picker/manipulator） | ⬜ P2c |
| EmptyState 0 pets | pets-v2 | parity（expo-linear-gradient） | ⬜ P2c |
| 開銷 camera FAB + AI 收據掃描(extractReceipt callable) | bug-receipt-ai-missing / receipt-scanner | **native-upgrade**（expo-camera first-flow；接同 callable，後端不改） | ⬜ P2d |

### P3 — Home + Feed
> 📋 spec → [`ios-p3-home-feed.md`](./ios-p3-home-feed.md)（最小 spec，依 master plan + web 實作）。sub-phase P3a（無 dep，main）→ P3b（reanimated gate）→ P3c（media-library+sharing gate）。
> 🟡 **P3 全 code 收齊（2026-06-02），待 user 發 EAS build 實機驗收**：P3a `a933fe1`+`4ecd677`（feed 資料層/PostCard/Reactions/Comments + Home v3 + Feed route + composer 相簿）、P3b `4eefb39`（reanimated PhotoLightbox + long-press tray；web gate 綠）、P3c `f5c5944`（expo-media-library/sharing：Photos gallery + SaveToAlbum PhotosKit；web gate 綠）。

| Web feature | Web spec | iOS policy | iOS 狀態 |
|---|---|---|---|
| Home v3(Feed-first + IG Stories bar) | [`home-v3-feed-first.md`](./home-v3-feed-first.md) | parity | 🟡 code done（`4ecd677`，4 variants）；待實機驗收 |
| StoriesBar(walk status rings) | home-v3 | parity | 🟡 code done（`4ecd677`，shared `computeTodayWalkStatus`；ring 用 linear-gradient，conic 為 follow-up polish）；待實機驗收 |
| PostCard list + PostComposer | home-v3 / feed | parity | 🟡 code done（`a933fe1` cards/reactions/comments + `4ecd677` composer 相機+相簿）；待實機驗收 |
| InviteFamilyCard / EmptyStateHome | home-v3 | parity | 🟡 code done（`4ecd677`；invite CTA → settings，full family flow = P4）；待實機驗收 |
| `/app/feed` full timeline | feed | parity | 🟡 code done（`4ecd677`，pull-to-refresh + composer）；待實機驗收 |
| PhotoLightbox(carousel + swipe) | [`photo-lightbox.md`](./photo-lightbox.md) | parity | 🟡 code done（`4eefb39`，reanimated swipe>50/drag-dismiss>100 + reduce-motion）；待實機驗收 |
| 拍照後存到相簿 | [`save-photo-to-album.md`](./save-photo-to-album.md) | **parity + native upgrade**（web Share sheet → iOS PhotosKit） | 🟡 code done（`f5c5944`，PhotosKit saveToLibrary + 分享 + Photos gallery 批次存）；待實機驗收 |
| 照片圖庫 `/app/photos`（drift，§B） | [`photo-gallery-downloads.md`](./photo-gallery-downloads.md) | **parity + native upgrade** | 🟡 code done（`f5c5944`，aggregator posts+walks+pets+expenses + filter pills + 批次存 + downloadState）；待實機驗收 |

### P4 — Leaderboard + Family
> 🟡 **P4 全 code 收齊（2026-06-03），待實機驗收**：P4a `590abe0`（human+dog 即時榜 onSnapshot + glow + tabs + FamilyProvider read）、P4b `ec34909`（family 管理 + QR + /join；functions gate，web gate 綠）。

| Web feature | Web spec | iOS policy | iOS 狀態 |
|---|---|---|---|
| Leaderboard(family-aware + 即時 glow) | [`family-leaderboard-realtime.md`](./family-leaderboard-realtime.md) | parity | 🟡 code done（`590abe0`，subscribe{,Dog}Leaderboard onSnapshot + shared periodKey + use-glow <5s freshness + scope/period/dimension AsyncStorage 持久化）；待實機驗收 |
| Dog Leaderboard v2(pet-aware) | [`leaderboard-v2-dog-centric.md`](./leaderboard-v2-dog-centric.md) | parity | 🟡 code done（`590abe0`，friends/all client filter by friendUids + ownerVisibility；personal dogs 含入）；待實機驗收 |
| Family section(member + invite + leave) | family epic | parity | 🟡 code done（`ec34909`，FamilyProvider + 多家庭 switcher + member list + create/join/leave/remove/regen callables asia-east1）；待實機驗收 |
| Family invite QR + share link(`/join/{code}`) | family epic / backlog 進階版 | parity | 🟡 code done（`ec34909`，react-native-qrcode-svg + copy/RN-Share + /join/[code] 6位驗證→callable→bounce）；待實機驗收 |
| Leaderboard Visibility Toggle | settings | parity | ⬜ P5（settings；dog board 已讀 denorm ownerVisibility） |
| 加入家庭自動加好友 | [`auto-friend-family-members.md`](./auto-friend-family-members.md) | parity（trigger 已 ship,iOS 只呈現） | ✅ 後端 trigger（iOS 只在 listFriendUids re-fetch 呈現，無 client code） |

### P5 — Push + Settings
> 🟡 **P5 全 code 收齊（2026-06-03），待實機驗收**：P5a `394b750`（settings shell + APNs registration + toggles + delete + guest upgrade）、P5b `6603f39`（data export；expo-file-system gate，web gate 綠）。
> ⚠️ **APNs 推播實際送達的前置（DevOps，非 code）**：Firebase Console → Cloud Messaging 需註冊 iOS app 的 **APNs 金鑰/憑證**；build 已帶 `aps-environment` entitlement + `remote-notification` background mode。憑證設好前 token 可 mint 但收不到推播 → 實機驗證須在憑證就緒後。

| Web feature | Web spec | iOS policy | iOS 狀態 |
|---|---|---|---|
| FCM→APNs push registration | [`engagement-push-notifications.md`](./engagement-push-notifications.md) | **parity + native upgrade**（web FCM 在 iOS PWA 殘缺 → APNs native） | 🟡 code done（`394b750`，messaging requestPermission/getToken → fcmTokens arrayUnion + reconcile + globalDisabled）；待 APNs 憑證 + 實機驗收 |
| Push toggle + engagement opt-out（A1/A2/B1/B2 + comment/reaction/achievement） | engagement-push | parity | 🟡 code done（`394b750`，global toggle + 7 型 per-type opt-out arrayUnion/Remove + family-milestone personal greyed）；待實機驗收 |
| WalkAutoPhotoSection toggle | walks-auto-photo-share | parity | 🟡 code done（`394b750`，walkPrefs.autoPhotoShare merge）；待實機驗收 |
| Leaderboard Visibility Toggle | settings | parity | 🟡 code done（`394b750`，public/friends/off radio + setLeaderboardVisibility）；待實機驗收 |
| Guest Login + Upgrade | settings/auth | **parity + native upgrade** | 🟡 code done（`394b750`，signInAsGuest + linkWithCredential Google/Apple，conflict→switch）；待實機驗收 |
| DeleteAccount flow | settings | parity | 🟡 code done（`394b750`，previewImpact + typed-displayName confirm + callable + signOut）；待實機驗收 |
| DataExport | settings | parity | 🟡 code done（`6603f39`，exportUserData → JSON file + native share）；待實機驗收 |
| UI Polish bundle(friends icon / post default public / leaderboard refresh) | [`ui-polish-bundle-2026-05-25.md`](./ui-polish-bundle-2026-05-25.md) | parity（P7 統一 catch up 亦可） | 🟡 部分（post default public ✅ P3a composer；leaderboard refresh ✅ P4a；friends icon → P6） |

### P6 — Social
> 🟡 **P6 全 code 收齊（2026-06-03），待實機驗收**：`4e9e49c`（friends list/requests/search + send + accept/reject/remove + My QR + /friends/add deep-link）。無新 native dep（QR/functions/clipboard 已在 P4b 裝）。

| Web feature | Web spec | iOS policy | iOS 狀態 |
|---|---|---|---|
| Friends list + search(`/app/friends`) | friends-search-lowercase | parity | 🟡 code done（`4e9e49c`，subscribeFriends onSnapshot + searchUsers email/displayNameLower prefix；listener unmount 清理）；待實機驗收 |
| Incoming requests + send | family/friends epic | parity | 🟡 code done（`4e9e49c`，subscribeFriendRequests + accept/reject callable/delete + sendFriendRequest setDoc；guest gate by rules）；待實機驗收 |
| QR Deep-Link 落地 `/friends/add?uid=` | family/friends epic | parity | 🟡 code done（`4e9e49c`，getUserProfile → profile + send + self/not-found state）；待實機驗收 |
| My QR dialog | friends epic | **parity + native upgrade**（qrcode-svg + clipboard/share） | 🟡 code done（`4e9e49c`，InviteQR friend URL + copy/share）；待實機驗收 |

### P7 — Polish + Submit
| Web feature | Web spec | iOS policy | iOS 狀態 |
|---|---|---|---|
| App icon / splash / screenshots / metadata | strategy P7 | ➖（iOS-only 上架物) | ⬜ |
| 隱私 / 服務條款 | `/privacy` `/terms` | parity（App Store 必須有,內容可重用 web） | ⬜ |

---

## B. ⚠️ Web feature **未被任何 iOS phase 涵蓋**（parity gap）

> 這些是實際存在的 web 路由 / feature,但 [`ios-app-strategy.md`](./ios-app-strategy.md) P0–P7 原本**完全沒提**。
> **2026-05-30 user 已拍板**(見 §D),policy 已從「建議」轉為「定案」。

| Web feature | Web 路由 | policy（已定案） | 理由 |
|---|---|---|---|
| **餐廳** | `/app/restaurants` + `/app/restaurants/[id]` | ⏸️ **deferred-v1**（✅ 2026-05-30 確認不做首版） | 戰略 spec 零提及;roadmap 把「餐廳 Google Places 整合」列為未來「新方向候選」,本身仍未深化。第一版 iOS 不做、ship 後 catch-up。 |
| **知識庫** | `/app/knowledge` + `/app/knowledge/[id]` | ⏸️ **deferred-v1**（✅ 2026-05-30 確認不做首版） | 同上;roadmap「知識庫持續產出」仍是候選方向,內容導向、非核心遛狗 loop。 |
| **照片圖庫** | `/app/photos` | parity,**排進 P3**（✅ 2026-05-30 確認） | 晚於 baseline ship(`e76f97c` 2026-05-27);與 feed/lightbox 同源,併入 P3 Home+Feed。iOS 用 PhotosKit 取代 web download(native upgrade)。 |
| **Onboarding 畫面** | `/onboarding` | parity-lite,**併 P0 auth flow** | 第一次登入導引;iOS 至少要有等價首登流程,內容可精簡。 |

---

## C. 平台合理差異(不是 drift,不要當 bug 修)

> 這些地方 iOS **本來就該跟 web 不一樣**,Cross-platform PM 預先認定為 acceptable。

| 面向 | Web/PWA | iOS | 認定 |
|---|---|---|---|
| Push 通道 | FCM web push(iOS PWA 支援殘缺) | APNs native | iOS 更好,acceptable |
| 存照片到相簿 | `navigator.share` / Blob download | PhotosKit 直接存 | iOS 更好,acceptable |
| 登入方式 | Google | Google **+ Apple Sign-In** | Apple guideline 強制,acceptable |
| 遛狗背景定位 | 不做(roadmap 明列「不做 Web 內背景 GPS」) | CoreLocation 背景追蹤 | ✅ **已拍板要做且重要(2026-05-30)** — iOS-only 殺手能力,列 **P1 committed scope**;非 drift,是刻意的 native 擴張。實作 + 審查注意見 §F |
| HEIC / Live Photos | 不適用 | 接受 native limitation,不特別支援 | risk table 已認 |
| 路由 | Next.js App Router(URL) | Expo Router(native stack/tab) | 實作差異,UX 對齊即可 |

---

## D. 決策紀錄（user 2026-05-30 拍板,原 Open Questions）

| # | 問題 | 決定 | 含意 |
|---|---|---|---|
| **Q1** | 餐廳進第一版 iOS? | **No** | deferred-v1;ship 後 post-launch catch-up sprint。 |
| **Q2** | 知識庫進第一版 iOS? | **No** | deferred-v1;同餐廳。 |
| **Q3** | 照片圖庫排哪? | **Yes,排 P3** | 補進 strategy P3 清單(交 iOS PM 改 spec)。 |
| **Q4** | iOS 遛狗背景 GPS? | **要做,且「很重要」** | 從 follow-up 升級為 **P1 committed scope**。iOS-only 殺手能力。實作 + 審查注意見 §F。 |
| **Q5** | D4 措辭收斂? | **OK** | D4 → 「**核心 feature parity 一次到位**(walks/pets/home/feed/leaderboard/family/social/push)+ 背景 GPS native 擴張;餐廳 + 知識庫列 post-launch catch-up」。 |

---

## E. Handoff

- **iOS PM**：Q3 → 照片圖庫補進 strategy P3;Q1/Q2 → strategy 標 deferred-v1 清單;Q4 → P1 加背景 GPS 工作項 + 工期重估(見 §F);Q5 → 更新 D4 措辭。**(本 session 已代為更新 strategy doc,iOS PM 接手後 review。)** ✅ **2026-05-30 iOS PM 已接手完成**:P1 工期重估 2.5–3 週(含背景 GPS 0.5–1 週 buffer)、累計 13.5–14 週;deferred-v1 正式列 strategy §Post-launch catch-up sprint(粗時點 + 估工);parallel-policy §5 拍板維持 critical + polish。
- **iOS Feature Builder**：做任一 feature 前回查本表該列 policy + web spec 連結;native upgrade 項(push/save-photo/auth)依 §C 實作,不算 deviation。
- **iOS Backend**：背景 GPS 的 native 設定(`UIBackgroundModes: location`、Always vs WhenInUse 權限、Info.plist usage strings)由你接,見 §F。
- **Web 側**：PWA 每新 ship feature → 通知 Cross-platform PM 在 §A/§B 新增列(避免 iOS 漏 catch-up)。

## F. 背景 GPS（Q4 committed）— 實作 + 審查注意事項

> Cross-platform PM 設 policy「P1 committed」;以下是交給 iOS Feature Builder / iOS Backend 的已知約束,不是實作細節(那是他們的事)。

- **能力定位**:遛狗中即使鎖屏 / 切到背景,仍持續記錄路徑 + 時長。web PWA 根本做不到,屬刻意的 iOS-only 擴張(D5 收斂後正式承認非嚴格 parity)。
- **權限**:需從 `When In Use` 升到 `Always`(或 expo-location 的背景權限);Info.plist 寫清楚 `NSLocationAlwaysAndWhenInUseUsageDescription` 用途字串。
- **背景模式**:`UIBackgroundModes` 含 `location`;Expo config plugin 設定。
- **⚠️ App Store 審查風險**:背景定位是 Apple 重點審查項。必須:(a) 用途字串講清楚「記錄遛狗路線」;(b) 只在遛狗 session 進行中啟用背景定位,結束即停;(c) 不可常駐背景定位。最常見拒絕原因 = 背景定位用途不充分。
- **耗電 / UX**:背景高頻定位耗電;walk 結束自動關閉 + 提供前景 fallback。

### F.1 P1d 實作狀態 — ✅ 達標（2026-06-01）

- **✅ 實機簽收**（merge `871b154` / feat `b001445`；EAS build `4e875f0b`）：user 鎖屏/口袋走一段，時間+距離續算 → 背景續跑 work。
- native：`UIBackgroundModes:location` + Always usage strings + `expo-task-manager` + `@react-native-async-storage/async-storage`（背景路徑持久化）；service：session-only 背景續跑 + wall-clock duration + Always 拒絕退前景 fallback。
- **P1 核心遛狗 loop（含背景）正式完成。** iOS-only 背景定位殺手能力 = Q4 committed 達成。

### F.2 App Store 審查 note 草稿（送審時貼 App Review notes）

> Backend 起草、iOS PM 收錄。送審 background-location 時用。

```
Mango Pet records your dog-walking route and distance. Background location
is used ONLY while a walk is actively in progress (the user taps Start Walk),
so the route keeps recording when the phone is locked or in a pocket. It stops
immediately when the walk ends (no persistent background tracking). The standard
iOS blue location indicator is shown during an active walk.
```

### F.3 Open Q3 拍板 — 背景定位提早 TestFlight internal

- **決定（2026-06-01）**：**P1d 就跑一次 TestFlight internal**（或 dev/internal build 走完整背景流程），把背景定位 + 權限 flow 驗給自己看，**提早暴露審查風險，不等 P7**。
- 理由：背景定位是 Apple 最常拒的項目;愈早跑完整 flow（含 Always 權限對話、藍色 indicator、結束即停）愈早發現問題。
- **工期影響**:P1 原估 2 週(前景追蹤);背景 GPS + 權限流程 + 審查預留,**P1 建議 +0.5～1 週 buffer**(交 iOS PM 重估)。
- **roadmap「不做」清單**:既有「不做 Web 內背景 GPS」**僅限 web**(PWA 技術做不好);iOS native 不在該禁令內,無矛盾。

## 維護紀錄

- 2026-05-29 建立(Cross-platform PM):盤點 web 全 20 路由 → 對齊 P0–P7;抓出餐廳/知識庫/照片圖庫 3 個 phase plan gap;列 5 個 open questions。
- 2026-05-30 決策落定(Cross-platform PM):user 拍板 Q1–Q5。餐廳 + 知識庫 deferred-v1;照片圖庫 → P3;**背景 GPS 升 P1 committed scope**(+§F 審查注意);D4 收斂為核心 parity + native 擴張。
- 2026-05-30 phase plan 算清(iOS PM):接手 §E handoff,完成 §F P1 工期重估 → P1 2.5–3 週、累計 **13.5–14 週**;deferred-v1(餐廳/知識庫)正式列 strategy §Post-launch catch-up sprint(餐廳受 web Google Places 成本暫停連動、知識庫可獨立先排);parallel-policy §5 拍板維持「critical + polish」。phase plan 內部一致性 verified。
