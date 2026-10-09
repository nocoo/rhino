# 05 Experience and 3D

[Index](README.md) | [Product Scope](01-product-scope.md) | [Delivery Gates](07-delivery-and-decisions.md)

> Implementation update (2026-10-09): the local journal is implemented. Read
> [the current runbook](08-local-and-release.md) for selected tooling, implemented
> behavior and unresolved release/3D acceptance. Proposal-era observations below
> retain their historical context and are not current deployment evidence.

## Visual Direction

Proposed direction: a precise personal training studio, not a gamified fitness
template. Use warm mineral surfaces, graphite typography, restrained olive
status accents, and an amber muscle highlight reserved for anatomy. The 3D
stage may be darker for depth, without turning the entire application into a
dark dashboard. Do not use purple gradients, decorative metric cards, oversized
hero sections, or a wall of interchangeable charts.

Adopt the existing Basalt system rather than drawing a competing control set.
Map semantic app tokens to its supported theme tokens; centralize spacing,
surface, border, focus, chart, and anatomical-highlight values. Use the supported
Basalt type stack and tabular numerals for data; verify Chinese glyph coverage
and readable fallbacks if the proposed Chinese-first UI is approved. Avoid an
extra webfont dependency solely to make the screen look different.

Local Basalt integration guidance was inspected. It specifies React 19,
standalone CSS **or** Tailwind 4, granular imports, accessible shell behavior,
and Recharts-backed chart integration. Prefer standalone CSS for this project.
The local source reported version 2.2.0 but the published package and compatible
versions must be checked before installation; an actively changing sibling
checkout is not a release guarantee.

## Shell and Information Hierarchy

### Implemented Basalt Layout Correction (2026-10-09)

The installed API/CSS contract is `@nocoo/basalt` **2.1.8**, standalone CSS.
The reference composition is Life.ai's `app-frame.tsx` and `app-sidebar.tsx`
at `5d7a44fcb520b3b057e68fb1d27fd8b242d32df4`. Basalt's own integration
documentation was checked at `e6c754a2d2482cc2b712d4cacb8d5658479a1d46`;
unreleased layout/density APIs from that checkout are not used here.

- Keep package-owned 260/68px sidebar widths and 56px framework/header rows.
  The 24px brand mark keeps its position during collapse. Expanded navigation
  uses the documented 12px inset and 2px item gap; icon-only items have tooltips.
- The content wrapper uses 12px side/bottom gutters from 768px, 8px below.
  ContentIsland retains its native 20px desktop / 12px mobile padding, without
  wide-screen padding overrides or an extra page-width constraint.
- Page sections use a 24px rhythm, forms/stacks 16px. LayerCard owns header,
  body and footer padding; Field owns label/control/hint spacing. StatGrid and
  StatCard replace the ad-hoc metrics, and Table owns tabular spacing. A local
  overflow wrapper protects narrow tables without shrinking their controls.
- Forms become single-column below 480px. Measurement actions align with the
  input baseline; equipment choices wrap. Today metrics follow the main content
  on phones so logging is not pushed below a column of summary cards.
- Global resets stay in the base cascade layer. Never apply an unlayered
  `button, input, select { font: inherit }` rule: it defeats component utility
  typography. The specialist Three.js stage retains its separate visual surface.

`tests/l3/journal.spec.ts` checks geometry, stable collapse, tooltip names,
mobile navigation/Escape focus return, breakpoint cleanup and both themes at
360/390/768/1024/1440px. Browser screenshots are emitted under
`test-results/l3/browser` for the five pages and prepared/active workout states.
These checks do not certify professional movement accuracy or physical-device
performance. This correction does not upgrade Basalt or change data contracts.

### Product Hierarchy

Use the supported `AppShell -> Sidebar + AppMain -> AppHeader -> ContentIsland`
structure. One content island, compact page heading, meaningful cards. Providers
include the Basalt theme/link/tooltip contracts and one toaster; Rhino owns
navigation, authentication, and data state.

Primary destinations: Today, Plans, Exercise Library, Progress, Profile. Use
Lucide icons with labels; navigation starts from Basalt's 16px/1.5 stroke
convention. The mobile sheet reuses the same navigation model without leaving
duplicate hidden focusable links. Profile settings are not a second dashboard.

| Screen | Desktop | Mobile |
| --- | --- | --- |
| Today | Compact weekly rail, selected workout, actual weekly totals | Today's choice and start action first; week horizontally scrollable within its region |
| Plan editor | Session list with inline composition editor | One session at a time; exercise selector in an accessible sheet |
| Workout | Set log and sticky instructional side panel | One-column log; explicit viewer toggle; current set and save actions stay reachable |
| Exercise library | Search/filter list with selected movement stage | Filterable list, then a dedicated viewer panel; never many active canvases |
| Progress | Weight/BMI chart plus actual workout history | One readable chart at a time, data-table option, non-hover-only values |
| Profile | Short grouped form and measurement history | Labeled controls, native numeric keyboard where appropriate, no multi-column cramped form |

