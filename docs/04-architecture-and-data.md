# 04 Architecture and Data

[Index](README.md) | [Planning Rules](03-planning-and-metrics.md) | [Infrastructure](06-infrastructure-and-quality.md)

> Implementation update (2026-10-09): the local journal is implemented. Read
> [the current runbook](08-local-and-release.md) for selected tooling, implemented
> behavior and unresolved release/3D acceptance. Proposal-era observations below
> retain their historical context and are not current deployment evidence.

## Smallest Complete Architecture

```text
Browser: React views + view-model hooks + domain functions
                    |
             same-origin /api
                    |
Cloudflare Access -> Worker: identity -> validation -> domain -> D1
                    |
             Vite static assets
```

Use one repository, one frontend build, one Worker, and one production D1
database. Serve versioned instructional assets with the application initially.
No KV, Durable Objects, queues, scheduled jobs, separate API host, or R2 is
required for this scope. If licensed asset size exceeds the verified Static
Assets limits, make a separate storage decision rather than adding R2 preemptively.

Proposed libraries: React for UI, Basalt for controls/shell, Lucide for icons,
Three.js for the viewer, Recharts through Basalt's chart integration, `jose` for
JWT verification, and Zod for request/data validation. Native Worker request
handling and D1 prepared statements are enough; no ORM, custom dependency
injection container, or repository interface with one implementation.

Only TypeScript **7.0.2** is fixed now. Select exact compatible published versions
for the other packages at scaffolding, lock them, and test the combination.
Observing a version in a sibling repository is not proof of publication or
compatibility. Use a maintained routing library only if route behavior actually
needs it; a few route views do not justify a second app framework.

## Proposed File Boundaries

These are planned paths, not files that currently exist.

| Path | Responsibility |
| --- | --- |
| `src/app.tsx` | Providers, app shell, route-level composition |
| `src/styles.css` | Basalt integration, app semantic tokens, responsive layout |
| `src/domain/planning.ts` | Deterministic schedule, allocation, progression suggestions |
| `src/domain/metrics.ts` | Date/age, heart-rate estimates, BMI, actual training totals |
| `src/domain/contracts.ts` | Shared validated request/snapshot schemas and derived types |
| `src/data/exercises.ts` | Small reviewed exercise catalog and versioned asset references |
| `src/features/{today,plans,session,progress,profile}/` | Feature views and `use-*-model.ts` hooks as needed |
| `src/lib/api.ts` | Typed same-origin fetch, conflict/error mapping, cancellation |
| `src/components/exercise-viewer.tsx` | Lazy viewer boundary, accessible controls and fallback |
| `src/three/exercise-scene.ts` | Three.js loading, animation, camera, highlighting, disposal |
| `worker/index.ts` | API routing, response headers, static asset handoff |
| `worker/auth.ts` | Access assertion verification and owner authorization |
| `worker/routes/` | Profile, measurements, plans, sessions, and progress handlers |
| `worker/db.ts` | Direct bound SQL and narrow persistence helpers |
| `migrations/0001_initial.sql` | Initial schema, checks, unique indexes, foreign keys |
| `assets-source/README.md` | Authorship, license, editable-source archive locations and hashes |
| `public/models/` | Optimized, licensed deployment artifacts only |
| `tests/{unit,l2,l3}/` | Pure/UI tests, real local API/D1 tests, browser journeys |
| `scripts/` | Only actual test-isolation, gate, and deployment-verification needs |

Use MVVM boundaries without ceremonial classes: views render data and invoke
actions; feature hooks own screen state and async workflows; pure domain
functions own calculation; the Worker owns authorization and persistence.
Do not put SQL, heart-rate math, or mutation retries inside visual components.

## Authentication and Single-Owner Authorization

Known deployment inputs:

