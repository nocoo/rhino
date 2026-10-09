# Rhino

A private fitness planning and training journal for one person, with realistic
3D exercise instruction and a clear view of personal progress.

**Status: research and design proposal.** There is no application, database,
package manifest, CI workflow, or deployment in this repository yet. Review the
documents before implementation. All proposed behavior is unimplemented unless
explicitly stated otherwise.

## Product

- Plan a sustainable training week and review the plan each month.
- Combine strength and cardio, including cardio-only cycling sessions.
- Choose a workout, adjust exercises and sets, then log what actually happened.
- Learn movements and target muscles through realistic Three.js instruction.
- Track dated height and weight, BMI, training consistency, and estimated cardio
  heart-rate guidance.
- Use a compact, professional interface on desktop and mobile.

## Technical Constraints

| Area | Requirement |
| --- | --- |
| Hosting and data | Cloudflare Workers, Static Assets, and D1 |
| Authentication | Cloudflare Access; one authorized owner |
| Frontend | Vite; proposed React and Basalt integration |
| Language | TypeScript **7.0.2**, exactly; replaces the earlier 5.7 request |
| Lint and format | Biome |
| Icons and instruction | Lucide and Three.js |
| CI/CD | Public reusable workflows from `nocoo/base-ci`, immutable SHA pins |
| Production target | `https://rhino.hexly.ai` |
| Local target | `https://rhino.dev.hexly.ai` |

The domains are targets, not evidence of a running service. Runtime versions,
deployment tooling, ports, and 3D assets still have explicit approval gates.

## Documentation

Start with the [documentation index](docs/README.md). The suggested review order
is [scope](docs/01-product-scope.md),
[training evidence](docs/02-training-evidence.md),
[planning rules](docs/03-planning-and-metrics.md), and
[decisions and delivery](docs/07-delivery-and-decisions.md).

Agent instructions and honest quality status: [AGENTS.md](AGENTS.md).
Operational incident records: [Retrospective.md](Retrospective.md).

No install, development, test, or deployment command exists yet. The planned
command contract is documented, not presented as runnable setup instructions.

## License

Repository code and documentation: [MIT](LICENSE). Future anatomical models,
textures, motion clips, fonts, and other third-party assets retain their own
licenses and require an asset provenance record.
