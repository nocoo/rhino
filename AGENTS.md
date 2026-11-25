# Rhino

Single-owner fitness planner/journal on Vite, React, Basalt, Cloudflare Workers, and D1.
Docs: [README.md](README.md) · [English](docs/README.en.md) · [Docs](docs/README.md) · [Release Runbook](docs/08-local-and-release.md) · [Retrospective](Retrospective.md)

## Commands

Run from root with Bun 1.4.2, Node 26.12.1, TS **7.0.2**, and stable Wrangler (`package.json`, not `cf`).

```sh
bun install --frozen-lockfile # Install exact lock + Husky
bun run dev                   # https://rhino.dev.hexly.ai -> 127.0.0.1:7057
bun run login:prod            # Auth dev Prod proxy via Access
bun run db:migrate            # Migrate daily local D1 only
bun run typegen               # Regenerate Wrangler binding types
bun run typecheck             # S1: strict TS (app, Worker, tests, scripts)
bun run lint                  # S2: Biome recommended + format, 0 warnings
bun run test:coverage         # L1: UT, 4x >=80%, no skips/empty/missing report
bun run test:l2               # L3: HTTP/Worker/D1 API tests, synthetic JWTs
bun run test:l3               # L4: Chromium Playwright (desktop + targeted mobile viewports)
bun run gate:l1               # Staged-index snapshot check (S1/S2/L1)
bun run gate:verify           # Disposable Git/Husky rejection probes
bun run gate:security         # G1/G2: Gitleaks + OSV (fail closed if missing)
bun run gate:pre-push         # Pushed-ref L2 + G1/G2 (Husky hook)
bun run build                 # B1: Worker + static assets (no deploy)
node assets-source/build-model.mjs   # Rebuild shared 3D rig and 11 clips
node assets-source/build-posters.mjs # Render static phase posters
```

## Invariants

- **UI & README**: Chinese-first UI; pair Chinese [README.md](README.md) with [docs/README.en.md](docs/README.en.md).
- **Layering**: Keep logic in feature hooks, pure domain functions, and bound D1 SQL; never move logic into `.tsx` to escape coverage.
- **Immutability**: Plans are immutable revisions; drafts are editable, started session targets/date/timezone/provenance are immutable; version-check actuals, never infer performed from planned.
- **Units & health**: `YYYY-MM-DD` dates, UTC instants, unrounded `kg`/`cm`. BMI is not a diagnosis; age HR is an uncertain 18–64 estimate, never a load prescription or safety ceiling.
- **Prod auth**: Verify Access RS256 issuer/audience/expiry/subject vs exact `OWNER_SUB`; blank owner fails closed; never trust email headers or auto-claim.
- **Auth envs**: `local` uses loopback synthetic identity; `test` verifies synthetic JWTs via JSON `TEST_ACCESS_JWKS`; prod ignores it for the fixed remote Access endpoint.
- **Sidebar identity**: Optional `GET /api/identity` calls `lizheng.blog` hashed-email profile only from verified JWT email; errors never block training data.
- **HTTP safety**: Mutations require exact `APP_ORIGIN` and JSON (256 KiB streamed cap). API responses are `no-store`; never log personal payloads or JWTs.
- **Dev gateway**: Header switches Local/E2E/Prod via instance-scoped URLs (defaults to Local on start); Prod proxies to the Access Worker (not remote D1), never leaks tokens, rejects stale requests.
- **Test isolation**: Use per-run `.wrangler/tests/run-*` and verified `_test_marker` (never in prod migrations); no remote bindings, inherited CF creds, daily-state resets, or broad cleanup.
- **Basalt & 3D**: Use installed Basalt public controls/tokens and Lucide; keep one 3D viewer, default pause, resource cleanup, and static/text fallbacks on failed WebGL.
- **Brand masters**: Keep approved masters; small app/browser marks use transparent foregrounds, README uses selected presentation ([brand guide](assets/brand/README.md)).
- **Preview gate**: 11 motions (catalog 1.2.0, opt-in YouTube refs) are unreviewed previews ([docs/05](docs/05-experience-and-3d.md)); never set `instructionReady=true` or claim review/completion.
- **Deploy**: Push CI on `main` auto-deploys (`deploy.yml`): exact-source proof, fresh `main`, no admin bypass or recurring reviewer approval; missing creds fail closed ([docs/08](docs/08-local-and-release.md)).
- **Live vs auth**: Access bypass covers anonymous `GET /api/live` (version/revision + D1, `no-store`, 503 on error); business routes need JWTs and verifier checks `/api/profile` redirect.

## Quality & Local Gates

Follows `system1-quality`; CI slots and `base-ci` pin live in `.github/workflows/quality-slots.yml` (`quality / Z1: Gate` required on `main`). Status terms: `enforced`, `planned`, `manual`, `N/A`.

- **Exceptions / gaps**: `L2 Runtime` is `N/A` (covered by L1/L3); `L3 Integration` runs `test:l2`; `P1 Package` is `N/A` (private app); CI `L4 E2E` runs `test:l3`; L1 80% excludes pure `.tsx` views, Three.js, and local Vite `dev/**` plugin.
- **Local hooks**: Installed by `bun install --frozen-lockfile` (`.husky/`); `pre-commit` runs `gate:l1` on staged index (`S1/S2/L1`), `pre-push` runs `gate:pre-push` on pushed refs (`L2/G1/G2`).
- **Evidence**: Rejection probes prove the gate, not app health; tie release evidence to exact SHA, never invent grades/timings ([L1 baseline](docs/12-l1-gate-evidence.md)).

## Resources & Isolation

| Lane  | Endpoint / State                                             | Boundary                                                                   |
| ----- | ------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Dev   | `rhino.dev.hexly.ai` -> `127.0.0.1:7057`, `.wrangler/state`  | Daily local D1 + synthetic user; default on start; keep server running     |
| Tests | `127.0.0.1:<port>`, `.wrangler/tests/run-*` + `_test_marker` | Isolated fixtures; automated tests locked to E2E; no CF creds/remotes      |
| Prod  | `rhino.hexly.ai`, D1 `fe36652a-9c84-485f-bae3-384f395e45ea`  | Access `nocoo`; read-only unless authorized; dev proxies via `cloudflared` |

## Retrospective

Log incidents in [Retrospective.md](Retrospective.md); promote recurring rules to `Invariants` and safeguards to tests/hooks.
