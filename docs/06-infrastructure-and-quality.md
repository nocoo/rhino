# 06 Infrastructure and Quality

[Index](README.md) | [Architecture](04-architecture-and-data.md) | [Delivery](07-delivery-and-decisions.md)

> Implementation update (2026-10-09): the local journal is implemented. Read
> [the current runbook](08-local-and-release.md) for selected tooling, implemented
> behavior and unresolved release/3D acceptance. Proposal-era observations below
> retain their historical context and are not current deployment evidence.

## Current Evidence, Not Deployment Status

Read-only investigation on 2026-10-09 found:

| Item | Observation |
| --- | --- |
| Rhino baseline | `main` at `576edb275ce8aacfe9cbb7bc6d34aba6d6e223cf`; only `LICENSE` before this documentation change |
| TypeScript | Owner requires exactly **7.0.2**; both inspected Life.ai and GeekHub manifests also pin it |
| Neighbor references | `../life.ai` at `5d7a44fcb520b3b057e68fb1d27fd8b242d32df4`; `../geekhub` at `b649e4aae56a8540ce1bffaa21ca7d9d3a9d1f1a` |
| base-ci checkout | `../base-ci` at `8816553dc9f4544d1e8486bacb5cce630a9f14cb`, including a `cf` deployment interface |
| Machine | Node 26.10.0, Bun 1.4.2, `cf` 1.0.0-beta.13 observed; not chosen project pins |
| Target hosts | Production `rhino.hexly.ai`; local `rhino.dev.hexly.ai`; DNS/serving state not established |
| Local ports | **Candidates only:** dev 7057, L2 17057, L3 27057; not reserved or approved |
| Caddy | Active `/opt/homebrew/etc/Caddyfile` and tracked `../workflow/caddy/Caddyfile` differ and are not the same file |
| Access | Team and audience supplied; actual owner identity/policy remain unverified |

Neighbor patterns worth reusing after inspection: Access verification in
`../life.ai/worker/auth.ts` and `../geekhub/src/worker/auth.ts`; test allocation and
guards in each repository's `scripts/run-tests.ts` and
`scripts/verify-test-bindings.ts`. Copy the relevant behavior, not whole frameworks
or unexplained compatibility layers.

### nmem and Local HTTPS

The local machine conventions were checked through `nmem`, including records
`crystal_99cdd67312be` and `25b22d6b-1df5-4491-ae4d-269a556f6442`:
`{project}.dev.hexly.ai`, a 7000-series dev port, L2 offset +10000, L3 offset
+20000. The documentation convention was checked against
`400e2be9-d4a2-4dae-83bb-01ce038567be`.

The candidate ports had no matching listeners or known entries at inspection.
That is not a reservation; repeat the checks before using them. Caddy's active
file hash was `d96f2162516042215a250048a9f8fb62cf51174f2b1c94f65e7c6eea641c5c02`;
the tracked file hash was
`5b42648e83f4219ec2886e1273c96bd4abec4e189d564abbc0f66ad84b78b284`.
The tracked snapshot was observed at workflow revision
`93d1bdbb991f02d2bd5cb75a1ef9e86142575970`; sibling repositories may advance
independently. These hashes record evidence, not desired replacement content.

After authorization, use the Caddy skill to add only Rhino's mapping, verify
syntax, and obtain browser HTTPS acceptance. Do not reconcile unrelated drift,
dump certificates, change Keychain/ACL state, or generate trust material merely
because the app needs a local URL. Any required certificate/trust change needs
its own explicit approval.

## Deployment Toolchain Decision

Cloudflare hosting is fixed; the CLI is not. This repository has not migrated
to `cf`, so the owner's "use cf for already-migrated repositories" rule does not
settle the new-project choice.

| Option | Benefits | Constraints |
| --- | --- | --- |
| Stable Wrangler + supported Vite plugin | Closest to the inspected sibling deployments; avoids adopting a beta config surface | Use only this configuration path; exact compatible versions still need verification |
| `cf` beta + `cloudflare.config.ts` + Vite plugin beta 2 | Current Cloudflare CLI path; inspected base-ci supports it | Open beta, Node-based config loading, different build outputs and deployment inputs; requires explicit beta acceptance |

**Recommendation for reliability:** stable Wrangler unless the owner explicitly
wants to standardize this new project on `cf` beta. If `cf` is chosen, use it
consistently rather than retaining a second Wrangler deployment path.

Official `cf` documentation checked during research states:

- `cloudflare.config.ts` is open beta, requires Node >=22.18, an ESM package,
  and a project-local `cf` dependency. Bun cannot load this config; Bun may be
  the installer, but the CLI needs the supported Node execution path.
