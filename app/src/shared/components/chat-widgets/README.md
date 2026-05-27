# Chat Widgets

App-local chat, rail, assistant, and conversation widgets live here.

Every real widget directory under this slot must include:

- `README.md` describing slot, data source, public props, and tests
- a sibling `*.test.tsx`
- a `mode` prop or README rationale when onboarding/demo and steady-state modes differ

Use exact-use harness widgets instead when the requested capability matches an
existing widget contract.
