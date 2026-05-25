# Overview

## What This Scaffold Is

`groundx-web-ui-scaffold` is the canonical runnable starter for GroundX
Studio web UI projects. Managed workspace projects are initialized from this
repo, then agents clone the managed repo, edit locally, commit, push, and
publish.

The stack is intentionally boring:

| Layer | Technology | Purpose |
| --- | --- | --- |
| Frontend | Vite, React, MUI, Emotion | Product UI, routing, auth screens, app shell, browser-safe config |
| Middleware | Express, TypeScript | Session cookies, app metadata, GroundX/Partner/LLM proxying |
| Local persistence | In-memory repository | Fast preview without MySQL |
| Production persistence | MySQL | App-owned state only |
| Deploy | GitHub Actions, Docker, Helm, Kubernetes | Build and publish managed scaffold projects |

## Repo Layout

```text
app/          Vite React frontend
middleware/   Express middleware
deploy/       nginx and Helm deployment assets
scripts/      setup, smoke, deploy-contract, and secret-scan checks
docs/agents/  agent-facing operating docs
```

## Secret Boundary

Browser code must never receive GroundX, Partner, Workspace, runner, LLM,
GitHub, GitLab, database, OAuth, or git-session credentials. The frontend calls
same-origin `/api`; middleware owns upstream calls and server-side env.

Safe browser configuration belongs in `app/src/appConfig.ts` and `VITE_*`
values that are explicitly browser-safe. Server secrets belong in ignored
local env files for development and deployment secrets for production.

## What Is Scaffold-Owned

Auth screens, session hydration, app shell navigation, account menu,
educational tooltip primitives, local preview mocks, middleware proxying,
deploy workflow shape, and baseline tests are scaffold behavior. Do not delete
or weaken them to make a product change easier.
