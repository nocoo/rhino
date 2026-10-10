# 08 Local Preview and Release Runbook

[Index](README.md) | [Infrastructure](06-infrastructure-and-quality.md)

## Implemented Baseline

The owner authorized implementation and eventual publication after the research
phase. Stable Wrangler, React/Basalt and Chinese-first UI were selected. The
original design documents remain the acceptance contract, not an assertion that
every proposal has passed. This document records the implementation boundary.

- Daily development: HTTPS `rhino.dev.hexly.ai` -> loopback Vite port 7057;
  `.wrangler/state` stores local D1. Caddy's existing wildcard certificate is
  reused; no certificate/trust-store/ACL changes were made.
- Production Access application/policy and owner UUID were checked read-only;
  configured `OWNER_SUB` is `455c6a6a-735c-5bc1-aeca-0ae5cf9e9692`.
  Test identity is unrelated: `rhino-local-owner`, audience `rhino-test`.
- `wrangler.jsonc` is the only deployment configuration. Compatibility date
  2026-09-25 matches the pinned workerd's supported range. Binding declarations
  are checked in and regenerated with `bun run typegen`.
- Local test configuration is generated per run through `RHINO_TEST_CONFIG`.
  Vite uses that config and `RHINO_TEST_STATE`; it does not inject duplicate vars.
  Synthetic JWKS is a JSON string with two real RS256 keys, no JWKS HTTP server.
- Four D1 tables store profile, measurements, plan revisions and sessions.
  `_test_marker` is test infrastructure only. API live checks the migrated D1
  profile table and returns version, revision and resource environment.
- Actual progress minutes are explicitly `actualCardioMinutes`. Strength
  duration is not inferred from planned time. A completed strength session
  counts only when at least one set is performed.
- Model assets are self-hosted. One 4.61 MB GLB contains eleven clips; matching
  PNG phase posters and written cues are available when WebGL fails.
- Catalog 1.1.0 adds five selectable dumbbell movements without changing the
  foundational automatic A/B templates. Replacing an old draft's movement
  updates that movement's catalog provenance and clears its planned load instead
  of carrying a total-external load into a per-hand exercise. Saved history stays immutable.
- Catalog 1.2.0 localizes names/muscles and corrects hinge, arm and contact paths.
  All eleven movements have attributed YouTube references; the optional
  third-party player is absent until the user requests it. These do not certify
  Rhino's model. The shell uses the installed Basalt primary palette in deep blue.
- `GET /api/identity` hashes only the email from an owner-verified Access JWT
  before querying the same `lizheng.blog/api/authors/profile` service used by
  Life.ai. Untrusted email headers are ignored. No email means no lookup; timeout,
  malformed/oversized response or invalid HTTPS avatar returns a neutral fallback.
  The independent sidebar request cannot prevent training-data loading. The
  synthetic local identity deliberately has no personal email/avatar.

## Local, E2E and Production Isolation

The owner's latest instruction supersedes production-by-default development.
The xray-style header switch defaults to **Local** on every server startup; it
does not restore a production preference from local storage.

- Local uses the in-process Vite Cloudflare Worker with persistent `.wrangler/state`
  D1 and synthetic local identity. The configured Caddy address is the save origin.
- E2E creates a fresh isolated child Vite/Worker, synthetic RS256 identity, generated
  config and marked local D1. Credentials and dev-vars inheritance are disabled.
  Leaving E2E stops its process before marker-checked deletion of its own state.
  An IPC disconnect also makes the child close its server and validate its marker
  before removing its state if the development parent exits unexpectedly.
- Prod forwards to the fixed `https://rhino.hexly.ai` Access-protected Worker,
  never a production D1 binding in the local runtime. Run `bun run login:prod`
  first. `cloudflared` supplies the server-side token; browser headers cannot
  provide proxy credentials. No token is returned to the browser or logged.
- Automatic L2/L3 runs remain locked E2E, retain direct API routes for real JWT
  rejection tests, and cannot switch into either Local or Prod.

Manual requests carry a server instance ID. A selection invalidates old tabs;
requests capture their target before reading bodies so a concurrent switch cannot
send an old request into production. Selection requires the current instance,
an unpredictable CSRF token and exact local origin. The UI confirms discard of
unsaved edits and reloads after selection. The gateway is a serve-only Vite plugin;
the production build has neither its injected capability nor its endpoints.

The initial production D1 was created on 2026-10-09 in APAC, UUID
`fe36652a-9c84-485f-bae3-384f395e45ea`. Readback reported zero application tables
and no user records before the initial migration. GitHub `production` permits
only branch `main` and disables admin bypass. Deployment credentials are configured.
After approving the initial deployment, the owner explicitly removed recurring
reviewer approval. Exact-source successful CI and fresh-main checks remain required.

