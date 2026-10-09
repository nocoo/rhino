# 01 Product Scope

[Index](README.md) | [Evidence](02-training-evidence.md) | [Delivery](07-delivery-and-decisions.md)

> Implementation update (2026-10-09): the local journal is implemented. Read
> [the current runbook](08-local-and-release.md) for selected tooling, implemented
> behavior and unresolved release/3D acceptance. Proposal-era observations below
> retain their historical context and are not current deployment evidence.

## Purpose and Assumptions

Rhino helps one person decide what to train, understand the movement, and record
the result with little friction. It is a private training journal with
explainable recommendations, not a medical device or an autonomous coach.

**Proposed initial recommendation scope:** apparently healthy adults aged 18-64
pursuing general fitness or basic strength development. The owner's actual age,
experience, equipment, injuries, and goals are unknown. This is a review gate,
not a claim about the owner. Logging remains available when automated advice is
inappropriate. Specialized rehabilitation, pregnancy/postpartum programming,
youth training, and older-adult fall-prevention programs are outside the initial
generator and require separate expertise.

The site is single-user. Cloudflare Access authentication does not turn it into
a multi-user service. There is no registration, social feed, coach marketplace,
subscription system, or invitation flow.

## Core Journeys

### Set Up a Profile

Enter a date-only birthday, timezone, height, current weight, experience, goal,
available equipment, weekly session count, preferred days, and time budget.
Confirm whether generic heart-rate estimates are appropriate; do not request a
detailed medical history. Allow skipping birthday, but explain that age-based
heart-rate guidance is unavailable until it is supplied.

Height and weight can be entered again on later dates. The first measurement
creates history; editing a profile must not silently rewrite old measurements.
The owner can choose an in-app weigh-in cadence. No email, push notification, or
background reminder service is necessary for the first release.

### Review and Choose a Plan

Show a week with separate strength, cardio, and recovery information. Display
the requested number of sessions and explain any gap between that schedule and
general public-health recommendations. Do not invent available time or force
every workout to contain strength.

Each workout card includes its body focus, exercises, sets/reps, estimated
duration, and time allocation. Cardio-only cycling is a first-class option.
The owner chooses a workout for today rather than being locked to a date.

At each new local calendar month, prompt for a review. Offer a new version based
on completion, tolerance, available time, and explicit feedback. The current
plan remains usable until the new version is accepted.

### Prepare and Learn

Before starting, adjust the selected session's exercises, set count, rep target,
load if known, rest, and cardio duration/intensity. Compatible substitutions
must have their own validated instruction. Defaults apply to this session only;
changing future workouts requires an explicit plan revision.

Open the movement viewer without losing edits. It shows realistic movement,
primary and secondary muscles, setup, breathing and technique cues, common
errors, and a usable static alternative. The animation is a teaching aid, not a
claim that every body must match an exact pose.

### Train and Record

During a session, keep the current exercise, set controls, and rest timer easy to
reach with one hand. Save actual repetitions and load, skipped sets, and cardio
minutes without navigating through a long form. A timer must recover elapsed
time from timestamps when the browser is suspended; it cannot depend on a
background interval running continuously.

After training, offer a compact summary and an explicit "performed as planned"
shortcut. Never mark unconfirmed targets as performed. Partial workouts are
valid. Zero, not recorded, and skipped are different states.

The UI reports "saved" only after the server confirms. An interrupted request
can be retried without duplicate sessions or sets. Retain an unsaved in-memory
draft and warn before leaving; cross-reload offline sync is not in the first
release. A browser crash can lose unsent edits and must not be marketed otherwise.

### Review Progress

Show actual workout completion, actual cardio duration and intensity, and
dated weight/BMI trends. Separate plans from results. Charts include units,
date ranges, missing-data behavior, and an accessible table. Avoid invented
calories, estimated body-fat percentage, or an opaque "fitness score."

## Acceptance Matrix

| Requirement | Observable acceptance |
| --- | --- |
| One owner | A valid Access token for another user is rejected; no first-visitor ownership claim |
| Durable data | A fresh authenticated browser retrieves the saved plan, session, and measurement from D1 |
| Weekly frequency | One to seven requested slots are supported; missed slots do not become forced catch-up workouts |
| Monthly refresh | Accepting a new month creates a revision; old plans and completed sessions are unchanged |
| Strength and cardio | Mixed sessions and a cycling-only session can both be planned and completed |
| Session edits | A changed exercise or set target affects only that session unless a plan change is explicitly accepted |
| Fast recording | A prepared workout can be confirmed as performed, reviewed, and saved from one summary screen |
| Realistic instruction | Every selectable strength exercise has a reviewed, licensed 3D clip and muscle mapping |
| Body measurements | Dated height/weight corrections are possible without silently changing unrelated history |
| Heart-rate guidance | Birthday-derived estimates show method and limitations; medication override suppresses generic zones |
| Desktop/mobile | No horizontal page overflow at 360px; keyboard and touch workflows both complete |
| Reliability | Repeated submission is idempotent; stale multi-tab edits produce an actionable conflict, not data loss |

These are release gates, not claims that the current repository passes them.

## Deliberate Boundaries

- No wearable integration, GPS routes, camera pose estimation, or live form scoring.
- No generative-AI training prescriptions; use deterministic, testable rules.
- No mandatory maximal-strength test or maximal-heart-rate test.
- No nutrition plans, weight-loss promises, or automatic intensity increases from BMI.
- No offline service worker, shared-user permissions, distributed job queue, or cron
  just to notice a new calendar month.
- No placeholder 3D assets presented as finished exercise instruction.

Detailed behavior is in [planning and metrics](03-planning-and-metrics.md);
unresolved choices are in [delivery and decisions](07-delivery-and-decisions.md).
