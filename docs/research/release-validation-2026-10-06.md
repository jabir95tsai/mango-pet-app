# 2026-10-06 privacy and account lifecycle release

## Scope and source

Base: `248686f`. Backend coordinates this release; Web and iOS Bug Hunter
sessions supplied their own platform fixes. Existing unrelated main-checkout
document edits are preserved and excluded from the release.

- R03: public profiles reject email and push tokens; Web/iOS transactions move
  legacy fields to private contact without losing other devices. Server push
  lookup and invalid-token cleanup support the migration safely.
- R05: account deletion persists a checkpoint and lease, freezes client/Admin
  writers, resumes through a retrying server trigger, cleans descendants and
  owned comments, and fences late achievement/leaderboard writes. Post deletion
  has its own retry-safe descendant cleanup. Export adds comments, achievements,
  stats and photo download state. Storage owner deletion works again.
- R07/R09: iOS waits for profile bootstrap; first push permission is actionable;
  token refresh, account changes and logout preserve installation ownership.
- R06 follow-up: Web unsaved drafts can be discarded with confirmation and retry
  once on reconnection/return, without a permanent-error retry loop.

Implementation contracts and boundaries: [contact](../features/private-contact-hardening.md),
[account lifecycle](../features/account-data-lifecycle.md),
[callable guards](../features/deletion-callable-fence.md),
[leaderboards](../features/leaderboard-deletion-freeze.md),
[iOS](../features/ios-auth-push-lifecycle-fix.md),
[walk drafts](../features/walk-draft-recovery.md).

## Local verification

2026-10-06, integrated production-code head `36dafdf`:

- Functions build, Web and iOS TypeScript checks pass. Worktree checks use
  worktree-local package aliases to avoid reading the original checkout through
  shared dependency junctions.
- **116/116** combined Firestore/Auth/Storage emulator tests pass under Java 21
  and Firebase CLI 15.32.1, using `demo-mango-security` and
  `firebase.lifecycle-tests.json`.
- **52/52** additional module/React-handler regressions pass: iOS 28, Web 24.
- Main checkout fast-forwarded to `f166d6b`; `npm run build` passed including
  TypeScript, all 22 static generation jobs and standalone output normalization.
  The three unrelated document files were SHA-256 checked before/after merge.
- Expected denied-write logs and synthetic retry errors are negative tests,
  not release failures. Test commands are in `functions/tests/README.md`.

## Production preflight

Read-only preflight at 2026-10-06 02:05 UTC: main/origin main at `248686f`;
32 existing affected Functions ACTIVE on Node 22, two new triggers absent as
expected. No ERROR logs on affected services since 01:00 UTC. Web traffic remains
on `build-2026-10-05-004`.

Contact audit at 01:15 UTC: 24 public profiles, zero public email/token fields;
10 private contact profiles containing 10 device tokens. No migration writes
were necessary. Only counts are retained in release evidence.

The new comments.authorUid collection-group index must reach READY before the
new cleanup/export callers. Its existing collection index modes are preserved.
The walks.familyId group override merely codifies an existing production index.
Storage cross-service rules require the Firebase Storage service agent's minimum
`roles/firebaserules.firestoreServiceAgent` role. Deployment order: rules and
indices, affected producers/workers, deleteUserAccount last, then Web rollout.

## Backend production verification

2026-10-06 02:12–02:22 UTC (10:12–10:22 Asia/Taipei):

- Firestore ruleset `81d9ec84-a65f-4679-a55d-208f219e0e1a`; Storage ruleset
  `96cbe881-35ce-43be-a0d4-be08c0501592`. Both downloaded sources match local
  rules after newline normalization. Exact hashes and revisions are in
  [the production snapshot](release-state-2026-10-06.json).
- Explicitly added only `roles/firebaserules.firestoreServiceAgent` to the
  Firebase Storage service agent, preserving existing IAM bindings/conditions
  and checking the policy etag. The noninteractive CLI had skipped that grant;
  a read-only follow-up confirmed it, and real client uploads/deletes succeeded.
- All four declared comments.authorUid index modes reached **READY** before
  deploying consumers. Existing composite indices were preserved.
