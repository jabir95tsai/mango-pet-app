# R15 authorization and atomic reactions — 2026-10-08

Baseline: `1a1f1fd`. Role: Backend (shared data adapters; no UI changes).

**Follow-up correction:** the original numeric-value audit missed two integral
double counters, and native RN Firebase uses double increment transforms. See
[numeric compatibility repair](reaction-number-compat-2026-10-08.md) for the
confirmed regression, data repair, rule correction and additional protocol test.

## Verified findings and implementation

- Walk create previously authorized only the caller's family, not the referenced
  pet. Create now checks the parent pet, matching personal/family scope, active
  pet owner and caller identity in both `walkerUid` and `ownerUid`.
- Walk update previously allowed arbitrary fields. Only notes/photos may change,
  with current pet access rechecked. Identity, score, time and metrics cannot be
  rewritten by a client after creation.
- Any real user could previously change another post's reaction counts. Both
  shipped adapters now atomically write the reaction and exact counter deltas.
  Rules verify before/after reaction state, all five counts, parent visibility,
  blocked/guest restrictions, UID, emoji and server timestamp.
- Author updates cannot bypass counter validation or transfer post ownership.
  New posts cannot seed reaction/moderation/comment counters.
- No new collections, indexes or Functions. No API signature changes.

## Validation

- Combined Firestore/Auth/Storage emulator: **131/131**, zero skips. Includes
  11 new cases, actual Web/native-adapter execution, concurrent reactors,
  switch/remove/retry, forged count/negative/mixed writes, inaccessible/orphan
  posts, guest/blocked callers, pet scope/identity and immutable walk updates.
- Existing platform handlers: **52/52**. Web and iOS typechecks and Functions
  build pass. Native transport is adapted to Web SDK; this is not device proof.
- Updated existing fixtures to include real parent pets, zero post counters
  and valid atomic reactions; deletion-fence positive and negative checks remain.
- An initial concurrent absolute-count write failed rules evaluation; using
  atomic increment transforms resolved the reproduced failure. A native test
  transpiler interop setting was corrected before the full passing run.
- The atomic design follows [Firebase transaction guidance](https://firebase.google.com/docs/firestore/manage-data/transactions).

## Read-only production audit (07:02 UTC / 15:02 Taipei)

- 87 posts / 182 reactions: 0 mismatched count maps, 0 malformed reactions.
- 24 profiles: 0 public contact fields. 14 pets: 0 missing ownerUid.
- 6 deletion markers: 0 IDs overlap existing profiles.
- Deployed Firestore and Storage rules match the baseline. Existing Web traffic
  is 100% on build-2026-10-08-001. Project ERROR logs since 03:26 UTC: 0.
- Only leaderboard service logs appeared in the schedule query. Deployment logs
  alone do not prove a completed scheduled invocation or notification delivery.
- No user data modified during this audit. Counts only; no user content recorded.

## Release sequence and compatibility

Publish the new Web adapter first (it works under the old rules), confirm rollout,
then deploy Firestore rules. Native adapter requires the next iOS binary. Old
Web tabs/native binaries using independent count writes will be denied by the
new rules; refresh Web / install the new native build. No insecure fallback.

### Published and verified

- Code commit `8dbef49` fast-forward merged to main and pushed. App Hosting
  `build-2026-10-08-002` READY / `rollout-2026-10-08-002` SUCCEEDED, 100% traffic
  confirmed at 07:11 UTC. Browser login page renders, console errors: 0.
- Firestore rules published at 07:11:48 UTC, ruleset
  `fadb1970-1998-4d9a-9b3c-7642c15a357b`. Remote source equals local rules;
  unchanged Storage source also equals local. No Functions redeployment needed.
- **4 production guest-walk behavior groups + cleanup pass:** personal create
  and recap, foreign/missing pet denial, immutable score/pet/walker/family,
  owner deletion / outsider denial. Real-user reaction writes remain validated
  by the actual adapters against emulator rules, not production OAuth.
- First smoke omitted `confirmDisplayName` when cleaning up and failed that
  step; later log inspection identified the observed HTTP 500 as Cloud Run
  instance unavailability, not an observed argument-validation response.
  Those two fixture accounts were recovered through the existing confirmed
  deletion checkpoint/worker. Corrected smoke then passed including callable
  cleanup. This was a verification-script correction, not a product code change.
- Final read-only audit at 07:18:26 UTC: all **4** temporary Auth users removed,
  0 remaining fixture documents/descendants, 4 completed permanent tombstones.
  No existing user accounts or records were deleted.
- Do not interpret this release as zero ERROR: 07:11–07:18 UTC contained **6**
  ERROR request entries: 1 failed initial cleanup request and 5 deletion-worker
  HTTP 500 retries. Follow-up classified 3 of the 6 as Cloud Run "no available
  instance" (including the initial request), and the other 3 as worker lease
  contention. All four checkpoints are complete. No other service appears
  in that error window. Tombstones are deliberately retained by the lifecycle.

The later documentation-only commit may trigger another automatic Web build;
the source code above is the version verified by this release evidence.

## Remaining work / handoff

- **R15 remains partial:** initial walk score is still client-computed. Backend
  must establish server-authoritative scoring before treating leaderboard inputs
  as tamper-resistant. GPS measurements themselves are not attestations.
- Existing malformed walks are retained; inaccessible/deleted-pet historical
  walks may remain readable/deletable but recap editing is denied.
- R08 family scope / R11 per-pet progress: Web/iOS Bug Hunter, including stale
  response tests and two-pet/two-walker acceptance. No UI/hooks changed here.
- R17 photo reference index: confirmed current deletion scans 11 projections;
  Backend follow-up needs backfill, dual-write, reconciliation and race-safe
  fallback before removing the global scan.
- Moderation permanent counter errors still throw with trigger retry enabled;
  Backend follow-up needs a durable quarantine/replay contract, preserving
  transient retries. Multi-account invitation/report abuse remains open.
- iOS shared-i18n prompts / Apple profile loading flash: iOS roles; native build,
  APNs, GPS and Safari/PWA acceptance remain outstanding. R19 CI still pending.

## Focused rules audit

```json
{
  "score": 4,
  "summary": "Parent authorization and atomic reaction attack cases pass; this is a scoped review, not a guarantee for the full ruleset.",
  "findings": [
    {"check":"Authority Source","severity":"moderate","issue":"Initial walk score remains client-provided.","recommendation":"Move scoring authority to the backend and validate inputs."}
  ]
}
```
