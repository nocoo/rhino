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

## 2026-10-09 - A Rendered Hinge Was Not a Hip Hinge

The owner correctly identified the Romanian deadlift as nonstandard. The old
exporter rotated spine05 while leaving the pelvis stationary, rotated the femurs
as if sitting, and manually translated the root without preserving foot contact.
Camera/framing tests could pass while the displayed movement remained wrong.

The replacement rotates the root so pelvis and torso remain coupled, compensates
the leg joints, anchors contact throughout a 65-sample repetition and steers the
straight arms along the legs. Review of all eleven clips also found an estimated
elbow-length error, widening pulldown grip, drifting seat geometry and overly
straight lateral-raise elbows. These received targeted corrections and actual
GLB kinematic tests. Posters are regenerated from the same model. Dense sampling
made the old first-two-keyframes motion assertion unsuitable; it now compares
the start and midpoint rather than mistaking a smooth initial increment for no
movement. No threshold was lowered to hide a form failure.

The lesson is to inspect the skeleton hierarchy, side views and contact/load
paths before multiplying animations. Technical checks and an official reference
video do not qualify a model as safe instruction; professional review remains
outstanding. The catalog continues to say so prominently.

The expanded desktop/mobile motion suite exceeded its old 180-second aggregate
runner budget while unrelated browser suites shared the machine. The aggregate
deadline is now 360 seconds; individual tests, assertions and quality floors are
unchanged. Cleanup then exposed a stopped-WAL database read difference: Node
26.10's SQLite read the exact marker and integrity check successfully, while
Bun's node:sqlite implementation and system SQLite returned CANTOPEN for the
marker query. The L2/L3 orchestration now runs on the already-pinned Node runtime,
using native node:sqlite as intended. Test state is removed only after the same
path, symlink and exact marker checks; no cleanup bypass was added.

## 2026-10-09 - Local Gateway Integration Boundaries

The initial instance gateway rewrote only `req.url`. The installed Cloudflare
Vite plugin restores Connect's `originalUrl` before calling the Worker, so a
real Local request reached the SPA fallback and returned HTML 200 instead of
API JSON. Locked automated E2E used bare API routes and therefore did not expose
this manual-development defect. Actual Caddy requests found it before release.
Inline forwarding must rewrite both fields and test the downstream restoration;
locked test success alone is not manual environment-switch acceptance.

Review also rejected an initial child-cleanup fallback that removed owned paths
after a database marker check failed. Path ownership cannot replace the matching
database marker. Cleanup must fail closed and preserve the state for inspection.
Serve-only plugin scoping, header allowlisting and sanitized proxy errors are
separate production-boundary checks, not consequences of a passing UI test.

The Cloudflare explorer middleware uses `enforce: pre`; ordinary plugin order
did not put the gateway ahead of it. Real requests still reached daily D1's
explorer until the gateway also used the early phase. The browser selector must
not coexist with an unscoped database-management bypass. Real Local/E2E switching
now checks the explorer boundary as well as the application API.

An attempted model-only atomic commit omitted the Window capability declaration.
The staged-snapshot typecheck blocked it despite passing worktree tests. Adding
the required declaration to the same commit restored a coherent change; hooks
were not bypassed. Review the staged dependency closure, not just edited files.

Actual SIGTERM testing disproved the assumption that Vite's awaited close hook
would run when Miniflare was installed. Miniflare registers a synchronous signal
exit handler and exits before the asynchronous child cleanup finishes. Adding
another parent signal listener did not solve it and was removed. The E2E child
now has a Node IPC channel: loss of its parent closes its own Vite server, then
performs exact-marker cleanup and exits. Real parent termination verified that
the child process and its marked state disappear. Earlier owned orphan states
were stopped and removed only after their original marker passed validation.

One full browser run overlapped edits to the Vite gateway import. The config
restart interrupted the last API assertion (19/20 passed); no business assertion
or timeout was weakened. Freeze gateway sources before the final full rerun.

## 2026-10-09 - Deployment Verification Chose a Bypassed Path

The first deployment uploaded the Worker and applied the initial migration, but
the verification job failed. It assumed `/api/live` inherited the hostname's
Access redirect. The existing shared Access application explicitly bypasses
that path; Rhino's independent Worker JWT check correctly returned 401 instead.
An Access cookie also cannot establish readiness on a path where the edge does
not turn it into an assertion. A direct owner assertion verified D1, version
0.1.0 and the exact deployed source revision.

The verifier now checks `/api/profile` for the configured team's login redirect,
with regression tests for its exact path and invalid responses. Worker auth,
shared Access policy and release gates are unchanged. Inspect path-specific
Access precedence, not only the hostname application, before choosing a probe.
Do not label a failed verification run as a failed upload or as a successful
release; they are separate outcomes that need separate evidence.
