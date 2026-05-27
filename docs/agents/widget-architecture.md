# Widget Architecture

Use this when adding app-local widgets or reusable components.

## Source Boundary

Exact-use widgets from the GroundX Studio Harness are copied only when the
requested capability matches that widget's contract. Product-specific widgets
live in this scaffold and follow the local slot contract.

## Component Slots

New components should use the role-specific directories when they fit:

| Slot | Use for |
| --- | --- |
| `app/src/shared/components/primitives/` | Unbranded atoms and MUI-aligned wrappers |
| `app/src/shared/components/brand/` | Branded molecules and GroundX-flavored wrappers |
| `app/src/shared/components/layout/` | Shell, navigation, and once-per-page layout components |
| `app/src/shared/components/chat-widgets/` | Chat, rail, assistant, and conversation widgets |
| `app/src/shared/components/viewer-widgets/` | Viewer, canvas, preview, document, and result widgets |

Do not move existing components just to satisfy the taxonomy. Use it for new
work and deliberate migrations.

## Widget Contract

Every real widget directory under `chat-widgets/` or `viewer-widgets/` must have:

- a README describing slot, data source, public props, and tests
- a sibling test for the primary user-visible behavior
- a `mode` prop or README rationale when onboarding/demo and steady-state modes differ
- API/context/middleware tests when the widget owns network, provider, or persistence behavior

Onboarding and demo states should decorate production widgets through props or
config. Do not build a second canvas implementation for the same production
widget path.

## MUI Alignment

When a primitive has a clear MUI counterpart, follow MUI's split and familiar
props before layering brand semantics. Diverge only when the component README
explains why.
