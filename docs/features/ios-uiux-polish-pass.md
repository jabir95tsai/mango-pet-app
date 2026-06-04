# iOS UI/UX Polish Pass — 全 app 視覺/原生手感

狀態：**READY-FOR-DEV**（iOS PM 2026-06-01）
建立日期：2026-06-01
規格作者：iOS PM session
角色執行：**iOS UI/UX 工程師**（純視覺/互動，不碰資料層）
上承：P0–P7 feature 全 code-done（功能對、外觀粗胚）→ 本 pass 把整個 app 視覺拉到 mango 設計 + iOS 原生手感
配合：[`ios-port-master-plan.md`](./ios-port-master-plan.md)、[`ios-parity-checklist.md`](./ios-parity-checklist.md)、各 phase ship note

> user 2026-06-01：「整個目前看起來 ok，接著做 ui/ux 部分。」P2–P7 功能已建（pets/feed/leaderboard/family/settings/friends/onboarding），現在做**視覺 polish pass**。

## 🔄 視覺方向轉向（user 2026-06-03）— 改「忠實還原 PWA 視覺」

> user：「我想要還原 PWA 的視覺到 app 裡面。」→ 選 **A：原生畫面 re-skin 成跟 PWA 一致**。
>
> **原方向（native-feel，非像素複製）作廢**。新方向：**iOS 畫面視覺忠實對齊 PWA**（佈局 / 間距 / 色票 / 元件外觀盡量跟 web 一樣），但**仍是 React Native 原生實作**（保留背景 GPS / 相機 / APNs push 等原生能力，D1 不變 —— 只改「長相」不改「技術路線」）。
> **視覺真相來源 = `apps/web/src` 對應元件 + `globals.css`**：re-skin 時直接讀 web 元件對照，1:1 還原其視覺，不要自由發揮 iOS 風格。
> ⚠️ **S1/S2 已用舊 native-feel 方向做**（dial/走路狗/卡片等）→ 需**回頭 re-align 到 web 視覺**（見 §剩餘工作）。

## 🎯 Fidelity Goal（user 2026-06-03）：iOS UI ≈ 99% 對齊 web PWA

> user：「設定一個 goal 讓 iOS 的 ui/ux 跟網頁 99% 像。」採用為本 pass 的硬目標。

**量測方法（per-screen side-by-side diff）**：每個畫面拿 **PWA 截圖 vs iOS 截圖** 並排，逐 7 維打分，差異列成 fidelity backlog 給 iOS UI/UX 收：
1. **佈局/結構**（區塊順序、層級）
2. **間距/密度**（padding/margin/行距）
3. **色票**（背景/卡/文字/accent 是否同色）
4. **字級/字重**（標題/內文比例）
5. **元件外觀**（radius / shadow / border / pill / FAB 形狀）
6. **iconography**（圖示風格、bottom nav、emoji vs icon）
7. **文案/i18n**（含上面抓到的「瀏覽器」push 文案漏字 → iOS 要原生措辭）

**流程**：user 給 PWA 截圖 → iOS PM 逐頁 diff 出 gap 清單（標 P0 明顯/ P1 細節）→ iOS UI/UX session 修 → 批次驗收（規則 5，末端一顆 EAS build 並排對照）。**目標 = 並排看「幾乎分不出哪個是 web 哪個是 app」**。

**目前 iOS 5 畫面已收到**（Home/Feed、Pets、Walks、Leaderboard、Settings，re-skin 後）→ 等 PWA 對應 5 畫面進來開 diff。

## 🎯 目標

把 iOS app 整面 re-skin 成**視覺上跟 PWA 一致**：讀 `apps/web` 對應畫面/元件，1:1 還原佈局、間距、色票、圓角、元件外觀（mango palette 已共用）。RN 原生實作不變、原生能力保留；只把「看起來不一樣」改成「看起來一樣」。safe-area / a11y / reduced-motion 仍要顧（原生必要），但**不為了「原生 idiom」而偏離 web 外觀**。

## ✅ 前提（好消息：無新 dep gate）

