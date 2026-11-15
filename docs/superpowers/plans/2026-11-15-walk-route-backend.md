# Walk route backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver a callable-only route lifecycle with protected current-family reads and idempotent offline uploads.
**Architecture:** `walkRouteSessions/{id}` owns immutable start/expiry and terminal lifecycle; immutable ordered `chunks` hold route samples. `walkLiveLocations/{id}` contains only latest position. Finalize alone creates `walks/{id}`. Persistent session tombstones prevent resurrection.
**Tech Stack:** Firebase Admin/Functions v2, Firestore rules, TypeScript, node:test emulator.
**Spec:** docs/features/ios-walk-route-tracking-v1.md

## Global Constraints
- No UI, deployment, dependencies or lockfile changes.
- Original start + 6 hours hard expiry; latest sample + 5 minutes read expiry.
- Family access uses current membership; historical points unavailable to others before finalize.
- Existing legacy Walk writers/delete remain compatible; route-backed IDs cannot be directly recreated.
- Offline end is terminal, uploads can continue until explicit finalize; delete is permanent.

## Review Focus
- Offline start/end replay after hours must never publish live: task 1.
- Concurrent uploads/finalize/delete cannot double count or resurrect: task 1.
- Owner leaving family loses family data access, even with old token: task 2.
- Legacy Walk deletion must clean chunks and prevent recreation: task 2.
- Account deletion cannot retain route coordinates: task 2.

### Task 1: Transactional lifecycle and shared contract
**Files:** create `functions/src/walk-routes.ts`, `functions/tests/walk-routes.test.cjs`; modify `functions/src/index.ts`, `packages/shared-types/src/index.ts`.
**Interfaces:** `manageWalkRoute` callable with `op: start|append|publish|end|finalize|delete`; sessionId stable globally unique id. Epoch milliseconds in input; Timestamp in Firestore. append uses sequential chunkIndex and <=250 ordered points with segment integer. finalize takes expected chunk/point counts and existing client-computed summary (distanceKm/durationMin/score).
- [x] Write tests for start replay immutable bounds, offline ended backfill, append idempotence/conflict/order, finalize exactly one Walk, invalid points, expiry and auth/account fences.
- [ ] Initial lifecycle RED before implementation was not observed: dependency/network setup blocked execution, and implementation preceded the first run. Recorded as a TDD workflow deviation; not claimed complete.
- [x] Implement bounded validation and transactions, export callable, shared discriminated contracts.
- [x] Run targeted emulator tests and functions typecheck.

### Task 2: Read permissions, deletion and handoff
**Files:** modify `firestore.rules`, `functions/src/index.ts`; extend tests; create `docs/features/walk-route-backend-contract.md`.
**Interfaces:** finalized Walk carries `routeVersion: 1`; route parent references matching Walk. Cleanup retains non-location tombstone; old direct delete handled by retryable trigger.
- [x] Write rules tests for current family, private history, nonmember/removed/guest, expiry, direct mutations/recreation and legacy deletion cleanup.
- [ ] Initial rules RED before implementation was not observed; first full suite exposed two fixture failures corrected below.
- [x] Implement read rules, reserved IDs, cleanup trigger and account cleanup integration.
- [x] Run complete backend emulator suite plus Web/iOS/Functions typechecks; document API, costs, limits, remaining device/UI acceptance.

## Execution ledger
- User authorized implementation; parent handles whole-branch review. No additional plan approval required.
- Pre-flight: both tasks share sessionId/status/routeVersion; task 2 protects the lifecycle from task 1.
- Commit/push/deploy omitted: implementation authorized, publication not requested.


### Completion / verification ledger

- Task 1: implemented and verified. Task 2: implemented and verified; root coordinated independent code review. Review found cleanup retry discoverability; fixed by retaining owner/pet IDs in coordinate-free tombstones, with injected failure/resume tests at helper and real account callable levels.
- Ruling: preserve existing client-computed distance/duration/score model rather than duplicate shared scoring in Functions; bounded numeric validation, exact manifest counts and immutable finalization are enforced.
- Ruling: removed family member may end/delete, but cannot upload/finalize family history; ownership transfer remains a PM decision.
- Added `listWalkLiveLocations` for usable family discovery: current membership checked before bounded single-index query; empty filtered pages can have next cursor. This addition followed RED (missing callable export) → GREEN. Evidence `/tmp/mango-route-discovery-red.log` and `/tmp/mango-route-targeted-final.log`.
- Initial full suite exposed a test-only Admin Timestamp passed to client SDK (fixed by reading Web snapshot) and a 1 ms emulator expiry fixture ambiguity (use explicit server reads and 60-second past margin). Production strict expiry rules were not relaxed. Exact controllable clock boundary is not claimed by that emulator fixture.
- `npm --prefix functions run build`: PASS.
- `npm run typecheck -w apps/web`, `npm run typecheck -w apps/ios`, `npx tsc --noEmit -p functions/tsconfig.json`: PASS.
- Direct modified shared source: `npx tsc --noEmit --skipLibCheck --target es2020 --module esnext --moduleResolution bundler packages/shared-types/src/index.ts`: PASS. This avoids relying solely on reused node_modules workspace symlinks.
- Focused route + account lifecycle: **13/13 PASS**, `/tmp/mango-route-integration-final.log`. Command: `PATH=/tmp/mango-jdk21/Contents/Home/bin:$PATH npm_config_registry=https://registry.npmmirror.com npx -y firebase-tools@15.32.1 emulators:exec --project demo-mango-security --config firebase.lifecycle-tests.json --only firestore,auth,storage 'node --test --test-concurrency=1 functions/tests/walk-routes.test.cjs functions/tests/walk-routes.integration.cjs'`.
- Complete backend lifecycle suite (before the final new account-route regression was added): **133/135 PASS**, `/tmp/mango-route-lifecycle-final.log`; same emulator command with `functions/tests/*.test.cjs functions/tests/*.integration.cjs`. Only failures are unchanged `r15-rules.test.cjs` tests “actual Web and iOS adapters add, switch and remove atomically, including concurrent callers” and “legacy REST whole-double counters support both adapters and optional normalization preserves data”, both `Unexpected module ./i18n` in the existing adapter loader. Not fixed in this slice.
- `git diff --check`: PASS. No manifest/lockfile changes; no commits, push, deploy, UI changes or device acceptance. Functions deps installed with existing lock; reused root/Web dependency links removed after verification to keep deliverable clean.
- Runtime setup used local Node 26.13.1 (package expects 22), temporary JDK21, firebase-tools15.32.1. No production service access. Runtime Node22 deployment smoke remains unverified.
- Handoff: `docs/features/walk-route-backend-contract.md`; approved source spec copied without modifying source checkout.
