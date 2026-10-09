# Phase A foundation (already committed) — API notes + handoffs

Keys added to catalogs: Common.retry, Family.actionFailed, Auth.profileError.body, Auth.profileError.revokeFailed, Settings.languageLabel.
Root layout: Stack is keyed by locale (language switch remounts screens).

## impl:A1-primitives
### api_notes
All primitives can be imported from "@/components/ui" (direct file paths still work). No new i18n keys were needed; only existing keys are used: Common.close, Common.back, Common.cancel, Common.confirm, Error.title and Nav.*.

**RouteHeader**, "@/components/ui/RouteHeader"
- Props: title: string; subtitle?: string; right?: ReactNode; action?: ReactNode (alias of right, web's name); onBack?: () => void; backLabel?: string (default t('Common.back')); backRowRight?: ReactNode (extra content on the right of the back row); marginBottom?: number (default 24 = web mb-6; pass 0 for web's mb-0); style?.
- Renders: optional back row (44pt ArrowLeft 20 button, then 16pt gap), then a row with the 26/800/-0.5 ink title (role header) and the right slot, then the optional 14/24 ink2 subtitle with marginTop 4.
- It does NOT add safe-area or horizontal padding; put it inside Screen or the page's padded column.

**Dialog**, "@/components/ui/Dialog"
- Props: visible?: boolean (or open?: boolean, web alias); onClose: () => void; title?: string; description?: string; children?: ReactNode; footer?: ReactNode; dismissible?: boolean (default true; false disables scrim tap, X, escape gesture and onRequestClose); size?: 'sheet' | 'center' (default 'sheet'); onClosed?: () => void (fires after it has fully disappeared); contentStyle? (the ScrollView content container: padding 20, gap 12); style? (the surface); testID?.
- The header and X only render when title is set, like web.
- footer is a column with gap 12 pinned under the scroll body. Put full-width buttons in it with fullWidth, or wrap your own row.
- You do not need SafeAreaView or KeyboardAvoidingView inside it; Dialog handles both.

**Input / Textarea**, "@/components/ui/Input"
- forwardRef<TextInput>. Props are InputProps = TextInputProps & { error?: string | null; invalid?: boolean; containerStyle?: StyleProp<ViewStyle> }.
- error shows the message below the field, turns the border danger and is announced to VoiceOver.
- Layout keys passed in style (flex, margins, width, alignSelf, position and similar) are applied to the outer wrapper automatically. All other style keys go to the TextInput.
- Textarea is always multiline, with text aligned to the top and minHeight 88.

**FieldLabel**, "@/components/ui/Input"
- Props: { children; style?: TextStyle; required?: boolean }. Renders 12/500 ink2 text.

**Field**, "@/components/ui/Input"
- Props: { label?; hint?; error?; required?; children; style? }. Stacks label, control and hint/error with gap 4.
- Pass error to Input OR to Field, not both, or the message shows twice.

**Tabs**, "@/components/ui/Tabs"
- Generic Tabs<K extends string>. Props: items?: { key: K; label: string; icon?: LucideIcon; accessibilityLabel?: string; disabled?: boolean }[]; options?: { value: K; label: string }[] (alias with the same shape as leaderboard Segmented); value: K; onChange(key: K): void; size?: 'sm' | 'md' (default 'md'); fullWidth?: boolean; accessibilityLabel?; style?.
- To migrate from Segmented, change the import and the component name; the options, value and onChange props are identical.
- Name clash: in files that also import Tabs from expo-router, alias one of them (e.g. `import { Tabs as SegTabs } from '@/components/ui'`).

**IconButton**, "@/components/ui/IconButton"
- Props: { icon: LucideIcon; onPress?; accessibilityLabel: string (required); accessibilityHint?; size?: number (default 40; hitSlop always brings the target to at least 44); iconSize?: number (default round(size × 0.5)); tone?: 'neutral' | 'brand' | 'danger' | 'ghost' (default 'ghost'); color?: string; filled?: boolean; shape?: 'circle' | 'rounded'; disabled?; selected?; badge?: boolean (brand dot); testID?; style? }.