動畫/繪圖 dep **全部已裝**（P2/P3 引入並過 gate）：`react-native-svg` / `react-native-reanimated` / `react-native-gesture-handler` / `expo-linear-gradient`。
→ **本 pass 預設不加新 dep → 不需 web rollout gate**（純 apps/ios style/animation）。若某項真要新 dep（少見）→ 停手回報 iOS PM 走 branch+gate。
→ 驗收依 **規則 5 批次**：一路 polish merge（每步 tsc），**末端一次 EAS build 實機驗整個 app**。

## 🚫 不做（已完成 / 別重做）
- **confetti 引擎**：已升級（canvas confetti `b92e966` + `confetti-engine-upgrade` spec）→ 不重做，只確認其他 surface 引用一致。
- **achievements/解鎖慶祝**：已有 spec（`achievements-badges`）→ 不在本 pass。
- **onboarding/privacy**：P7 已做（`1972d6c`）→ 只做視覺 polish，不改 flow。
- 資料層 / Firestore / functions / callable 簽名 → 完全不碰。

---

## 🧱 UX-0 — 跨切面 primitives + token 細修（先做，後面全 surface 共用）

> 先建可重用 native primitives + 對齊 token，後面每個 surface polish 都複用，避免各畫面各刻一套。

- **mango tokens 細修**（`@mango/shared-tokens` → iOS `theme.ts`）：確認 amber/emerald/桃粉、文字階層、radius（2xl / full）、spacing、shadow/elevation 對齊 web `globals.css` @theme。
- **Reusable primitives**（`apps/ios/src/components/ui/`）：`Button`（primary/secondary/ghost + pressed state + 觸覺 `expo-haptics`?僅若已裝，否則略）、`Card`、`Screen`（safe-area + scroll + keyboard avoidance wrapper）、`Sheet`（Expo Router modal 包裝）、`Pill`/`Chip`、`EmptyState`、`Avatar`。
- **safe-area 策略**：`react-native-safe-area-context`（已裝）統一 top/bottom inset；full-screen modal（tracking / lightbox）避瀏海 + home indicator。
- **reduced-motion helper**：`AccessibilityInfo.isReduceMotionEnabled` 包成一個 hook，所有動畫（dial/走路狗/glow/confetti/sheet transition）統一吃它。
- **a11y 基線**：tap target ≥ 44pt、accessibilityLabel/Role、focus 順序、對比 WCAG AA。

---

## 🎨 Per-surface polish（UX-0 後，依「最常看到 + 最粗」排序）

> **新方向（2026-06-03）**：每個 surface **打開 `apps/web` 對應元件當視覺真相，1:1 還原**（佈局結構 / 間距 / 色票 / 圓角 / 字級）。UX-0 primitives 的視覺也要校到跟 web 一致。下列各 surface 的「iOS approach」描述若與「忠實還原 web」衝突，以**還原 web** 為準。
>
> **剩餘工作（含 S1/S2 re-align）**：S1 Walks + S2 Home/Feed 已用舊 native-feel 做 → 回頭對照 web re-align；S3–S6 直接 web-faithful 做。

### S1 — Walks（核心，user 已看過最粗）
- **dial**：分段環 → **平滑 arc**（`react-native-svg` circle stroke-dashoffset），達標 leaf 綠漸層。
- **走路狗**：靜態 → **Reanimated 走路動畫**（對齊 web 6-keyframe 精神：bob/腿擺/尾搖），reduced-motion 時靜態。
- **week strip / streak chip**：完成日 paw fill、today 高亮、streak ≥7 leaf 變體 + flame flicker（reduced-motion skip）。
- **tracking full-screen**：safe-area、timer/距離視覺層級、紅停止鈕 affordance。
- **done screen**：emerald 慶祝 wash + 達標標題 + streak badge pop（confetti 引擎已做，確認串接）。

### S2 — Home + Feed
- **Stories bar**：pet walk status conic ring（done/pending/tracking）— svg/reanimated；user dashed ring。
- **PostCard**：author 區、photo grid(1/2/2+) 間距/圓角、reaction/comment badge、visibility icon。
- **Reactions long-press tray** + **PhotoLightbox**：gesture-handler 手勢順滑（水平切換/下滑關閉）、reduced-motion。
- **Composer / sheets**：keyboard avoidance、photo grid、發佈 affordance。
- **empty/no-posts/invite cards**：linear-gradient + CTA 視覺。