- **34/34 affected Functions ACTIVE**, Node 22, with all traffic on their new
  revisions. `deleteUserAccount` was deployed last. The three retrying handlers
  are `onAccountDeletionProgress`, `onPostDeletedCleanup`, `onCommentDeleted`.
  Two long-running admin services had no request logs since 02:00 UTC; normal
  producers had passed their old 60-second execution window before smoke.
- **7 production behavior groups + exact fixture cleanup PASS** using actual
  anonymous Auth, client SDK rules, callable HTTP and Eventarc delivery:

| Behavior | Observed result |
| --- | --- |
| Public/private contact | Public email/token writes denied; owner private writes work; another account cannot read/write them |
| Storage ownership | Owner image upload/delete succeeds; another owner cannot delete |
| Post delete trigger | Descendants, throttle and unshared canonical photo removed; peer's live photo reference retained |
| Export HTTP | Owned comments, achievements, stats and photoDownloadState present; schemaVersion remains v1 |
| Account delete HTTP | Auth, profile descendants, quota and own comment removed; peer account and shared photo retained |
| Cached old ID token | Profile/contact recreation, orphan-cleanup callable and upload denied |
| Server recovery | An interrupted confirmed checkpoint completes without another client request |

Fixtures were confined to three new guest identities, private posts, a pet and
known owner Storage object names. No notifications were enabled. All fixture
Auth identities, content, descendants and objects were removed; **three completed
server tombstones intentionally remain** to fence late events. The production
profile count returned to 24; public contact fields remain zero and the original
10 private tokens remain. No real-user migration writes were necessary.

One local smoke attempt stopped before creating any fixture because Admin
Storage rejects a custom token credential. The harness switched to the Google
Cloud Storage client with the existing CLI OAuth credentials in memory; the
complete rerun passed. No provider or application credential setting was changed.

There were **three HTTP 500 request logs** from the deletion-progress trigger
during concurrent fixture lease ownership. The corresponding stderr entries all
say `Account deletion is already running`; all three checkpoints reached
`complete`. These are expected retry contention, **not a zero-error-log claim**.
No other affected service had ERROR entries in the checked release window.

## Web rollout and follow-up checks

- Main pushed to `106e898cc10f2b85a8d223cd45a2f5eb3d5d7c40`.
- At **02:29:02 UTC on October 6**, App Hosting `build-2026-10-06-001` was
  READY and `rollout-2026-10-06-001` SUCCEEDED for that exact source hash,
  serving **100%** of production traffic.
- A real browser reload of the public login page displayed the expected
  sign-in options and policy links, with zero captured console ERROR entries.
  This does not claim browser OAuth or a GPS walk flow was tested.
- Delayed fixture audit at 02:26 UTC found no resurrected fixture content,
  empty cleanup queues and three completed tombstones. A fresh log query over
  **02:22–02:26 UTC** found zero new ERROR entries on affected services.
- Automatic approval review exhausted its usage allowance before the final
  documentation update could execute. On October 8, the resumed session
  confirmed main/origin main still at `106e898`, both rules matching source,
  all 34 Functions ACTIVE and that same Web build still serving 100% traffic.
- The longer October 8 observation window found pre-existing scheduled-job
  failures that the short release smoke window did not cover. Both signatures
  occur before the October 6 deployment. See the
  [October 8 follow-up](release-validation-2026-10-08.md) for repairs and evidence.

The original three uncommitted main-checkout documents remain excluded from
release commits. No dependency, lockfile, App Hosting environment or native
build configuration changed in this release.

## Remaining boundaries

- iOS code requires the next App build. No EAS build, real Apple/Google login,
  APNs delivery or native permission UI has been verified in this batch. The
  existing APNs entitlement/configuration release gap still needs DevOps work.
- Real GPS and iOS Safari/PWA stop/reconnect behavior still need device testing.
- Storage cleanup deliberately retains shared references and unknown formats.
  Firestore references and Storage deletions cannot form one cross-service
  transaction; late-reference races remain documented. Historical orphan files
  are not automatically swept. Cleanup summary counts cover the last pass.
- Account checkpoint tombstones remain to block stale credentials/late writers.
  Multiple-account abuse, invite-code entropy/expiry, R08/R11/R15 and R19 CI are
  separate pending work. This release does not close the whole project review.
