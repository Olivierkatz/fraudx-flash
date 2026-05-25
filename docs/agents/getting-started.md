# Getting Started

## Local Preview

From the scaffold root:

```bash
npm install
WORKSPACE_API_KEY=... LLM_SERVICE=... LLM_MODEL_ID=... LLM_API_KEY=... npm run setup:env
npm run dev
npm run verify:preview
```

`npm run dev` starts middleware on port `3001` and the Vite frontend on port
`5173`. Frontend `/api` requests proxy to middleware.

`npm run setup:env` writes ignored env files. It must not write secrets into
browser-visible files.

## Managed Project Flow

For a new managed GroundX Studio project:

1. Use the `groundx-studio` MCP tools when attached.
2. Create the project from this scaffold.
3. Request a git session.
4. Clone the managed repo locally.
5. Run local setup and preview verification before product edits.
6. Write a failing test for the user-visible behavior.
7. Implement, verify, commit, push, then publish when requested.

If MCP tools are not attached, follow the harness attachment diagnostics before
using Workspace REST or local git fallbacks.

## Baseline Checks

Before substantial product work, run:

```bash
npm run verify:preview
npm run build
npm test
```

Run `npm run test:e2e` when the change affects routing, auth pages, the shell,
responsive layout, onboarding, or other user-visible browser paths.
