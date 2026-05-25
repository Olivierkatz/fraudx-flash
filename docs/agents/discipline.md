# Discipline

Read this alongside `backlog.md` before opening or closing work.

## Definition Of Done

A feature is done when a test exercising real user-visible behavior passes.
A seam test is not enough.

Examples:

| Work | Closure test |
| --- | --- |
| Endpoint behavior | Supertest posts a real-shaped request and asserts the user-visible response |
| View behavior | Browser or RTL test navigates/renders the user path and asserts visible UI |
| Data reader | Integration-style test reads seeded data and returns facts the user can see |
| Deploy contract | Structural test proves workflow/chart behavior that deploy relies on |

If the implementation behind a route, dispatcher, context, or component is a
stub or a frank "not wired" response, the item stays `in-progress`.

## Single Backlog

Pending work lives in `docs/agents/backlog.md`. Do not create extra tracking
files such as `open-work.md`, `chat-fix-list.md`, `phase-tracker.md`, or
temporary top-level TODO lists.

Inline `TODO(<id>)` markers may point to backlog rows. When the item closes,
delete the inline TODO.

## Follow-On Hygiene

When closing one item creates follow-on work:

1. Add the new backlog item first.
2. Use the new stable id in any inline TODO.
3. Then close the parent item.

Inline TODOs without a backlog id are forbidden.

## Verify Before Not-Started

Before marking an item `not-started`, grep for the likely seam:

```bash
rg "<feature-or-component-name>" app/src middleware/src
```

If code, tests, routes, or docs already exist, the item is probably
`in-progress`, not `not-started`.

## No Secrets

Never commit API keys, OAuth tokens, refresh tokens, client secrets,
git-session credentials, database passwords, kubeconfigs, or provider tokens.
Do not put these values in examples, docs, logs, screenshots, or generated
fixtures. Use placeholders that are clearly placeholders.
