# Documentation

Status: proposal for review, researched on 2026-10-09. This tree describes the
intended product; it does not certify implemented behavior or medical safety.

| Document | Purpose |
| --- | --- |
| [01 Product Scope](01-product-scope.md) | User journeys, boundaries, and acceptance criteria |
| [02 Training Evidence](02-training-evidence.md) | Research method, findings, limitations, and source register |
| [03 Planning and Metrics](03-planning-and-metrics.md) | Weekly frequency, monthly revisions, workout rules, BMI, and heart rate |
| [04 Architecture and Data](04-architecture-and-data.md) | Module boundaries, Access, D1, API, and reliable saves |
| [05 Experience and 3D](05-experience-and-3d.md) | Responsive interaction, visual direction, assets, and motion acceptance |
| [06 Infrastructure and Quality](06-infrastructure-and-quality.md) | Local findings, Cloudflare, base-ci, test isolation, and deployment gates |
| [07 Delivery and Decisions](07-delivery-and-decisions.md) | Approval choices and independently verifiable implementation stages |

## Reading Conventions

- **Requirement:** explicitly requested by the owner.
- **Evidence:** a cited source or a dated local observation.
- **Proposal:** a product or technical choice awaiting review.
- **Gate:** a condition that must be resolved before the affected work proceeds.
- **Target:** an acceptance budget or quality goal, not a measurement.

The documents use English as requested. Product interface language is a separate
decision; a Chinese-first interface is proposed without adding an internationalization
framework in the first release.

## Review Priorities

1. Confirm the initial training audience, goals, and available equipment.
2. Approve the realistic 3D asset and movement-review path.
3. Choose stable Wrangler or the beta `cf` toolchain before scaffolding.
4. Confirm the owner identity and local ports before configuring infrastructure.
5. Approve implementation only after these documents have been reviewed.

Return to the [project overview](../README.md) or the
[agent handbook](../AGENTS.md).
