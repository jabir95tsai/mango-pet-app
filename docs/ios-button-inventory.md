# Mango Pet iOS 按鈕與樣式索引

依原始碼位置排列。共用控制項與呼叫端分列，動態清單每種模板列一次。行號可直接對照目前 checkout。樣式欄保留實作名稱，樣式覆寫以來源為準。

## apps/ios/app/(auth)/sign-in.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 137 | {用 Google 登入} | Pressable · styles.google / styles.googlePressed / styles.disabled |
| 166 | AppleAuthentication.AppleAuthenticationButton | AppleAuthentication.AppleAuthenticationButton · styles.apple |
| 187 | {以訪客身分繼續} | Pressable · styles.guest / styles.guestPressed / styles.disabled |
| 208 | 使用 Email 帳號登入 | Pressable · styles.emailToggle / styles.emailTogglePressed |
| 256 | {以 Email 登入} | Button · variant="primary" |
| 280 | 隱私權政策 | Pressable |
| 287 | 服務條款 | Pressable |

## apps/ios/app/(tabs)/index.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 183 | 查看更多動態 | Pressable · styles.more / styles.morePressed |

## apps/ios/app/(tabs)/leaderboard.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 136 | Tabs | Tabs · size="icon" |

## apps/ios/app/(tabs)/pets.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 262 | {寵物} | Pressable · styles.addPetBtn / styles.addPetPressed |
| 341 | {t(`PetsPage.fab.${activeTab}`)} | Pressable · styles.fab / styles.fabPressed |
| 366 | {關閉} | Pressable · 區域樣式（見來源） |
| 373 | PetSwitcher | PetSwitcher · styles.switcher |

## apps/ios/app/(tabs)/settings.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 139 | {好友} | Pressable · styles.friendsDisc / styles.dim |
| 150 | 登出 | Pressable · styles.signOut / styles.dim |
| 164 | 成就徽章 | Pressable · styles.linkCard / styles.linkCardPressed |
| 201 | 聯絡客服（jabir95tsai@gmail.com） | Pressable · styles.supportRow / styles.linkCardPressed |
| 227 | 隱私權政策 | Pressable |
| 231 | 服務條款 | Pressable |

## apps/ios/app/(tabs)/walks.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 190 | PetPill | PetPill |
| 247 | 收合 | Pressable · styles.toggleAllBtn / styles.toggleAllPressed |
| 274 | {手動補登} | Button · variant="ghost" · size="sm" · icon={&lt;Hand size={16} color={colors.ink2} strokeWidth={2} />} · styles.manualBtn |
| 306 | WalksStartCta | WalksStartCta |

## apps/ios/app/(tabs)/_layout.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 47 | 首頁 | Tabs |

## apps/ios/app/achievements.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 154 | 社群與排行榜徽章需綁定帳號才能解鎖；遛狗、里程、寵物等個人徽章你現在就能累積。 | Pressable · styles.guestHint / styles.guestHintPressed |

## apps/ios/app/feed.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 134 | {發文} | Button · primary · size="md" · icon={PenSquare} · fullWidth=true |

## apps/ios/app/friends/add.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 102 | {status === "sending" ? 送出中… : 送出好友邀請} | Button · primary · size="lg" · icon={&lt;UserPlus size={16} color="#ffffff" strokeWidth={2} />} · fullWidth=true |
| 122 | {返回} | Pressable · styles.backBtn |

