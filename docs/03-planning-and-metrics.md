# 03 Planning and Metrics

[Index](README.md) | [Evidence](02-training-evidence.md) | [Data Model](04-architecture-and-data.md)

> Implementation update (2026-10-09): the local journal is implemented. Read
> [the current runbook](08-local-and-release.md) for selected tooling, implemented
> behavior and unresolved release/3D acceptance. Proposal-era observations below
> retain their historical context and are not current deployment evidence.

All rules in this document are proposed. Source IDs refer to
[the evidence register](02-training-evidence.md). Pure functions will live in
`src/domain/planning.ts` and `src/domain/metrics.ts`; the Worker validates and
persists their results. No model API or external recommendation service is needed.

## Inputs and Units

| Input | Meaning and handling |
| --- | --- |
| Birthday | Valid date-only `YYYY-MM-DD`, optional; reject future dates |
| Timezone | Confirmed IANA timezone; determines local dates, weeks, and months |
| Experience/goal | Beginner or returning general-fitness owner initially; strength-first or endurance-first preference |
| Weekly frequency | Integer 1-7 available sessions; not an instruction to train hard every day |
| Availability | Preferred weekdays, per-session time budget, optional cardio-only slots |
| Equipment | Explicit catalog equipment IDs; never substitute unavailable equipment |
| Measurements | Finite positive kg and cm with an effective local date; plausibility warnings, no silent clamping |
| Guidance mode | Generic estimates allowed, disabled, or clinician-provided range; uncertainty disables numeric zones |
| Feedback | Actual completion, perceived effort, tolerance, pain flag, and explicit adjustment preference |

Age is full elapsed calendar years on the workout's local date, not
`milliseconds / 365 days`. Use March 1 as the non-leap-year anniversary for
February 29 birthdays; document and test this product convention. A timezone
change affects future scheduling, not the local dates already stored on sessions.

No birthday means no age-derived HR values. Do not guess age from other data.
Outside the approved recommendation population, retain journal access but do
not generate a supposedly personalized exercise prescription.

## Weekly Plan Generation

Use Monday-Sunday weeks in the selected timezone. Store an ordered weekly
template rather than pre-creating a database row for every future calendar day.
The owner may start any template today, reschedule it, or start a cardio-only
session. Preserve the connection to its source plan without enforcing attendance.

1. Validate scope, time, equipment, and available reviewed exercise assets.
2. Reserve explicitly requested cardio-only days.
3. Offer the simplest remaining strength schedule from the table below.
4. Place demanding same-muscle strength sessions on nonconsecutive days where
   possible; approximately 48 hours is a recovery heuristic, not a universal law.
5. Allocate preparation, strength, cardio, and recovery within the time budget.
6. Show a preview with rationale, compromises, and unfilled requirements.
7. Persist only when accepted. Identical inputs and catalog/algorithm versions
   produce the same preview; there is no random monthly exercise shuffle.

| Weekly slots | General-fitness proposal, before explicit cardio-only overrides |
| --- | --- |
| 1 | One full-body session or one cardio session by preference; explain the frequency limitation |
| 2 | Two full-body sessions with different emphasis; cardio additions only if time permits |
| 3 | Two full-body sessions plus one cardio-only session; optionally three tolerable full-body exposures when strength is the priority |
| 4 | Two full-body sessions plus two cardio sessions; a reviewed upper/lower split is an alternative, not the beginner default |
| 5-7 | Keep two or three strength sessions; distribute the remaining slots across easy/moderate cardio and recovery-oriented activity |

The table is a product default, not a claim that a particular split is superior.
Full-body sessions may emphasize different regions without neglecting the other
major movement groups. Do not market one-body-part-per-week routines as meeting
the twice-weekly coverage guidance.

When the user reserves all slots for cycling, honor that choice and show the
strength-training gap. If available equipment, movement tolerance, or reviewed
assets cannot support the plan, return an explicit limitation and offer a
smaller valid plan; do not invent a movement or silently change constraints.

