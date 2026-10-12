# Immersive Workout Flow

Introduced in v0.2.0 (2026-10-12). This is a personal training preview,
not professional exercise review.

## Basalt 3 Presentation

The application pins the published `@nocoo/basalt` 3.0.0 artifact. Integration
and compatibility guides were checked against the installed package and upstream
revision `e3071c168e148381848b021d802f0972a3f7c0e7`. Standalone CSS remains the
only stylesheet contract. Sidebar owns its 260/68px geometry, navigation insets
and collapse animation. Collapse sits in the expanded header; expand sits under
the collapsed mark, with keyboard focus preserved when the control moves. The
mobile Sheet retains the package's 6px backdrop blur, 350/250ms entry/exit and
reduced-motion behavior. The shell owns safe-area padding once.

The pinned 3.0.0 stylesheet resolves normal rail motion to 180ms; read its token,
not older 300ms documentation. After upgrading, restart Vite with `--force`:
a long-running server can retain the former dependency stylesheet even though
the installed package and isolated test servers already use the new artifact.

Brand controls use AccentProvider's supported primary override: HSL
`215 72% 39%` in light mode and `210 80% 74%` in dark mode. Training uses a
separate, theme-independent blue-family palette with white foregrounds:

| Phase | HSL background | CSS token suffix |
| --- | --- | --- |
| Strength | `215 72% 34%` | `strength` |
| Preparation | `192 72% 28%` | `preparation` |
| Main cardio | `202 78% 32%` | `main` |
| Recovery | `205 32% 32%` | `recovery` |
| Inter-set rest | `158 48% 25%` | `rest` |

These `--rhino-training-*` tokens apply only to the specialist live workout
surface, not library cards, modal roots, menus or charts. Static contour lines
at 2.5% white and a bounded 5% highlight add depth with a combined wash below 8%,
without reducing text contrast below 4.5:1; hints use 90%
white. Labels continue to identify phases independently of color. White primary
actions use the current phase as their foreground. Preparation and record review
retain ordinary Basalt surfaces.

The timer's text block is centered inside its ring. The active stage centers in
the available content height; short screens scroll only that region while exit,
finish and save actions stay outside it. Desktop keeps a bounded colored panel
and reference column instead of covering the entire monitor. Clocks still show
elapsed time; this presentation update does not introduce countdown completion
or change persisted training data.

Preparation uses compact chronological rows: cardio labels and minute controls
share one row; strength pairs an uncropped illustrative thumbnail with the
exercise selector and preview action, followed by rest guidance and set/repetition
controls. All number steppers use left/right buttons with at least 44px targets,
including live load entry. Long fractional values use compact typography without
changing storage precision; narrow record rows stack to retain readable per-hand
load units. Redundant unit suffixes are omitted only in preparation where the
mobile label already says sets or repetitions. Group headings use the 22px row line
with 8px separation from their content. Avenir Next/DIN display preferences fall
back to the existing Basalt fonts; no remote font request is introduced.
Entering a session resets the island scroll once, without resetting it on edits
or timer ticks. Preview content remains intact through its closing animation.
Untimed active records explicitly say timing has not started; opening an overview
never creates inferred timestamps.

The exercise row shares one centerline for its thumbnail, selector and preview
action. The redundant field label is visually hidden, not removed from assistive
technology. The header environment segment paints 28px items inside a 32px pill;
its pseudo-element hit regions retain 44px height, including border compensation.
The finishing dialog groups its header, elapsed summary, fields and actions with
16px section gaps and the package's responsive footer instead of inline buttons.

An existing positive rest countdown switches the live screen to green, a leaf
icon and an explicit rest heading while retaining the next task's prescription.
Starting early or reaching zero returns to the next task's palette; the end of
rest never starts a set or records performed work automatically. Other phases
use restrained Lucide markers. The CSS texture adds no assets or animation.

## Interaction

- Preparation follows the target block order, with estimated start offsets.
  Select another slot from the session's source plan revision before starting;
  changes affect this draft only. Sets, repetitions and cardio minutes use
  labelled button steppers. Movement previews open on demand.
- Active mobile training removes dashboard chrome, retains a visible exit and
  finish action, and gives the current task, total clock, step clock and recording
  controls priority. Desktop retains the sidebar and a separate reference column.
- Confirming preparation starts the first segment. Completing a set or segment
  saves it before advancing. Subsequent steps begin explicitly. Rest is a prompt,
  derived from the previous finish timestamp, not a forced delay.
- Technique dialogs keep clocks running. They reuse the paused, disposable 3D
  viewer with its static fallback and return focus to their opening control.
- Load controls retain an existing planned/recorded value or offer an explicit
  15 kg preset. Five-kilogram increments are input conveniences, not progression
  or safety recommendations. Unselected load remains null; per-hand and total
  conventions are visible. Stored precision is preserved.
- Plan/record review remains reachable throughout training. Started targets and
  provenance remain immutable; actual records can be corrected. Switching the
  actual plan after starting requires ending this session and creating another.
- Finishing is explicit and supports partial completion. An unfinished step is
  not silently marked performed. The old bulk "as planned" shortcut is removed.

## Timing and Persistence

`SessionActual.timing` contains UTC `startedAt`, nullable `endedAt`, and bounded
step entries keyed by target set/cardio IDs. Timing is absent for records that
were not timed; it is not reconstructed from record creation/update timestamps.
The existing D1 actual JSON stores it without new tables or data backfills.
Validation rejects duplicate/unknown step IDs, overlaps, reversed intervals,
multiple open steps and incompatible session states.

Clocks derive elapsed wall time from these instants, including rests, background
time and time away from the page. This is elapsed time, not measured active effort.
The current interval is persisted before recording begins. Cardio completion
records measured seconds converted to minutes unless the owner adjusts minutes;
the original timestamps remain available. Intensity is never inferred.

Writes retain the existing origin/auth/body-size protections, version checks and
mutation IDs. Identical retries retain the exact timestamped payload, including
when the first response is lost after the database commits. Controls lock during
saves. An error does not advance the workout, and local edits warn before exit.
Refreshing recovers acknowledged server records; offline persistence is not
claimed. A conflicting tab still requires reloading the current server version.

## Verification Scope

Domain and hook checks cover chronology, timer recovery, null values, corrections,
partial completion, failed writes and duplicate submissions. Isolated desktop and
mobile HTTP/browser tests exercise per-step D1 saves, lost-response retry, dialog
focus, visible finish controls and refresh recovery. User acceptance on the
owner's physical phone remains separate, as does the professional motion gate.
