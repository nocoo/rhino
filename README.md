# Rhino

A private fitness planning and training journal, built for one person.
Weekly structure, honest workout records, and a clear view of personal progress.

**Status: working local preview, not released.** The journal and automated
quality checks run locally. Eleven Three.js movements are illustrative previews;
professional movement review and production acceptance remain open.

## Features

- Weekly strength/cardio plans based on frequency, time, equipment and priority;
  cardio-only cycling is supported. Monthly adoption creates immutable revisions.
- Pre-session movement, sets, repetitions and cardio-duration adjustments;
  actual repetitions, load, RIR, skipped sets, cardio intensity and quick logging.
- Dated height/weight without storage rounding, historical-height BMI, trends,
  birthday-based estimated heart-rate guidance and clinician-entered overrides.
- Responsive Chinese-first Basalt interface, Lucide icons, realistic-proportion
  rig with eleven authored clips, muscle-region highlights and static phase posters.
- Dumbbell curls, triceps kickbacks, lateral raises, bent-over rows and calf raises
  are selectable before training; the foundational automatic A/B plans stay unchanged.
- Cloudflare Access owner authorization, version/conflict checks and local D1.
- Opt-in, attributed YouTube demonstrations for all eleven strength movements.
- Local/E2E/Prod development selector: persistent local records, disposable test
  records, or an authenticated proxy to the production Worker, never a remote test binding.

The model's muscle highlights are approximate surface regions, not tissue
segmentation or measured activation. Motion, equipment alignment and physical-phone
performance still require acceptance. This is not a medical or exercise prescription.

## Develop

Node **26.10.0**, Bun **1.4.2**, TypeScript **7.0.2**. Use the permitted local
registry mirror if the machine blocks npmjs; CI uses the portable frozen lock.

```sh
bun install --frozen-lockfile
bun run db:migrate
bun run dev
```

Open **https://rhino.dev.hexly.ai** on the configured development machine.
Caddy forwards to loopback port 7057. Local mode uses a synthetic identity and
local storage; do not expose it publicly. No production credentials are needed.
Each development-server start defaults to **Local**, regardless of the previous
selection. Switching discards unsaved edits after confirmation and reloads the
page. Other tabs using an old instance are rejected, not redirected to new data.
**E2E** creates a separate temporary Wrangler database; leaving it removes only
that marked instance. Automated tests lock both UI and server to E2E.

To deliberately use **Prod**, first authenticate with `bun run login:prod`, then
select Prod in the header. The token remains in the local proxy, never browser
JavaScript. This mode reads and writes real production data. Hosted production
does not expose the selector or the local gateway.

```sh
bun run typecheck
bun run lint
bun run test:coverage
bun run test:l2
bun run test:l3
bun run gate:security
bun run build
```

Husky checks the staged index, not an unstaged corrected worktree. Coverage
requires all four metrics >=95%; the wrapper also rejects skipped/empty suites.
`bun run gate:verify` exercises failure rejection in a disposable repository.
Tests mint their own RS256 keys and use isolated local D1, never daily/remote data.

## Deployment

Target: **https://rhino.hexly.ai**. One Worker, Static Assets and D1, protected by
Cloudflare Access. Stable Wrangler 4.135.0 and the public `nocoo/base-ci` workflows
are pinned. Deployment is manual and requires a successful exact-source CI run,
fresh main, production protection and a confirmed D1 UUID. No cloud deployment
or GitHub Release has been performed yet.

See [the runbook](docs/08-local-and-release.md), [training research](docs/02-training-evidence.md),
[design and 3D acceptance](docs/05-experience-and-3d.md), and [all documents](docs/README.md).
Exact agent commands and boundaries: [AGENTS.md](AGENTS.md).

## License

Application code and documentation: [MIT](LICENSE).
Bundled MakeHuman geometry/rig assets retain their separately stated **CC0**
license. Source revision, hashes, modifications and limitations are recorded in
[assets-source](assets-source/README.md); no purchased assets are included.
