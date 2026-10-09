# Retrospective

## 2026-10-09 - Initial implementation integration

The first implementation exposed several integration mistakes before release.
No production database or deployment was involved.

- The Pi launch used an unavailable provider model spelling, returning 404.
  Relaunching with the locally supported model ID restored progress. Verify
  provider IDs before assigning a long-running task; do not infer them from aliases.
- Grok's backend handoff stalled while urgent integration messages queued.
  The coordinator stopped and closed its owned pane, explicitly transferred
  source ownership, and fixed the blocked code. Ownership changes must be stated
  before two agents edit shared files; long reasoning is not delivery evidence.
- A current-date Worker compatibility value exceeded the pinned workerd's maximum
  and prevented local startup. The configuration now uses supported 2026-09-25.
  Verify compatibility against the installed runtime rather than guessing from
  the calendar alone, and track the intentional date when upgrading the runtime.
- `_test_marker` was initially included in the application migration, colliding
  with the quality runner's isolated marker initialization. It was removed from
  the production schema; tests now own initialization and guarded cleanup.
- The first staged-snapshot strategy assumed the offline Bun cache was complete.
  Installation disproved that assumption. The gate now verifies exact lockfile
  and manifest pins, then uses copy-on-write dependency clones instead of a
  network-dependent install or a writable shared link. Failure fixtures exercise
  the actual staged-index path and preserve the user's index.
- Concurrent workerd instances used by repeated SQLite marker probes produced
  Miniflare internal errors. Read-only node:sqlite marker checks now inspect the
  known run-owned D1 database without starting a competing emulator. The first
  database search also counted metadata.sqlite; the guard now identifies the
  expected hashed D1 filename and rejects ambiguity. Run-owned remnants were
  cleaned only after marker verification.
- Domain validation called a date calculation after invalid date parsing, causing
  a thrown error rather than the intended 400 response. Both dates are now checked
  before the secondary range refinement, with a regression test.
- Number inputs used step=0.1, so browsers blocked valid precise measurements
  before a request was sent. step=any now matches the unrounded-storage contract;
  desktop/mobile workflows use nontrivial decimal fixtures to detect regression.
- Biome migration left the initial rules preset disabled. Integration review
  found it before commit; preset=recommended is explicit and zero-warning checks
  now run over the application, tests and gate scripts. Formatting success alone
  must never be called lint enforcement.
- G2 found vulnerable transitive sharp 0.35.4 and undici 7.29.0. Exact patch
  overrides select sharp 0.35.5 and Miniflare's undici 7.29.1 while preserving
  jsdom's newer undici. The public Access audience false positive received an
  exact-string allowlist that retains default secret rules. Both scanners were
  rerun; no dependency finding was suppressed to permit publication.

The quality gates blocked these failures rather than being lowered. Automated
success still does not establish professional review of the authored movements,
physical-phone performance or readiness of an undeployed production service.

## 2026-10-09 - Basalt Layout Drift

The first UI used Basalt components but overrode their geometry: 18-40px shell
gutters, oversized rail branding, uninset navigation and an unlayered control
font reset. On phones, unwrapped equipment choices collapsed into narrow text
columns. Passing workflow tests had not established visual compliance.

The correction follows the installed 2.1.8 package and the corresponding
Life.ai shell, not unreleased APIs from the newer Basalt checkout. Card slots,
Field, Table and statistics components now own their standard spacing. Browser
checks measure rail/header/island/control geometry and exercise both themes,
collapse, drawer focus and narrow-screen overflow alongside the real workflows.
The first exact logo-position check caught a 1/64px flex-centering difference;
an explicit compact brand row now gives identical expanded/collapsed placement.
Inspect computed browser geometry and screenshots before claiming conformity;
component imports and passing business tests alone are insufficient evidence.

## 2026-10-09 - Clipped Motion and Misplaced Arm Masks

Fixed camera distances did not account for narrow canvases or raised arms, and
overlaid labels consumed the visible motion area. Upper-arm masks were divided
by a global height threshold in unshifted source coordinates, conflating shoulder
and arm regions; pushes and pulls also reused the same arm mask. Passing business
tests and generating a GLB had not established framing or muscle placement.

The exporter now partitions arms relative to shoulder/elbow joints and bakes
sampled motion bounds. Runtime framing fits those bounds and the current aspect
ratio. Controls sit outside the canvas, with a rear preset for posterior muscles.
Regression checks inspect the actual exported mesh and sampled animation, not
only hardcoded catalog labels; browser stills cover full extension and both arm
surfaces. These approximations remain explicitly unreviewed.

Catalog expansion also exposed stale provenance when replacing a movement in an
old draft. The replaced movement now adopts its source catalog version without
rewriting the plan snapshot or unrelated historical targets. It also clears the
old movement's planned load instead of silently reinterpreting its weight convention.

Inspection of the added clips caught inherited all-around lower-leg highlighting
and floating feet in hinged poses. Calf masks now exclude the shin, and the added
hinge/toe-rise poses anchor their supporting joints with sampled contact tests.
The first persistence browser run used a more specific kickback label than the
UI exposed; the shared UI name now explicitly identifies the bent-over variant.