The pre-existing shared Access application bypasses the edge on `/api/live`.
Local source revision `7376d23` adopts owner-authorized anonymous GET health:
`{ status: "ok", name: "rhino", version, revision }`, without a `data` envelope.
It executes `SELECT 1 FROM profile LIMIT 1` and never returns personal rows.
Database failure returns 503 and `{ status: "error", name: "rhino", version }`;
both responses are no-store. Business routes retain owner JWT verification.
Deployment checks the edge login redirect on `/api/profile` separately. Shared
Access policies were not changed; local source adoption is not proof of deployment.

## Local Acceptance

Run the commands in the root handbook. Test generation and writes must remove
Cloudflare credentials, reject remote bindings, verify the test marker before
fixture operations and remove only run-owned storage after stopping its process.

Desktop and mobile browser journeys cover profile, exact-precision measurements,
plan adoption, workout logging, failed-save recovery and no-WebGL/reduced-motion
behavior. Unit tests invoke the imported Worker against real isolated local D1;
the same API scenario also runs over actual HTTP. Narrow fault injection tests
cover conditional-write failures in addition to, not instead of, real persistence.

The environment/video change passed 130 unit tests in 24 files with statements
98.55%, branches 95.42%, functions 99.17% and lines 98.89%, including the gateway
and Worker authentication. The post-cleanup-fix full desktop/mobile run passed
20 browser tests in 2.9 minutes. Five further regression checks cover the deployment
verifier's protected path and rejection of missing/wrong login redirects.
Real Caddy acceptance wrote only E2E: Local profile readback stayed byte-equivalent,
leaving/re-entering E2E produced a fresh empty profile, and stale API IDs and the
unscoped explorer were rejected. Parent SIGTERM triggered IPC child cleanup with
the run marker intact. No acceptance fixtures were written to daily or production D1.

Use the Caddy URL for owner acceptance. Do not insert sample personal metrics
into the daily database to decorate screenshots. Confirm both light/dark modes,
360px/390px/768px/1440px layouts, chart/table visibility, keyboard navigation,
session edits, record reload, and all eleven motion clips.

## Open Acceptance Work

1. Qualified movement review is absent. The rig, surface highlights and clips
   are previews, with explicit UI warnings. No physical-phone 60-second frame-rate
   measurement or professional technique acceptance has been claimed.
2. Configurable weigh-in cadence is stored, but a date-driven dashboard prompt
   is not yet connected. Preferred/cardio-only weekdays are supported in the API;
   the initial editor uses an evenly distributed preset and all-cardio switch.
3. Progression suggestions exist as domain rules but are not yet an interactive
   load recommendation. No automatic weight increment is applied.
4. Production verification is read-only; no sample health records or workout
   fixtures are written online. An Access 302 is not readiness or revision evidence.
5. Vite reports large chart/application and Three.js chunks. The viewer is lazy,
   but further route splitting and real-device performance verification remain.

Do not call this list feature-complete or publish validated coaching claims.

## Publish a Proven Revision

1. Complete local acceptance and resolve whether any release is explicitly an
   unreviewed personal preview. Preserve all movement limitations either way.
2. Confirm the Cloudflare account and create exactly the intended `rhino` D1
   database through the chosen CLI; record its returned UUID, never invent it.
   Replace the placeholder and regenerate types. Review the initial migration.
3. Configure least-privilege deployment credentials and a main-only `production`
   GitHub environment with admin bypass disabled. Do not add recurring reviewer
   approval: the owner explicitly removed it. Naming the environment in YAML
   alone does not configure branch restrictions.
4. Before pushing any later data migration, record a D1 export/Time Travel recovery
   point and review a restoration procedure. For an empty first database,
   document that no user data exists and preserve the migration/source revision.
5. Commit through Husky and push to `main`. Verify all enabled base-ci jobs on
   that exact SHA, including aggregate source proof. No manual success override.
6. Successful push CI automatically triggers Deploy through `workflow_run` with
   the completed run ID and head SHA. No dispatch or approval is required. PR,
   fork, failed and manually dispatched CI cannot deploy; stale main fails closed.
   The proven checkout injects `DEPLOY_REVISION=HEAD`, builds, applies the reviewed
   remote migration and deploys `dist/rhino/wrangler.json`, not raw unbuilt source.
   The shared production lock serializes deployments without cancelling one
   in progress.
7. The deployment verifier checks anonymous `/api/live` for HTTP 200, no-store,
   the manifest version and proven checkout SHA, then verifies the configured
   Access redirect on `/api/profile`. Inspect the hosted desktop/mobile UI
   read-only with the owner identity.
   Create/reload fixtures belong in E2E, never production. Do not log tokens.
8. Publish a matching version tag and GitHub Release only after exact-revision
   CI and deployed verification. Do not claim a pending workflow as published.

## Recovery

Never reset production for a failed test. A code rollback restores the last known
good Worker version without assuming schema rollback. Before data changes,
record the D1 recovery point and validate the restoration command against current
Cloudflare documentation. Restoration needs explicit authorization and a fresh
backup of current state; it can discard later user writes. Keep Access protection
enabled throughout recovery and recheck protected health afterward.
