# 07 Delivery and Decisions

[Index](README.md) | [Scope](01-product-scope.md) | [Infrastructure](06-infrastructure-and-quality.md)

## Decisions for Owner Review

Confirmed constraints: Cloudflare/D1/Access, Vite, Biome, TypeScript **7.0.2**,
Lucide, realistic Three.js instruction, single-owner use, mobile/desktop quality,
the two Rhino domains, and public base-ci.

The following choices are **not** silently resolved by the proposal:

| Gate | Options and recommendation | What depends on it |
| --- | --- | --- |
| Initial recommendation scope | Proposed healthy adult 18-64 general fitness/basic strength; alternatively expand only with appropriate specialist guidance | Onboarding, safety text, generator, age behavior |
| Training goals and equipment | Confirm strength-first/endurance-first preference, experience, available machines/free weights, weekly frequency/time, and movement constraints | First catalog, templates, progression defaults |
| Realistic assets | Recommended licensed rig plus authored/reviewed clips; alternatively derive suitable open anatomical assets with explicit modeling work | Visual prototype, redistribution rights, archive location, asset/reviewer budget |
| Toolchain | Recommended stable Wrangler for maturity; alternatively explicitly accept `cf` beta and plugin beta 2 | Config format, runtime pins, scripts, base-ci deployment inputs |
| Identity and local mapping | Confirm owner Access subject and policy; approve or replace candidate ports 7057/17057/27057 | Auth setup, local HTTPS, deployment validation |
| Interface | Proposed Basalt with a compact mineral/graphite direction and Chinese-first UI; confirm before visual implementation | Component integration, typography, screen copy |

Personal details do not need to be posted in a public issue or committed to the
repository. Set them through the private local/production onboarding when the
application exists. The asset budget is a permission gate: do not purchase,
download restricted material, or claim expert review without authorization.

## Delivery Strategy

Build complete vertical slices. Each stage leaves the previously working
product usable. Do not replace a usable journal with a half-finished animation
framework. Conversely, do not declare the full product finished while the
requested realistic instruction remains a placeholder.

The stages are implementation proposals, not permission to start now. Resolve
only the gates needed by each stage; production changes retain separate approval.
Each logically complete change gets an explicit-path atomic commit after its
relevant checks. Do not push or publish without instruction.

### Stage 0: Research and Design Review

Deliverables: this documentation tree, root handbook, source register, and
decision matrix. Validate internal links, consistent constraints, and honest
status labels. No application scripts, cloud resources, model assets, or
package installations are part of this stage.

Exit: owner reviews the plan and authorizes implementation, with a toolchain
choice and a path to realistic assets.

### Stage 1: Working Private Journal

Create the selected Vite/Cloudflare configuration, TypeScript 7.0.2, Biome,
Basalt shell, local identity, production fail-closed auth, and initial schema.
Implement profile/measurements plus one manually prepared strength or cardio
session that can be saved and reopened. Keep real user data out of test fixtures.

Paths: package/config files, `src/app.tsx`, `src/styles.css`, profile/session
feature modules, `worker/auth.ts`, initial routes, `migrations/0001_initial.sql`.
Add L1 gates and the local test-isolation foundation alongside code, not as an
unbounded cleanup phase. Install a pinned base-ci quality caller once runnable
checks exist; do not add empty scripts that always pass.

Acceptance: restart the local app, retrieve the same D1 record; reject invalid
identity/owner; handle a failed/retried save without duplication; complete the
basic journal journey on phone-sized and desktop viewports. No cloud deployment
is needed to prove this slice.

### Stage 2: One Realistic Instruction End to End

Produce one approved movement asset and a usable viewer inside the live journal.
Record license/provenance, movement review, camera presets, muscle labels,
reduced-motion behavior, static alternative, and disposal/load-failure behavior.

Paths: `assets-source/README.md`, `public/models/`, exercise catalog, viewer
component, `src/three/exercise-scene.ts`, focused tests and browser fixtures.

Acceptance: owner accepts the actual visual result; a qualified reviewer checks
the technique/muscles; the agreed physical phone meets the proposed performance
budget. A mock screenshot, procedural dummy, or still image alone does not pass.
If sourcing or quality fails, pause catalog expansion without breaking the journal.

### Stage 3: Weekly Planning and Workout Workflow

Implement deterministic frequency/time/equipment rules, plan preview/acceptance,
session snapshots and pre-workout editing, set logging and quick completion,
cardio-only sessions, and version conflicts. Expand the catalog only with
reviewed assets needed by approved templates.

Paths: domain planning/contracts, plan/session view models and views, plan/session
routes, catalog manifest, versioned schema changes only where needed.

Acceptance: choose frequency, preview and save, alter one workout without
changing its plan, finish partially or as planned, retry safely, and verify
actual history. Every selectable strength exercise has working instruction.
Test short time budgets, missing equipment, all-cardio schedules, and two-tab
conflicts. Unmet weekly guidance is explained rather than hidden.

### Stage 4: Review and Personal Progress

Implement month-due review without cron, immutable plan revisions, birthday/HR
guidance with suppression/override, dated height/weight, BMI derivation, actual
training charts, and configurable in-app weigh-in prompts.

Paths: metrics module, progress/profile models and views, progress endpoints,
monthly plan review UI, unit and integration date/metric fixtures.

Acceptance: month rollover leaves an active session intact; missing height does
not fabricate BMI; age and timezone boundaries are correct; disabled generic
heart-rate guidance remains disabled; charts match actual stored observations
and remain usable without hover or color discrimination.

### Stage 5: Local Acceptance and Authorized Production

Complete L2/L3 route/journey coverage, quality failure-injection evidence,
security scanning, realistic asset review, mobile/device testing, and local
Caddy acceptance. Pin the verified public base-ci deploy workflow, configure
only approved resources/owner policies, and prepare recovery verification.

Paths: `.github/workflows/`, `.husky/`, test/gate scripts, selected Cloudflare
config, documented operational commands, asset attribution, updated handbook.

Acceptance: obtain owner approval of the running local site, then obtain/confirm
publication authorization. Prove the exact deployed source revision and enabled
CI gates, perform protected production smoke checks, and verify fresh-browser
Access and real persistence without destructive test data operations.

Do not promise deployment or 6DQ completion until the evidence exists. Replace
planned command/status descriptions with exact runnable commands and dated
verification evidence as each part is actually delivered.

## Release-Blocking Checklist

- The owner can plan, edit, learn, train, save, reopen, and inspect actual progress.
- Unsupported identities, stale writes, duplicate saves, and untrusted inputs
  fail correctly; private data never enters caches, logs, or public fixtures.
- Every selectable strength movement passes license, technique, realism,
  accessibility, and physical-phone performance review.
- Recommendation scope, heuristic labels, HR uncertainty, and BMI limitations
  remain visible without overwhelming ordinary use.
- Required quality lanes run against the intended snapshots and cannot turn
  missing tools, failed tests, or unmeasured coverage into success.
- The local/production domains, database, Access policy, backup plan, and
  deployed revision are verified within explicit authorization.

## Deferred Until a Concrete Need

Wearables, automatic heart-rate imports, route maps, cross-device live sync,
full offline operation, multi-user tenancy, push/email reminders, generative
coaching, computer-vision form assessment, and an expansive exercise marketplace.
No abstraction, cloud product, or schema is reserved for these speculative paths.