## apps/ios/app/friends/index.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 167 | 取消 | 對話框選項 "cancel" |
| 168 | 刪除 | 對話框選項 "destructive" |
| 229 | {返回} | Pressable · styles.backBtn |
| 247 | {我的 QR} | Button · variant="secondary" · size="sm" · icon={&lt;QrCode size={16} color={colors.ink} strokeWidth={2} />} |
| 262 | 搜尋 | Segmented |
| 297 | {刪除} | Pressable · styles.iconBtn / styles.disabled |
| 326 | {接受} | Pressable · styles.iconBtn / styles.acceptBtn / styles.pressed / styles.disabled |
| 340 | {拒絕} | Pressable · styles.iconBtn / styles.disabled |
| 369 | {搜尋} | Pressable · styles.searchBtn / styles.pressed |
| 403 | {接受} | Button · primary · size="sm" · icon={&lt;Check size={14} color="#ffffff" strokeWidth={2.2} />} |
| 411 | { already ? 已是好友 : sent ? 已送出 : 加好友 } | Button · variant={already \|\| sent ? "ghost" : "primary"} · size="sm" · icon={already \|\| sent ? undefined : &lt;UserPlus size={14} color="#ffffff" strokeWidth={2} />} |
| 446 | 我的 QR code | Pressable · styles.modalBackdrop |
| 447 | 我的 QR code | Pressable · styles.qrSheet |
| 455 | {copied ? 已複製 : 複製連結} | Button · variant="secondary" · icon={ copied ? ( &lt;Check size={16} color={colors.ink} strokeWidth={2} /> ) : ( &lt;Copy size={16} color={colors.ink} strokeWidth={2} /> ) } · styles.flex1 |
| 468 | {返回} | Button · primary · styles.flex1 |
| 470 | {分享} | Pressable · styles.shareBtn / styles.pressed |

## apps/ios/app/join/[code].tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 170 | {回到首頁} | Button · primary |

## apps/ios/app/notifications.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 167 | {[r.title, petName(r.petId)].filter(Boolean).join("，")} | Pressable · styles.pressed |
| 201 | {`${text}，${time}`} | Pressable · styles.row / styles.rowFresh / styles.pressed |

## apps/ios/app/onboarding.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 71 | 前往首頁 | Pressable · styles.alreadyLink / styles.dim |
| 103 | {建立家庭} | OptionCard · icon={Users} |
| 110 | {加入家庭} | OptionCard · icon={UserPlus} |
| 119 | 先用個人模式 → | Pressable · styles.skip / styles.dim |
| 178 | {actionLabel} | Button · primary · size="sm" · fullWidth=true |

## apps/ios/app/photos.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 147 | 取消 | 對話框選項 "cancel" |
| 148 | 開啟 iOS 設定 | 對話框選項  |
| 194 | {返回} | Pressable · styles.backBtn |
| 211 | { saving ? 儲存中... : undownloaded.length === 0 ? 全部已儲存 : 儲存 {count} 張尚未下載的照片 } | Button · primary · icon={&lt;Download size={16} color="#ffffff" strokeWidth={2} />} · fullWidth=true |
| 225 | {儲存選取的 {count} 張} | Button · variant="secondary" · icon={&lt;Download size={16} color={colors.ink} strokeWidth={2} />} · fullWidth=true |
| 256 | setFilter | Pressable · styles.pill / styles.pillOn |
| 280 | {去發動態} | Button · primary · icon={&lt;Camera size={16} color="#ffffff" strokeWidth={2} />} |
| 285 | {開始遛狗} | Button · variant="secondary" |

## apps/ios/app/_layout.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 231 | {重試} | Button · primary · size="lg" · fullWidth=true |
| 241 | {登出} | Button · variant="ghost" · fullWidth=true |

## apps/ios/src/components/achievements/badge-card.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 103 | {`${title} — ${綁定帳號解鎖}`} | Pressable · styles.card / styles.cardPressed |

## apps/ios/src/components/auth/guest-upgrade.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 177 | {我知道了} | Button · primary · fullWidth=true |
| 194 | {用 Google 綁定} | ProviderButton |
| 202 | {用 Apple 綁定} | ProviderButton |
| 242 | {label} | Pressable · styles.provider / styles.providerApple / styles.providerGoogle / styles.providerApplePressed / styles.providerGooglePressed / styles.providerDisabled |
| 293 | {綁定帳號} | Button · primary · size="sm" |
| 369 | {綁定帳號} | Button · primary · size="sm" |
| 375 | {稍後再說} | Button · variant="ghost" · size="sm" |
| 384 | {稍後再說} | Pressable · styles.nudgeClose / styles.nudgeClosePressed |

## apps/ios/src/components/family/family-dialogs.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 87 | {取消} | Button · variant="ghost" |
| 88 | {busy ? "..." : 建立} | Button · primary |
| 169 | {取消} | Button · variant="ghost" |
| 170 | {busy ? "..." : 加入} | Button · primary |

## apps/ios/src/components/family/import-wizard-sheet.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 115 | {先不要} | Button · variant="ghost" |
| 116 | { busy ? 搬移中... : selectedTotal > 0 ? 搬進來（{n}） : 沒有可搬的 } | Button · primary |
| 140 | setSelected | Pressable · styles.row / styles.rowDisabled / styles.rowPressed |

