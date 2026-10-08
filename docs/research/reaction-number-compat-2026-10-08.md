# Reaction counter numeric compatibility — 2026-10-08

Backend follow-up to `db298e5` and Claude's production regression review.

## Confirmed regression and immediate data repair

The previous audit compared JavaScript numeric values with reaction documents.
It did **not** inspect Firestore wire types. A stored `doubleValue: 4` reads as
the same JavaScript number as `integerValue: "4"`, so the zero-mismatch result
did not establish compatibility with `is int` rules. This was a validation gap.

Raw REST projection of all 87 posts confirmed two heart counters stored as
doubles, numerically 4 and 3. Both matched the reaction documents. At
**10:59:06 UTC**, the guarded tool normalized those two counters to the same
integer values. A second execution at 10:59:23 changed zero fields; another raw
scan of 87 posts found zero remaining double counters. No reaction, content,
author or visibility was changed; document update times naturally advanced.

`functions/scripts/normalize-reaction-counts.mjs` requires an explicit project
and post-ID allowlist, defaults to dry-run, and reads the post and its reaction
documents in a server transaction. It refuses fractional, unsafe, negative,
malformed or mismatched data. A field mask and update-time precondition protect
unrelated fields/concurrent changes; writes specify `integerValue` explicitly
and verify raw types afterward. It is safe to rerun after interruption.

```powershell
node functions/scripts/normalize-reaction-counts.mjs --project=mango-pet-app --post=POST_ID
# Only after reviewing the dry-run; requires authorized ADC:
node functions/scripts/normalize-reaction-counts.mjs --project=mango-pet-app --post=POST_ID --commit
```

## Additional native cause — data repair alone is insufficient

Installed `@react-native-firebase/firestore` **21.14.0** calls
`fieldValueForDoubleIncrement` in
`ios/RNFBFirestore/RNFBFirestoreSerialize.m:448`. The native adapter's integer
JavaScript deltas therefore become **double transforms** on the wire, including
zero deltas. A Web-SDK-backed native test adapter hides this distinction.

The corrected rules enforce **nonnegative whole numeric values no larger than
9007199254740991**, using a number check and `value == math.floor(value)`.
Integer and integral-double storage are both accepted. Fractions, NaN, infinity,
unsafe magnitudes, extra keys, standalone counter writes, incorrect deltas,
identity spoofing and visibility violations remain rejected. All existing
atomic reaction checks remain in place. No Web/native code or dependency change.
The post-create zero-count check now compares each numeric field with zero;
whole-map equality distinguishes maps containing `0` from maps containing `0.0`.
Extending the native protocol test to create a post reproduced that second
failure before the scalar zero checks were added.

References: [Firestore wire values](https://firebase.google.com/docs/firestore/reference/rest/v1/Value),
[Rules math.floor](https://firebase.google.com/docs/reference/rules/rules.math).

The normalization utility is a targeted repair/audit tool, not a requirement to
keep every counter physically integer forever: correct native writes can and
will produce integral doubles again, which the corrected rules accept.

## Verification and release

- Initial strict-rules reproduction: **13/13** focused cases passed, including
  explicit REST doubles denied before normalization and accepted afterward.
- Corrected rules: **14/14** focused cases passed, including explicit native
  double transforms, add/switch/remove and invalid fractional/non-finite writes.
- Functions build and migration-script syntax check pass. Actual iOS device
  testing remains outstanding; the protocol test is not a device build.
- Final combined Firestore/Auth/Storage + Web/iOS adapter run: **134/134 PASS**,
  zero skips. This includes native-style post creation with five double zeros.
  No platform handler/typecheck rerun is claimed: Web/iOS sources did not change.
- Rule release evidence is recorded below after completion.

## Correction to the previous error-log explanation

Fresh read-only inspection of **07:11–07:19 UTC** confirms six ERROR request
records, exactly **three** containing Cloud Run's "no available instance".
Those include the first cleanup request and two deletion-worker requests. The
other three worker failures correspond to the already-running lease messages
previously collected. All fixture deletion checkpoints completed.

The smoke script also omitted `confirmDisplayName`, and was corrected, but the
first request's observed HTTP 500 was an instance-availability failure; it was
not evidence that the handler rejected that missing argument. Do not attribute
all six errors to a script parameter or to lease contention. If this recurs for
real users, investigate Cloud Run capacity/settings and quotas before changing
limits. No instance/quota settings were modified in this follow-up.

## Focused rules audit

```json
{"score":5,"summary":"Focused numeric compatibility and atomic-counter checks; not an audit of the full ruleset.","findings":[]}
```

Initial walk-score authority, photo reference indexing, moderation permanent
error handling, R08/R11, native release and real-device acceptance remain open.
