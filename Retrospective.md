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

## 2026-10-10 - Removing Approval Was Not Continuous Delivery

Removing production reviewers did not make deployment follow main: the consumer
still required a manual workflow dispatch. The previous release also checked
the exact public health revision outside CI, while its deployment verifier only
checked the Access redirect. That split could mark an automatic deployment green
without proving that the expected Worker revision was live.

Deployment now follows successful same-repository main push CI, retaining the
pinned source-proof and fresh-main guards. Its verifier checks uncached anonymous
D1 health against the checkout SHA and manifest version before the business
Access redirect. Regression tests reject wrong versions, stale revisions,
unhealthy or cacheable responses and missing Access protection. Approval policy,
automatic triggering and deployed-revision verification are separate requirements.

The first push exported HTTP proxy variables for Git, which also reached the
pre-push tests. Wrangler printed its proxy warning before `d1 execute --json`,
so strict JSON parsing correctly rejected the output and blocked the push.
The owned test state was cleaned up. Scope Git's proxy with
`git -c http.proxy=http://127.0.0.1:7890 push` and leave local test subprocesses
free of proxy variables; do not weaken JSON parsing or bypass the hook.

## 2026-10-12 - Verify Pane Context and Workout Viewport

The inherited Herdr environment identified a different workspace than the live
Rhino controller. Using `--current` created an empty pane in that other space.
Only that newly created pane was immediately closed; no existing process was
touched. Subsequent commands used the controller's explicitly verified live pane
ID. Check inherited IDs against the agent inventory before layout operations.
The documented Pi Sol alias also returned 404; the task was moved to the available
Luna runner rather than changing shared model configuration.

Initial workout browser checks caught missing focus restoration on dialogs opened
outside a DialogTrigger, and screenshots exposed desktop controls scrolling the
current heading out of view. Explicit trigger focus restoration and a compact
desktop timer/control grid address these defects. Keep viewport assertions for
the heading, total clock and completion action alongside persistence checks;
successful HTTP writes alone do not prove a usable training screen.

A final browser repeat exposed a pre-existing sidebar-image race: the assertion
read `complete` immediately after opening the mobile drawer, before the image
finished loading. It now waits for the same readiness predicate with Playwright's
normal assertion deadline. The same run also hit three mobile timeouts while
host load averages exceeded 100, after earlier complete and focused runs passed.
Do not attribute every timeout to application code, increase deadlines to hide
it, or stop unrelated host processes. Keep the failed run distinct from earlier
passing evidence and repeat the affected checks separately.
The focused replay passed the corrected image check; the three mobile timeouts
persisted. Keep mobile replay pending rather than reporting the latest run green.

## 2026-10-12: Basalt 3 consumer verification

A broad read of the local coding-agent configuration, intended only to identify
the review model, also printed an existing credential-bearing setting into the
local tool transcript. No credential was copied into this repository or used in
an external request. Read only explicitly allowlisted non-secret fields; model
selection does not justify dumping configuration. Credential rotation remains
an owner action, not part of a UI upgrade.

The first geometry update assumed every Basalt 3 control would be exactly 34px.
The date input retains a native 36px intrinsic height; the version guide describes
reference geometry, not fixed heights. Browser checks now preserve that native
behavior while asserting the new navigation and field spacing. Palette checks
separately cover a roomy desktop and a deliberately short viewport rather than
assuming a 720px desktop has enough room for every reference panel.

The owner then saw broken steppers and drawer motion locally despite passing
isolated checks. An HTTP read proved the daily Vite process was still serving
the old cached Basalt stylesheet without 3.0 dimension tokens. Restarting only
the owned dev process with `bun run dev --force` restored the installed CSS.
After a dependency upgrade, verify the running development asset as well as the
installed version; fresh isolated servers cannot catch a stale daily server.