### S3 — Pets
- **header**（avatar + chips）、**4-tab pill** 切換動效/active 視覺、**StatGrid**。
- **開銷 donut + legend**、**健康 weight chart**：色彩/標籤/座標視覺細修（功能已對，純美化）。
- **forms（reminder/expense/health/pet-edit）**：sheet 呈現、欄位密度、datepicker 樣式、stepper。
- **0-pet EmptyState** gradient hero。

### S4 — Leaderboard + Family
- **rank list**：名次視覺、自己高亮、**glow 更新動效**（reduced-motion skip）、human/dog/period tab 切換。
- **family section**：member list、invite QR 卡、code/share 視覺。

### S5 — Settings + Friends
- **settings**：section 分組、toggle 原生樣式、photos preview grid、delete/export 危險動作視覺。
- **friends**：list、search、request accept/reject、My QR dialog。

### S6 — 全 app 收斂 QA
- 一致性 audit（間距/圓角/色票/字級跨 surface 一致）、loading/error/empty tone、reduced-motion 全 surface、Dynamic Type 不破版、bottom nav raised disc 與各頁互動。

---

## 🤝 角色 / 護欄
- **iOS UI/UX 工程師**主導；只動 `apps/ios/**` UI + `shared-tokens` + `shared-i18n` 文案微調。
- **不碰**：Firestore/Storage/functions/callable 簽名、shared-firebase API、web UI、feature flow（功能缺口 → iOS Feature Builder）。
- 預設不加 dep；真要加 → 停手回報 iOS PM 走 gate。

## ✅ 驗收（規則 5 批次）
- 一路 polish，每步 `npx tsc --noEmit`（apps/ios）+ merge，**中途不發 device build**。
- 全 surface polish 收齊 → iOS PM 發**一顆** EAS build → user 一次走完整 app 看視覺（before/after 對照 web）。
- a11y / reduced-motion / safe-area / tap target 抽查。

## 🚀 Launch prompt（開 iOS UI/UX session）

> 範圍大 → 可一個 session 做 UX-0 + S1–S2（最常看到的），再開第二個 session 做 S3–S6;或一個 session 慢慢全做。驗收一樣 batched 末端一次。

```
平台：iOS｜角色：iOS UI/UX 工程師
先讀：AGENTS.md、docs/team/README.md（規則 5 批次驗收）、docs/team/ios-ui-ux.md、docs/features/ios-uiux-polish-pass.md（本 spec）、docs/features/visual-redesign-mango.md（web 視覺方向參考）
先跑：git fetch && git log -8 --stat origin/main

任務：iOS 全 app UI/UX polish pass（功能已 code-done，做視覺/原生手感）。
順序：先 UX-0（primitives + token + safe-area + reduced-motion hook + a11y 基線）→ 再 S1 Walks → S2 Home/Feed →（同 session 或下一棒）S3 Pets → S4 Leaderboard/Family → S5 Settings/Friends → S6 收斂 QA。
細節照 ios-uiux-polish-pass.md 各 surface 清單。

護欄：
- 只動 apps/ios/** UI + shared-tokens + shared-i18n 文案微調
- 不碰 Firestore/Storage/functions/callable/shared-firebase API/web UI/feature flow
- 動畫 dep（svg/reanimated/gesture-handler/linear-gradient）已裝 → **不要加新 dep**；真要加停手回報 iOS PM
- 動畫一律吃 reduced-motion hook；safe-area 用 safe-area-context；tap target ≥44pt
- confetti 引擎/achievements/onboarding flow 已做 → 不重做（只確認視覺串接）

驗收（規則 5 批次）：
- 每步 npx tsc --noEmit（apps/ios）pass + merge；**中途不發 device build、不要 user 中途驗**
- 全 surface 收齊 → 通知 iOS PM 發一顆 EAS build，user 一次走完整 app 看 before/after

回報：
1. 角色 + 做了哪些 surface（commit hash）
2. before/after 或 web reference 對照（截圖或描述）
3. 有沒有加 dep（應為無）/ 有沒有發現功能 bug（丟 iOS Bug Hunter，不自己修 flow）
4. 給 iOS PM：哪些 surface polish 完、parity §A 對應列可標視覺 ✅、剩哪些 surface 待下一棒
```