Do not render a full-screen canvas above the essential workout controls on a
phone. The stage supplements logging; it must not make quick recording slow.
Body focus, actual versus planned, units, and save state outrank decoration.

## Interaction and Accessibility

- Reuse Basalt buttons, inputs, dialogs, sheets, toggles, and feedback components
  where available; inspect documented APIs before inventing replacements.
- No clipped page overflow at 360px. Test 390px, 768px, and 1440px layouts plus
  landscape phone, zoom, long labels, and dynamic browser chrome.
- Aim for 44px touch targets; compact visual density does not mean tiny hit areas.
  Normal body/control text is 14-16px; avoid text below 11px.
- Keep visible labels and units, keyboard focus, Escape behavior, dialog focus
  return, and announced save errors. Do not communicate muscles or completion
  status by color alone.
- Charts have data alternatives, accessible date filters, gaps for missing
  observations, and visible units. A zero baseline is not required for weight,
  but the scale must be honest and clear.
- Provide restrained view transitions only where useful; reduced-motion mode
  removes decorative animation and starts movement instruction paused.
- Avoid auto-rotating anatomy, hover-only controls, celebratory motion during
  a workout, and countdowns that imply the owner must rush a lift.

## The 3D Instruction Contract

### Implemented Preview Correction (2026-10-09)

The stage header, muscle legend and camera controls occupy document flow rather
than covering the canvas. Canvas height is 360-560px (340-460px in compact cards),
scaled against the small viewport height. The camera fits baked full-repetition
bounds at the current aspect ratio and reserves room for handheld equipment.
Front, side and rear presets reset framing; detail fits the highlighted regions
while retaining the current direction. Posterior-focused movements open at the rear.
Below 1024px, the exercise picker is a horizontal scrollable row rather than an
eleven-item vertical list above the viewer; each button exposes its selected state.

The bind-pose shoulder/elbow axis now distinguishes deltoid caps, anterior upper
arm and posterior upper arm. Pushes highlight triceps; pulls and curls highlight
biceps. This corrects the global-height classification but is still a surface
approximation, not individually segmented anatomical tissue.

Catalog 1.1.0 contains eleven clips/posters. Five added dumbbell movements are
available through the existing pre-training selector: curl, triceps kickback,
lateral raise, bent-over row and calf raise. Automatic A/B templates remain
foundational rather than silently substituting isolation work. Every asset is
still draft with `instructionReady=false`; no professional review is implied.

Asset tests check animated bounds, three camera directions and mask partitioning.
Browser tests scrub all eleven clips with unobstructed controls on desktop/mobile,
capture arm views, and save/reopen the new selections with precise per-hand loads.
These are technical regressions, not anatomical or coaching certification.

### Acceptance Contract

**Realistic authored animation is a core deliverable, not decorative polish.**
Every selectable strength movement needs a licensed, reviewed model/clip pair.
A capsule person, disconnected rotating limbs, generic idle animation, or an
unreviewed stock clip does not satisfy this requirement.

Two coordinated views are sufficient:

1. **Technique view:** credible adult proportions, neutral fitted clothing or
   non-graphic anatomical surfaces, correct equipment, full movement context,
   stable planted feet/hands, and clearly visible joint paths.
2. **Muscle view:** cropped local detail with surface anatomy/selected muscle
   meshes, readable muscle contours, and labeled primary/secondary roles.
   Fade surrounding surfaces deliberately; do not imply tissue deformation or
   EMG measurements that the model does not compute.

Highlighting communicates educational involvement, not a quantified activation
percentage, a diagnosis, or proof that a particular muscle is working in the
viewer. Exercise selection, phase text, and muscle labels remain readable
without the canvas.

Required controls: play/pause, replay, scrub a single repetition, slower playback,
front/side/three-quarter preset, reset view, primary/secondary muscle toggles,
and a technique/muscle view switch. Touch orbit must not hijack ordinary page
scrolling. Each movement includes setup, execution, breathing cues, common
mistakes, and a stop/seek-guidance note for pain or uncertain technique.

## Asset Sourcing and Legal Gate

No model, rig, texture, or motion asset has been acquired or approved.

| Path | Value | Limitation and decision |
| --- | --- | --- |
| Licensed rigged anatomical adult plus authored clips | Best direct path to coherent realism and repeated movements | Confirm web redistribution, derivative work, source/archive rights, costs, and qualified review; recommended path if budget permits |
| BodyParts3D-derived local muscle detail | Credible anatomical starting geometry with explicit attribution | Static anatomy, not an exercise rig or validated motion library; substantial retopology/rigging may be required |
| Z-Anatomy repository | Rich anatomical material | Mixed per-asset licensing; cannot adopt the entire repository under one permissive assumption |