New visual tests initially left active workouts behind in the shared disposable
suite database, causing a later resume-workout test to select the wrong fixture.
Finish each visual test's session explicitly. Also wait for modal removal before
capturing preparation: an immediate screenshot after Escape captures the exit
animation, not the intended page. Preview content now survives that exit instead
of briefly turning into an empty dialog.

## 2026-10-12: Compact segment hit-region verification

The compact header applies a 44px minimum directly to nested segment buttons,
inflating the entire pill. Separating painted height from the pseudo-element hit
region initially produced only 42px of effective hit height: absolute offsets
start inside the button's border. Real browser hit tests at both vertical edges
caught this on desktop and mobile. Include border width in the inset calculation
and verify elementFromPoint, not only CSS dimensions. Also wait for the Select
exit animation before taking a finishing-dialog screenshot.

## 2026-10-12 — Calendar browser fixture collision

The new calendar L3 scenario passed desktop but selected two "Continue recording"
buttons on mobile because both projects share one disposable test database and
seeded the same historical date. The production list correctly displayed both
records. Scope the fixture action to one matching record and verify its date;
never assume a shared test day has exactly one session. No daily or production
records were touched.

## 2026-10-12 — Review launcher model name mismatch

The supplied model spelling `group/auto-gpt-6.1-sol` was rejected by the live
provider. No review ran. The provider identifies this route as
`group/auto-gpt-6-1-sol`; relaunch the task-owned reviewer with that exact name.
After stopping an interactive agent, verify the shell is ready before starting
another: terminal keyboard-protocol teardown briefly prefixed the next command.
Neither a settled pane nor a launch command alone proves review completion.

## 2026-10-12 — Manual cardio and landscape review gaps

The manual-record route reused the overview, which exposed cardio minutes but
not intensity. Records stayed unknown and could not contribute to equivalent
cardio totals. Expose the existing intensity editor in both manual and completed
records; verify persistence, reopening, correction and the resulting API totals.
Portrait-only checks also missed phase gutters reverting on landscape phones.
Use touch capability alongside the narrow breakpoint for paint, leave safe-area
geometry with Basalt, and exercise rotation explicitly. Simulated Chromium
insets remain distinct from native Safari acceptance. Inspect the screenshot as
well as color assertions: the first landscape pass retained desktop navigation
and left too little room for the clock. Keep touch training immersive in both
orientations and assert a usable, scrollable content viewport.

## 2026-10-12 — Sidebar avatar intrinsic sizing

An application `h-9 w-9` override displaced Avatar's built-in token sizing, but
those utility classes were absent from the standalone stylesheet. A small test
image hid the resulting intrinsic-size bug. Remove the redundant override and
test a 512px identity image against Basalt's default 36px avatar geometry.

## 2026-10-13 — Route fixtures and pane targeting

Native routing deliberately preserves the profile or session on reload. Older
browser fixtures assumed every reload returned home and selected an arbitrary
pending record. Target the created session ID explicitly and assert the new page
title. Shared desktop/mobile fixture dates also require selecting by identity,
not the first record on that day.

Herdr's inherited current-pane context resolved to another workspace during the
review launch. The newly created empty pane was immediately closed; no existing
agent or file was changed. Use the verified live Rhino pane ID for control calls
and confirm the resulting workspace and split proportions before launching work.

## 2026-10-13 — Native URL and skip-link review

The first parent-path check accepted a leading slash without validating the
parsed origin. Backslashes and normalized double slashes can turn apparent local
paths into external URLs. Validate the URL origin and keep only canonical local
destinations. The native skip-link fragment also bypassed the router's history
index; focus the main landmark without adding a navigation entry. Cover malformed
parents and keyboard skip activation before cancelling dirty-editor navigation.

Editing shared UI files during the Vite-backed L3 run invalidated its stable-code
assumption; interactive controls detached or returned to their initial view while
the runner was using them. Finish source edits before the final full browser run.
Visual inspection also caught retained island scrolling across pages and clipped
date labels. Reset the island at page/record boundaries and assert visible titles
and complete label geometry, not merely successful route changes.