## 跟其他 spec 的關聯
- 視覺方向參考 web [`visual-redesign-mango.md`](./visual-redesign-mango.md)（mango palette + Epic 4 決策）。
- confetti/celebration：`confetti-engine-upgrade` / `walks-photo-and-celebration` / `achievements-badges` 已涵蓋，本 pass 不重做。
- 功能 spec：各 phase（walks/pets/feed/leaderboard/settings/friends）為 behavior reference，本 pass 不改 behavior。

---

## 📦 Session 1 SHIPPED — UX-0 + S1 + S2（iOS UI/UX 工程師，2026-06-03）

範圍照 spec line 91 建議：一個 session 做 **UX-0 + S1–S2（最常看到的）**，S3–S6 留下一棒。全程 `tsc --noEmit` 綠 + push main（**無 device build、未實機驗** — 依規則 5 末端一次 EAS）。**無新 dep**。

### Commits（都在 main）
| Surface | Commit | 內容 |
|---|---|---|
| UX-0 | `175345f` | `theme.ts` 加 shadow tiers（card/elevated/mango，暖棕底）+ typography scale（`type.*`），既有 colors/spacing/radius 不動。`useReducedMotion` hook（單一來源 + live 訂閱，收斂 4 處 ad-hoc `AccessibilityInfo`）。`components/ui/` primitives：`Button`（primary/secondary/ghost/danger、≥44pt、ink-on-brand AA、pressed scale）/`Card`/`Screen`（safe-area+scroll+kbd）/`Sheet`/`Pill`/`EmptyState`/`Avatar` + index barrel。`PetAvatar`/`UserAvatar` 改成 `Avatar` 薄殼。 |
| S1 Walks | `6a373c4` | `walks-dial`：60-tick segmented ring → 單一 animated SVG arc（strokeDashoffset），brand→amber 漸層、達標轉 leaf→success 綠；中央 🐕 改 Reanimated 走路 bob+tilt（reduced-motion 靜態）。`walks-week-strip`：完成日 paw fill。`walks-streak-chip`（新）：≥7 天 leaf milestone + flame flicker（reduced-motion 靜態，flame a11y-hidden）。walks 畫面：0-pet → `EmptyState`、sticky CTA → `Button`（ink-on-brand 修掉先前白字 on 橘的 AA miss）。done-screen emerald 慶祝 + confetti 串接**已驗證不變**。 |
| S2 Home/Feed | `a194097` | `pet-story-avatar`：flat 漸層 disc → 乾淨 SVG stroked status ring（done/tracking/pending），對齊 dial/donut SVG 慣例 + web conic。`post-card`：card radius 2xl + 暖 resting shadow、leaf tag 文字 → `#3f7a39`（修 leaf-on-leafTint AA）、留言 badge 36→44pt。`invite-family-card` CTA 36→44pt + ink-on-brand。`post-composer`：包 `KeyboardAvoidingView`。 |

### a11y 修掉的 contrast/tap 問題（順手）
- 白字 on 橘底（fail AA 2.6:1）→ ink-on-brand：walks sticky CTA、invite-family CTA。
- leaf on leafTint（2.6:1）→ `#3f7a39`：post-card 寵物 tag。（同 web Phase 1 deviation 1 的精神，建議之後加 `mango.leafDeep` token 收斂。）
- tap target < 44pt → ≥44pt：post-card 留言 badge、invite-family CTA。

### 給 iOS PM
- **parity §A 可標「視覺 ✅」對應列**：Walks（S1 全項）、Home/Feed（stories ring / PostCard / composer kbd）。Lightbox/reactions/confetti 視覺串接確認過、未改 flow。
- **剩餘 surface（下一棒 iOS UI/UX session）**：**S3 Pets**（header/4-tab/donut/weight chart/forms/empty）、**S4 Leaderboard/Family**（rank glow/QR）、**S5 Settings/Friends**、**S6 全 app 收斂 QA**。下一棒直接複用 UX-0 primitives（`@/components/ui`）+ `useReducedMotion`。
- **無發現功能 bug**（純視覺層，未碰 flow/資料層）。若末端 EAS 走查發現 runtime bug → iOS Bug Hunter。
- **驗收**：S3–S6 收齊後，PM 發**一顆** EAS build，user 一次走 before/after。

