# Codex Handoff: JMTools 通用去背景工具与素材工具台

> Reactivation prompt:
>
> We are continuing from this handoff. Read this document first, inspect the current repo state, verify what still applies, and continue from the next steps without assuming the old chat context is available. The user prefers Chinese UI text, shadcn/shared components, Tauri/Rust-backed local-first tools, and focused implementation with verification.

## Repo / Path / Branch

- Repo path: `D:\mydev\game\dev\gametools\jmtools`
- Branch: not detected. `git branch --show-current` returned `fatal: not a git repository`.
- App type: Tauri v2 desktop app for local-first game asset production.
- Package manager: Bun.
- Frontend: React, TypeScript, Vite, Tailwind CSS v4, shadcn/ui primitives, shared composed components.
- Backend: Rust/Tauri commands.

## Current Goal

Build JMTools into a professional desktop game asset production tool, with the current focus on:

- 通用素材工具台, starting with a reusable background-removal tool.
- Character workflow integration, where character action pages reuse the same tool pipeline.
- Stable desktop UI layout, consistent theme tokens, shadcn/shared components, and light/dark support.
- Future extensibility for cut/slice tools, asset preflight, view style generation, item/map/UI processing, and advanced node workflows.

The immediate active thread goal before this handoff was fixing the new background-removal workspace:

- Make source image preview reliable.
- Keep the left parameter panel usable when parameters are long.
- Make preview controls compact and stable when the window is resized.
- Avoid duplicate/over-layered preview backgrounds.

## What We Completed

- Added a reusable backend image pipeline:
  - `src-tauri/src/image_pipeline/mod.rs`
  - `src-tauri/src/image_pipeline/background_removal.rs`
  - Supports procedural chroma background removal with automatic corner sampling, manual sample colors, tolerance, edge softness, edge offset, cleanup strength, hole filling, small-part preservation, spill suppression, bbox, score, and warnings.

- Added a generic asset tool command layer:
  - `src-tauri/src/commands/asset_tools.rs`
  - `run_asset_tool` supports `toolId: "background-removal"`.
  - Output goes to `assets/.cache/tools/background-removal/<task_id>/transparent.png`.
  - Supports PNG/JPG/WEBP input.
  - Supports `chroma` and optional `rembg` engines.
  - Added `load_asset_tool_source_preview` to return source preview as `dataUrl + width + height`, avoiding unreliable `convertFileSrc` previews for temp/Chinese paths.

- Registered backend commands:
  - `commands::asset_tools::run_asset_tool`
  - `commands::asset_tools::load_asset_tool_source_preview`
  - `commands::characters::bind_character_tool_result`

- Added character binding command:
  - Character records can bind a generic tool result back to the current character view as `transparentImage`, bbox, quality report, and processing state.
  - Character action page now calls `runAssetTool` instead of directly running its own background removal algorithm.

- Added frontend tool service/types:
  - `runAssetTool`
  - `loadAssetToolSourcePreview`
  - `AssetToolSource`, `BackgroundRemovalToolOptions`, `AssetToolResult`, `AssetToolSourcePreview`
  - Tool registry metadata now includes route and standalone/batch support flags.

- Added standalone asset tool workspace:
  - `src/features/tools/AssetToolWorkspaceView.tsx`
  - `src/features/tools/AssetToolWorkspaceView.css`
  - `src/features/tools/components/AssetToolPreview.tsx`
  - `src/features/tools/components/BackgroundRemovalToolPanel.tsx`
  - Project workspace sidebar includes “素材工具”.
  - UI is structured as left parameters, center preview, right result/quality report.

- Improved background-removal workspace UI:
  - Source preview now loads via Rust command and `dataUrl`.
  - Preview mode/background controls moved to the `CanvasPanel` top toolbar.
  - Preview stage now focuses only on rendering source/result/compare.
  - Status banner made compact via feature CSS.
  - The left run button was moved into `InspectorPanel.footer` so long parameter lists do not push it out of the scroll area.
  - Latest CSS change makes the asset tool workspace use parent-allocated height instead of a viewport estimate, reducing clipping inside the project workspace.

- Codex maintenance report:
  - Ran `$keep-codex-fast` report-only.
  - Active sessions about `3.386 GB`; old session candidates about `2.794 GB`.
  - No mutation was performed.

## Files Touched Or Investigated

Key changed files:

- `src-tauri/src/image_pipeline/mod.rs`
- `src-tauri/src/image_pipeline/background_removal.rs`
- `src-tauri/src/commands/asset_tools.rs`
- `src-tauri/src/commands/characters.rs`
- `src-tauri/src/commands/mod.rs`
- `src-tauri/src/lib.rs`
- `src/lib/tauri/commands.ts`
- `src/features/tools/types.ts`
- `src/features/tools/toolRegistry.ts`
- `src/features/tools/AssetToolWorkspaceView.tsx`
- `src/features/tools/AssetToolWorkspaceView.css`
- `src/features/tools/components/AssetToolPreview.tsx`
- `src/features/tools/components/BackgroundRemovalToolPanel.tsx`
- `src/features/workspace/types.ts`
- `src/features/workspace/workspaceFixtures.ts`
- `src/features/workspace/ProjectWorkspaceView.tsx`
- `src/features/characters/components/CharacterActionWorkspace.tsx`