## apps/ios/src/components/feed/comment-section.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 228 | 載入中... | Pressable · styles.more / styles.morePressed / styles.moreDisabled |
| 259 | {刪除留言} | Pressable · styles.delete / styles.deletePressed |
| 306 | {送出} | Pressable · styles.send / styles.sendDisabled / styles.sendPressed |

## apps/ios/src/components/feed/emoji-reactions.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 199 | {mainLabel} | Pressable · styles.mainBtn / styles.mainBtnOn / styles.pending / styles.pressed |
| 221 | {更多表情} | Pressable · styles.moreBtn / styles.morePressed |
| 256 | 選擇表情 | Pressable · 區域樣式（見來源） |
| 282 | {回應 {emoji}} | Pressable · styles.trayBtn / styles.trayBtnOn / styles.pressed |

## apps/ios/src/components/feed/photo-lightbox.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 322 | {存到相簿} | Pressable · styles.iconBtn / styles.iconBtnPressed / styles.iconBtnBusy |
| 343 | {關閉} | Pressable · styles.iconBtn / styles.iconBtnPressed |
| 370 | { active ? {current} / {total} : i &lt; index ? 上一張 : 下一張 } | Pressable · styles.dot / styles.dotActive |

## apps/ios/src/components/feed/post-card.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 123 | {刪除} | Pressable · styles.deleteBtn / styles.deleteBtnPressed |
| 166 | {留言} | Pressable · styles.commentBtn / styles.commentBtnPressed |
| 239 | {{current} / {total}} | Pressable · styles.cellPressed |

## apps/ios/src/components/feed/post-composer.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 255 | {取消} | Button · variant="ghost" |
| 261 | {發布} | Button · variant="primary" |
| 290 | {移除照片} | Pressable · styles.removeBtn / styles.removeBtnPressed |
| 308 | {拍照} | Button · variant="ghost" · size="sm" · icon={Camera} |
| 316 | {`${photoUris.length}/${MAX_PHOTOS}`} | Button · variant="ghost" · size="sm" · icon={ImageIcon} |
| 334 | Pressable | Pressable · styles.petChip / styles.chipOn |
| 358 | setVisibility | Pressable · styles.visChip / styles.chipOn |

## apps/ios/src/components/feed/post-menu.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 118 | reportLabel | 對話框選項  |
| 119 | 封鎖 {name} | 對話框選項 "destructive" as const |
| 125 | {更多選項} | Pressable · styles.btn / styles.btnPressed |
| 153 | setReason | Pressable · styles.reason / styles.reasonOn |
| 176 | {送出檢舉} | Button · primary · styles.submit |

## apps/ios/src/components/feed/save-to-album-button.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 78 | {label} | Pressable · styles.base / styles.saved / styles.failed / styles.saving / styles.pressed |

## apps/ios/src/components/home/feed-section-header.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 16 | 查看更多 | Pressable · styles.link / styles.pressed |

## apps/ios/src/components/home/home-empty-state.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 57 | {新增第一隻寵物} | Button · primary · size="lg" · pill=true · icon={&lt;Plus size={18} color="#ffffff" strokeWidth={2.5} />} · fullWidth=true · styles.primary |
| 68 | 加入家庭 | Pressable · styles.secondary / styles.secondaryPressed |

## apps/ios/src/components/home/home-top-bar.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 36 | {t(hasUnread ? "Notifications.bellUnread" : "Home.notifications")} | Pressable · styles.pressed |

## apps/ios/src/components/home/invite-family-card.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 26 | 邀請家人加入 | Pressable · styles.shadow / styles.pressed |

## apps/ios/src/components/home/no-posts-hint.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 15 | 動態還空空的 | Pressable · styles.card / styles.pressed |

## apps/ios/src/components/home/pet-story-avatar.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 69 | {`${name} · ${t(STATUS_HINT[status])}. ${依寵物篩選 — 開發中}`} | Pressable · styles.wrap |

## apps/ios/src/components/home/stories-bar.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 34 | YourStoryAvatar | YourStoryAvatar |

## apps/ios/src/components/home/your-story-avatar.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 27 | {發文} | Pressable · styles.wrap |

