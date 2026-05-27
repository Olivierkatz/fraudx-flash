# Backlog

Single source of truth for pending scaffold or project work.

## Rules Of Engagement

1. Stable IDs are required before code lands.
2. Definition of done is a user-visible test, not a seam test.
3. WIP cap is 3 `in-progress` items per epic.
4. Closing an item deletes matching inline `TODO(<id>)` markers.
5. New follow-on work gets a new id before the parent closes.
6. Do not leave tombstone files after consolidating trackers.

## Status Legend

| Status | Meaning |
| --- | --- |
| `not-started` | Design known, no code or docs started |
| `in-progress` | Some code/docs/tests exist, but closure test does not pass yet |
| `seam-only` | Plumbing, storage, route, context, or widget seam exists, but public write/read behavior is not verified |
| `blocked` | Waiting on external decision, access, data, or infrastructure |
| `closed` | User-visible closure test passes and inline TODOs are gone |

`seam-only` is not closed. Move it to `closed` only after the round-trip checks in
`round-trip.md` pass and the closure test is named in this backlog.

## ID Convention

Use a short epic prefix plus a number, for example:

| Prefix | Epic |
| --- | --- |
| `UI-N` | Frontend UI and routes |
| `MW-N` | Middleware routes, services, repositories |
| `SDK-N` | Frontend API wrappers and contexts |
| `AUTH-N` | Auth, sessions, account lifecycle |
| `DEP-N` | Deploy, Helm, workflows, runtime config |
| `TEST-N` | Test coverage gaps |
| `DOC-N` | Docs and agent guidance |
| `SEC-N` | Security and secret hygiene |

Project-specific apps may add their own prefixes. Keep the legend updated.

## Current Items

| ID | Status | Item | Closure test |
| --- | --- | --- | --- |
|  |  |  |  |

Start empty in the base scaffold. Add project-specific rows as work is found;
do not preserve example rows as active work.

## Discovery Checklist

Run all 14 methods before claiming an audit is complete:

The commands intentionally return candidates, not automatic failures. Review each hit
and either close it with a user-visible test or add a backlog row. Commands that scan
`docs/` exclude scaffold agent reference docs so the checklist does not mostly find its
own instructions. If a project adds non-reference docs with pending work, move that work
into this backlog before closing the audit.

### Method 1: Open Work Markers

```bash
rg -n "TODO|FIXME|XXX|HACK" app middleware scripts deploy docs \
  -g '!docs/agents/*.md'
```

### Method 2: Follow-On Language

```bash
rg -n "follow-?up|follow on|later|for now|we'll|defer|deferred" app middleware docs \
  -g '!docs/agents/*.md'
```

### Method 3: Stub Or Partial Implementation Signals

```bash
rg -n "not wired|stub|placeholder|dummy|temporary implementation|not implemented|unimplemented" app/src middleware/src docs \
  -g '!*.test.*' -g '!**/test/**' -g '!docs/agents/*.md'
```

### Method 4: Disabled, Skipped, Or Focused Tests

```bash
rg -n "\\.(skip|only)\\(|test\\.fixme|describe\\.fixme|it\\.todo|test\\.todo" app middleware
```

### Method 5: Lint And Type-Check Suppressions

```bash
rg -n "@ts-ignore|@ts-expect-error|eslint-disable" app middleware scripts
```

### Method 6: Console Logging In Production Paths

```bash
rg -n "console\\.(log|warn|error)" app/src middleware/src \
  -g '!*.test.*' -g '!**/test/**'
```

### Method 7: Runtime Not-Implemented Paths

```bash
rg -n "501|not implemented|not wired|unimplemented" app/src middleware/src \
  -g '!*.test.*' -g '!**/test/**'
```

### Method 8: Type Escape Hatches

```bash
rg -n "as unknown as|as any|Record<string, any>|unknown as" app/src middleware/src \
  -g '!*.test.*' -g '!**/test/**'
```

### Method 9: Mock-Only Or Canned-Response Paths

```bash
rg -n "MOCK_MODE|mock-only|canned|fixture|sample response" app middleware scripts
```

### Method 10: Env-Var Usage Drift

```bash
rg -n "MOCK_MODE|APP_REPOSITORY_MODE|VITE_|process\\.env" app middleware scripts
```

Compare hits against `.env.example`, `middleware/.env.example`, deploy
variables, and docs before calling the config complete.

### Method 11: Secret-Like Strings And Unsafe Examples

```bash
rg -n "password|secret|token|api[_-]?key|refresh" app middleware docs scripts \
  -g '!docs/agents/*.md'
```

### Method 12: Duplicate Tracking Files Or Tombstones

```bash
find docs -maxdepth 3 -type f | sort
rg -n "open-work|chat-fix-list|phase-tracker|merged into|moved to|tombstone" docs \
  -g '!docs/agents/*.md'
```

### Method 13: Route, Navigation, And E2E Mismatch Signals

```bash
rg -n "ROUTER_PATHS|createBrowserRouter|path:|appNavigation|test:e2e" app/src app/e2e docs \
  -g '!docs/agents/*.md'
```

### Method 14: Verify Before Marking Anything Not Started

```bash
rg -n "<feature-or-component-name>" app/src middleware/src app/e2e middleware/src docs
```

Then run the closure gates:

```bash
npm test
npm run scan:secrets
```

Add any discovered pending work here with a status and closure test.