**EmptyState**, "@/components/ui/EmptyState"
- Props: { icon?: LucideIcon; emoji?: string; title: string; description?: string; body?: string (legacy alias); action?: { label; onPress; icon?: LucideIcon; accessibilityLabel?; loading?; disabled? } | ReactNode; secondaryAction?: same descriptor shape; ctaLabel?/onPressCta? (legacy); gradientHero?: boolean; hint?: string; variant?: 'card' | 'plain' | 'hero'; style? }.
- The default variant is 'card' unless only emoji is given and no action/icon, in which case it is 'hero' (the legacy look).
- A descriptor action renders as a primary md Button (lg pill in hero). A secondaryAction renders as a secondary Button.
- emoji is now optional, which is backward compatible.

**Button**, "@/components/ui/Button"
- ButtonProps adds: icon?: IconSlot (a LucideIcon component such as icon={Plus}, an element such as <Plus/> which gets a colour injected unless it sets one, or an emoji string); iconPosition?: 'start' | 'end'; labelStyle?: StyleProp<TextStyle>; accessibilityHint?; testID?. The ButtonProps type is exported.
- Visual changes:
  - Default radius 14 → 8 (web rounded-lg). pill keeps 9999.
  - Horizontal padding 24 for every size → 12 / 16 / 24 (sm / md / lg).
  - Font 14 / 14 / 16 at weight 500 (was 700). Use labelStyle={{ fontWeight: '800' }} for hero CTAs.
  - Pressed scale 0.97, and only opacity under Reduce Motion.
  - danger uses colors.danger.

**Avatar**, "@/components/ui/Avatar"
- Adds variant?: 'person' | 'pet' (default derived from shape: circle → person, rounded → pet) and accessibilityLabel?.
- Exported initialsOf(name): string | null.
- A broken photo URL falls back to initials.

**renderIconSlot / IconSlot**, "@/components/ui/icon-slot" (also re-exported from the index)
- renderIconSlot(icon: IconSlot, color: string, size: number, strokeWidth = 2): ReactNode.

**Pill**
- The icon prop is now IconSlot and is rendered in a View; this is backward compatible.

**Sheet**
- API unchanged. cancelLabel now defaults to t('Common.cancel'), the cancel button has a 44pt target and an a11y label, and it does not slide under Reduce Motion.

**confirm**, "@/lib/confirm"
- confirm(opts: { title?: string (default t('Common.confirm')); message?: string; confirmLabel?: string (default t('Common.confirm')); cancelLabel?: string (default t('Common.cancel')); destructive?: boolean; confirmText?/cancelText?/danger? (web aliases) }): Promise<boolean>. Resolves true only when the confirm button is pressed.
- alertError(message?: string): void shows Alert.alert(t('Error.title'), message). notifyError is an alias.
- notify(title: string, message?: string): Promise<void> shows a single-button alert (Common.confirm).
- Example for a post delete: `if (await confirm({ title: t('Common.delete'), message: text.slice(0, 80), confirmLabel: t('Common.delete'), destructive: true })) { ... }`.