## apps/ios/src/components/leaderboard/board-list.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 48 | RefreshIconButton | RefreshIconButton |

## apps/ios/src/components/leaderboard/dog-leaderboard.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 197 | 本週 | Segmented · size="sm" |

## apps/ios/src/components/leaderboard/human-leaderboard.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 256 | 本週 | Segmented · size="sm" |

## apps/ios/src/components/leaderboard/podium.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 169 | option.label | 對話框選項  |
| 175 | {範圍：{scope}，點擊切換} | Pressable · styles.pill / styles.pressed |

## apps/ios/src/components/leaderboard/refresh-icon-button.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 48 | {刷新排行榜} | Pressable · styles.btn / styles.dim |

## apps/ios/src/components/leaderboard/segmented.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 23 | Tabs | Tabs · size={size} · fullWidth={fullWidth} |

## apps/ios/src/components/liquid-glass-tab-bar.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 175 | {tabLabel(route.name)} | Tab |
| 224 | {label} | Pressable · styles.tab |

## apps/ios/src/components/pets/expense-form.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 275 | {移除品項} | IconButton · tone="ghost" · size={36} · icon={X} |
| 287 | {新增品項} | Button · variant="ghost" · size="sm" · icon={Plus} · styles.addItemBtn |

## apps/ios/src/components/pets/form-sheet.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 76 | 取消 | Pressable · styles.headerBtn |
| 89 | {儲存} | Pressable · styles.headerBtn / styles.headerBtnEnd |
| 178 | Pressable | Pressable · styles.optPill / styles.optPillActive / styles.optPillPressed |
| 228 | {`${label} ${display}`} | Pressable · styles.dateBox / styles.dateBoxOpen |
| 280 | {label} | Button · variant="secondary" · size="sm" · pill=true · icon={Plus} · styles.addDate |
| 296 | {刪除} | Button · variant="ghost" · size="sm" · icon={X} · styles.clearDate |
| 342 | {`−${step}`} | Pressable · styles.stepBtn / styles.stepBtnPressed / styles.stepBtnDisabled |
| 372 | {`+${step}`} | Pressable · styles.stepBtn / styles.stepBtnPressed / styles.stepBtnDisabled |

## apps/ios/src/components/pets/health-form.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 63 | {label} | Button · variant="secondary" · size="sm" · pill=true · icon={Plus} · styles.addDate |
| 77 | {刪除} | Button · variant="ghost" · size="sm" · icon={X} · styles.clearDate |

## apps/ios/src/components/pets/health-record-card.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 131 | {`${刪除} ${typeLabel}`} | Pressable · styles.trash / styles.trashPressed |

## apps/ios/src/components/pets/pet-expense-card.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 84 | {編輯} | Pressable · styles.iconBtn / styles.iconBtnPressed |
| 97 | {刪除} | Pressable · styles.iconBtn / styles.iconBtnDangerPressed |

## apps/ios/src/components/pets/pet-expenses-body.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 228 | setFilter | Pressable · styles.pill / styles.pillActive / styles.pillIdle / styles.pillPressed |
| 276 | 新增開銷 | Pressable · styles.emptyCta / styles.emptyCtaPressed |

## apps/ios/src/components/pets/pet-form.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 184 | {點擊上傳照片} | Pressable · styles.avatarBtn / styles.pressed |
| 281 | 刪除 | Pressable · styles.deleteBtn / styles.deleteBtnPressed / styles.deleteBtnBusy |

## apps/ios/src/components/pets/pet-header.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 53 | {multi ? 切換寵物（目前：{pet}） : undefined} | Pressable · styles.nameRow |
| 80 | {編輯} | Pressable · styles.editBtn / styles.pressed |

## apps/ios/src/components/pets/pet-health-body.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 125 | {重試} | Button · variant="secondary" · size="sm" |
| 201 | 新增紀錄 | Pressable · styles.emptyCta / styles.emptyCtaPressed |

## apps/ios/src/components/pets/pet-reminder-card.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 102 | {tRem("markDone")} | Pressable · styles.checkBtn / styles.pressed |
| 112 | {tC("edit")} | Pressable · styles.iconBtn / styles.pressed |
| 123 | {tC("delete")} | Pressable · styles.iconBtn / styles.pressed |

