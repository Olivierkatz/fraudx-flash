# Round-Trip Contract

Use this before closing work that persists app-owned state.

## Rule

A persisted byte is done only when a test proves it travels through:

1. a public write path,
2. app-owned durable storage,
3. a separate public read or hydrate path,
4. a user-visible assertion.

Repository tests and handler seam tests are progress evidence. They do not close
the backlog row by themselves.

## Pre-Closure Checks

| Check | What to prove |
| --- | --- |
| Round-trip test | A public action writes state, another public route/context hydrates it, and the test asserts the visible result. |
| Dead-column check | Every app-owned field that is written has a non-test read/hydrate path or a documented reserved-field rationale. |
| Dead-endpoint check | Every server route has a non-test frontend API caller or an explicit allowlist reason. |
| Dead-context check | Every exposed context field has a non-test consumer or the backlog row remains `seam-only`. |

## Handoff Format

When closing persisted-state work, name:

- public write path
- public read or hydrate path
- test file or command
- visible behavior asserted

If any item is missing, keep the row `in-progress` or `seam-only`.

## Scaffold Guards

The base scaffold includes these guardrails:

- `app/src/test/dead-endpoint.test.ts`
- `app/src/test/no-hardcoded-styles.test.ts`
- `app/src/test/widget-contract.test.ts`
- `middleware/src/persistenceRoundTripContract.test.ts`

Do not delete or weaken these tests to close a feature.