**raised-tab-bar**, "@/components/raised-tab-bar"
- New exports: TAB_NAV_KEYS (route name → 'Nav.*' key) and tabLabel(routeName): string.
### handoffs to screen lanes (apply the ones touching files you own)
- [settings / feed / social / family lanes] (apps/ios/app/(tabs)/settings.tsx, apps/ios/app/feed.tsx, apps/ios/app/photos.tsx, apps/ios/app/friends/index.tsx, apps/ios/app/family.tsx) SHELL-10: Adopt RouteHeader in settings.tsx (title t('Nav.settings'), right slot = the 'more' button), feed.tsx (title Home.feed.title or the web feed title key, subtitle Feed.subtitle, right = compose IconButton, onBack), photos.tsx (Photos.title / Photos.subtitle, onBack), friends/index.tsx (t('Nav.friends'), right = QR IconButton, onBack) and family.tsx (Family.title, onBack). Remove the per-file header, backBtn and title styles, plus the hard-coded '返回', '設定' and '好友'.
- [family / settings / feed / walks / pets lanes] (apps/ios/src/components/settings/family-section.tsx, apps/ios/app/family.tsx, apps/ios/src/components/settings/delete-account-section.tsx, apps/ios/src/components/feed/post-composer.tsx, apps/ios/src/components/walks/photo-prompt-sheet.tsx, apps/ios/src/components/walks/manual-walk-dialog.tsx, apps/ios/src/components/walks/pet-pill.tsx, apps/ios/src/components/pets/form-sheet.tsx, apps/ios/src/components/walks/walk-tracking-view.tsx, apps/ios/src/components/pets/receipt-scanner.tsx) SHELL-11 / XCUT-17: Migrate the hand-rolled transparent slide modals to <Dialog visible onClose title footer>. These are the family create/join dialogs, delete-account, post-composer, photo-prompt-sheet, manual-walk-dialog and pet-pill. For the full-screen modals (form-sheet, walk-tracking-view, receipt-scanner), set animationType={useReducedMotion() ? 'none' : 'slide'}. Dialog already handles keyboard avoidance and the safe area.
- [family / social / feed / settings lanes] (apps/ios/app/family.tsx, apps/ios/app/friends/index.tsx, apps/ios/src/components/feed/post-card.tsx, apps/ios/src/components/feed/post-menu.tsx, apps/ios/src/components/settings/family-section.tsx) SHELL-12: Replace the Alert.alert confirms and the hard-coded '取消', '刪除', '移除' and '失敗' strings with confirm() / alertError() from '@/lib/confirm'. Post delete: title Common.delete, message = first 80 characters of the post text, confirmLabel Common.delete, destructive. Friend remove: Friends.removeConfirm, destructive.
- [feed / social / photos / leaderboard / walks lanes] (apps/ios/app/feed.tsx, apps/ios/app/friends/index.tsx, apps/ios/app/photos.tsx, apps/ios/src/components/leaderboard/dog-leaderboard.tsx, apps/ios/src/components/leaderboard/human-leaderboard.tsx, apps/ios/app/(tabs)/walks.tsx) SHELL-15: Move the hand-rolled empty states to the EmptyState card variant with the icons web uses. Feed: Newspaper, Feed.empty.title/subtitle, action with icon PenSquare. Friends: Users, Friends.emptyFriends.* and Friends.emptyRequests. Photos: Images, Photos.empty.title. Leaderboard empties likewise. In (tabs)/walks.tsx the no-pet empty state still has hard-coded Chinese and uses the hero look. Web uses the card with icon Footprints, title Walks.needPetTitle, description Walks.needPetDescription and an action with icon Plus; pass icon={Footprints} with action={{label, onPress, icon: Plus}}.
- [leaderboard / social lanes] (apps/ios/app/(tabs)/leaderboard.tsx, apps/ios/src/components/leaderboard/dog-leaderboard.tsx, apps/ios/src/components/leaderboard/human-leaderboard.tsx, apps/ios/app/friends/index.tsx, apps/ios/src/components/leaderboard/segmented.tsx) SHELL-18: Swap Segmented for Tabs from '@/components/ui'. The options/value/onChange props are identical, so only the import and component name change. Then reduce segmented.tsx to a re-export or delete it once no file imports it (not done in this lane, as instructed). Alias Tabs where expo-router's Tabs is also imported.
- [onboarding / family / feed / pets / walks / settings lanes] (apps/ios/app/onboarding.tsx, apps/ios/app/family.tsx, apps/ios/src/components/settings/family-section.tsx) SHELL-19: Adopt Input, Textarea and FieldLabel (or Field) for text fields, starting with onboarding and the family create/join dialogs, then comment-section, form-sheet, delete-account-section and manual-walk-dialog. Remove the per-file input styles.
- [lead / QA] (apps/ios/src/components/ui/Button.tsx) Visual regression check after the Button change. Default radius is now 8 (web rounded-lg), md padding is 16 instead of 24, and label weight is 500 instead of 700. Existing callers: family.tsx, family-section.tsx, dog-leaderboard.tsx, human-leaderboard.tsx, and the EmptyState hero CTA, which keeps its pill shape and uses weight 800. Callers can now pass lucide icons with icon={Plus} instead of hand-rolling icon rows.

