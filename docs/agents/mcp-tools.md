# MCP Tool Surface

The `groundx-studio` MCP server is the supported agent path for managed
project operations.

## Common Tools

| Tool | Use |
| --- | --- |
| `project_create` | Create a managed scaffold project |
| `operation_wait` | Poll a long-running workspace operation |
| `deploy_config` | Set deploy variables and secrets |
| `deploy_config_from_local` | Load deploy secrets from ignored local env files |
| `deployment_status` | Read managed deployment status and evidence |
| `deployment_public_health` | Probe public URL health and freshness metadata |
| `deployment_diagnostics` | Queue structured deployment diagnostics |
| `deployment_retry` | Retry the latest managed deployment |
| `deployment_repair` | Queue allowlisted deployment repair |
| `deployment_teardown` | Tear down a managed deployment without deleting the project/repo |
| `workflow_run_status` | Read deploy/diagnose/uninstall workflow status |
| `workflow_run_logs` | Read workflow logs |
| `pod_logs` | Dispatch `diagnose.yml` for Kubernetes pod logs |
| `pod_describe` | Dispatch `diagnose.yml` for Kubernetes pod describes |
| `helm_release_status` | Dispatch `diagnose.yml` for Helm status |
| `helm_uninstall` | Dispatch `uninstall.yml` for lower-level Helm teardown fallback |
| `git_session` | Request short-lived repo-scoped git credentials |
| `clone_project` | Clone the managed repo locally |
| `setup_env` | Generate ignored scaffold env files for local preview |
| `dev_start` / `dev_status` / `dev_logs` / `dev_stop` | Manage a local scaffold dev server |
| `sync_status` | Check local branch and git divergence before push |
| `verify_preview` | Run the scaffold preview smoke check |
| `commit_push` | Commit and push local changes with managed credentials |
| `publish` | Dispatch deployment |

Older audit notes may ask for `cluster_logs` or `cluster_state`. In this
scaffold, those map to the existing read-only diagnostic tools:
`workflow_run_logs`, `pod_logs`, `pod_describe`, and `helm_release_status`.
Do not add alias tools unless the MCP surface itself changes.

## Metadata Boundaries

OAuth connector metadata belongs in plugin app metadata, not in scaffold app
runtime files:

| File | Purpose |
| --- | --- |
| `.app.json` | OAuth connector binding for the registered connector id |
| `.codex-plugin/plugin.json` | Plugin display metadata and pointers to `.app.json` / `.mcp.json` |
| Marketplace JSON | Catalog, install policy, auth timing |
| `.mcp.json` | Local MCP server launch command and args only |

Never commit OAuth client secrets, access tokens, refresh tokens, per-user auth
state, API keys, or git-session credentials to any of these files.
