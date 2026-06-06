# iOS ↔ PWA 視覺 fidelity gaps（per-screen diff）

狀態：**ACTIVE**（iOS PM 2026-06-03，依 user 提供的 PWA vs iOS 並排截圖）
目標：iOS UI ≈ 99% 對齊 web PWA（見 [`ios-uiux-polish-pass.md`](./ios-uiux-polish-pass.md) §Fidelity Goal）
給：iOS UI/UX 工程師（修）。批次驗收（規則 5）。

> 整體已很接近（cream 底 / 橘 accent / 圓角卡 / raised disc nav 都對）。下列是逐頁差異。P0 = 一眼看出的結構差；P1 = 細節。**Walks 頁缺 PWA 截圖 → 待補再 diff。**

---

## S0 — Icon 系統對齊（root cause of icon 差異）
> 實查：**web 用 `lucide-react`；iOS 沒裝 icon 庫**（emoji / 自刻 svg 拼）。要 99% 一致就要讓 iOS 跟 web 同源。
| # | gap → 解法 | 維度 | 級 |
|---|---|---|---|
| I1 | **iOS 線條 icon 不同源** → 加 **`lucide-react-native`**（lucide 的 RN 版，跟 web lucide-react 同套），把 app 內所有 UI 線條 icon（首頁/齒輪/獎盃/鈴鐺/分享/複製/刷新/編輯/check/trash…）逐一換成 **與 web 同名的 lucide icon**（對照 apps/web 各元件 import 的 lucide 名稱 1:1）。⚠️ **新 dep → branch + linux gate** | icon 系統 | **P0** |
| I2 | **emoji 選錯字元** → 把 iOS code 裡跟 web 不同的 emoji 改成**同一個字元**（如 nav 中央 🐕→🐾）。同支 iPhone 上 emoji 本來就同字型，改字元即一致。保留 emoji 的地方（🥭🔥🥇🥈♀）確認字元與 web 相同 | icon/文案 | P1 |
| I3 | **launcher（桌面）app icon + splash 未設** → app.json 加 `icon`（1024×1024、不透明、不預先圓角的 Mango master）+ `splash`。來源用 Mango logo；現有 `apps/web/public/web-app-manifest-512x512.png` / `apple-touch-icon.png` 可當素材（512² 會略軟，最好出 1024² master）。**App Store 送審必備** | asset | **P0** |

## S2 Home / Feed
| # | gap（iOS 現況 → PWA 目標） | 維度 | 級 |
|---|---|---|---|
| H1 | top bar 只有「Mango 家」→ PWA 是 **🥭 logo + 「芒果寵物」品牌字 + 「Mango家」家庭 pill（帶 home icon）** 三件 | 佈局/品牌 | **P0** |
| H2 | top-right：iOS 有「相框 + bell」→ PWA 只有 **bell（白底圓圈內）**，相框不在這 | icon | P1 |
| H3 | bottom nav 中央 = 🐕 狗 → PWA 是 **🐾 paw print**（橘 disc）；label「寵物→我的寵物」「排行→排行榜」 | icon/文案 | **P0** |
| H4 | 反應列：iOS「❤️2 pill ＋ "+" ＋ ❤️2 ＋ 『留言』文字鈕」→ PWA「❤️ 選取 pill ＋ **😀＋(加表情臉)** ＋ ❤️2 ＋ **💬 icon 圓鈕（無「留言」字）**」 | 元件/文案 | P1 |

## S3 Pets
| # | gap | 維度 | 級 |
|---|---|---|---|
| P1a | 標題列缺 **「＋ 寵物」按鈕**（PWA 右上有，淺底 pill）→ iOS 只有 pencil | 佈局 | **P0** |
| P2a | 「即將到期」row：iOS = bell icon + 「每月 / 9 小時後」、**無操作鈕** → PWA = **聽診器 icon（peach 方塊）+「🔁每月 ⏰大約 9 小時內」+ 右側 check-circle + trash 兩個操作鈕** | 元件 | **P0** |
| P3a | 「最近開銷」空狀態：iOS = 純灰字 → PWA = **白色圓角卡內置中灰字「本月還沒有開銷」** | 元件 | P1 |
| P4a | 本月開銷幣值：iOS「$0」→ PWA「**0 NT$**」（數字 + NT$ 後綴） | 文案 | P1 |
| P5a | 散步天數：iOS「2 天」→ PWA「**2 天 · 本月**」 | 文案 | P1 |