Important investigated files:

- `src/components/shared/InspectorPanel.tsx`
- `src/components/shared/CanvasPanel.tsx`
- `src/components/shared/SegmentedControl.tsx`
- `src/components/shared/EmptyState.tsx`
- `src/components/shared/StatusBanner.tsx`
- `src/components/shared/shared.css`
- `src/components/shared/layouts/WorkbenchLayout.tsx`
- `src/components/shared/layouts/layouts.css`
- `src/App.css`
- `src-tauri/capabilities/default.json`
- `src-tauri/tauri.conf.json`
- `docs/ui-system.md`
- `docs/character-pipeline-roadmap.md`
- `cankao/character_generation_system_design.md`
- `AGENTS.md`

## Commands / Tests Already Run

- `cargo fmt --manifest-path src-tauri\Cargo.toml`
- `cargo check` from `src-tauri` passed.
- `bun run build` passed multiple times.
- Known build warning remains:
  - Vite reports `Some chunks are larger than 500 kB after minification`.
  - This is pre-existing/expected for now; likely future work is route-level or PixiJS-related lazy loading.
- `$keep-codex-fast` report-only command passed:
  - `python C:\Users\mh_12\.codex\skills\keep-codex-fast\scripts\keep_codex_fast.py`

## Known Errors / Warnings / Failing Checks

- No current compile/check failure known.
- The latest CSS fix for the left panel button has only been build-verified, not visually verified by browser/devtools because the user prefers using the running Tauri app directly and previously asked not to use browser inspection.
- Need user confirmation that the left footer button is visible after the latest CSS change.
- Vite chunk-size warning remains and should be addressed later with code splitting.
- Some old character-specific background-removal code still exists for compatibility; the goal is to continue moving algorithm ownership into the generic image pipeline over time.
- `load_asset_tool_source_preview` allows absolute paths selected by user; this matches the current standalone upload use case but should remain validated carefully if reused elsewhere.

## Open Decisions

- Whether to keep the asset tool workspace as a three-column layout at all widths, or stack sections below a certain width.
- Whether the left “执行去背景” should be sticky footer in all tool panels, not only background removal.
- Whether preview toolbar controls should use text segmented controls or compact icon+tooltip buttons later.
- Whether to make background-removal presets savable from the tool workspace.
- Whether to add a full AI semantic background-removal model manager in settings before expanding standalone batch processing.
- When to introduce advanced node workflow mode. Current agreement: node workflow is future “高级生成方式”, not the immediate simple workflow.

## Constraints / User Preferences / Do Not Touch

- Default UI language must be Simplified Chinese.
- Use Bun commands, not npm/pnpm/yarn.
- Prefer shadcn/ui primitives under `src/components/ui`, but do not edit generated `src/components/ui` files directly.
- Compose app-specific UI in `src/components/shared` or feature components.
- Use Lucide icons, no emoji for structural UI.
- App should feel like professional desktop production software, not SaaS/marketing UI.
- Use stable desktop layouts, fixed/scrollable panes, dense controls, consistent max widths, and token-driven light/dark theme.
- PixiJS is for preview/animation/editor surfaces, not export logic.
- Generated outputs should not pollute formal asset directories until the user confirms save; cache goes under `assets/.cache/...`.
- Be careful with user changes in a dirty tree; do not revert unrelated work.
- The user has said not to rely on browser inspection when they are running `bun tauri dev`; prefer local build/check and user-side visual confirmation.
- Current folder is not a git repo, so avoid git assumptions.
- Keep implementation complete and wired; do not add visual-only/fake controls when parameters represent real generation behavior.

## Next 3-7 Concrete Steps

1. Ask the user to re-check the asset tool page in the running Tauri app after the latest CSS fix.
   - Confirm the left footer button remains visible with long parameters.
   - Confirm small-window layout no longer clips the footer.

2. If still clipped, inspect parent scroll/layout in `src/App.css` and `AppPageShell` usage.
   - Likely fix: make `.project-workspace-content.single-column-workspace` or the tool workspace own a scroll region consistently.
   - Avoid stacking more viewport `calc()` hacks.

3. Polish background-removal parameters UI.
   - Consider grouping advanced chroma parameters behind a collapsible section.
   - Keep the run button fixed in footer.
   - Add concise helper text for tolerance, edge offset, cleanup, spill suppression.

4. Add manual test coverage notes or lightweight unit tests for Rust pipeline helpers.
   - Validate PNG/JPG/WEBP preview command.
   - Validate bbox/score output for a simple synthetic image if practical.

5. Continue extracting old character-specific background-removal behavior into the generic image pipeline.
   - Keep character commands focused on record mutation/binding.
   - Avoid duplicating image algorithms in character modules.

6. Add lazy loading / route splitting later.
   - Split PixiJS preview stage and asset tool workspace if bundle warning becomes painful.

7. Before archiving old Codex sessions, create handoffs for any other important active repo threads, then close Codex and run normal `$keep-codex-fast --apply` maintenance.