- The Vite integration uses plugin beta 2.0. Do not combine it blindly with the
  older plugin 1.x configurations observed in siblings.
- `cf dev`/`cf build` delegate to Vite. Build artifacts are under
  `.cloudflare/output/v0/`; use `cf deploy --prebuilt --mode production` for
  the inspected shared deployment path.
- `cf build` does not invoke the package's build script; explicit typecheck,
  lint, tests, and build steps must not depend on an imagined lifecycle hook.
- Configure the port in Vite; `--port` is not forwarded by `cf` in the inspected
  interface. Modes and environment selection require an explicit check.
- Missing config can trigger auto-configuration or installs, even in exploratory
  command paths. No `cf dev`, build, or deploy has been run in this empty repo.
- Missing resource IDs can lead to provisioning during deployment. Production
  validation must reject absent/placeholder D1 IDs rather than auto-create.

Sources: [cf projects](https://developers.cloudflare.com/cf/projects/index.md),
[Cloudflare config](https://developers.cloudflare.com/cf/projects/cloudflare-config/index.md),
[cf agent guidance](https://developers.cloudflare.com/cf/agents/index.md).
Recheck them at implementation because beta interfaces can change.

For either toolchain: generate binding types from the selected configuration,
pin a current compatibility date at implementation, enable structured Workers
logs and traces without personal payloads, serve `/api` through the Worker before
SPA fallback, and keep all application/API requests same-origin.

## Package and Runtime Policy

Use one package manager and frozen lockfile. Proposed: Bun as the installer and
script runner where supported, with an exact Node version for Node-only tooling.
No version other than TypeScript 7.0.2 is selected by these documents.

The machine blocks `registry.npmjs.org`; follow the local package policy and use
the approved `https://packagefeedproxy.microsoft.io/npm/` route locally. Do not
retry blocked registry calls, change global package configuration, or make
public CI depend on a private machine-only endpoint without verification.
Resolve CI's reachable registry/install policy separately and keep lockfile
integrity. No package installation was needed for this documentation phase.

## Public base-ci Integration

Inspect and pin `nocoo/base-ci/.github/workflows/quality.yml` and
`nocoo/base-ci/.github/workflows/deploy-worker.yml` to a **published, passing,
immutable full SHA** when implementation begins. The local candidate
`8816553dc9f4544d1e8486bacb5cce630a9f14cb` is evidence of an interface, not proof
that its remote CI passed. The older sibling pin
`ad43150de3a2be2fa464b5cd2f921dc4fa9f8f0f` lacks this `cf` interface.

Quality workflow requirements:

- Supply exact package-manager/runtime and Node versions, frozen install policy,
  command overrides, and every lockfile used by security scanning.
- Keep typecheck, lint, unit coverage, and security enabled. Explicitly enable
  build, L2, and L3 when their runnable lanes land; the shared defaults for these
  optional lanes are off.
- Use the aggregate `tested-sha` output. A single successful job is not a complete
  quality proof. All enabled checks must describe the same source revision.
- Keep lifecycle scripts blocked unless a named package actually requires a
  reviewed exception. Required scanners and test runners fail closed if absent.

Deployment workflow requirements:

- Follow completed successful `CI` push runs on this repository's `main` using
  `workflow_run`, without manual dispatch or reviewer approval. Reject PR/fork
  and manually dispatched CI sources, even when their checks succeed.
- Deploy only a proven successful CI source, with `source-run-id`, matching
  `source-sha`, canonical workflow path/name, branch, and allowed source events.
  Do not publish arbitrary PR/fork commits or treat a manually typed SHA as proof.
- Require fresh `main` for continuous delivery and a protected production
  environment. Use the shared non-cancelling production concurrency lock.
- Supply exactly one `deploy-cli` and exact local CLI version. With `cf`, use
  D1 **UUIDs**, not Wrangler database names, and do not pass Wrangler config/path
  inputs. Use the prebuilt production-mode deployment path.
- Pass only named deployment secrets: `CLOUDFLARE_API_TOKEN` and
  `CLOUDFLARE_ACCOUNT_ID`. Use least privilege and no `secrets: inherit` shortcut.
- Apply only reviewed migrations to the confirmed production database, with a
  verified recovery plan. Test or development credentials never enter this job.
- Use bounded anonymous `/api/live` verification for HTTP 200, no-store, the
  manifest version, proven checkout revision and database readiness. Check
  `/api/profile` for the configured Access team's login redirect. Keep protected
  browser acceptance separate; do not put a real user's Access JWT in CI.

The inspected deploy workflow pins its internal release-source action at
`8cbdb970c3a38240289c1e152c40dd550ac62dba`. Do not rewrite internal shared workflow
references in a consumer project. The consumer is installed at
`.github/workflows/deploy.yml` and retains the shared source and concurrency guards.

## Planned Commands

These are script **names to implement**, not commands that can currently run:

| Script | Required behavior |
| --- | --- |
| `dev` | Local Worker/Vite and daily-development local D1, explicit approved port |
| `typecheck` | TypeScript 7.0.2, `strict: true`, no emit; UI, Worker, tests, and helpers |
| `lint` | Biome check-only including format, explicit rules and `--error-on-warnings` |
| `test:coverage` | Nonempty UT lane, all four coverage metrics individually >=95% |
| `test:l2` | Owned local HTTP/Worker/D1 environment with route inventory |
| `test:l3` | Owned browser journey environment, isolated from dev and L2 |
| `gate:security` | Required dependency and secret scanners, bounded failure propagation |
| `gate:l1` | Check the staged-index snapshot without mutating the worktree/index |
| `gate:pre-push` | Inspect pushed refs from hook stdin; L2 and G2 with aggregate status |
| `build` | Explicit checked build for the selected Cloudflare/Vite toolchain |

Prefer runner-native coverage thresholds and simple orchestration. Vitest is a
proposed fit for TypeScript/UI behavior; Playwright is proposed for browser
journeys. Verify their actual TypeScript/toolchain compatibility before pinning.
Pure rendering-only views may be outside UT coverage; business logic stays in
models/hooks/domain modules and cannot be hidden in excluded visual files.

## 6DQ Contract and Current Status

| Dimension | Release contract | Current status |
| --- | --- | --- |
| L1 | Meaningful UT; statements, branches, functions, lines each >=95%; strict typecheck; zero lint warnings/errors; installed Husky staged-snapshot gate and proven failure blocking | **Planned**; no runtime/config/hooks/tests exist |
| L2 | Real local HTTP for each owned endpoint/method, D1 constraints, auth failures, rollback and save races | **Planned** |
| L3 | Profile -> plan -> edit -> view movement -> record -> reopen -> progress; desktop and mobile, failure recovery | **Planned** |
| G2 | Dependency and secret scans with correct lockfile scope and missing-tool failure | **Planned** |
| D1 isolation | Per-run local test stores, owned process/port allocation, guards before writes/reset/cleanup | **Planned**; this quality dimension is separate from the Cloudflare D1 product name |

No S/A/B/F grade, coverage result, CI success, or 6DQ certification is claimed.
Documentation link/whitespace checks are not substitutes for application tests.

Husky must run against the index snapshot, including its configs and tests. Prove
that a staged bug still fails with an unstaged fix present. In isolated fixtures,
prove rejection for test failure, each coverage metric, lint warning/error, type
error, missing tools, timeout, and interrupted child process. Gates never autofix,
re-stage, suppress failures, or change the user's current index.

Personal timing targets: ordinary pre-commit L1 under 30 seconds; pre-push L2
and G2 under 3 minutes. Record machine, cold/warm conditions, elapsed time, and
actual exit codes. Do not skip checks to claim the target was met.

## Local Test Isolation

Each L2/L3 run allocates an owned temporary directory, run ID, local SQLite/D1
state, generated local bindings, and free test port. Use workerd/Miniflare through
the supported selected toolchain. No remote `-test` databases are necessary.

Before fixture writes, reset, or cleanup:

1. Verify local/test mode, an owned directory under the test root, and an explicit
   run ID. Reject production IDs, remote bindings, default dev state, and symlinks
   escaping the owned directory.
2. Initialize `_test_marker` with `env = test` and the run ID only after those
   checks, then verify it before subsequent destructive fixture operations.
3. Pass no production tokens. Network/CLI configuration must not silently select
   remote D1. Tests seed only synthetic profile/health information.
4. Terminate only owned process IDs and remove only verified owned paths, including
   on failure/signals. Never kill all Vite processes or reset daily dev data.

L2 tests cover wrong/expired/missing audience, issuer/signature and owner, JWKS
rotation, origin rejection, validation, duplicate submissions, stale saves,
constraint failures, date boundaries, history preservation, and unauthorized
alternative routes. L3 covers the same critical user journey with real local
persistence, slow/failed saves, reduced motion, unavailable WebGL, and mobile
viewport interaction. A static screenshot alone is not a functional test.

## Production Approval Boundary

Before first deployment, confirm the account, Worker name, D1 UUID, Access owner
subject and policies, DNS/domain route, build revision, backup/restore procedure,
and verification method. Recheck local Caddy separately. Creating resources,
applying remote migrations, changing Access, deploying, and publishing releases
are distinct external actions; this design document authorizes none of them.