## S4 Leaderboard
| # | gap | 維度 | 級 |
|---|---|---|---|
| L1 | **人/狗 toggle 位置**：iOS 在「排行榜」標題**下方** → PWA 在標題**上方**（頁面最頂） | 佈局 | **P0** |
| L2 | rank row 有 **avatar 照片** → PWA **無頭像**（只有獎牌 + 名字）；且 PWA 名字旁有 **品種 chip（米克斯/米格魯）+「我的狗」橘 pill** → iOS 是「· 我」文字 | 元件 | **P0** |
| L3 | metadata 順序：iOS「21.4km · 7次 · 🔥1 · 飼主」→ PWA「**7次 · 21.4km · 🔥1 · 飼主**」 | 佈局 | P1 |
| L4 | 刷新：iOS =「刷新排行榜」文字連結 → PWA = **circular-arrows icon（標題右側）** | icon | P1 |

## S5 Settings
| # | gap | 維度 | 級 |
|---|---|---|---|
| S5a | 「登出」：iOS = peach pill 在名字**右側** → PWA = **黑色 pill 在名字下方** + profile 卡右上角有 **👥 好友 icon（peach 圓）** | 元件/佈局 | **P0** |
| S5b | **「成就徽章」卡**（trophy + 「查看已解鎖的徽章與進度」+ chevron）：PWA 在 profile 下方第 2 張 → iOS 順序/呈現不同（確認補上同款卡） | 佈局 | P1 |
| S5c | 照片圖庫：iOS = **row + chevron** → PWA = **整張卡 + 內置 3 格照片 grid + 「查看全部」** | 元件 | **P0** |
| S5d | 家庭：iOS = **row「家庭 >」**（點進另一頁）→ PWA = **設定頁內展開整張卡**（邀請碼 845317 + share/copy/refresh icons + 「請家人輸入…」+ 成員(4) 列表 inline） | 佈局/元件 | **P0** |
| S5e | 推播通知文案：iOS「**瀏覽器已拒絕，請到瀏覽器設定開啟通知權限**」= web 漏字 → 改 **iOS 原生措辭**（到 iOS 設定開啟通知 / APNs），這是 shared-i18n web-centric 字串，iOS 要分支文案 | 文案/i18n | **P0** |

## ⏳ 待補
- **S1 Walks**：未拿到 PWA walks 截圖 → user 補一張(遛狗頁)再 diff。
- 推播 section 下半（PWA 截圖截斷在「成員」）→ 若有差異補。

---

## 🎯 完成定義（GOAL — 一次做完）

**DoD = 本檔所有 gap（P0 + P1，全 5 頁）全部關閉，iOS 並排 PWA「幾乎分不出」。** 一個 UI/UX session 一次做完全部，不分批；每項對照 `apps/web` 對應元件 1:1。收齊 → 末端一顆 EAS build，user 並排總驗收（規則 5）。

## 修正優先序
- **P0 先做**（一眼差異）：H1 品牌列、H3 nav 中央 paw + label、P1a ＋寵物鈕、P2a 提醒 row（icon+操作鈕+wording）、L1 toggle 上移、L2 rank row（去頭像+品種chip+我的狗 pill）、S5a 登出黑pill+友 icon、S5c 照片圖庫卡+grid、S5d 家庭 inline 卡、S5e 推播文案。
- **P1 後做**（細節）：H2/H4、P3a/P4a/P5a、L3/L4、S5b。
- 全部對照 `apps/web` 對應元件 1:1（讀 web 程式，不憑印象）。
