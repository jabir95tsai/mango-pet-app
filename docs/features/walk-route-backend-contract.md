# Walk route v1 — Backend contract / iOS handoff

2026-11-15. Implements the backend slice of [approved spec](ios-walk-route-tracking-v1.md). Code only; not deployed. No map/tracking UI or device acceptance is included.

## Schema and authority

| Path | Required fields / purpose | Read / write |
|---|---|---|
| `walkRouteSessions/{sessionId}` | `walkerUid`, `petId`, `familyId`, `shareLive`, `startedAt`, `expiresAt`, `status`, `chunkCount`, `pointCount`, `lastPoint`, `createdAt`; ended adds `endedAt`; finalized adds immutable `manifest` | Active/ended: walker only, also current member for family data. Finalized: current family members, or personal walker. Callable-only writes. |
| `walkRouteSessions/{sessionId}/chunks/{index padded to 10 digits}` | `chunkIndex`, `points: [{lat,lng,t,segment}]` | Same scope as parent, other members only after finalized and corresponding Walk exists. Immutable server writes. |
| `walkLiveLocations/{sessionId}` | `familyId`, `walkerUid`, `petId`, `lat`, `lng`, `locatedAt`, `expiresAt` | Current real family members, while walker still belongs, session active, server request time before BOTH deadlines. Server-only writes. Contains no historical route. |
| `walks/{sessionId}` | Existing Walk contract plus `routeVersion:1`, `routeChunkCount`, `routePointCount`; no inline `path` | Existing Walk ACL. Created once by finalize; old clients can still update notes/photos and delete. |
| deleted session | `sessionId`, `status:'deleted'`, `walkerUid`, `petId` | No client reads/writes. Permanent resurrection fence. Owner/pet IDs remain for retryable account erasure; no location, start/end, family or route metadata. |

Only existing single-field indexes are used: session queries by `walkerUid` or `petId` for erasure; chunk ordering by `chunkIndex`. No new composite indexes or TTL policy. Family access derives from `families/{id}.memberUids`, never profile family caches. Personal records remain personal after joining a family.

## Callable: `manageWalkRoute` (`asia-east1`)

Shared wire types: `WalkRouteOperation`, `WalkRouteResult` in `@mango/shared-types`. All input times are **integer epoch milliseconds**, not serialized SDK Timestamp objects. Firestore document timestamps use native Timestamp adapters. ID format `[A-Za-z0-9_-]{1,128}`; generate and persist a UUID before any upload, reuse it for the complete lifecycle. Unknown operations and malformed numbers/points reject.

1. `start {sessionId,petId,familyId,startedAtMs,shareLive}`. Explicit boolean each time (UI default false); personal mode requires false. Start is client-reported original start, bounded by server now; older offline starts are supported. Server freezes `expiresAt = startedAt + 21,600,000 ms`. Pet scope and current authoritative membership checked. Retrying identical start returns the existing state, never rewinds state or expiry; changed inputs conflict. Existing Walk IDs cannot be reserved.
2. `append {sessionId,chunkIndex,points}`. **1–250** points/chunk, sequential zero-based indices, strictly increasing time across chunks, nondecreasing integer segment. Points must lie within original start and min(server now, end or six-hour deadline). Preserve segments across chunk boundaries; increment segment for interruptions/pauses/GPS gaps. Identical chunk retry succeeds; changed content conflicts; out-of-order chunks reject. Active and ended accept history backfill; finalized/deleted reject new chunks. There is no rolling point cap.
3. `publish {sessionId,point}`. Requires sharing enabled at start, active session, original family membership and non-expired session. Location timestamp must advance and be less than five minutes old; old retries cannot refresh expiry. Server stores expiry `min(point.t + 300000, session.expiresAt)`. No heartbeat timestamp substitutes for capture time. Client timestamps cannot be independently attested as physical GPS readings; this retains the existing authenticated-client sensor trust boundary.
4. `end {sessionId,endedAtMs}`. Terminal, deletes live location atomically. Clamp original local end to the original six-hour deadline; cannot precede already uploaded points or exceed server now. Identical end retry succeeds; different end conflicts. Owner may end after losing membership (to stop sharing), but cannot publish/upload/finalize family data after removal.
5. `finalize {sessionId,chunkCount,pointCount,distanceKm,durationMin,score}`. Requires ended, exact acknowledged counts and matching pet/family authority; creates one immutable Walk and seals route in one transaction. Identical retries/concurrent calls return success without another Walk/create trigger. Changed manifest conflicts. Duration cannot exceed elapsed start/end. Distance/score are finite bounded values using the **existing client-computed shared business formula/trust model**, not a new server scoring algorithm. Client must calculate distance without crossing segments and duration with existing pause semantics. No new server anti-cheat guarantee is claimed.
6. `delete {sessionId}`. Walker or current family member may delete. Atomically removes Walk/live and installs terminal tombstone, then removes chunks. Idempotent after transient chunk-cleanup failure. Family removal does not prevent walker from erasing their own session. Any authenticated retry against an already deleted ID is a harmless success and only retries chunk cleanup; it reveals no tombstone fields.

Responses always include `sessionId,status`; start includes `expiresAtMs`; append includes `chunkCount,pointCount`. Errors: `unauthenticated`, `permission-denied` (scope), `invalid-argument` (payload), `already-exists` (immutable identity/content conflict), `failed-precondition` (terminal/out-of-order/incomplete/stale/account deletion), `not-found` (unknown session).

## Family discovery: `listWalkLiveLocations` (`asia-east1`)