---

## 📦 Session 2 SHIPPED — S3 + S4 + S5 + S6（iOS UI/UX 工程師，2026-06-03）

一個 session 一路做完 **S3→S4→S5→S6**，全程複用 Session 1 的 `@/components/ui` primitives + `useReducedMotion`（**沒有重刻**）。每步 `tsc --noEmit` 綠 + push main（**無 device build、未實機驗** — 規則 5 末端一次 EAS）。**無新 dep**。

### Commits（都在 main）
| Surface | Commit | 內容 |
|---|---|---|
| S3 Pets | `faeb50c` | `pet-tabs`：per-tab 背景切換 → 單一滑動白卡 indicator（Reanimated translateX 220ms，reduced-motion 直接定位），tab ≥44pt。`weight-chart`：漸層面積填色 + 上/底 faint gridline + min/max kg y-hint + 首/末日期 x 軸標籤（圖表算法不動）。`pets-empty-state`：bespoke 漸層 → `EmptyState` primitive（gradientHero）。 |
| S4 Leaderboard+Family | `2ce2e9f` | `segmented`：per-seg 切換 → 單一滑動 indicator（Reanimated，reduced-motion snap），leaderboard dimension/scope/period 共用，active ≥44pt。`leaderboard-row`：glow 改 opacity-fade overlay（不再 animate bg），「我」row 可同時帶 cardSoft 底 + brand 邊（glow 仍吃 `useReducedMotion`）。human/dog 空狀態 CTA → `Button`。`family`：primary 按鈕 ink-on-brand、code 複製/分享/QR 38→44pt、My-QR dialog 改置中。 |
| S5 Settings+Friends | `e69925b` | `settings`：flat card stack → iOS 分組 section（一般/通知/遛狗與隱私/資料與帳號 uppercase header），登出 36→44pt；native Switch+radio 既有原生樣式保留。`friends`：accept/加好友/QR-close ink-on-brand、tab 38→44pt、accept/reject/QR-action →44pt；My-QR dialog 已置中。`friends/add` 送出鈕 ink-on-brand。export/delete 危險動作（outline danger + white-on-cookie 4.2:1 + ink export）查核 OK 不動。 |
| S6 收斂 QA | `2aa5988` | 跨 surface audit → 收掉**最後 9 個** white-on-brand 文字鈕（2.6:1 fail AA）統一 ink-on-brand：comment send / post publish / manual-walk save / walk-tracking save / camera 用此張 / receipt 手動輸入 / form-sheet SelectField active pill / join-family CTA / onboarding primary。 |

### S6 一致性 audit 結論
- **reduced-motion**：全 app 8 個有動畫的 component 全部吃 `useReducedMotion`（dial/走路狗/streak flame/story ring/pet-tabs/segmented/leaderboard glow/confetti/lightbox），**0 個殘留 ad-hoc `AccessibilityInfo`**。
- **對比 AA**：所有 brand 底主要按鈕文字 = ink-on-brand（5.2:1）。white-on-dark（相機/lightbox 黑底）、white-on-cookie/red（destructive，≥4.2:1 或慣例）保留。
- **tap target**：本 session 所有互動元件補到 ≥44pt（tabs/segmented/code 動作/friends 動作/登出）。
- **token 一致**：圓角/色票/字級走 `theme` token；新卡片向 PostCard 的 radius 2xl + `shadows.card` 對齊。
- **已知保留**（非 bug，記錄供 PM 判斷）：FAB「＋」與 your-story「＋」glyph 仍 white-on-brand（大型裝飾性 icon，沿用 Material/IG FAB 慣例；如要 100% ink 化再開一張小票）。

### 給 iOS PM — ✅ 全 surface 視覺 polish 完成
- **iOS 全 app（UX-0 + S1–S6）視覺 polish 已收齊**，請發**末端一顆 EAS build**，user 一次走完整 app before/after。
- **parity §A 可標「視覺 ✅」**：Pets / Leaderboard / Family / Settings / Friends（＋ Session 1 的 Walks / Home-Feed）。
- **無新 dep**（svg/reanimated/gesture-handler/linear-gradient 已裝）。
- **無發現功能 bug**（純視覺/互動層，未碰 flow/資料層/callable）。末端 EAS 走查若遇 runtime bug → iOS Bug Hunter。