## apps/ios/src/components/pets/pet-reminders-body.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 71 | 新增提醒 | Pressable · styles.addPill / styles.pressed |

## apps/ios/src/components/pets/pet-switcher.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 60 | Pressable | Pressable · styles.row / styles.rowActive / styles.rowPressed |
| 88 | Pressable | Pressable · styles.row / styles.rowPressed |

## apps/ios/src/components/pets/pet-tabs.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 28 | LensTrack | LensTrack |

## apps/ios/src/components/pets/pets-empty-state.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 48 | {新增寵物} | Button · primary · size="lg" · pill=true · icon={&lt;Plus size={18} color="#ffffff" strokeWidth={2.5} />} · styles.cta |

## apps/ios/src/components/pets/receipt-scanner.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 250 | {取消} | Pressable · styles.overlayBtn / styles.overlayTopRight / styles.dim |
| 261 | 取消 | SaveToAlbumButton |
| 266 | {scanning ? AI 辨識中... : 開始辨識} | Button · primary · size="lg" · icon={scanning ? &lt;ActivityIndicator color={WHITE} size="small" /> : Sparkles} · fullWidth=true |
| 274 | 取消 | ManualLink |
| 295 | {關閉} | Pressable · styles.topBtn |
| 311 | {從相簿選} | Pressable · styles.sideBtn / styles.dim |
| 329 | {拍照} | Pressable · styles.shutterOuter / styles.dim |
| 340 | 手動輸入開銷 | Pressable |
| 375 | {拍照} | Button · primary · size="lg" · icon={Camera} · fullWidth=true |
| 383 | {前往設定} | Button · primary · size="lg" · icon={Settings} · fullWidth=true |
| 392 | {從相簿選} | Button · variant="secondary" · size={denied ? "md" : "lg"} · icon={ImageIcon} · fullWidth=true |
| 401 | 需要相機權限 | ManualLink |
| 426 | {關閉} | IconButton · size={44} · icon={X} |
| 449 | 手動輸入開銷 | Pressable · styles.manualLink |
| 475 | {label} | Pressable · styles.overlayBtn / styles.overlayBottomRight / styles.dim |

## apps/ios/src/components/photos/photo-asset-card.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 57 | {開啟照片：{title}} | Pressable · 區域樣式（見來源） |
| 71 | {selected ? 取消選取 : 選取照片} | Pressable · styles.circle / styles.select / styles.selectOn / styles.selectOff |
| 81 | {儲存照片} | Pressable · styles.circle / styles.download / styles.dim |

## apps/ios/src/components/raised-tab-bar.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 106 | {label} | Pressable · styles.centerCell |
| 134 | {label} | Pressable · styles.tab |

## apps/ios/src/components/settings/blocked-users-section.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 90 | {取消封鎖} | Button · variant="secondary" · size="sm" |

## apps/ios/src/components/settings/delete-account-section.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 142 | {刪除我的帳號} | Button · variant="danger" · icon={Trash2} · styles.openBtn |
| 157 | {取消} | Button · variant="ghost" |
| 163 | {deleting ? 刪除中... : 永久刪除} | Button · variant="danger" · icon={deleting ? undefined : Trash2} |

## apps/ios/src/components/settings/engagement-push-section.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 97 | {label} | Switch |

## apps/ios/src/components/settings/export-data-section.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 47 | {busy ? 準備中... : 下載我的資料} | Button · variant="secondary" · icon={Download} · styles.btn |

## apps/ios/src/components/settings/family-section.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 244 | {加入} | Button · variant="ghost" · size="sm" |
| 245 | {新建} | Button · variant="secondary" · size="sm" · icon={&lt;Plus size={14} color={colors.ink} strokeWidth={2.5} />} |
| 261 | {重試} | Button · variant="secondary" · size="sm" · styles.retry |
| 282 | Pressable | Pressable · styles.switchPill / styles.switchPillOn / styles.switchPillPressed |
| 315 | {分享邀請連結} | Pressable · styles.codeBtn / styles.codeBtnPressed |
| 327 | {複製邀請碼} | Pressable · styles.codeBtn / styles.codeBtnPressed |
| 340 | "QR" | Pressable · styles.codeBtn / styles.codeBtnPressed |
| 350 | {重新產生邀請碼} | Pressable · styles.codeBtn / styles.codeBtnPressed / styles.disabled |
| 400 | {`${移除成員} ${m.displayName}`} | Pressable · styles.removeBtn / styles.removePressed |
| 418 | 離開家庭 | Pressable · styles.leaveBtn / styles.leavePressed / styles.disabled |
| 469 | 關閉 | Pressable · styles.qrBackdrop |
| 470 | 關閉 | Pressable · styles.qrSheet |
| 474 | {關閉} | Button · variant="secondary" |