Input `{familyId,pageSize?:1..50,cursor?:sessionId}` (default page size 25); output `{locations,nextCursor}` with location times `locatedAtMs,expiresAtMs`. Authenticated non-guest requester must be a current family member **before** the query. Uses familyId equality + document-ID order on the existing single-field index. Each page reads at most 50 live docs and their session parents; server filters expired locations, inactive/expired sessions, and walkers no longer members. Only latest-position DTOs leave the callable, never route points. Transactional membership/session reads provide a consistent authorization snapshot.

An empty filtered page may have `nextCursor`; follow it until null, with a client page budget and retry/poll policy. Cursor is the last scanned ID, not a count of visible positions. At exactly page size, a final empty page can be needed. New lower-ID sessions appearing during pagination are picked up on the next refresh from null. Stale stored docs can increase the number of pages; a future active-only index/cleanup optimization may be useful at scale. This bounded contract requires no new composite index. Revalidate on every poll; enforce expiry locally between calls.

## Client sequencing and privacy duties

- Persist locally first. For offline-finished walks send `start → end → append chunks → finalize`, never publish queued positions. For online walks append/publish while active, stop the local sensor and publisher immediately on end, send end before historical retry queue. Server cannot know an offline local end until it receives it; old visible positions disappear by their capture-time deadline.
- Keep all local data until `finalize` acknowledgment. A timeout is unknown outcome: retry the identical operation. Persist manifest/chunk boundaries so retries are byte-content equivalent. Do not use existing direct Walk-save API for route-backed IDs.
- Recovered session must use original start/expiry/share choice. Six hours is wall elapsed time; background suspension does not extend it. Expired server sessions may retain stored `active` status, but all live writes/reads are denied; client ends with clamped time and uploads only pre-deadline samples.
- Use `listWalkLiveLocations` for family discovery; then subscribe to the returned live document IDs if needed. Do not query private session parents for discovery. When expiry passes, clear rendered location via a local timer; Firestore rules do not emit time-triggered snapshot removals.
- Display possible staleness after **60,000 ms**, hide at the earlier of capture + **300,000 ms** and session start + **21,600,000 ms**. Do not infer freshness from snapshot receipt time, pending writes or cache.
- No family history offline browsing: hide family routes/live on disconnect or unverifiable membership; revalidate authoritative membership before showing on reconnect. Server rules prevent new unauthorized fetches; they cannot erase rendered/cached data or revoke screenshots.
- New member can read finalized family history. Removed walker/member cannot fetch family chunks or live. If walker loses original membership, keep local recording; this API rejects history finalize rather than inventing a new private/family ownership policy. PM must decide any future recovery/ownership transfer.
- Read chunk collections only after completion; order by `chunkIndex`. No current full trail is shared. Legacy `path` remains legacy/possibly truncated, never label as complete. Zero-point route can represent timing-only capture; frontend labels no route.

## Deletion and account lifecycle

Old clients may delete `walks/{id}` directly. Read rules require that finalized Walk still exist, hiding chunks immediately; retryable `cleanupDeletedWalkRoute` removes live/chunks and retains the fence. Finalize checks parent existence even before cleanup arrives. Direct Walk creation cannot reuse any session ID (including tombstones) or forge route fields. Legacy IDs without sessions keep previous behavior.

Account deletion freezes mutations through `deletedAccounts` read inside each transaction. Cleanup discovers both owner routes and routes of deleted pets, including in-progress routes without a Walk. It fences before recursive deletion and retains owner/pet IDs so an interrupted cleanup is discoverable on retry. Route deletion does not independently remove existing photos; existing Walk/account storage lifecycle remains authoritative.

## Operational limits and rollout handoff

- 250 samples keeps each chunk well below Firestore's 1 MiB document limit (only four validated numeric fields are stored). Sequential chunks keep finalize O(1), with acknowledged counts and immutable content. Each append writes chunk + session; live update writes one live doc plus transactional reads; end/finalize each bounded transaction. Route reads scale with number of chunks, no rolling cap. IDs/point counts use safe integers.
- No scheduled scans, outbound messages, dependency or lock changes. Expiry is an access rule, not data deletion. Latest doc may remain after six hours until end/delete but is unreadable. Historical route retention follows Walk.
- Future deployment owner: deploy rules and `manageWalkRoute`, `listWalkLiveLocations`, `cleanupDeletedWalkRoute` plus modified `deleteUserAccount` before enabling new clients. Existing function handlers imported from index unchanged aside from route cleanup. Review deployed rule/query behavior and trigger retries. This work does not deploy.
- iOS Feature Builder owns recorder changes, durable upload queue, client freshness/revocation timers, history map, return-to-start reminder and foreground/background/device acceptance. Web new maps remain deferred. Shared DTO/schema foundation is ready for implementation; no client currently calls it.

## Verification

Tests: `functions/tests/walk-routes.test.cjs` uses real Firestore rules and transactions, exported callable `.run` with synthetic verified auth, and one injected transient recursive-delete failure. This is not deployed HTTP/App Check/IAM, GPS, Auth SDK or device acceptance. Full commands and measured outcomes are in the implementation plan execution ledger.

Verified locally: focused route/account tests **13/13**; complete pre-final-fixture lifecycle suite **133/135**, with two pre-existing r15 adapter-loader `./i18n` failures. Web/iOS/Functions and direct shared-source TypeScript checks pass. See plan ledger for exact commands, runtime difference (local Node26 vs deployed Node22), and test process limitations.
