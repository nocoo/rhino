# Changelog

## v0.2.6 - 2026-10-25

- Bump direct and transitive dependencies (Cloudflare toolchain, Vite, Biome,
  Jose, Lucide, Bun types) and override `undici` to 7.30.1 for security fixes.

## v0.2.5 - 2026-10-22

- Run L2 API scenarios sequentially against the shared Vite/Miniflare worker and
  align the session-deletion harness with the established `nodeFetch` transport,
  marker checks and auth header conventions so unauthorized DELETE probes return
  401 instead of tripping Miniflare dispatch failures.
- Stabilize desktop session-record L3 touch-target measurements after calendar
  record rows render.

## v0.2.4 - 2026-10-17

- Polish all user-facing Basalt views (`today`, `calendar`, `plans`, `library`,
  `progress`, `profile`, `session` and `session-plan`) and shared chrome to align
  layout density, surface hierarchy, semantic status badges and CJK typography
  with Basalt template peers.
- Add staggered section entrance motion, phase-colored time-allocation bars with
  grow animations, smooth live workout clock ring sweeps and active camera preset
  states in the 3D exercise viewer, with full `prefers-reduced-motion: reduce`
  support.
- Upgrade plan revision history into a structured version grid, refine collapsible
  static phase previews and muscle role badges in the exercise library, and add
  recessed table containers and coach callouts while preserving all desktop/mobile
  geometry and accessibility contracts.

## v0.2.1 - 2026-10-12

- Add a cross-month workout calendar with historical plan revisions, scheduled
  training, completed results and unfinished records. Preserve the selected date
  when returning from a session.
- Add manual workout recording without fabricating elapsed time or performed
  sets. Allow actual cardio intensity to be saved and corrected, with matching
  moderate-equivalent totals.
- Add an online-only installed web app manifest and approved 192/512 PNG icons.
  Keep private training and Access responses out of service-worker caches.
- Extend phase colors into mobile safe areas and browser theme metadata; retain
  immersive training in landscape on touch devices without duplicating Basalt's
  safe-area geometry. Desktop pointer devices retain the framed workspace.
- Cover calendar navigation, manual recording, installed metadata and landscape
  training through desktop/mobile browser regressions.

This patch follows the owner's explicit Z+1 request. No database schema migration
or authentication change is required. Native iPhone Safari installation and
toolbar acceptance remain pending; Chromium checks do not certify iOS behavior.
The eleven motion previews remain unreviewed illustrations.

## v0.2.0 - 2026-10-12

- Rebuild training as a chronological preparation and immersive workout flow,
  with source-plan choices, exercise previews and mobile-friendly number steppers.
- Persist total and per-step timing, save each completed set or cardio segment,
  recover acknowledged records after reload and retry lost responses safely.
- Keep plan/record review, non-interrupting technique dialogs and explicit partial
  completion available throughout training. Loads use optional 15 kg presets and
  5 kg steps while retaining precise actual values and per-hand units.
- Upgrade Basalt from 2.1.8 to 3.0.0; align sidebar motion and blur, compact header
  controls, exercise rows, finishing-dialog spacing and touch targets.
- Add phase-specific blue backgrounds, white timer typography, green inter-set
  rest, Lucide phase markers and lightweight contour textures. Desktop retains a
  separate reference panel; short mobile screens scroll only when needed.
- Deploy automatically after successful main-branch CI, with exact-source proof,
  anonymous version/revision and D1 health checks, and protected business APIs.
- Extend desktop/mobile browser coverage for persistence, failure recovery,
  layout, contrast, touch regions and rest expiry without automatic recording.

Timing is optional data in the existing session actual JSON; no database schema
migration or authentication-flow change is required. Started targets remain
immutable, and performed work is never inferred from a plan. The eleven motion
previews remain unreviewed illustrations, not qualified coaching.

## 0.1.1 - 2026-10-09

- Adopt the approved rhinoceros identity across the sidebar, startup and failure
  states, browser favicons, Apple touch icon and README presentation.
- Normalize the Chinese README and complete English counterpart, with current
  development, isolation, training limitations and brand-usage documentation.
- Expose anonymous minimal database health on exact GET `/api/live`, with
  no-store responses and sanitized 503 on database failure. Business APIs still
  require the verified owner identity.
- Verify branding, startup recovery, browser metadata, sidebar geometry and
  desktop/mobile themes while preserving training and data behavior.

Health API contract change: successful responses are now top-level
`{ status: "ok", name: "rhino", version, revision }`, not
`{ data: { ok, version, revision, environment } }`. The endpoint no longer requires
a JWT and does not report the environment. This patch version follows the owner's
explicit Z+1 release request. No database migration or dependency update is required.

The 3D previews remain unreviewed illustrations, not qualified coaching.

## 0.1.0 - 2026-10-09

Initial personal preview, with exact-source CI and production verification.

- Add single-owner Cloudflare Access authentication and versioned D1 records for
  profiles, measurements, training plans and workout sessions.
- Add weekly strength/cardio planning, immutable monthly plan revisions,
  pre-workout adjustments, actual workout logging and progress visualization.
- Add Chinese-first deep-blue Basalt desktop/mobile layouts, verified optional
  author avatars, height/weight curves, BMI and estimated heart-rate guidance.
- Add eleven illustrative Three.js movement clips, approximate muscle highlights,
  static fallback phases and opt-in, attributed real-person YouTube references.
- Add a Local/E2E/Prod development selector with instance-scoped requests,
  disposable E2E databases and an explicit Access-authenticated production proxy.
- Add strict local quality gates, real local D1 integration tests, desktop/mobile
  browser tests and pinned public base-ci workflows with main-only manual deployment.
  Deployment requires proven CI, without recurring reviewer approval.

The 3D movements remain unreviewed previews, not qualified coaching. External
videos do not certify Rhino's animation or constitute a personalized prescription.