## impl:A3-data-scope
### api_notes
FAMILY CONTEXT. Import { useFamily, FamilyProvider, type FamilyContextValue, type FamilyStatus } from "@/state/family-context".
useFamily() returns:
- family: Family | null. Null means personal mode when status is "ready". While loading or error it holds the last known family.
- families: Family[]
- currentFamilyId: string | null. Only authoritative when status is "ready".
- status: "loading" | "ready" | "error"
- error: unknown. The read error when status is "error".
- loading: boolean. Back-compat; equals status === "loading". It is true during refresh().
- scopeVersion: number. Increments on every successful refresh or switch.
- switchingFamilyId: string | null. Use for pill busy state.
- dataRevision: number
- getDataRevision(): number. Synchronous read.
- markDataChanged(): number. Bumps the revision and returns the new value; every other mounted data hook refetches on its next focus.
- refresh(): Promise<void>. Never rejects; failure lands in status "error". Its identity is stable per uid, which matters because the join screen effect depends on it.
- switchFamily(familyId): Promise<void>. Writes users/{uid}.currentFamilyId, re-reads the family, and switches every consumer. It REJECTS if the write fails (scope unchanged), so callers must catch. It is a no-op if that family is already active.
The provider waits for auth initializing to finish and retries itself on app foreground while in error. A user change is never served the previous user's scope.

FAMILY SCOPE. Import { useFamilyScope, useScopedData, scopeKeyOf, type FamilyScope, type ScopedData, type ScopedFetcher, type ScopeArgs } from "@/lib/use-family-scope".
useFamilyScope() returns { uid, familyId, family, status, scopeReady (uid present AND status ready), scopeKey (string | null), error, retry (= context refresh), dataRevision, getDataRevision, markDataChanged }. This is the ONLY way data code should get familyId. resolveCurrentFamilyId stays exported only for _layout's one-shot landing decision.
useScopedData<T>(opts) takes:
- initial: T
- fetch: (scope: { uid, familyId }, previous: T | null) => Promise<{ data: T; error?: unknown }>. previous is the last data for the same scope; use it to keep a failed source's old value.
- variant?: string
- focusRefresh?: boolean, default true
- minIntervalMs?: number, default 15000
- isStale?: () => boolean, an extra staleness signal
useScopedData returns ScopedData<T>:
- data: only data for the current scope; initial otherwise.
- uid
- loading: true until the current scope has loaded; false on scope error.
- refreshing
- error: the scope error, else the last load error (data kept).
- scopeReady, familyId, family, scopeStatus
- refresh(): pull-to-refresh and retry; sets refreshing and re-resolves a failed scope first.
- reload(): silent reload.
- reloadAfterWrite(): markDataChanged() plus a silent reload of this screen.
- mutate(fn): local update.
- markChanged(): marks other screens stale without reloading this one.

FOCUS REFRESH. Import { useFocusRefresh, isDataStale, FOCUS_REFRESH_MIN_INTERVAL_MS } from "@/lib/use-focus-refresh".
- useFocusRefresh({ enabled?: boolean, isStale: () => boolean, onStale: () => void }): runs on screen focus and on app foreground while the screen is focused.
- isDataStale(lastLoadedAt, loadedRevision, currentRevision, minIntervalMs = 15000).
- Hooks built on useScopedData already include this; screens do NOT need to add useFocusEffect.

useWalksData() from "@/lib/use-walks-data". All previous fields are kept (loading, pets, walks, familyId, activePet, hasMultiplePets, selectPet, goalMin, todayProgress, streakDays, weekDayFlags, weekKm, weekCount, weeklyAvgMin, autoPhotoShare, todayIdx, refresh). Added:
- refreshing, error, scopeReady, scopeStatus, family
- walksComplete: boolean. Whether walks holds the full history.
- loadAllWalks(): Promise<void>. Call before showing the full "view all" list.
- reload(), reloadAfterWrite()
Notes:
- refresh is now pull-to-refresh: Promise<void> that sets refreshing.
- Write paths (WalkTrackingView, ManualWalkDialog) must gate on scopeReady and use onSaved={reloadAfterWrite}.
- The type is exported as WalksData.

