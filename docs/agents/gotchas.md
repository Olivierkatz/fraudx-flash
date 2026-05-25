# Common Gotchas

- **Seam tests are tempting.** A green dispatcher test does not mean the user
  can do anything new. Close with a user-visible test.
- **Browser secrets are still secrets.** `VITE_*` values are bundled for the
  browser. Do not put GroundX, Workspace, Partner, LLM, runner, OAuth, GitHub,
  GitLab, database, or git-session secrets there.
- **Memory mode is intentional.** Local preview defaults to
  `APP_REPOSITORY_MODE=memory`; do not require MySQL for the default smoke path.
- **Mock mode is not production.** `MOCK_MODE=true` keeps preview deterministic.
  It does not prove live upstream behavior.
- **Middleware is private.** The frontend Ingress exposes static assets and
  proxies `/api`; middleware should remain private behind a ClusterIP service.
- **Marketplace is not runtime config.** Connector ids go in `.app.json`; local
  MCP server launch goes in `.mcp.json`; marketplace JSON controls catalog and
  install policy.
- **One backlog only.** Do not add extra work trackers. Use
  `docs/agents/backlog.md`.
