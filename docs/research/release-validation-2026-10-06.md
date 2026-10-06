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

Deployment and production smoke are **pending** at this commit; this document
will be updated with actual results after verification.

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