```text
ACCESS_TEAM = nocoo
ACCESS_ISSUER = https://nocoo.cloudflareaccess.com
ACCESS_JWKS_URL = https://nocoo.cloudflareaccess.com/cdn-cgi/access/certs
ACCESS_AUD = 2a76fd13714fbf4b676b80a7717f31852579385065fc1e553a8b3e8c49ac44bc
```

These identifiers are not credentials. Their presence does not prove that an
Access application, domain policy, or owner allow-list is configured correctly.

- Protect the entire production hostname with Access. Before reading personal
  data, verify `Cf-Access-Jwt-Assertion` with `jose`, the fixed issuer, expected
  audience, allowed signing algorithm, signature, expiry, and required identity
  claims. Respect `nbf` when present and use bounded clock tolerance.
- Use the fixed Cloudflare JWKS endpoint with rotation-aware caching. Never
  derive a key URL from an untrusted token or merely decode the JWT.
- Enforce a configured owner subject after verification. Obtain and confirm
  that subject during authorized setup. Never auto-enroll the first visitor;
  a valid token for another person receives 403.
- Do not trust an email header alone, accept a client-supplied user ID, store
  Access tokens in localStorage, or add a password system beside Access.
- Disable unprotected alternate production entrypoints, including previews and
  `workers.dev` unless explicitly protected. API verification remains mandatory
  even when the edge is expected to authenticate every request.
- Local development uses a separate synthetic identity through explicit local
  configuration, not a query/header bypass or a request-hostname-only check.
  Release validation rejects any local-auth flag in production config/artifacts.
  L2 auth tests use local signing keys and a local JWKS fixture, never real tokens.

Owner identity is an unresolved deployment gate. No permissive default exists.

## Data Shape

Use four small tables. Store bounded, schema-validated plan/session documents as
JSON inside D1, not a generic document-store abstraction. A complete workout is
one logical aggregate; storing it in one row makes a quick-save atomic without
dozens of per-set requests. Measurements remain relational for time-series queries.

| Table | Essential fields and constraints |
| --- | --- |
| `profile` | Singleton `id = 1`, birthday nullable, timezone, preferences/guidance JSON, integer version, UTC created/updated timestamps |
| `measurements` | UUID primary key, kind `height` or `weight`, effective local date, positive finite value in cm/kg, version, timestamps; unique `(kind, effective_date)` |
| `plan_revisions` | Monotonic revision primary key, unique client request UUID, review month, accepted timestamp, algorithm/catalog versions, validated input/template/rationale JSON; append-only |
| `sessions` | UUID primary key, optional source plan revision FK, local workout date and timezone snapshot, status, target snapshot JSON, actual log JSON, version, last mutation UUID/hash, timestamps |

Use the selected migration tool's schema history; do not add a duplicate schema
metadata table. No `users` table or owner ID column is needed everywhere for a
deliberately single-owner database.

Session states: `draft -> active -> completed` or `abandoned`. A completed
session can receive an explicit log correction, but does not silently become a
new workout. "Skipped" is an exercise/set result, not a completed set with zero
repetitions. Cardio segments distinguish planned and actual duration/intensity.

Target snapshots include exercise ID, name, catalog/asset version, equipment,
load convention, set targets, rest, and segment allocations. Actuals include
stable exercise/set IDs, performed/skipped state, reps, load when known, effort
when entered, and actual cardio segments. Do not infer performed values from
targets without explicit confirmation.

Use foreign keys and `CHECK`/unique constraints in addition to request validation.
Validate dates as calendar dates in application code. Apply bounded payloads,
array lengths, finite numbers, and text lengths; a proposed 256 KiB request cap
is ample for a personal session and must be enforced while reading the body,
not only by trusting `Content-Length`. Do not accept executable asset URLs or SQL
fragments from stored JSON.

## Proposed API Surface

All personal endpoints require the owner. JSON responses use `Cache-Control:
no-store`. The API uses method-specific routing and JSON errors, never an HTML
SPA fallback for an unknown `/api` path.

