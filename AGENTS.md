# Rhino

Single-owner fitness planning and journaling with Vite/React/Basalt, a Cloudflare
Worker API and D1. Read [README.md](README.md) and [docs](docs/README.md).
Instructions apply repository-wide; there are no nested handbooks.

## Commands

Use Bun 1.4.2 and Node 26.10.0. TypeScript is pinned to **7.0.2**.
The machine blocks the official npm registry; follow the global mirror policy
without writing mirror tarball URLs into the committed lockfile.

| Command | Purpose |
| --- | --- |
| `bun install --frozen-lockfile` | Install the exact lock and initialize Husky |
| `bun run dev` | Local-only Vite/Worker, port 7057, local D1 |
| `bun run db:migrate` | Apply migrations only to daily-development local D1 |
| `bun run typegen` | Regenerate checked-in Wrangler binding declarations |
| `bun run typecheck` | Strict TS across app, Worker, tests and scripts |
| `bun run lint` | Biome recommended rules and formatting, reject warnings |
| `bun run test:coverage` | Full UT, four 95% thresholds, reject skips/empty/report loss |
| `bun run test:l2` | Real HTTP/Worker/D1 API scenarios with synthetic JWTs |
| `bun run test:l3` | Desktop/mobile Chromium critical workflows |
| `bun run gate:l1` | Check the exact staged index in an isolated snapshot |
| `bun run gate:verify` | Disposable Git/Husky healthy and rejection probes |
| `bun run gate:security` | Gitleaks and OSV; missing scanners fail closed |
| `bun run gate:pre-push` | Pushed-ref L2 and G2 (normally invoked by Husky) |
| `bun run build` | Build Worker and static assets, not deployment |
| `node assets-source/build-model.mjs` | Rebuild the shared rig and eleven clips |
| `node assets-source/build-posters.mjs` | Render matching static phase posters |

## Boundaries

- Communicate in Chinese with the owner's requested honorific. Code, documents,
  comments and Git messages use English; product UI is Chinese-first.
- Use feature hooks as view models, pure domain functions, and bound D1 SQL.
  Do not move logic into `.tsx` to escape coverage or add compatibility layers.
- Plans are immutable revisions. Draft sessions can be adjusted; started
  session targets/date/timezone/provenance are immutable. Actuals can be corrected
  under version checks. Never infer performed work from planned work.
- Dates use YYYY-MM-DD, instants UTC, kg/cm values are not rounded in storage.
  BMI is not a diagnosis. Age-based heart rate is an uncertain estimate for the
  documented 18-64 scope, never a load prescription or safety ceiling.
- Production verifies Access RS256 issuer/audience/expiry/subject and exact
  OWNER_SUB. Blank owner fails closed. Never trust an email header or auto-claim.
- `local` uses a synthetic identity behind loopback Vite/Caddy restrictions.
  `test` requires real synthetic JWT verification using JSON `TEST_ACCESS_JWKS`.
  Production ignores test JWKS and uses the fixed remote Access key endpoint.
- Mutations require exact APP_ORIGIN and JSON; streamed bodies are capped at
  256 KiB. API responses are no-store. Do not log personal payloads or JWTs.
- Tests use per-run `.wrangler/tests/run-*` state and a verified `_test_marker`.
  The marker belongs to tests, never the production migration. No remote test
  bindings, inherited CF credentials, daily-state reset or broad cleanup.
- Use the installed Basalt public controls/tokens and Lucide. Keep one viewer,
  default pause, resource cleanup and static/text alternatives on failed WebGL.

## Verification and Release

Husky pre-commit invokes coverage, strict TS and lint on the staged snapshot.
Four coverage metrics each require >=95%, including auth and feature `.ts`
models. Pure `.tsx` views and Three.js rendering use browser/visual verification.
Rejection probes prove the gate, not application health. Store L1 audit reports
in nmem, not a tracked certification document. Do not invent grades or timings.

The current implementation has passed UT, L2 and desktop/mobile L3 locally.
This is not a published-release assertion; exact-revision CI, production D1,
production environment protection and deployment remain separate evidence.

Local URL: `https://rhino.dev.hexly.ai`, Caddy to `127.0.0.1:7057`.
Production target: `https://rhino.hexly.ai`, Access team `nocoo`.
Use stable Wrangler 4.135.0; this project has not migrated to beta `cf`.
base-ci is pinned to `8816553dc9f4544d1e8486bacb5cce630a9f14cb`.
Deployment is manual, proven successful CI source only, fresh main and protected
`production`. Placeholder D1 UUID is deliberately rejected. Never bypass it.

Eleven motions are **unreviewed illustrative previews**, not qualified instruction.
The realistic-motion acceptance gate in docs/05 remains open. Do not set
`instructionReady=true`, claim expert review or declare feature-complete without
corresponding evidence. Owner preview acceptance cannot substitute for
professional review; any preview release must preserve its limitations.

Commit coherent changes using explicit paths and normal hooks, lowercase
Conventional Commits <=50 characters. No unrequested pushes, hook bypasses,
destructive resets or edits to unrelated infrastructure. Avoid exporting
credentials. Do not change certificates, Keychain or ACL settings.
Record actual incidents in `Retrospective.md`.
