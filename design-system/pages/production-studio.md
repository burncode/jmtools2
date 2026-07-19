# Production Studio Overrides

Inherits [MASTER.md](../MASTER.md).

## Layout

- Top: read-only compact pipeline stepper (aligned with 1360px canvas via `character-production-content-canvas`)
- Header: **产线日志** (popover) + **导出** (popover) + 返回资产库
- Body: single **动作** workspace — no production Tabs
- No bottom inline log panel (log lives in header popover)

## Fixed Canvas (1360px)

| Column | Width |
|--------|-------|
| Character summary | minmax(200px, 220px) |
| Action cards | minmax(280px, 360px) |
| Pixi preview | minmax(0, 1fr) |

- Stepper + three-column workspace share the same **1360px** centered canvas
- Workshop header uses the same max-width alignment in production mode
- Grid columns use `fr` so **gaps are included** in the 1360 budget (no horizontal scroll)
- Window `minWidth` is **1360**
- Action list: **no internal Panel scroll**; `compact` density when 4+ actions

## Toolbar contract

- Use **`AppToolbarRow`** for any horizontal control cluster (preview header, export popover fields)
- **`SegmentedControl`** must sit inside `AppToolbarRow` or another `flex-direction: row; flex-wrap: nowrap` container
- Do **not** put Segmented inside `flex-direction: column` toolbars

## Action Workspace

- Left: character summary (`InspectorPanel`)
- Center: action cards (`InspectorPanel` with header/footer); compact mode scales cards
- Right: **CharacterActionPreviewPanel** (Viewport + Transport + Timeline)

## Preview Panel

Structure under `src/features/characters/components/preview/`:

1. **Header** — `AppToolbarRow`: 动画/精灵图 Segmented + zoom + 显示 Popover（来源/洋葱皮等）
2. **Viewport** — Pixi stage + overlay badge + footer metadata
3. **Transport** — transport buttons + `app-slider-control` scrubber
4. **Timeline** — frame filmstrip (`AnimationFrameTile`)

## Production Log

Header **产线日志** popover (same pattern as **导出**): Tabs for 步骤 / QC / 错误

## Export

Top header **导出** popover; sprite sheet via export flow

## Pipeline

Unchanged: view-aware reference prep → action generation → delivery post-process

## Direction Picker

Multi-select in Popover; **八方向/全方向** shortcut button retained