| Method and path | Contract |
| --- | --- |
| `GET /api/profile` | Profile, readiness and guidance state |
| `PUT /api/profile` | Version-checked singleton update |
| `GET /api/measurements?from=&to=` | Bounded dated observations |
| `PUT /api/measurements/:id` | Stable-ID creation or version-checked correction; duplicate date is an explicit conflict |
| `DELETE /api/measurements/:id` | Confirmed, version-checked deletion; disclose derived BMI changes |
| `GET /api/plans` | Current revision and bounded history |
| `POST /api/plans/preview` | Recompute validated deterministic preview without a write |
| `PUT /api/plans/:requestId` | Accept one new revision against the expected current revision |
| `GET /api/sessions?from=&to=` | Bounded history with cursors when needed |
| `GET /api/sessions/:id` | Snapshot, actuals, save version |
| `PUT /api/sessions/:id` | Stable-ID creation, preparation, start, quick-save, completion, or explicit correction |
| `GET /api/progress?from=&to=` | Derived actual totals and body measurements, never fabricated scores |
| `GET /api/live` | Minimal authenticated readiness; no health records, stack traces, or configuration |
| `GET /api/identity` | Optional display name/avatar from the hashed, owner-verified JWT email; never an email header; no-store and fail-soft profile lookup |

Health monitoring outside Access is a later explicit policy choice. Do not add
a public bypass just to satisfy a monitor. No generic arbitrary-SQL endpoint,
public asset uploader, or administrative delete-all route is needed.

## Save and Conflict Semantics

1. Generate the session UUID in the browser before its first request. Retries
   address the same resource; repeated taps cannot create duplicate sessions.
2. Each save carries the expected integer version and a stable mutation UUID.
   Server validation normalizes the payload and computes its content hash.
3. For a new resource, insert only if absent. For an existing resource, use one
   conditional SQL update matching ID and expected version; increment version
   and store the last mutation UUID/hash in the same statement.
4. A retry of the most recent successful mutation with the same hash returns
   the current result. Reusing that UUID for different content is rejected.
5. A stale version or an older retry after another save returns 409 with current
   version information. Reload and compare; never silently overwrite newer data.
6. The UI distinguishes saving, saved, failed, and conflict states. Do not report
   completion or clear a draft until the write is acknowledged.

This is bounded last-write retry support, not an infinite idempotency ledger.
Plan acceptance similarly uses a stable request ID, matching accepted content,
and a conditional insert against the expected latest revision. Test concurrent
acceptance so only one contender succeeds. Do not trust a client-generated
preview as authoritative; recompute or validate all accepted plan inputs.

Use a single SQL statement for single-row operations. For genuine multi-row
changes, use D1's documented transactional `batch`, with conditions that prevent
partial logical success; inspect results and test rollback. A sequence of
independent awaited writes is not a transaction. Read replicas and session
consistency APIs add no value until a concrete need exists.

## Privacy and Operational Boundaries

- Validate the exact request origin for state-changing browser requests and
  require JSON where appropriate. Do not enable wildcard CORS; Access cookies
  alone are not a CSRF design.
- Use prepared bound SQL. Reject unknown enum values and unauthorized methods.
- Logs contain request ID, route, status, latency, and non-sensitive error code;
  no JWTs, birthdays, weights, workout payloads, or detailed medical notes.
- No personal data or credentials in static bundles, demo fixtures, analytics,
  URLs, or browser screenshot artifacts intended for publication.
- Error boundaries and network failures retain user edits where possible.
  Never hide a persistence error behind a successful toast.
- Define backup/restore and migration verification before production writes.
  Code rollback is not database rollback. Do not rely on an unverified retention
  window or delete real records as a smoke test.

Technical sources: [Access JWT verification](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/index.md),
[D1 database API and batch behavior](https://developers.cloudflare.com/d1/worker-api/d1-database/index.md),
and [Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/index.md).
