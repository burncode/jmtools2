# JMTools Design System (MASTER)

Product: local-first desktop game asset production tool (Tauri + React).

## Visual Direction

- Dark blue-gray workbench surfaces with blue primary actions
- Dense desktop layout: fixed sidebars, scrollable inspectors, canvas-first center
- Lucide icons only; no emoji navigation icons
- Chinese UI copy by default

## Token Rules

- Layout / panels / chrome: `--app-*` from `src/styles/tokens.css`
- shadcn primitives (Button, Input, Tabs): `--primary`, `--background`, etc.
- Status colors: `--app-success`, `--app-warning`, `--app-danger`, `--app-status-*-border`
- Spacing rhythm: 4/8px via `--app-space-*`
- Motion: `--app-duration*`; honor `prefers-reduced-motion`

## Component Rules

- Workbench: `WorkbenchLayout` + `InspectorPanel` + `CanvasPanel`
- Lists: `SelectableListRow` for selectable rows / frame tiles
- Forms: `InspectorField` + shadcn inputs
- Navigation: shadcn Tabs for primary feature navigation; steppers read-only where duplicated

## Anti-Patterns

- Raw Tailwind hex for QC/status (`#22c55e`) — use semantic tokens
- Global `cursor: pointer` on tool chrome
- Marketing hero layouts inside production workspaces
- Feature-local giant CSS without token usage

## Desktop Native Feel (Tauri scope)

- No hand cursor on list rows; selection via background/border
- Chrome labels: `user-select: none`
- Visible `:focus-visible` rings on custom controls
- Optional: custom titlebar / acrylic (future)