## apps/ios/src/components/settings/guest-upgrade-section.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 29 | {綁定帳號} | Button · primary · styles.cta |

## apps/ios/src/components/settings/language-switcher.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 59 | {opt.label} | Pressable · styles.option / styles.optionActive / styles.optionPressed |

## apps/ios/src/components/settings/photos-preview-section.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 68 | Pressable | Pressable · styles.dim |
| 80 | Pressable | Pressable · styles.empty |
| 88 | {tS("photosLink")} | Pressable · styles.cell |

## apps/ios/src/components/settings/prefs-sections.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 65 | {遛狗自動拍照} | Switch |
| 134 | Pressable | Pressable · styles.option / styles.optionOn / styles.optionPressed |

## apps/ios/src/components/settings/push-toggle.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 108 | {推播通知} | Switch |
| 119 | {testing ? "..." : 測試} | Button · variant="ghost" · size="sm" · icon={&lt;Send size={14} color={colors.ink} strokeWidth={2} />} · styles.inlineAction |
| 130 | {開啟 iOS 設定} | Button · variant="ghost" · size="sm" · styles.inlineAction |
| 142 | {重試} | Button · variant="ghost" · size="sm" · styles.inlineAction |

## apps/ios/src/components/ui/Button.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 125 | {accessibilityLabel ?? label} | Pressable · styles.fullWidth / styles.pressedStatic / styles.pressed / styles.disabled |

## apps/ios/src/components/ui/Dialog.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 190 | Pressable | Pressable · 區域樣式（見來源） |
| 227 | {關閉} | Pressable · styles.close / styles.closePressed |

## apps/ios/src/components/ui/EmptyState.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 87 | {action.label} | Button · variant={variant} · size={hero ? "lg" : "md"} · pill={hero} · icon={action.icon} |

## apps/ios/src/components/ui/IconButton.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 94 | {accessibilityLabel} | Pressable · styles.base / styles.pressedScale / styles.disabled |

## apps/ios/src/components/ui/LensTrack.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 253 | {item.accessibilityLabel} | Pressable · styles.disabled |

## apps/ios/src/components/ui/Pill.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 78 | {accessibilityLabel ?? label} | Pressable · styles.pressed |

## apps/ios/src/components/ui/PromptHost.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 21 | {action.text} | Button · variant={action.style === "cancel" ? "ghost" : action.style === "destructive" ? "danger" : prompt.size === "sheet" ? "secondary" : "primary"} · fullWidth=true |

## apps/ios/src/components/ui/RouteHeader.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 67 | {backLabel ?? 返回} | Pressable · styles.backBtn / styles.backBtnPressed |

## apps/ios/src/components/ui/Sheet.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 63 | {closeLabel} | Pressable · styles.cancelBtn |

## apps/ios/src/components/ui/Tabs.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 75 | {accessibilityLabel} | LensTrack |

## apps/ios/src/components/walks/camera-capture-modal.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 106 | {允許相機} | Button · primary · size="lg" · pill=true · fullWidth=true |
| 114 | {前往設定} | Button · primary · size="lg" · pill=true · fullWidth=true |
| 122 | 跳過 | Pressable · styles.skipBtn / styles.pressed |
| 153 | {關閉} | Pressable · styles.closeBtn |
| 164 | {拍照} | Pressable · styles.shutter / styles.pressed |

## apps/ios/src/components/walks/family-live-viewer.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 33 | 家人的散步位置 | Pressable · styles.button |
| 42 | 查看下一批位置 | Pressable · styles.button |
| 44 | 回到第一批位置 | Pressable · styles.button |

## apps/ios/src/components/walks/manual-walk-dialog.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 146 | {取消} | Button · variant="ghost" |
| 147 | {儲存} | Button · primary |

