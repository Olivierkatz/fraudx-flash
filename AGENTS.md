# AGENTS.md

Table of contents for agents working in this scaffold. Keep this file short:
anything that needs more than one line belongs in the linked reference.

- [**Backlog template**](docs/agents/backlog.md) - single source of truth with stable IDs, statuses, WIP cap, closure rules, and audit checklist.
- [**Discipline rules**](docs/agents/discipline.md) - user-visible definition of done, follow-on hygiene, no tombstones, and no secrets.
- [**Round-trip contract**](docs/agents/round-trip.md) - persisted-state closure checks for public write/read behavior.
- [**Widget architecture**](docs/agents/widget-architecture.md) - app-local widget slots, component taxonomy, and drift guards.
- [**Project overview**](docs/agents/overview.md) - what the scaffold is, where code lives, and the browser/server secret boundary.
- [**Getting started**](docs/agents/getting-started.md) - local setup, preview verification, and managed-project flow.
- [**Testing layers**](docs/agents/testing.md) - which tests prove which behavior, and what counts as a closure test.
- [**Deploy**](docs/agents/deploy.md) - publish, deploy-config, diagnose, uninstall, and environment boundaries.
- [**Workspace deploy ops**](docs/agents/workspace-deploy-ops-endpoints.md) - scaffold workflow role in first-class workspace deployment operations.
- [**Air-gap audit**](docs/agents/airgap-audit.md) - scaffold-neutral inventory template for on-prem runtime host readiness.
- [**MCP tool surface**](docs/agents/mcp-tools.md) - `groundx-studio` tools and connector-vs-MCP metadata rules.
- [**Common gotchas**](docs/agents/gotchas.md) - traps already seen in this scaffold.
- [**Postmortem template**](docs/agents/postmortem-template.md) - compact handoff format for failures and session wrap-up.

## Conventions For Additions

New top-level agent concern means a new file under `docs/agents/` plus a
one-line entry here. Do not turn `AGENTS.md` into a rulebook.