usePetsData() from "@/lib/use-pets-data". Kept: loading, refreshing, pets, reminders, expenses, walks, familyId, activePet, hasMultiplePets, selectPet, refresh. Added: error, scopeReady, scopeStatus, family, reload, reloadAfterWrite.
- Forms' onSaved should call reloadAfterWrite.
- PetForm, ReminderForm and ExpenseForm should open only when scopeReady. The empty-state CTA already falls back to refresh() when not ready.
- When error && pets.length === 0, render Error.title + Error.retry → refresh instead of the empty state.

useFeedData({ home }) from "@/lib/feed-data". Kept: loading, refreshing, pets, posts, walkStatus, familyId, familyName (now from the context family), hasMoreThanHome, refresh, removePost, removeBlockedAuthor. Added: error, scopeReady, scopeStatus, family, reload, reloadAfterWrite, and reloadAfterPost() (use for PostComposer onPosted; posts-only invalidation of the other feed screen).

useHealthRecords(petId: string | null, reloadKey = 0) from "@/lib/use-health-records" returns { loading (first load for this pet only), records, error, refreshing, reload(): Promise<void> (silent), refresh(): Promise<void> (sets refreshing) }.

LIB FUNCTIONS
- listHealthRecords(petId, filter?: { type?, max?: number | null }): default max HEALTH_RECORDS_LIMIT = 200; null means unbounded.
- listWalksForScope(familyId, uid, max: number | null = 50): null means no limit.
- listWalksForStats(familyId, uid): Promise<{ walks, complete }>; WALKS_STATS_INITIAL_LIMIT = 60.
- loadFamilyScope(uid): Promise<{ families, family }>. One users/{uid} read; throws on real failures.
- listMyFamilies now skips permission-denied families and rethrows other errors.

No Firestore document shapes or query shapes changed beyond adding an optional limit.
### handoffs to screen lanes (apply the ones touching files you own)
- [walks UI lane] (apps/ios/app/(tabs)/walks.tsx) Add RefreshControl (refreshing/refresh from useWalksData) to the main ScrollView and wrap the 0-pet EmptyState in one. When error && pets.length===0, render an error card (t('Error.title') + Button t('Error.retry') → refresh) instead of the add-pet empty state. Disable WalksStartCta when !scopeReady. The expanded 'view all' list can now be hundreds of rows: cap it or use a FlatList. Hard-coded zh strings remain.
- [walk tracking lane (TRACK-11)] (apps/ios/src/components/walks/walk-tracking-view.tsx) Snapshot pet and familyId when the session starts and save with the snapshot. After a family switch or join mid-walk, the hook clears the old scope's pets, so pet can become null and handleSave() would currently call onClose() and drop the walk. Do the same in manual-walk-dialog.
- [pets UI lane] (apps/ios/app/(tabs)/pets.tsx) Error card when error && pets.length===0. Gate header add-pet, PetSwitcher add and FAB on scopeReady. Wrap PetsEmptyState in a ScrollView with RefreshControl (onPullRefresh already reloads health too).
- [home/feed UI lane] (apps/ios/app/(tabs)/index.tsx, apps/ios/app/feed.tsx) Show error/retry UI from useFeedData().error (currently HomeEmptyState or the empty feed shows on failure). Add RefreshControl to the HomeEmptyState branch and to the feed empty branch.
- [photos lane (XCUT-13)] (apps/ios/app/photos.tsx) Keep failedSources from listMyPhotoAssetsWithStatus and render the t('Photos.partialError') banner. Add an error card; load failures are now caught silently. When scope status is 'error', pull-to-refresh should call useFamily().refresh.
- [leaderboard lane (XCUT-14)] (apps/ios/src/components/leaderboard/dog-leaderboard.tsx, apps/ios/app/(tabs)/leaderboard.tsx) Add an active guard and .catch to the listFriendUids and AsyncStorage reads, and include nonce in deps.
- [settings/family UI lane] (apps/ios/src/components/settings/family-section.tsx, apps/ios/app/family.tsx) XCUT-17: Modal animationType={reduceMotion ? 'none' : 'slide'} for CreateDialog and JoinDialog. XCUT-12: replace hard-coded Alert('失敗', …) with t('Error.title') / t('Family.actionFailed'), plus '取消' and '關閉' in family.tsx. XCUT-16: 44pt remove-member target. Switch pills already have a busy state and error alert.
- [i18n lead] (packages/shared-i18n/src/messages/{zh-TW,en}.json) Add Family.actionFailed = 操作失敗，請稍後再試 | Something went wrong. Please try again. It is already used by family-section.tsx and family.tsx.
- [social/settings lanes] () After writes outside the data hooks (friend add/remove, walk-pref toggle, pet edits from other screens), call useFamily().markDataChanged() so mounted tabs refetch on their next focus. Optionally have settings photos-preview refetch on focus when dataRevision changes.

