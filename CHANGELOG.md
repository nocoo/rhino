# Changelog

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
