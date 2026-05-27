# Air-Gap / On-Prem Runtime Audit

Use this template before claiming the scaffold is ready for an air-gapped or
on-prem deployment. The goal is an inventory, not a promise: every runtime
external host should have a clear seam, and every missing seam should become a
backlog item with a stable id.

## Scope

Include production runtime calls from browser code, middleware code, deploy
configuration, CSP allowlists, script/style/font/image hosts, analytics, error
reporting, documentation CTAs, webhooks, and callback URLs.

Exclude mock-only hosts, unit-test fixture URLs, local dev examples, and prose
examples that never execute.

## Inventory

| Host / URL | Used for | Source | Seam | On-prem path | Status |
| --- | --- | --- | --- | --- | --- |
|  |  |  | env/config/none |  | open |

Use `env/config` when the host can be changed without code, `partial` when only
some runtime paths are configurable, and `none` when source changes are still
required.

## Discovery Checklist

- Search browser and middleware source for literal external URLs.
- Search deploy and workflow files for public hosts, registry endpoints, and
  provider-specific control-plane values.
- Search CSP, iframe, image, font, script, and style allowlists.
- Check generated config and app config defaults that may reach production.
- Confirm telemetry and analytics no-op when unset or can point to a private
  equivalent.
- Record every missing seam in the backlog before closing the audit.

## Closure Gates

- `npm test`
- `npm run scan:secrets`
- `npm run scan:backlog`
- Link each remaining gap to a backlog id.
