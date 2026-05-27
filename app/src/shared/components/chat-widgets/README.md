# Chat Widgets

App-local chat, rail, assistant, and conversation widgets live here.

Every real widget directory under this slot must include:

- `README.md` describing slot, data source, public props, and tests
- a sibling `*.test.tsx`
- a `## Mode Contract` README section with a typed `mode` prop or explicit
  `No mode contract required` rationale

Use exact-use harness widgets instead when the requested capability matches an
existing widget contract.
