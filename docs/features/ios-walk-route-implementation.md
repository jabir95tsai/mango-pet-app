# iOS walk routes v1 implementation and device handoff

2026-11-15. Implements [approved spec](ios-walk-route-tracking-v1.md) using [backend contract](walk-route-backend-contract.md). Work stays on `codex/walk-route-backend`; no deployment or device build initiated.

## Delivery

- Existing recorder extended with complete segmented route capture, original six-hour deadline, durable native API outbox and stop-before-backfill ordering.
- Explicit per-walk live sharing, default off; background/foreground/timing-only capability messages and recovered-session behavior.
- MapKit history route, segment gaps and singleton fixes, start/end markers, legacy/manual route states.
- Current-family latest locations, server authorization, expiry and staleness, network/background/scope clearing, bounded continuation pages.
- Return-to-start local notification: departed >200m, returned within100m, valid continuous dwell5min, once per session; inline reminder when notification permission unavailable.

## Native configuration and compatibility

Added Expo bundled-compatible react-native-maps1.27.2, expo-notifications~57.0.22, NetInfo12.0.1 and native plugins. MapKit uses the default iOS map provider, no Google Maps key. Existing Firebase native SDK remains authority.

References consulted: [Expo notifications](https://docs.expo.dev/versions/latest/sdk/notifications/), [react-native-maps installation](https://github.com/react-native-maps/react-native-maps/blob/master/docs/installation.md); installed Expo bundledNativeModules.json fixes versions. Native permission and callback behavior still needs device verification.

Dependency/lock changes require the repository Linux App Hosting build gate before merge. This Mac has no Docker runtime; no branch push/build API invocation or rollout has occurred. macOS Metro export is not the Linux gate. New native dependencies require a rebuilt app; an old installed development client does not prove this change runs.

## Batch device acceptance (all pending)

- Two family accounts/two iPhones: share off vs on, names and capture timestamps, 15–30s update target, stale after60s, hide at5min/original6h.
- Lock screen and switch apps during a long walk (>500 accepted samples); preserve start and all segments; verify distance does not cross gaps.
- Airplane mode while recording, offline end, restart and reconnect: one Walk, complete history, no late live replay; retry unknown finalize outcome.
- Revoke location permissions and notification permission; foreground/timing-only fallback; no phantom route or blocked finish.
- Depart >200m then return within100m and dwell5min: one notification, tap current walk, no auto-end; leave radius or lose fixes resets dwell; restart never duplicates.
- Six-hour deadline including suspended callback delivering pre/post-deadline points; stop capture/sharing, retain pre-deadline fixes.
- Remove family member, change family/account, background viewer or lose network while requests pending: clear rendered family data, reject late results, re-authorize reconnect.
- Legacy/manual/no-points route, isolated middle fix, multiple segments, >10 filtered live pages, large text, VoiceOver and Reduce Motion.
- End/discard/recover/offline draft races; photos, notes, leaderboard and auto-post links preserved.
- Measure battery/thermal behavior and GPS drift in real streets. No unconditional guarantee when OS kills app, phone powers off or no valid fixes exist.

## Rollout order

Backend rules/functions must be deployed and verified before enabling the new client. Then pass Linux gate, produce one phase device build and run the list above. No deployment or merge is represented as completed by this document.

## Observed verification

- Frozen-lock full workspace `npm ci --ignore-scripts --no-audit --no-fund`: PASS (1228 packages). npm registry mirror was used for network reachability; no persistent registry setting.
- Web and iOS TypeScript checks: PASS.
- Combined auth/push, tab gestures, route pure logic, native-module boundary, route-reader tests: **56/56 PASS**. Command: `node --test apps/ios/scripts/auth-push.test.cjs apps/ios/scripts/tab-gestures.test.cjs apps/ios/scripts/walk-route.test.cjs apps/ios/scripts/walk-route-native.test.cjs apps/ios/tests/walk-route-reader.test.cjs`.
- Final iOS and Web Metro exports: PASS. These are bundle checks, not native compilation/device checks.
- Independent review fixes verified: isolated map points, bounded pagination continuation, discard never deleting saved server Walk, original-deadline batch retention, resume sharing and persisted once-only reminder.
- `git diff --check`: PASS.
- Linux App Hosting build gate, native compile, real GPS/background/notifications/MapKit visual checks, two-device production API validation: NOT RUN. Backend APIs remain undeployed. No claim of release readiness.
- Native boundary tests use mocked native transports/storage and controlled clocks; they execute production TypeScript but do not prove OS behavior.
- Local-only discard suppresses route retries without deleting an already-saved server Walk. An incomplete server route may remain private until existing account/route cleanup; no new retention policy was invented.
