# 12 L1 Gate Evidence

[Index](README.md) | [Infrastructure](06-infrastructure-and-quality.md) | [Local and Release](08-local-and-release.md)

Point-in-time L1 staged-snapshot and rejection-probe measurements (originally
recorded under the legacy `system0-6dq-l1 v1.1.3` rubric). Rejection probes
prove the gate, not application health; do not invent grades or timings.

## Measured Baseline

Recorded at pinned `main` revision `aadae12` on Linux x86_64 with Bun 1.4.4,
Node from the project CI pin, and `bun install --frozen-lockfile` (clean tree).

| Check              | Command                                                    | Exit              | Cold  | Warm  |
| ------------------ | ---------------------------------------------------------- | ----------------- | ----- | ----- |
| Husky chain        | `sh .husky/pre-commit` (`bun run gate:l1` on staged index) | 0 (healthy index) | —     | 12.7s |
| L1 snapshot gate   | `bun run gate:l1`                                          | 0                 | 13.8s | 12.7s |
| L1 rejection suite | `bun run gate:verify`                                      | 0                 | ~30s  | ~30s  |

Coverage from the staged snapshot run (`gate:l1`, exit 0): statements **98.61%**,
branches **96.23%**, functions **98.75%**, lines **99.02%** (each floor 95%).

## Gate Execution and Rejection Coverage

- Parallel steps inside `gate:l1`: `typecheck`, `lint`, `test:coverage`;
  failures aggregate through `Promise.allSettled` and reject the hook. Wall time
  remained under the 30s target on the measured machine without skipping checks.
- `gate:verify` builds a disposable Husky repo with real runners, proves a
  healthy commit, then auto-cleans after verifying rejection for:
  - UT failure
  - each coverage metric below floor (fixture uses a 101% probe threshold)
  - lint error and warning
  - type error
  - `test.skip` and `test.only`
  - staged bug with an unstaged fix
  - missing tool
  - child signal and timeout
  - missing `coverage-summary.json`
  - empty suite
  - parallel sole failure (`typecheck` fails while `lint` and UT succeed)
- CI runs `bun run gate:verify` in the `l1-precommit-gate` job (`L1: Unit (Pre-commit Gate)`) inside `.github/workflows/quality-slots.yml`, gated by `Z1: Gate`.
