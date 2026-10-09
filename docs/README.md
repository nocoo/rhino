# Documentation

Status: local preview implemented after research on 2026-10-09. Documents 01-07
retain the original requirements and research context. Document 08 records the
current implementation and open acceptance gates; none certifies medical safety.

| Document | Purpose |
| --- | --- |
| [01 Product Scope](01-product-scope.md) | User journeys, boundaries, and acceptance criteria |
| [02 Training Evidence](02-training-evidence.md) | Research method, findings, limitations, and source register |
| [03 Planning and Metrics](03-planning-and-metrics.md) | Weekly frequency, monthly revisions, workout rules, BMI, and heart rate |
| [04 Architecture and Data](04-architecture-and-data.md) | Module boundaries, Access, D1, API, and reliable saves |
| [05 Experience and 3D](05-experience-and-3d.md) | Responsive interaction, visual direction, assets, and motion acceptance |
| [06 Infrastructure and Quality](06-infrastructure-and-quality.md) | Local findings, Cloudflare, base-ci, test isolation, and deployment gates |
| [07 Delivery and Decisions](07-delivery-and-decisions.md) | Approval choices and independently verifiable implementation stages |
| [08 Local and Release](08-local-and-release.md) | Current local setup, implementation limits, production and recovery runbook |
| [09 Video References](09-video-references.md) | Attributed external movement demonstrations and verification limits |

## Reading Conventions

- **Requirement:** explicitly requested by the owner.
- **Evidence:** a cited source or a dated local observation.
- **Proposal:** a product or technical choice awaiting review.
- **Gate:** a condition that must be resolved before the affected work proceeds.
- **Target:** an acceptance budget or quality goal, not a measurement.

The documents use English as requested. Product interface language is a separate
decision; the implementation uses Chinese-first UI without an internationalization
framework.

## Remaining Review Priorities

1. Accept the realistic movement preview and obtain qualified technique review.
2. Verify the actual interface and motion on the owner's phone.
3. Complete protected production configuration, recovery and exact-source CI.
4. Follow the release runbook; no production deployment has occurred.

Return to the [project overview](../README.md) or [agent handbook](../AGENTS.md).
