# Calendar and Installed Experience

## Routes and navigation

The calendar is the default workspace. `/` is replaced with `/calendar` without
adding a history entry. The application uses native `pushState`/`replaceState`
and `popstate`; Basalt breadcrumb links use the same navigation adapter.

| Path                        | Content                                               |
| --------------------------- | ----------------------------------------------------- |
| `/calendar?date=YYYY-MM-DD` | Month calendar and selected-day agenda                |
| `/today`                    | Today's recommendations                               |
| `/plans`                    | Weekly training plans                                 |
| `/library/:exerciseId`      | Selected exercise preview; `/library` opens the first |
| `/progress`                 | Measurements and progress                             |
| `/profile`                  | Personal profile                                      |
| `/sessions/:id?from=...`    | Independently loaded training record and parent path  |

Session links accept `mode=view` for read-only details and `mode=edit` for the
existing plan/actuals editor. Omitting the mode resumes the workout flow. Switching
modes retains the original parent, including the selected calendar date.

Session deep links load their record by ID, including records beyond the home
summary's one-year range. Failed requests remain retryable, and obsolete requests
are aborted. Unknown paths show an explicit missing-page state. Only valid local
page paths are accepted as session parents after URL normalization and origin
validation. Cloudflare's existing SPA asset
fallback serves direct page requests without changing API authentication.

Browser back/forward, navigation actions and breadcrumbs preserve route state.
Unsaved training uses the existing before-unload guards for a single confirmation;
cancelled history traversal restores the current entry without remounting the
editor. Navigation from a saving training session is blocked until it settles.
The framework header contains ancestors and the current title; there is no second
breadcrumb trail inside the page.
Changing pages or records resets the content island's scroll position; selecting
a date or exercise keeps the current page mounted.
The skip link focuses the main landmark without creating a fragment history
entry, so keyboard accessibility cannot bypass the navigation guard's index.

The calendar retains its original spacious layout: a full-width two-column desktop
grid, a sticky month panel, responsive 52-80px date cells and 20px date numbers.
On narrow screens the month and selected-day details stack vertically. Plan
details remain visible without an accordion. The compact statistics strip,
per-cell captions and duplicate monthly archive were removed at the owner's
request; date selection still exposes all records for that day. Basalt 3.0.0
public APIs were checked against its installed guides and the
local Basalt reference at `e3071c1`.

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

Selected-day records use a compact Basalt table instead of individual cards.
Each row contains the training name, status, creation time, actual work and plan
provenance. Three always-visible, 44px icon actions open, edit or delete the
record. Titles use 14px medium text; supporting text uses 12px regular text.
The month grid geometry is unchanged.

Deletion requires explicit confirmation and the record's current version.
`DELETE /api/sessions/:id` accepts `{expectedVersion}` under the existing owner,
Origin and JSON checks. A stale version returns 409 without deleting anything;
the dialog offers reloading the record. Successful deletion refreshes the calendar
and progress totals. Repeating a successful deletion is safe after a lost response.
Migration `0002_session_tombstones.sql` retains only deleted IDs, not workout
payloads, and prevents delayed create retries from resurrecting deleted records.
Apply this migration before running the new API; rolling back application code
must not re-enable unguarded session insertion. This change does not introduce a
recycle bin or delete plans.

A scheduled date up to today supports manual recording. This creates an active
record with empty actuals and no timer, opens the actuals editor, and requires an
explicit finish confirmation. It never copies planned repetitions or cardio into
performed work. Normal timed training starts only for today. Completed sessions
remain correctable under the existing version checks.
Manual and completed records expose actual cardio intensity, defaulting to unknown;
only explicitly recorded moderate/vigorous minutes contribute to equivalent totals.

## Safari and home-screen installation

`viewport-fit=cover` and Basalt's `100dvh` shell remain the only viewport/safe-area
geometry owner. The workout phase paints the document and shell safety gutters,
including landscape left/right insets, without padding the controls twice.
Touch devices retain the immersive training layout when rotated; desktop pointer
devices keep the framed workspace.
`theme-color` tracks the resolved phase or light/dark surface. Browser chrome can
still follow Safari's own tint preferences; web content cannot force toolbar
visibility. Active workouts use their own phase color (green for rest).
The deprecated `apple-mobile-web-app-status-bar-style` key is omitted, allowing
current WebKit to choose status-bar colors from the page. See the
[WebKit maintainer guidance](https://bugs.webkit.org/show_bug.cgi?id=317153#c2).

The manifest and Apple metadata provide standalone launch, scoped root identity,
Chinese app name and approved 192/512 PNG icons. Apple retains its existing opaque
180px touch icon. The new PNGs are whole-canvas derivatives of
`assets/brand/icon.png`; no recoloring or new identity is introduced. `purpose:any`
is intentional: the approved composition is not certified for maskable cropping.

This is an online-only installed application. No service worker, Cache Storage,
offline write queue or cache of private API/Access responses is introduced. Access
authentication still applies on launch. In Safari, use Share > Add to Home Screen
(and Open as Web App when offered). Install production and local testing separately;
each origin owns its own app identity. The local environment always boots Local.
Native iPhone Safari toolbar, safe insets and home-screen installation require
on-device acceptance; Chromium viewport checks are not an iOS certification.
