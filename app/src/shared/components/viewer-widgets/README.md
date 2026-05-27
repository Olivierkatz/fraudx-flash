# Viewer Widgets

App-local viewer, canvas, preview, document, and result widgets live here.

Every real widget directory under this slot must include:

- `README.md` describing slot, data source, public props, and tests
- a sibling `*.test.tsx`
- a `mode` prop or README rationale when onboarding/demo and steady-state modes differ

Do not build a duplicate onboarding-only canvas for the same production viewer
path. Use props or config to adapt the production widget.
