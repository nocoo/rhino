# Retrospective

## 2026-10-09 - Initial implementation integration

The first implementation exposed several integration mistakes before release.
No production database or deployment was involved.

- The Pi launch used an unavailable provider model spelling, returning 404.
  Relaunching with the locally supported model ID restored progress. Verify
  provider IDs before assigning a long-running task; do not infer them from aliases.
- Grok's backend handoff stalled while urgent integration messages queued.
  The coordinator stopped and closed its owned pane, explicitly transferred
  source ownership, and fixed the blocked code. Ownership changes must be stated
  before two agents edit shared files; long reasoning is not delivery evidence.
- A current-date Worker compatibility value exceeded the pinned workerd's maximum
  and prevented local startup. The configuration now uses supported 2026-09-25.
  Verify compatibility against the installed runtime rather than guessing from
  the calendar alone, and track the intentional date when upgrading the runtime.
- `_test_marker` was initially included in the application migration, colliding
  with the quality runner's isolated marker initialization. It was removed from
  the production schema; tests now own initialization and guarded cleanup.
- The first staged-snapshot strategy assumed the offline Bun cache was complete.
  Installation disproved that assumption. The gate now verifies exact lockfile
  and manifest pins, then uses copy-on-write dependency clones instead of a
  network-dependent install or a writable shared link. Failure fixtures exercise
  the actual staged-index path and preserve the user's index.
- Concurrent workerd instances used by repeated SQLite marker probes produced
  Miniflare internal errors. Read-only node:sqlite marker checks now inspect the
  known run-owned D1 database without starting a competing emulator. The first
  database search also counted metadata.sqlite; the guard now identifies the
  expected hashed D1 filename and rejects ambiguity. Run-owned remnants were
  cleaned only after marker verification.
- Domain validation called a date calculation after invalid date parsing, causing
  a thrown error rather than the intended 400 response. Both dates are now checked
  before the secondary range refinement, with a regression test.
- Number inputs used step=0.1, so browsers blocked valid precise measurements
  before a request was sent. step=any now matches the unrounded-storage contract;
  desktop/mobile workflows use nontrivial decimal fixtures to detect regression.
- Biome migration left the initial rules preset disabled. Integration review
  found it before commit; preset=recommended is explicit and zero-warning checks
  now run over the application, tests and gate scripts. Formatting success alone
  must never be called lint enforcement.
- G2 found vulnerable transitive sharp 0.35.4 and undici 7.29.0. Exact patch
  overrides select sharp 0.35.5 and Miniflare's undici 7.29.1 while preserving
  jsdom's newer undici. The public Access audience false positive received an
  exact-string allowlist that retains default secret rules. Both scanners were
  rerun; no dependency finding was suppressed to permit publication.

The quality gates blocked these failures rather than being lowered. Automated
success still does not establish professional review of the authored movements,
physical-phone performance or readiness of an undeployed production service.
