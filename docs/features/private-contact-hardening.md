# Private contact hardening — R03

Date: 2026-10-06. Baseline: `248686f`. Backend scope; native client handoff is documented separately.

## Data contract

- `users/{uid}` remains readable by signed-in users. Client create/update must contain neither `email` nor `fcmTokens` in the resulting document.
- `users/{uid}/private/contact` holds `email` and `fcmTokens[]`. Only the owner can read/write; backend uses Admin SDK. Public push preferences remain on the profile.
- Backend token lookup unions private and legacy tokens and removes duplicates/malformed values. Invalid-token cleanup atomically merges surviving devices into private contact and removes the legacy public token field. Missing/deleting accounts are skipped.
- Web bootstrap is transactional across profile and contact. It preserves a pre-existing device registration, merges legacy devices before deleting public contact fields, and records a linked provider's email privately.

No new index or dependency is required. Native clients must move all registrations/removals to private contact; an older binary that writes public tokens will be rejected after deployment. Existing private tokens can still receive notifications. This change does not establish APNs delivery or produce a new iOS binary.

## Migration and rollout

Build Functions before running `functions/scripts/migrate-user-pii.mjs`. Default is a counts-only dry run; `--commit --strip` copies and strips each profile atomically. Transactions re-read current values so concurrent registrations survive. It is safe to restart, and `--after=<documentId>` can resume an ordered scan. No tokens, email addresses or account IDs are logged. Preserve an existing nonempty private email. Deploy the public-field guard before stripping.

Read-only production inventory at `2026-10-06T01:15:22.779Z`: 24 profiles, 0 public email/token profiles, 10 private token profiles / 10 tokens. No production migration writes were needed at that point. Recheck after deployment; this inventory alone is not proof of a deployed fix.

## Validation

Functions build and Web typecheck passed. Ten focused emulator integration tests passed using actual Admin/Web Firestore SDKs and the updated rules. Cases cover union/deduplication, atomic and repeated migration, concurrent device registration, invalid-token cleanup, missing/deleting profiles, public-field denial and owner-only contact access, Web first login, legacy bootstrap, guest upgrade and transaction failure propagation. The prior full suite plus the initial nine new cases passed 45/45; the additional guest-upgrade case then passed in the focused ten-test run.

Production deployment and delivery status belong in the release validation report; the results above are local emulator evidence.
