# iOS auth / push regressions

Run from the repository root with installed workspace dependencies:

```powershell
node --test apps/ios/scripts/auth-push.test.cjs
npm run typecheck -w apps/ios
npm run typecheck -w apps/web
```

These 28 tests transpile and execute the actual `auth.ts`, `auth-profile.ts`,
`push.ts`, and `AuthProvider` modules. Native Google/Apple, messaging/APNs,
AsyncStorage and Firestore transport are mocked. The small hook scheduler is
not a React Native renderer or a device test.

To prove the first-permission regression detects the original bug:

```powershell
$env:IOS_PUSH_BASELINE_REF='248686f'
node --test --test-name-pattern='NOT_DETERMINED' apps/ios/scripts/auth-push.test.cjs
Remove-Item Env:IOS_PUSH_BASELINE_REF
```

Expected: one failure, actual `denied` versus expected `notDetermined`. Do not
leave this environment variable set for normal regression runs.

## Real SDK and rules integration

The six integration tests adapt native Firestore calls to the Web SDK and a fresh
emulator. They cover bootstrap, atomic legacy migration, token add/remove, private
contact isolation, rejected public PII writes, and the R05 deletion marker. The
native permission/token provider remains mocked. The tests require integrated
R03/R05 rules and refuse production project IDs or non-loopback hosts. The
standalone project below and the combined `demo-mango-security` release harness
are accepted; see `functions/tests/README.md` for the combined run.

Create a local ignored config and copy the rules under test:

```powershell
New-Item -ItemType Directory -Force outputs/ios-auth-tests | Out-Null
Copy-Item firestore.rules outputs/ios-auth-tests/firestore.rules
'{"firestore":{"rules":"firestore.rules"},"emulators":{"firestore":{"host":"127.0.0.1","port":8193},"ui":{"enabled":false},"singleProjectMode":true}}' | Set-Content outputs/ios-auth-tests/firebase.json -Encoding utf8
$env:JAVA_HOME='C:/Program Files/Java/jdk-21'
$env:PATH=$env:JAVA_HOME+'/bin;'+$env:PATH
$env:JAVA_TOOL_OPTIONS='-Duser.language=en -Duser.country=US'
$env:GCLOUD_PROJECT='demo-mango-ios-auth'
$env:TEST_DELETION_MARKER='1'
npx -y firebase-tools@15.32.1 emulators:exec --project demo-mango-ios-auth --config outputs/ios-auth-tests/firebase.json --only firestore 'node --test --test-concurrency=1 apps/ios/scripts/auth-push-emulator.test.cjs'
```

Use fresh emulator state for each run. `TEST_DELETION_MARKER` may be omitted only
when checking R03 before R05 is integrated; that explicitly skips one case and is
not the full six-test acceptance run.
