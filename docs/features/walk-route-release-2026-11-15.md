# Walk route v1 release validation — 2026-11-15

Source: `cd3d51be5bd66e9bdb7e134000d3668998886dd7`, branch `codex/walk-route-backend`, rebased onto `bf8854d` (current main at release preparation). Latest warm Home/Walks changes retained; only conflict was two necessary imports, both kept.

## Completed

- Frozen lock install after rebase, Web/iOS typechecks, Functions compilation and 56 iOS regression tests passed.
- Branch pushed to existing `jabir95tsai/mango-pet-app` repository with explicit user authorization. Main was not pushed or merged.
- Linux App Hosting gate `route-gate-cd3d51b-20261115`: **READY** for the exact source commit. Build only, no Web rollout created. [Cloud Build evidence](https://console.cloud.google.com/cloud-build/builds;region=asia-east1/1d0ed9d6-bd3c-4405-ad12-f1efa54f9617?project=722604603606).
- Firebase target: **mango-pet-app**, Functions region **asia-east1**, runtime **Node.js 22**. Firestore rules released. `manageWalkRoute`, `listWalkLiveLocations`, `cleanupDeletedWalkRoute` created; `deleteUserAccount` updated. CLI completed successfully. Cleanup retry policy explicitly enabled as designed and tested.
- Production non-mutating smoke: both new callable HTTP endpoints returned **401 / UNAUTHENTICATED** for unauthenticated empty payload. This confirms endpoint reachability and auth rejection, not an authenticated device end-to-end flow.

## iOS build

EAS project `@jabir95tsai/mango-pet`, profile `preview` (standalone internal Ad Hoc, physical iPhone), app build version2. Signing profile active, contains one registered iPhone. No new device registration or distribution certificate replacement performed.

Build ID: `0870c3e7-3a99-495b-bd69-1059041d73ef`.
[Build page](https://expo.dev/accounts/jabir95tsai/projects/mango-pet/builds/0870c3e7-3a99-495b-bd69-1059041d73ef).

Status: **ERRORED** in Fastlane/Xcode signing. Existing Ad Hoc provisioning profile lacks Push Notifications / `aps-environment`. Dependency installation, prebuild and Pods passed. No usable IPA from this attempt.

Apple agreement restriction was resolved by the account holder. Enabled Push Notifications for the existing bundle and regenerated the same Ad Hoc profile; decoded profile confirms `aps-environment=production`, unchanged certificate and device set. Other capabilities remain unchanged.

Retry build: `7987199d-4e7d-46c4-a8b5-7027ab78c438`, same source commit and preview profile. [Retry build page](https://expo.dev/accounts/jabir95tsai/projects/mango-pet/builds/7987199d-4e7d-46c4-a8b5-7027ab78c438). Status: **FINISHED**. Xcode archive, signing and IPA export succeeded.

[Download IPA](https://expo.dev/artifacts/eas/Dtzr3mKWxxF_kxPm5B95NulKo7_23mdpvTHkGoMYu-k.ipa). Use the retry build page on the registered iPhone for installation. Device acceptance remains pending.

## Acceptance

Use the [single batch device checklist](ios-walk-route-implementation.md). Native GPS/background delivery, real map behavior, notifications, battery and authenticated family two-device flows remain user acceptance. Current Ad Hoc profile allows one registered iPhone; additional family iPhones require registration and a future profile/build update.
