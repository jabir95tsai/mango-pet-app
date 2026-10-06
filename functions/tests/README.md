# Backend security regression

Use Node 22+, Java 21+, installed root/functions dependencies and Firebase CLI.
From the repository root, compile the functions, then run the tests against an
isolated Firestore emulator. No production credentials or data are needed.

```powershell
npm --prefix functions run build
$env:GCLOUD_PROJECT = 'demo-mango-security'
npx -y firebase-tools@15.32.1 emulators:exec --project demo-mango-security --config firebase.security-tests.json --only firestore 'node --test --test-concurrency=1 functions/tests/*.test.cjs'
```

For a freshly started, empty emulator listening on 127.0.0.1:8185 with the current rules:

```powershell
$env:FIRESTORE_EMULATOR_HOST = '127.0.0.1:8185'
$env:GCLOUD_PROJECT = 'demo-mango-security'
node --test --test-concurrency=1 functions/tests/*.test.cjs
```

The harness refuses non-loopback hosts and any project other than
`demo-mango-security`. Start with empty emulator data for each complete run:
health fixtures deliberately use fixed IDs and immutable server timestamps, so
reusing a previous run's documents can fail for reasons unrelated to the change.
The `emulators:exec` command above starts a fresh instance without importing data.
Callable tests invoke the exported `.run` handler
with synthetic verified-auth context; rules tests use the client SDK and emulator
mock auth. They cover application logic and actual Firestore rules, but do not
validate deployed callable HTTP/IAM/App Check, real Firebase Auth or real devices.
The account-cleanup test exercises its family cleanup helper only; it does not
call Auth or Storage deletion services.

## Account / post / Storage lifecycle integration

The additional `*.integration.cjs` tests need fresh Firestore, Auth and Storage
emulators. They run actual exported callable/trigger handlers and actual local
Admin Auth / Storage operations, plus client Storage rules tests:

```powershell
npm --prefix functions run build
$env:GCLOUD_PROJECT = 'demo-mango-security'
npx -y firebase-tools@15.32.1 emulators:exec --project demo-mango-security --config firebase.lifecycle-tests.json --only firestore,auth,storage 'node --test --test-concurrency=1 functions/tests/*.test.cjs functions/tests/*.integration.cjs'
```

This config uses isolated ports 8188 / 9098 / 9198. Start without imported data
for each complete run; test IDs and Auth UIDs are fixed. There are no production
credentials in these tests. The Storage emulator does not enforce GCS generation
preconditions; the replacement regression exercises the additional metadata
refresh guard. See `docs/features/account-data-lifecycle.md` for race, scale and
production-verification boundaries.
