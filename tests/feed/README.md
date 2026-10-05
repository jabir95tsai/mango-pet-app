# Feed query regression

Use the existing root, Web and Functions dependencies (no extra test packages).
Start a Java 21+ Firestore emulator with the repository rules, project
`demo-mango-feed`, host `127.0.0.1`, and port `8189`, then run:

```powershell
$env:FIRESTORE_EMULATOR_HOST = '127.0.0.1:8189'
$env:GCLOUD_PROJECT = 'demo-mango-feed'
node --test --test-concurrency=1 tests/feed/feed-query.test.cjs
```

For example, with the cached emulator JAR:

```powershell
java -Duser.language=en -Duser.country=US -jar <path-to-cloud-firestore-emulator.jar> --host 127.0.0.1 --port 8189 --project_id demo-mango-feed --single_project_mode --single_project_mode_error --rules firestore.rules
```

The English JVM locale avoids missing localized rule-error bundles in the cached emulator.
If the environment blocks Node child processes, Node 24 can run the same suite
with `--test-isolation=none`.

The harness refuses other hosts/projects. It exercises the actual Web and iOS
TypeScript data-layer functions against the client SDK and emulator rules. The
iOS native transport is represented by a chainable query adapter to the Web SDK;
this does not verify native Firebase on a device. The emulator enforces the
30-disjunction limit, but does not verify production composite-index readiness.
The query fields, order and existing composite index are unchanged by this fix.

`max` retains its existing meaning: a cap on each source/chunk query, not a cap
on the final merged feed. Empty friend lists issue no friend query. Query errors
continue to reject the complete request; callers retain responsibility for
presenting errors. Tests cover the old 15/16 boundary, multiple chunks, duplicate
authors, ordering, deduplication, visibility, moderation filtering and failures.