## Session Composition and Time

For a strength-priority session: easy aerobic preparation, specific warm-up
sets, main strength work, optional substantive cardio, and gradual recovery.
For endurance priority, place the main cardio work first or in a separate
session. Do not confuse a short easy warm-up with an endurance training block
[E4-E6].

Example **allocation**, not a medical prescription: a 60-minute mixed session
may contain 8 minutes easy warm-up, 35 minutes strength including specific
warm-up/rest/transitions, 12 minutes main cardio, and 5 minutes cool-down.
Its main-work ratio is `35:12`; preparation and recovery are shown separately.
A 45-minute cycling session may contain `5 + 35 + 5` minutes with **100% cardio
main work**. Neither example necessarily fulfills a weekly aerobic target.

Strength time estimation must include each set's estimated execution time,
prescribed rest, warm-up sets, and equipment changes. Label it approximate.
If a session does not fit, offer fewer exercises/sets or less optional cardio;
do not secretly shorten recovery or double the required pace. Durations remain
user-editable, and impossible allocations produce validation feedback.

## Strength Prescription and Progression

Initial coaching defaults for review:

- Two working sets per selected movement, commonly 8-12 controlled repetitions,
  leaving roughly 2-3 repetitions in reserve (RIR). Warm-up sets are separate.
- RIR is the estimated number of additional technically acceptable repetitions,
  not a heart-rate or pain scale. Beginners may estimate it poorly.
- Offer roughly 2 minutes rest for larger compound movements and 60-90 seconds
  for smaller movements, adjustable for recovery and technique.
- Use an individually controllable range of motion; never force depth or joint
  angles simply to match the model. Pain is not a progression target.
- Do not require a 1RM test. The owner selects a manageable starting load, with
  technique guidance and the option to leave load unrecorded.

These are heuristics informed by [E2, E3], not exact outputs of those sources.
Load may mean total external load, per-hand dumbbell load, or a machine stack;
each exercise declares its convention. Unilateral repetitions are per side.
Assisted exercises must not invert progression by treating more assistance as
more resistance. Unsupported load conventions are excluded from the first catalog.

Progression is a suggestion requiring confirmation: after two comparable
sessions reach the top of the rep range on all working sets, with tolerable
effort and no reported pain, suggest the smallest available load increment and
return to the lower rep target. If the equipment increment is too large, keep
the load and discuss reps/sets instead. Do not increase load and volume together
by default. Missing effort data or a changed variation blocks automatic inference.

Missed sessions never trigger punishment, compressed catch-up, or an automatic
increase. A return after a break, repeated difficulty, or pain prompts review
and a conservative reduction or pause, not a diagnosis or rehabilitation plan.

## Monthly Review and Session Immutability

- On the first visit in a new local month, show "review due." No cron is needed.
- Show completion, actual minutes, exercise history, and feedback from the prior
  period. Lack of records is uncertainty, not proof of poor adherence.
- Offer to retain the plan, change frequency/duration, or replace unsuitable
  exercises. Explain every recommended change.
- Accepting creates an immutable plan revision with month, inputs, algorithm
  version, catalog version, and reasons. Multiple revisions in a month are valid.
- If review is deferred, keep using the current plan. A month boundary must not
  strand an active session or erase its snapshot.
- Starting a session copies the chosen template. Pre-workout edits change that
  session only. Completed actual logs never become edits to the source template.
- Corrections to a completed log are explicit version-checked saves with an
  `updated_at` value; a full audit/event-sourcing system is unnecessary initially.

## Cardio Intensity and Heart Rate

The initial design uses **percent estimated HRmax**, not heart-rate reserve:

```text
age = full calendar years on the local workout date
estimated_hrmax = 208 - 0.7 * age
moderate_reference_bpm = estimated_hrmax * [0.50, 0.70]
vigorous_reference_bpm = estimated_hrmax * [0.70, 0.85]
```

