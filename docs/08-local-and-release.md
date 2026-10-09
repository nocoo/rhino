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
  A NASM YouTube reference is available for the Romanian deadlift; the optional
  third-party player is absent until the user requests it. It does not certify
  Rhino's model. The shell uses the installed Basalt primary palette in deep blue.
- `GET /api/identity` hashes only the email from an owner-verified Access JWT
  before querying the same `lizheng.blog/api/authors/profile` service used by
  Life.ai. Untrusted email headers are ignored. No email means no lookup; timeout,
  malformed/oversized response or invalid HTTPS avatar returns a neutral fallback.
  The independent sidebar request cannot prevent training-data loading. The
  synthetic local identity deliberately has no personal email/avatar.

## Requested Production-Connected Development

The owner explicitly wants ordinary development actions to affect production
data, while all automated tests must continue on isolated Wrangler D1 instances.
Read-only Wrangler discovery on 2026-10-09 confirmed that the configured account
contains neither a `rhino` D1 database nor a deployed `rhino` Worker (10007).
No cloud resource was created, no data was written and no authentication rule
was weakened during this UI/motion change.

Two materially different arrangements need owner selection: a local frontend
using the deployed Access-protected Worker, or a locally executing Worker with
a remote production D1 binding. The latter is not a connection to the deployed
Worker. Existing local-only development is retained until that choice and the
actual production resource are established. Never silently point synthetic
test identities or fixture runners at remote bindings.

## Local Acceptance

Run the commands in the root handbook. Test generation and writes must remove
Cloudflare credentials, reject remote bindings, verify the test marker before
fixture operations and remove only run-owned storage after stopping its process.

Desktop and mobile browser journeys cover profile, exact-precision measurements,
plan adoption, workout logging, failed-save recovery and no-WebGL/reduced-motion
behavior. Unit tests invoke the imported Worker against real isolated local D1;
the same API scenario also runs over actual HTTP. Narrow fault injection tests
cover conditional-write failures in addition to, not instead of, real persistence.

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
4. Production D1 still has a deliberately invalid placeholder UUID. Deployment
   credentials, protected environment and authenticated browser acceptance remain
   outstanding. An Access 302 is not application readiness or revision evidence.
5. Vite reports large chart/application and Three.js chunks. The viewer is lazy,
   but further route splitting and real-device performance verification remain.

Do not call this list feature-complete or publish validated coaching claims.

## Publish a Proven Revision

1. Complete local acceptance and resolve whether any release is explicitly an
   unreviewed personal preview. Preserve all movement limitations either way.
2. Confirm the Cloudflare account and create exactly the intended `rhino` D1
   database through the chosen CLI; record its returned UUID, never invent it.
   Replace the placeholder and regenerate types. Review the initial migration.
3. Configure least-privilege deployment credentials and a protected `production`
   GitHub environment. Verify protection actually exists; naming the environment
   in YAML does not configure reviewers or branch restrictions.
4. Commit through Husky and push. Verify all enabled base-ci jobs on the exact
   current-main SHA, including aggregate source proof. No manual success override.
5. Record a D1 export/Time Travel recovery point before any later data migration;
   review a restoration procedure. For an empty first database, document that
   no user data exists and preserve the migration/source revision.
6. Dispatch Deploy with the successful CI `source-run-id` and `source-sha`.
   The proven checkout injects `DEPLOY_REVISION=HEAD`, builds, applies the reviewed
   remote migration and deploys `dist/rhino/wrangler.json`, not raw unbuilt source.
7. Verify the unauthenticated Access redirect, then use an authorized browser to
   inspect `/api/live`: exact version/revision, production environment and D1
   readiness. Perform the accepted create/reload workflow without logging tokens.
8. Publish a matching version tag and GitHub Release only after exact-revision
   CI and deployed verification. Do not claim a pending workflow as published.

## Recovery

Never reset production for a failed test. A code rollback restores the last known
good Worker version without assuming schema rollback. Before data changes,
record the D1 recovery point and validate the restoration command against current
Cloudflare documentation. Restoration needs explicit authorization and a fresh
backup of current state; it can discard later user writes. Keep Access protection
enabled throughout recovery and recheck protected health afterward.
