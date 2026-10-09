<p align="center">
  <img src="../assets/brand/icon-rounded.png" width="128" height="128" alt="Rhino logo" />
</p>
<h1 align="center">Rhino</h1>
<p align="center">A personal training journal: plan strength and cardio, record each set, and follow your progress.</p>
<p align="center">
  <a href="https://rhino.hexly.ai">Website</a> ·
  <a href="../README.md">简体中文</a>
</p>

## What it does

Rhino is a single-owner fitness planning and journaling website. Plan around weekly availability, session duration and equipment; adjust exercises and sets before starting, then record what you actually completed. The Chinese-first interface supports desktop and mobile. Cloudflare Access restricts identity, while a Worker and D1 store the profile and training history.

This is a personal preview, not professional coaching or medical care. The 3D movements have not received qualified review. Muscle highlights approximate surface regions, not precise tissue segmentation or measured activation. Real-person videos are external references, not personalized prescriptions. Stop and seek professional guidance when a movement is unclear or painful. Physical-phone performance still needs separate verification.

## Features

- **Training plans:** generate weekly strength/cardio sessions from frequency, time, equipment and priorities, including cardio-only cycling. Adopting a refreshed monthly plan preserves immutable previous revisions.
- **Workout records:** replace movements and adjust sets, repetitions and cardio duration before starting. Log actual repetitions, load, reps in reserve (RIR), skipped sets and cardio intensity afterward, without counting planned work as performed work.
- **Exercise laboratory:** eleven strength movements with 3D illustrations, muscle regions, Chinese cues and static phase posters. Every movement has an attributed YouTube reference; third-party content connects only after explicit loading.
- **Personal progress:** record dated height and weight and inspect trend curves. Preserve input precision, use historical height for BMI, and derive uncertain heart-rate estimates from birthday, with support for clinician-provided ranges.
- **Reliable saves:** store personal records in D1, check update conflicts and preserve the original target snapshot after a workout starts. BMI is not a diagnosis; an age-based formula is neither a safety ceiling nor a strength-load prescription.
- **Local isolation:** switch Local/E2E/Prod in the development header. Daily local records, disposable tests and online data stay separate; stale tabs cannot silently retarget their requests.

Curls, kickbacks, lateral raises, bent-over rows and calf raises are selectable before training; automatic plans retain the foundational A/B templates. Weigh-in prompts, interactive progression suggestions and other unfinished capabilities are listed under [current limitations](08-local-and-release.md#open-acceptance-work).

## Usage

1. Open the [website](https://rhino.hexly.ai) and authenticate through Cloudflare Access as the allowed owner.
2. Set birthday, equipment and training preferences in the profile, then record height and weight.
3. Preview and adopt a weekly plan. Select a session for the day and adjust it before starting.
4. Record performed sets and cardio afterward; review records and trends in the progress view.

Personal pages and business APIs require the owner identity. In the current source, anonymous `GET /api/live` exposes only the application name, version, revision and minimal database health, never personal records; unavailable storage returns 503. Source changes are not necessarily deployed: check [Releases](https://github.com/nocoo/rhino/releases) and [deployment results](https://github.com/nocoo/rhino/actions/workflows/deploy.yml).

## Development

Use Node **26.10.0**, Bun **1.4.2** and pinned TypeScript **7.0.2**. If the machine blocks the official npm registry, follow its configured mirror policy without replacing source URLs in the lockfile.

```sh
bun install --frozen-lockfile
bun run db:migrate
bun run dev
```

On the configured development machine, open [rhino.dev.hexly.ai](https://rhino.dev.hexly.ai); Caddy forwards to `127.0.0.1:7057`. Local uses a synthetic identity and local D1 without production credentials. Do not expose it publicly. Other machines need their corresponding local domain and save origin configured; see [local setup](08-local-and-release.md).

| Mode | Data and behavior |
| --- | --- |
| Local | Default on every server start; `.wrangler/state` persists daily development data |
| E2E | Creates a fresh temporary Wrangler database; leaving removes only its matching marked instance |
| Prod | Proxies to the hosted Worker with real Access identity; reads and writes affect production |

Switching confirms the loss of unsaved edits and reloads the page. Old tabs are rejected rather than redirected to the new environment. Automated tests are locked to E2E. Hosted production has neither the selector nor the local gateway.

If production access from local development is deliberate, install `cloudflared`, sign in and explicitly select Prod:

```sh
bun run login:prod
```

Credentials remain on the local server, never in browser JavaScript.

```sh
bun run typecheck
bun run lint
bun run build
```

Deployment uses pinned public `nocoo/base-ci` workflows and successful CI evidence for current main, without recurring reviewer approval. Self-hosting requires replacing the maintainer's account, D1, domain and Access configuration before deployment; do not deploy against existing resources. Configuration, migrations and recovery are documented in the [release runbook](08-local-and-release.md).

## Tests

After installing dependencies, run from the repository root:

```sh
bun run test:coverage
bun run test:l2
bun x --no-install playwright install chromium
bun run test:l3
```

Vitest runs unit tests; Worker tests invoke real isolated local D1. L2 checks APIs over HTTP, and L3 exercises desktop/mobile browser journeys. Tests generate independent RS256 keys and marked temporary databases, strip inherited Cloudflare credentials, and never write to daily Local or production data. Start L2/L3 through these runners.

## Stack

| Technology | Role |
| --- | --- |
| React · Vite · Basalt · Lucide | Chinese-first responsive UI, controls and icons |
| Three.js | Movement illustrations, camera controls and muscle regions |
| Recharts | Personal measurement and training trends |
| Cloudflare Workers · D1 · Access | APIs, persistence and owner authentication |
| TypeScript · Zod · jose | Types, input validation and JWT verification |
| Bun · Biome · Vitest · Playwright | Scripts, static checks, unit and browser tests |

## Documentation

- [Documentation index](README.md)
- [Training evidence and boundaries](02-training-evidence.md)
- [Planning and metric algorithms](03-planning-and-metrics.md)
- [Architecture and data contracts](04-architecture-and-data.md)
- [Interface and 3D acceptance](05-experience-and-3d.md)
- [Local environments, release and recovery](08-local-and-release.md)
- [Real-person video sources](09-video-references.md)
- [Brand asset usage](../assets/brand/README.md)
- [Maintainer instructions](../AGENTS.md) · [Changelog](../CHANGELOG.md)

## License

Application code and documentation use [MIT](../LICENSE). Bundled MakeHuman geometry and rig assets retain their separate **CC0** license. Source revisions, hashes, modifications and limitations are recorded in [model provenance](../assets-source/README.md); no purchased assets are included.