## impl:A2-auth-guest-i18n
### api_notes
LOCALE: import from "@/lib/i18n"
- setAppLocale(locale: Locale): Promise<void> switches t() and activeLocale synchronously, notifies subscribers, then persists to AsyncStorage "mango.locale". The root Stack in app/_layout.tsx is keyed by locale, so every mounted screen remounts with the new strings and the route stack is preserved.
- restorePersistedLocale(): Promise<Locale> is idempotent and never rejects. The root layout already calls it and shows the splash until it resolves.
- getActiveLocale(): Locale is always current; prefer it over the activeLocale binding in new code.
- activeLocale is now `export let`, a live binding that stays backward compatible.
- isLocaleRestored(): boolean; subscribeLocale(fn): () => void.
- useLocale(): Locale re-renders the caller when the locale changes. useLocaleRestored(): boolean.
- SUPPORTED_LOCALES, LOCALE_STORAGE_KEY ("mango.locale"), type Locale.
- t and scoped are unchanged.

LANGUAGE UI: import from "@/components/settings/language-switcher"
- LanguageSwitcher({ style? }) is the web 繁中|EN toggle with no sliding indicator.
- LanguageSection({ style? }) is the full Settings card row (radius.xl, hairline, shadows.card, padding 16): Globe 20 brandDeep + t('Settings.languageLabel') on the left, LanguageSwitcher on the right. Mount it after BlockedUsersSection, as web does.

GUEST: import from "@/components/auth/guest-upgrade" or the "@/components/auth" barrel
- GuestUpgradeProvider({ children }) is already mounted in _layout.tsx as AuthProvider > GuestUpgradeProvider > FamilyProvider.
- useGuestUpgrade(): { openUpgrade(): void }. openUpgrade is a no-op for non-anonymous users. It opens the shared bind dialog (Google/Apple link). On linked the dialog closes; the auth listener re-bootstraps and the root navigator returns the user to the same pathname. On switched it shows the conflict notice.
- GuestLockedNotice({ feature: 'post'|'reactions'|'friends'|'family', style? }) renders a Lock icon, the Guest.locked.<feature> text and a primary sm Guest.upgradeCta button. Exported type: GuestLockedFeature.
- GuestUpgradeNudge({ style? }) renders null unless the user is anonymous, has at least 1 personal pet and has not dismissed it (AsyncStorage key GUEST_NUDGE_DISMISS_KEY = 'mango.guestNudgeDismissed'). It has a default marginBottom of 16, like web's mb-4, and re-checks on screen focus via useFocusEffect, so it must be rendered under the root navigator (any tab or screen). It is also re-exported from "@/components/auth/guest-upgrade-nudge".
- GuestUpgradeSection (settings) keeps the same export and props (none) and now just calls openUpgrade.

AUTH LIB: "@/lib/auth"
- Adds class SignInCancelledError (code 'auth/canceled') and isSignInCancelled(err): boolean.
- signInWithGoogle, signInWithApple, upgradeGuestWithGoogle and upgradeGuestWithApple now reject with SignInCancelledError when the user backs out. Their signatures are unchanged.
- All 28 tests in apps/ios/scripts/auth-push.test.cjs still pass, and no new imports were added to auth.ts or auth-context.tsx.

AUTH-ERRORS: "@/components/auth/auth-errors"
- signInErrorMessage(err) and upgradeErrorMessage(err) return string | null, where null means the user cancelled and nothing should be shown.

