# Testing

## Layers

| Layer | Command | Proves |
| --- | --- | --- |
| App unit/RTL | `npm --workspace app test` | Components, contexts, config, theme, route behavior |
| Middleware unit/contract | `npm --workspace middleware test` | Express routes, middleware behavior, app-owned persistence |
| Deploy assets | `npm run test:deploy` | Workflow/chart/nginx structural contract |
| Setup env | `npm run test:setup-env` | Local env generation and secret boundaries |
| Vite alias | `npm run test:alias` | Import alias contract |
| Full unit gate | `npm test` | All non-e2e checks |
| Browser smoke | `npm run test:e2e` | Responsive public/auth/shell paths |
| Local preview | `npm run verify:preview` | Dev server boot, `/api` proxy, mocks, health path |
| Secret scan | `npm run scan:secrets` | Committed secret patterns |

## Closure Tests

Choose the lowest layer that proves the user-visible behavior. A test that only
asserts a dispatcher calls a mock is a seam test; it can support progress, but
does not close a feature unless the mock shape is the user-visible contract.

For browser-facing changes, prefer RTL for component behavior and Playwright
for route, auth, shell, viewport, or overflow behavior.

For middleware changes, prefer Supertest against the Express app with seeded
repository state and fake upstream clients.

For persisted app-owned state, closure requires a round trip: a public write
path, durable storage, a separate public read or hydrate path, and a user-visible
assertion. Use `round-trip.md` and keep `persistenceRoundTripContract.test.ts`
green when extending repositories or metadata.