## apps/ios/src/components/walks/pet-pill.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 55 | { hasMultiplePets ? 切換寵物（目前：{pet}） : activePet.name } | Pressable · styles.pill / styles.pressed |
| 89 | {關閉} | Pressable · 區域樣式（見來源） |
| 101 | Pressable | Pressable · styles.row / styles.rowSelected / styles.rowPressed |
| 131 | 管理寵物 | Pressable · styles.row / styles.rowPressed |

## apps/ios/src/components/walks/photo-prompt-sheet.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 71 | {拍照} | Button · primary · size="lg" · pill=true · icon={&lt;Camera size={20} />} · fullWidth=true |
| 80 | 跳過 | Pressable · styles.skipBtn / styles.skipPressed |

## apps/ios/src/components/walks/tracking-active-panel.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 187 | {state.isPaused ? 繼續 : 暫停} | Button · variant="secondary" · pill=true · icon={state.isPaused ? Play : Pause} |
| 194 | 停止 | Pressable · styles.stopBtn / styles.stopPressed / styles.stopDisabled |

## apps/ios/src/components/walks/tracking-done-panel.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 209 | 加備註 | Pressable · styles.notesToggle / styles.notesTogglePressed |
| 241 | {重試} | Button · primary · pill=true |
| 249 | {捨棄本機草稿} | Button · variant="secondary" · pill=true |
| 258 | {稍後再儲存（紀錄會保留在遛狗頁）} | Button · variant="ghost" · pill=true |
| 269 | {回到遛狗} | Button · primary · size="lg" · fullWidth=true |
| 276 | {查看排行榜} | Button · variant="secondary" · size="lg" · fullWidth=true |

## apps/ios/src/components/walks/tracking-photos.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 68 | 已達上限 5 張 | Pressable · styles.photoBtn / styles.photoBtnFull / styles.photoBtnActive / styles.photoBtnPressed |
| 115 | {上傳失敗} | Pressable · styles.overlay / styles.overlayFailed |
| 125 | {移除} | Pressable · styles.deleteBtn / styles.deletePressed |
| 164 | {放大檢視} | Pressable · styles.gridTile / styles.gridTilePressed |

## apps/ios/src/components/walks/tracking-session-controller.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 105 | 取消 | 對話框選項 "cancel" |
| 106 | 開始（不分享即時位置） | 對話框選項  |
| 107 | 開始並分享即時位置 | 對話框選項  |

## apps/ios/src/components/walks/tracking-session-recovery.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 75 | 繼續散步 | 對話框選項  |
| 82 | 結束散步 | 對話框選項  |

## apps/ios/src/components/walks/tracking-status-screens.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 37 | {前往設定} | Button · primary · size="lg" · pill=true · fullWidth=true |
| 44 | {只計時，不記錄路線} | Button · variant="secondary" · size="lg" · pill=true · fullWidth=true |
| 45 | {返回} | Button · variant="secondary" · size="lg" · pill=true · fullWidth=true |
| 67 | {重試} | Button · primary · size="lg" · pill=true · fullWidth=true |
| 68 | {返回} | Button · variant="secondary" · size="lg" · pill=true · fullWidth=true |

## apps/ios/src/components/walks/walk-draft-recovery.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 263 | {recovery.recovering ? 正在儲存散步… : 重試} | Button · primary · pill=true · styles.retry |
| 278 | {捨棄本機草稿} | Button · variant="secondary" · pill=true |

## apps/ios/src/components/walks/walk-row.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 83 | 查看路線 | Pressable · 區域樣式（見來源） |
| 100 | {{current} / {total}} | Pressable · styles.thumb / styles.pressed |
| 120 | {刪除} | Pressable · styles.delete / styles.deletePressed |

## apps/ios/src/components/walks/walks-start-cta.tsx

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 6 | 開始遛狗 | Pressable · styles.shadow |

## apps/ios/src/lib/confirm.ts

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 26 | cancelLabel | 對話框選項 "cancel" |
| 27 | confirmLabel | 對話框選項 destructive ? "destructive" : "default" |
| 49 | 確認 | 對話框選項  |

## apps/ios/src/lib/prompts.ts

| 行 | 文字、無障礙名稱或動作 | 元件與樣式 |
|---:|---|---|
| 24 | 取消 | 對話框選項 "cancel" |
