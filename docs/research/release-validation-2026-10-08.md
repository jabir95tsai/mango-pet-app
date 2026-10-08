# 2026-10-08 scheduled-job follow-up

Backend role, continuing the authorized merge/push/deploy/verify work. Base is
`106e898`; the October 6 release remains documented separately.

## Findings and repair

The October 8 read-only audit found two errors in both old and current revisions:

1. `eveningWalkReminder` and `streakBreakWarning` query the `walks` collection
   group by `startedAt`. Its group ascending index was absent; production query
   replay returned FAILED_PRECONDITION. `a29a9dd` declares the missing group
   index and retains all three existing collection index modes.
2. Daily dog leaderboard aggregation was interrupted by a stored pet ID
   `__verify_dog_lb_pet__`, which the production API reserves. Of 159 walks,
   one had an invalid pet reference. `f61dc2a` filters malformed IDs before
   aggregation and realtime create/delete handling; the common scoring helper
   rejects invalid pet/owner IDs before constructing document paths. Other
   database errors still propagate. The existing malformed record is retained.

Document IDs are validated for type, path separators, reserved names, valid
UTF-8 and the 1,500-byte limit according to the
[Firestore limits](https://firebase.google.com/docs/firestore/quotas).
This is bounded defensive handling, not the complete R15 parent-pet
authorization fix. It does not silently change normal scoring or delete data.

The historical log query over October 1–6 found 45 ERROR entries on these three
services, including the same reserved-ID and missing-index messages on October
5. These were pre-existing defects, not new October 6 regressions. The earlier
release's zero-error result applied only to its explicitly stated short window.

## Validation

- Functions build passes.
- **9/9 emulator regressions pass**: four new malformed-ID/actual scheduled
  aggregation tests, plus five existing leaderboard deletion-fence tests.
- Read-only execution of the patched scoring helper against production data
  completes for four valid pet IDs, producing 1 weekly, 1 monthly and 3 all-time
  eligible scores. Counts only are recorded; no leaderboard or user data was
  mutated by this check.
- The combined Firestore/Auth/Storage run was then repeated with all backend,
  Web save adapter and iOS auth adapter tests: **120/120 PASS**, zero skips.
  This includes the four new cases; the earlier 52 platform-handler cases were
  unchanged and their October 6 result remains historical evidence.

## Production verification

- At 03:30 UTC (11:30 Asia/Taipei), the new walks.startedAt group ascending
  index and all three preserved collection modes were **READY**.
- The previously failing production group query now passes, returning seven
  records in its seven-day window. The same patched scoring helper completes
  against production records with the eligible counts above.
- All three selected Functions are ACTIVE on Node 22 with all traffic on their
  new revisions: `aggregateleaderboards-00014-noy`,
  `recomputedogleaderboards-00005-dis`, and
  `recomputedogleaderboardsondelete-00005-tob`.
- Affected-service ERROR logs for 03:25–03:30 UTC: **0**. This observation window
  does not include a scheduled evening or midnight execution.
- Two-day delayed audit of the previous smoke fixtures still shows zero
  resurrected content and three completed permanent tombstones.
- Exact index, query and revision evidence:
  [production snapshot](release-state-2026-10-08.json).

Notification schedules were not manually invoked; actual FCM delivery and the
next scheduled production aggregation remain unverified. Scoring was replayed
read-only, and full scheduled handler execution was verified in the emulator.
The malformed pre-existing walk remains stored. R15 is still a separate fix.