The maximum estimate comes from Tanaka [E7]; the broad percentages come from
AHA [E9]. AHA's own chart uses `220 - age`; Rhino's combination is an explicit
product choice, **not a reproduction of that chart or a validated personal
prescription**. Other standards use different boundaries. Do not call the
result a laboratory zone, lactate threshold, or "Zone 2."

For age 40: estimated maximum `180 bpm`; moderate reference `90-126 bpm`;
vigorous reference `126-153 bpm`. Round only the displayed endpoints. The 70%
boundary is shared educational guidance, not an automatic classifier. Do not
derive recorded intensity or moderate-equivalent minutes solely from this estimate.

Alongside it, show CDC's 0-10 relative-effort description: moderate around 5-6
(can talk but not sing); vigorous begins around 7-8 (only a few words before a
breath) [E10]. This is distinct from strength-set RIR. Disagreement between
perceived effort and pulse calls for caution, not a demand to chase the number.

Generic numeric zones are suppressed for an unknown birthday, out-of-scope age,
or when the owner indicates that medication/medical advice makes them
inappropriate. A clinician-provided range may be stored as a clearly labeled
manual override with its date; do not adjust medication or derive a replacement
zone. Do not recommend a self-administered maximal test to resolve uncertainty.

The screen states that estimates can differ substantially from measured values
[E8]. It cannot detect emergencies. Chest pain, severe unusual breathlessness,
or fainting during exercise mean stop and seek urgent medical help as appropriate;
use location-appropriate emergency wording, not a hardcoded UK number [E13].

## Measurements, BMI, and Trends

```text
bmi = weight_kg / (height_cm / 100) ** 2
moderate_equivalent_minutes = actual_moderate_minutes + 2 * actual_vigorous_minutes
```

Store height and weight observations independently with effective local dates
and UTC write timestamps. One observation of each kind per date is sufficient
initially; corrections require explicit replacement and a revision check.

For a weight point, use the latest height effective **on or before** that date.
No earlier height means no historical BMI unless the owner explicitly adds a
historical height. Adding today's height must not backfill the entire chart.
Editing a historical height intentionally recalculates affected derived BMI
points; explain that effect. Store source measurements, not a second persisted
BMI truth. Show one decimal place, calculate from unrounded values.

Example: `80 kg / 1.8 m squared = 24.691...`, displayed `24.7`. No automatic
clinical classification, body-fat estimate, training-load change, or red/green
judgment is needed. If categories are later added, specify the standard and its
population; CDC adult categories are not for ages 18-19 [E12].

Plot actual observations against their real dates. Do not fill missing days with
zeros or fabricate measurements by interpolation. A trend line is a visual aid,
not a new observation. A weigh-in reminder derives from the most recent weight
date and the user's cadence, not from an invasive notification permission.

Weekly cardio totals use actual segments and declared intensity, not planned
minutes. Easy/unknown intensity is displayed but does not silently count toward
the moderate-equivalent goal. Count a warm-up segment only if its actual intensity
qualifies, and never count it again as main cardio. Strength block duration
includes rest and is not interchangeable with aerobic minutes.

## Required Deterministic Tests

| Area | Cases |
| --- | --- |
| Dates | Birthday today/tomorrow, leap day, invalid/future date, month/year boundary, timezone change |
| Plan | Frequencies 1-7, all-cardio choice, unavailable equipment, no valid substitute, budget too small |
| Progression | Missing effort, partial sets, pain flag, changed variation, unsuitable equipment increment |
| Versioning | Same inputs repeat, deferred review, multiple revisions, active session during rollover |
| HR | Age-40 example, missing birthday, guidance disabled, manual override, no HRR/HRmax mixing |
| BMI | Example above, zero/NaN/infinite rejection, no historical height, corrected dated height |
| Totals | Partial session, skipped sets, unknown cardio intensity, no warm-up double count, local week boundary |

Medical and coaching review is additional to software testing; passing unit tests
cannot establish that a training instruction is appropriate for an individual.
