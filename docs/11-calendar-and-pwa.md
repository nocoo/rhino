# Calendar and Installed Experience

## Workout calendar

The month view queries its complete six-week window instead of relying on the
home page's one-year summary. All retained immutable plan revisions are available;
each date uses the highest revision accepted by that date in the plan's timezone.
The adoption day uses the final accepted revision for that day. Future dates are
weekly projections, not booked appointments or completed work. No current plan is
backfilled into dates before its adoption. Session targets and source revisions
remain the authoritative snapshots for recorded workouts.

Date cells distinguish scheduled plans, completed records and unfinished records.
Selecting a date exposes every session on that day. Returning from the session
editor retains the selected date. Previous/next month, direct month input and
Today provide cross-month navigation. Errors never masquerade as empty results.

A scheduled date up to today supports manual recording. This creates an active
record with empty actuals and no timer, opens the actuals editor, and requires an
explicit finish confirmation. It never copies planned repetitions or cardio into
performed work. Normal timed training starts only for today. Completed sessions
remain correctable under the existing version checks.
