# Rhino

Rhino is a planned single-owner fitness journal with realistic 3D instruction,
Vite frontend, Cloudflare Worker API, and D1 persistence.
Overview: [README.md](README.md). Architecture: [docs/04-architecture-and-data.md](docs/04-architecture-and-data.md).

## Scope and Instruction Sources

- This handbook applies throughout the repository; there are no nested handbooks.
- Preserve project constraints when scaffolding. Do not create a CLAUDE.md copy.
- The owner requested research and documents before implementation. Current
  documents are proposals; do not treat them as deployment or purchase permission.
- Communicate with the owner in Chinese using their requested Chinese honorific.
  Code, documents, comments, search queries, and Git messages use English.
- Source of truth today: the reviewed requirements in `docs/`. No manifest,
  application configuration, schema, or test command exists yet.

## Setup and Commands

This is a documentation-only repository. There is no install/dev/build/test
entrypoint and no dependencies to install. Do not invent successful command runs.

The following inspection command is currently valid from the repository root:

```sh
git diff --check
```

The future script contract is in
[infrastructure and quality](docs/06-infrastructure-and-quality.md). Replace
planned descriptions with exact verified commands when the application lands.
TypeScript must be pinned to **7.0.2**, not the superseded 5.7 requirement.

## Product and Code Boundaries

- Cloudflare Access authentication must be followed by explicit single-owner
  authorization; never auto-claim the first visitor or trust an email header.
- A production owner identity is not known yet. Production access fails closed.
- Use MVVM boundaries: views, feature view-model hooks, pure domain functions,
  and Worker persistence. Prefer bound D1 SQL over a speculative abstraction.
- Keep plan revisions, session targets, and actual results distinct. Session
  edits cannot silently rewrite plans or completed history.
- Use kg/cm, date-only birthday/effective dates, UTC instants, and recorded
  timezone context. Do not round stored values or invent missing measurements.
- Age-based heart rate is an estimate, BMI is not a diagnosis, and training
  defaults are not individual medical prescriptions. Preserve scope limitations.
- Every selectable strength exercise needs reviewed realistic motion, muscle
  mapping, asset provenance, and a static accessible alternative.
- Use Basalt controls/tokens if the proposed integration is approved; do not
  maintain a copied control library. Use Lucide for the requested icons.
- No compatibility layers, generic job systems, AI services, or additional
  Cloudflare products without a demonstrated current requirement.
- Never log tokens, birthdays, weights, workout payloads, or medical details.

## Testing and Quality Contract

All application quality lanes are **planned**, not enforced or certified.

| Dimension | Required contract | Current evidence |
| --- | --- | --- |
| L1 | UT statements/branches/functions/lines each >=95%; strict TS; Biome check-only with zero warnings/errors; installed Husky staged-index gate and failure blocking | Planned; no source, tests, config, hooks, or results |
| L2 | Real local HTTP/Worker/D1 tests for owned routes, constraints, auth and mutation races | Planned |
| L3 | Critical desktop/mobile journeys including realistic instruction and failed-save recovery | Planned |
| G2 | Dependency and secret scanners with missing-tool failure | Planned |
| D1 isolation | Per-run local state, marker guards before writes/reset/cleanup, owned process cleanup | Planned |

The former G1 is included in L1; the framework retains its 6DQ name. Current
hooks/CI: none configured in this repository. No S/A/B/F grade is claimed.
Pre-commit targets the Git index snapshot, not an unstaged fixed worktree.
Personal targets: L1 under 30 seconds; pre-push pushed-ref L2 + G2 under 3 minutes.
These are requirements, not measured timing results. Gates stay check-only and
must reject missing tools, timeouts, skipped required suites, and child failures.

Workers tests use isolated local workerd/Miniflare/D1, never remote test resources
or daily-development data. Initialize a per-run `_test_marker(env=test)` only
after validating the local owned path; verify it before fixture writes/cleanup.

## Resources and Operational Safety

| Purpose | Target / state | Boundary |
| --- | --- | --- |
| Development | `rhino.dev.hexly.ai`; candidate port 7057 | Not configured/reserved; approve mapping before Caddy changes |
| Tests | Candidate L2 17057 and L3 27057 | Per-run local storage/fixtures; recheck ports |
| Production | `rhino.hexly.ai`, Access team `nocoo`, D1 ID unknown | Target only; no deployment verified |

Access issuer/audience and infrastructure evidence are documented in
[architecture](docs/04-architecture-and-data.md) and
[infrastructure](docs/06-infrastructure-and-quality.md). Identifiers are not secrets.
Do not run auto-configuring `cf` commands before the toolchain decision.
Use the selected CLI consistently; migrated `cf` projects must not retain a
parallel Wrangler deployment path. Public base-ci callers require verified
immutable SHA pins and exact-revision deployment evidence.

Deployment, remote migrations, Access/Caddy changes, asset purchases, releases,
and destructive operations require authorization for the specific action.
Do not touch unrelated certificate, Keychain, trust-store, or ACL configuration.

## Completion and Documentation

- Maintain the linked English docs tree and honest planned/enforced/manual/N/A
  status. Configuration inspection alone is not passing execution evidence.
- Commit completed logical changes atomically with explicit paths and a lowercase
  Conventional Commit subject of at most 50 characters. Do not push unasked.
- Report checks actually run, unresolved choices, and unverified behavior.
- Record real incidents in [Retrospective.md](Retrospective.md); keep architecture
  and delivery plans in `docs/`, not in accident narratives.