---

## 📦 Session 3 — 視覺方向轉向後 re-align（iOS UI/UX 工程師，2026-06-03）

方向改成「**忠實還原 PWA**」後，回頭把 native-feel 做法 re-align 到 `apps/web` 視覺。每步 `tsc --noEmit` 綠 + push main（**無 device build**）。**無新 dep**。

### Commits（都在 main）
| 範圍 | Commit | 內容 |
|---|---|---|
| UX-0 foundation | `d36f922` | **radius scale 改回 web `:root --radius-*`**（lg 16→14、xl 24→18、+xl2 22、pill 9999）。**Button primitive primary 改成 web `.btn-mango`**：amber→brand→brandDeep LinearGradient + **白字** + lifted mango shadow（先前 flat-brand+ink 作廢）。`shadows.mango` 對齊 web brand rgba。**把 Session 1-2/S6 的 ink-on-brand 全部還原成白字**（web 每顆橘鈕都是 btn-mango 白字；先前的 a11y「修正」其實偏離 PWA）。EmptyState CTA 改 pill+gradient。 |
| S1 Walks | `1f94734` | 對照 web walks/* **1:1 重建**：`walks-dial`（solid brand/leaf ring、R96/stroke14、暖 bgRing、白 tick、中央漸層 disc、達標 leaf check badge、底部白 pill；arc sweep 600ms 保留）；**`walks-pet-walking`（新）= web 卡通狗 SVG 的 RN port**（body/head/legs/tail/ground + Reanimated 擺腿/搖尾/bob/ground，reduced-motion 靜態）；`walks-week-strip`（card + 34px 圈 + 白 paw SVG + today-done leaf halo）；`walks-streak-chip`（web 3-tier 漸層 + 火焰 SVG flicker）；`walk-row`（web walk-card 版型 + ⭐score）。 |
| S2 Feed | `65f73bc` | `post-card` 對齊 web：card rounded-lg(8px)、author text-sm/semibold、photo grid 全 aspect-square gap-2。（web feed 是 zinc/white + Tailwind 圓角，非 mango var。）|
| S3 Pets | `fac5457` | 寵物頁 ＋ FAB flat brand → **btn-mango 漸層**（globals.css 註明 .btn-mango = pets FAB）。 |

### web reference → iOS after 已對齊
- **Walks（最完整 1:1）**：dial 環色/幾何/tick/中央 disc/check badge/底 pill、走路狗 SVG、week strip、streak chip、walk-row 全部照 web 重建。
- **全 app 橘色按鈕**：透過 Button primitive + 還原白字，**統一成 web btn-mango 漸層白字**（開始遛狗 CTA、pets FAB、empty CTA、各表單 save/送出/accept…）。
- **圓角尺度**：改回 web `--radius-*`（卡片不再過圓）。
- **Feed post-card**：rounded-lg + aspect-square 照片格對齊 web。

### 護欄 / 狀態
- **無新 dep**；**未碰 flow/資料層/callable**；只動 apps/ios UI + theme。
- safe-area / reduced-motion / tap≥44pt 原生必要仍保留（不影響 web 外觀一致）。
- **誠實註記（給 iOS PM）**：Foundation（Button 漸層 + radius + 還原白字）會 ripple 到**所有** surface；**S1 Walks 為最深度 1:1 重建**；S2 feed + S3 FAB 已對齊。**S3 其餘（donut/weight chart/forms 細節）、S4 Leaderboard/Family、S5 Settings/Friends 目前主要靠 foundation 對齊（漸層鈕/圓角/色票已一致），各畫面逐元件 pixel-parity 細修可視末端 EAS web-vs-app 走查結果再補一輪**。web 本身混用 mango + zinc 兩套（feed/settings 偏 zinc）、兩套圓角（Tailwind vs --radius-var），逐元件對照時需個別確認來源。

### 給 iOS PM
- 請發**末端一顆 EAS build**，user 直接 **web 開一個畫面 / app 開同畫面 對照**走查；落差清單回給本角色下一棒逐項補。
- 重點先看 **Walks（已深度 1:1）** 確認方向對，再看其餘 surface 的漸層鈕/圓角/色票是否一致。