AUTH CONTEXT
- useAuth() now also returns isGuest: boolean (= !!user?.isAnonymous).

ONBOARDING LIB: "@/lib/onboarding"
- ONBOARDED_KEY is unchanged.
- PENDING_JOIN_KEY ('mango.pendingJoin').
- normalizeJoinCode(raw): string | null.
- joinCodeFromPath(pathname): string | null.
- rememberPendingJoin(code): Promise<void>.
- takePendingJoin(): Promise<string | null> reads and clears the code, with a 1h TTL.
- clearPendingJoin(): Promise<void>.

MISC
- withAlpha(hex, alpha) in "@/components/auth/color" converts a mango token to rgba, the equivalent of Tailwind's /NN.
- GoogleIcon({ size? }) and AppleIcon({ size?, color }) are in "@/components/auth/provider-icons".

ROUTING (_layout.tsx) landing order on the auth→app transition:
1. A pending invite goes to /join/{code}.
2. The same uid re-bootstrapping (guest link or profile retry) resumes the last pathname.
3. A guest goes to /(tabs)/walks.
4. A user who is not onboarded and has no family goes to /onboarding.
5. Everyone else goes to /(tabs)/walks.

TYPECHECK
- `npx tsc --noEmit` in apps/ios is clean across the whole project.
### handoffs to screen lanes (apply the ones touching files you own)
- [Settings lane] (apps/ios/app/(tabs)/settings.tsx) Mount <LanguageSection /> (from @/components/settings/language-switcher) after BlockedUsersSection and before ExportDataSection, for guests too, as on web. Also replace the hard-coded '設定' header with t('Nav.settings'), the guest name '訪客' with t('Guest.displayName') (new key, XCUT-12), and the sign-out activeLocale ternary Alert with catalog keys.
- [Settings lane] (apps/ios/app/(tabs)/settings.tsx) Render <GuestLockedNotice feature="family" /> for guests in place of hiding FamilySection, as web family-section.tsx:205 does (SHELL-2).
- [Settings lane] (apps/ios/src/components/settings/push-toggle.tsx) Replace t('Common.retry'), which is missing from the catalog, with t('Error.retry') at line ~69, and move the activeLocale ternaries (lines 42, 62, 70) into catalog keys (XCUT-5/XCUT-12).
- [Walks / Home tab lanes] (apps/ios/app/(tabs)/walks.tsx, apps/ios/app/(tabs)/index.tsx) Render <GuestUpgradeNudge /> (from @/components/auth/guest-upgrade) at the top of the scroll content, as web mounts it on every /app page (SHELL-2).
- [Feed / Friends lanes] (apps/ios/app/feed.tsx, apps/ios/src/components/feed/post-card.tsx, apps/ios/app/friends/index.tsx) Gate guest community write paths with GuestLockedNotice from @/components/auth/guest-upgrade, matching web: feed composer feature='post' (web feed/page.tsx:110), post-card reactions and comment input feature='reactions' (web post-card.tsx:143), and the friends screen feature='friends' (web friends/page.tsx:136).
- [Import-wizard lane] (apps/ios/app/onboarding.tsx) Personal-data import wizard (SHELL-8): hook into app/onboarding.tsx handleCreatedOrJoined(newFamilyId) at the marked 'SHELL-8 HOOK POINT'. Open the wizard for newFamilyId, and call handleImportComplete() from the wizard's onComplete and onClose.
- [Lead (i18n catalogs)] (packages/shared-i18n/src/messages/{zh-TW,en}.json) Add new catalog keys to both locales: Auth.profileError.body, Auth.profileError.revokeFailed, Settings.languageLabel ('語言 / Language' in both). They render as missing-key markers until added.
- [Lead / release] (apps/ios/app.json) Optional: add expo.ios.infoPlist.CFBundleLocalizations ['zh-Hant','en'] so system-localised UI (the native Apple button label, permission prompts) can follow per-app language. The in-app switcher already covers app copy.
- [Web lane] (apps/web/src/app/app/walks/page.tsx) Web has the same missing-key bug: Common.retry is called at apps/web/src/app/app/walks/page.tsx:504 and walk-tracking-view.tsx:1086 (XCUT-5 note).
