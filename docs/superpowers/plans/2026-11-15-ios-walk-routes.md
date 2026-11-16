# iOS walk routes implementation plan

> Execute with superpowers:subagent-driven-development; isolate file ownership and review integrated result.

Goal: implement approved iOS v1 against existing Backend contract, no deployment.
Spec: docs/features/ios-walk-route-tracking-v1.md and walk-route-backend-contract.md.
Architecture: existing background recorder extended with durable complete segments and native callable outbox; native map history and family discovery; session-scoped local notifications.
Constraints: native Firebase only; six-hour original deadline; 200m away/100m return/5min dwell once; share default false; all local data retained until finalize ack; end before backfill; no family offline caching; mango tokens and reduced-motion; no backend changes without concrete integration need.

- [x] Recorder/API integration: test segment accumulation (>500), gaps, deadline, dwell, persisted notification and outbox retries before implementing. Own tracking service, drafts, save pipeline, tracking UI and API wrappers.
- [x] Map and viewer: native map component, paginated history reads, current family latest-position polling and expiry/revocation handling; legacy/manual states. Own history row/new route views; integrate entry with recorder owner.
- [x] Native dependencies/config: Expo bundled versions maps/notifications/netinfo; validate local docs, reproducible lock update, no production rollout. Dep change remains branch-only pending Linux gate.
- [x] Integrate: iOS/Web/shared typechecks, existing and new script tests, Metro export, independent review fixes, device acceptance checklist and actual completion state.

Review focus: offline stop race vs publish; resume identity/family/auth switch; no path truncation; server-only history freshness and revoke; app kill/deadline vs pending notification.

Validation: 56/56 tests, iOS/Web typecheck, iOS/Web Metro exports, frozen lock npm ci and diff check PASS. Independent review fixes addressed. Linux gate, native compile/device and deployment remain pending; checklist marks implementation/check attempts, not release acceptance. See docs/features/ios-walk-route-implementation.md.
