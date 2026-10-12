# Immersive Workout Flow

Implementation revision: 2026-10-12. This is a local preview for owner acceptance,
not a release or professional exercise review.

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