[BodyParts3D's current license page](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html),
updated 2025-02-27, states CC BY 4.0. Confirm the exact downloaded release and
its terms; old mirrored releases can carry different terms. Its required
attribution, with the copyright symbol represented here as an HTML entity, is:
"BodyParts3D, &copy; The Database Center for Life Science licensed under CC
Attribution 4.0 International". Mark modifications and retain the license link.

[Z-Anatomy's license file](https://raw.githubusercontent.com/Z-Anatomy/Models-of-human-anatomy/master/License.txt)
has an umbrella BY-SA 4.0 statement but also identifies assets with noncommercial
terms, including inner-ear and kidney material. A top-level license is not
sufficient evidence for every mesh. Avoid importing an entire archive when only
a few muscle regions are needed.

Each adopted asset requires a manifest: source URL, creator, exact release/hash,
license text, attribution, modifications, redistribution restrictions, editable
source location, export settings, reviewer/date, and matching exercise IDs.
Keep third-party licenses separate from the repository MIT license. No purchased
or restricted source assets are committed to a public repository without rights.

## Production Pipeline

1. Approve one representative exercise and realistic reference appearance.
2. Acquire or author a proportionally credible rig and necessary equipment.
3. Author the movement in a DCC tool such as Blender; verify equipment alignment,
   joint axes, contact, range, phase timing, and absence of mesh intersections.
4. Add intentionally simplified muscle-region meshes or overlays with named
   identifiers; do not label an anatomical guess as accurate.
5. Have a suitably qualified movement reviewer check technique and muscle
   mapping, including individual variation and safe instructional wording.
6. Export versioned glTF/GLB animations. Optimize geometry/textures only after
   checking visible anatomy, skinning, and muscle-label fidelity.
7. Create a reviewed static poster/phase sequence from the same source asset.
8. Record provenance and browser performance; only then enable catalog selection.

Proposed first catalog for equipment review: goblet squat, dumbbell Romanian
deadlift, machine chest press, seated cable row, lat pulldown, and dumbbell
shoulder press. This covers several common patterns but does not imply these
movements fit every person. The owner may replace the list based on actual
equipment. No unsupported catalog variation is selectable just because its
name is familiar. Cardio logging does not need a fabricated strength-style clip.

Start with **one** approved movement to prove the art and runtime path. A small
complete catalog is preferable to fifty unverified animations. The first
working journal milestone may precede the full catalog, but the product must
not be declared feature-complete before realistic instruction passes acceptance.

## Three.js Runtime

Use a small direct Three.js scene module behind a React component, unless the
implementation reveals a concrete reason to add React Three Fiber. Use
`GLTFLoader` and `AnimationMixer` for authored clips; scrubbing controls mixer
time rather than inventing joint rotations in the render loop.

- Lazy-load the viewer code and the selected model. Dashboard navigation must
  not download the full 3D library or every exercise asset.
- Reuse a compatible rig where it genuinely fits; do not build a generic asset
  orchestration framework before the first clip works.
- Keep one active canvas. Pause when hidden/offscreen; render on demand while
  paused. Clamp pixel ratio and reduce costly effects on mobile.
- Begin with physically plausible materials, soft baked/contact shading, and a
  restrained light rig. Avoid real-time subsurface-scattering ambitions or heavy
  postprocessing that hides movement detail and overheats a phone.
- Dispose geometries, materials, textures, renderer resources, observers,
  controls, and animation mixers on replacement/unmount. Account for image bitmap
  cleanup; a JavaScript garbage collection assumption is not enough.
- Handle resize, device-pixel-ratio changes, context loss, failed downloads,
  route changes, and reduced-motion preferences.
- Introduce Meshopt/KTX2 only when measurements justify them; host any required
  decoders with the app and verify worker/CSP compatibility rather than using
  arbitrary third-party script URLs.
- When WebGL is unavailable, show the reviewed static phases and cues. That
  accessibility fallback is not a substitute for delivering the required 3D.

Official API references: [GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html),
[AnimationMixer](https://threejs.org/docs/pages/AnimationMixer.html),
[KTX2Loader](https://threejs.org/docs/pages/KTX2Loader.html).

## Acceptance Budgets and Review Evidence

These are **proposed targets**, not measured achievements:

| Area | Target and verification |
| --- | --- |
| First movement transfer | Selected rig/clip/textures <=5 MiB compressed; report actual network transfer |
| Mobile animation | At least 30 fps during a 60-second reviewed clip on the agreed physical phone; record device/browser/thermal conditions |
| Ordinary routes | No 3D model requests until instruction is opened; logging remains responsive while assets load |
| Resource lifetime | Twenty open/close or exercise switches without monotonic GPU/resource-count growth; inspect renderer counters and browser memory |
| Form fidelity | Reviewer approves setup, equipment, phases, range, breathing cues, and muscle labels per exercise |
| Accessibility | Keyboard-only controls, named buttons, reduced-motion initial pause, complete static/text alternative |
| Recovery | Failed model request/context loss does not discard session edits; retry/fallback remains usable |

Record side/front stills and a full repetition video at desktop and mobile sizes.
Performance numbers cannot waive incorrect anatomy; realism cannot waive an
unusable phone experience. If the first asset cannot meet both, revisit asset
complexity before multiplying the catalog.
