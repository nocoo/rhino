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
