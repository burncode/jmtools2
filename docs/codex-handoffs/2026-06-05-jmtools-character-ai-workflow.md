# JMTools Codex Handoff - Character AI Workflow

Reactivation prompt:

```text
We are continuing JMTools from this handoff. Read docs/codex-handoffs/2026-06-05-jmtools-character-ai-workflow.md first, inspect the current repo state, verify what still applies, and continue from the next steps without assuming the old chat context is available.

Important project rules: JMTools is a Chinese-first Tauri desktop app for a local-first game asset production pipeline. Use Bun, not npm/pnpm/yarn. UI must feel like desktop production software, not a web SaaS dashboard. Prefer shadcn/ui primitives, lucide-react icons, PixiJS for preview/editor surfaces, Rust/Tauri commands for filesystem and persistence, and SQLite for indexes/settings while keeping actual assets as files.
```

## Repo And Branch

- Repo/path: `D:\mydev\game\dev\gametools\jmtools`
- Branch: not applicable / not initialized as a Git repository. `git rev-parse --abbrev-ref HEAD` currently fails with `fatal: not a git repository`.
- Package manager: Bun.
- App type: Tauri v2 desktop app with React, TypeScript, Vite, Tailwind CSS v4, shadcn/ui, lucide-react, Rust backend, SQLite via `rusqlite`, AI generation services, and future PixiJS preview/editor surfaces.

## Current Goal

Build JMTools into a local-first game asset production pipeline. The current focus is the character workflow:

1. Manage project-level character assets.
2. Use AI settings/providers to generate a structured character master plan.
3. Create a persisted character card from a selected plan.
4. Show role/character assets in a character library.
5. Next: implement a real character detail/action production workspace for image preview, action generation, animation frames, and export.

## Product Direction And Constraints

- Default UI language is Simplified Chinese.
- Home screen is only project entry; real production work happens inside the Project Workspace.
- Current production modules include character workshop, scene/map, items, VFX, UI assets, animation, atlas, and audio.
- The UI should be compact, desktop-native, and production-oriented: stable sidebars, fixed topbars, dense controls, panes, inspectors, scroll regions, and workflow panels.
- Avoid marketing page patterns, web dashboard bloat, decorative heroes, oversized cards, and one-off styling patches.
- Use shadcn/ui primitives where appropriate; do not edit `src/components/ui` directly.
- Use lucide-react icons, not emoji, for navigation/actions/status.
- PixiJS is intended for internal previews/editors, not as a required final game asset format.
- Exports should be pluggable. Default outputs should be common formats such as PNG sequences, Spritesheet + JSON, and later engine-specific adapters.
- Project data should remain local-first. Core project access should not require cloud services.
- Actual generated images/audio/sprites should remain filesystem assets; SQLite stores indexes, relationships, settings, and metadata.
- All files should be UTF-8. When reading Chinese files in PowerShell, use `-Encoding UTF8`.

## What We Already Completed

### Architecture And Docs

- Created initial planning docs:
  - `docs/initial-concept.md`
  - `docs/data-architecture-notes.md`
- Added project coding guidance:
  - `AGENTS.md`
  - It includes local product direction, Bun usage, Tauri/Rust rules, UI desktop rules, TypeScript rules, JSON/SQLite direction, PixiJS direction, and verification checklist.

### Project/Home/Workspace UI Direction

- Established JMTools as a Chinese-first desktop app, not a generic web dashboard.
- Built/iterated a workspace shell with:
  - fixed sidebar
  - top toolbar
  - project workspace panels
  - project library and recent project flow
- Added “返回首页” behavior in the project workspace topbar after discovering it was missing.
- Improved layouts to avoid over-stretching on wide screens and reduce line-heavy nested card feel.

### Settings And AI Model Management

- Added a settings feature with separate panels/components instead of one giant file:
  - `src/features/settings/SettingsView.tsx`
  - `src/features/settings/SettingsView.css`
  - `src/features/settings/panels/GeneralSettingsPanel.tsx`
  - `src/features/settings/panels/AiSettingsPanel.tsx`
  - `src/features/settings/panels/DisplaySettingsPanel.tsx`
  - `src/features/settings/panels/ProjectResourcesSettingsPanel.tsx`
  - `src/features/settings/panels/ExportSettingsPanel.tsx`
  - `src/features/settings/panels/AboutSettingsPanel.tsx`
  - `src/features/settings/components/*`
- AI settings now manage providers and models as separate concepts.
- Provider/model UI direction:
  - left provider list
  - selected provider details
  - model list
  - model usage binding below as app-level settings
  - model dropdowns/search/refresh support
- Added AI provider/model services:
  - `src/features/ai-models/providerService.ts`
  - `src/features/ai-models/providerPresets.ts`
  - `src/features/ai-models/providerFactory.ts`
  - `src/features/ai-models/generationService.ts`

### Rust/Tauri Backend Architecture

- Began splitting Rust commands into modules under `src-tauri/src/commands`:
  - `ai_generation.rs`
  - `ai_models.rs`
  - `characters.rs`
  - `logging.rs`
  - `project.rs`
  - `settings.rs`
  - `system.rs`
- Added storage helpers:
  - `src-tauri/src/storage/database.rs`
- Added structured logging:
  - `src-tauri/src/logging/mod.rs`
  - Uses `tracing`, `tracing-appender`, `tracing-log`, and `tracing-subscriber`.
- Removed/avoided duplicate logger initialization that caused:
  - `attempted to set a logger after the logging system was already initialized`
- `tauri-plugin-log` was removed from Rust/plugin usage to avoid logger duplication; custom tracing pipeline is now the backend logging direction.
- Tauri MCP bridge is enabled in debug builds in `src-tauri/src/lib.rs`.

### SQLite / Persistence

- App-level SQLite exists at app data path via `open_app_database`.
- App-level tables include:
  - `app_settings`
  - `ai_model_providers`
  - `ai_provider_models`
- Project-level SQLite was added at:
  - `<project-root>/.jmtools/project.db`
- Project-level schema currently includes:
  - `project_profile`
  - `character_assets`
- Project data direction:
  - keep `jmproject.json` as portable project manifest
  - keep `assets/characters/<id>/character.json` as readable per-character source record
  - keep `assets/characters/index.json` as portable character index
  - sync records into `.jmtools/project.db` for faster indexing/query/filter/search

### AI Text Generation

- Added Tauri command `generate_ai_text` in `src-tauri/src/commands/ai_generation.rs`.
- It runs blocking HTTP work inside `tauri::async_runtime::spawn_blocking`, avoiding UI freezes.
- Supports OpenAI-compatible text generation and local Ollama-style generation.
- Frontend wrappers live in `src/lib/tauri/commands.ts`.

### Character Workshop

- Added character domain under:
  - `src/features/characters`
- Main files:
  - `src/features/characters/CharacterWorkshopView.tsx`
  - `src/features/characters/CharacterWorkshop.css`
  - `src/features/characters/types.ts`
  - `src/features/characters/characterFixtures.ts`
  - `src/features/characters/components/CharacterAssetSettings.tsx`
  - `src/features/characters/components/CharacterPlanPreview.tsx`
  - `src/features/characters/components/CharacterAssetLibraryView.tsx`
  - `src/features/characters/services/characterPlanGeneration.ts`
- Character workflow now:
  1. Default enters character library.
  2. Empty state shows “还没有角色资产” with new character action.
  3. New character opens the create/generation flow.
  4. AI generates a structured character master plan.
  5. User selects a candidate plan.
  6. User creates a character card.
  7. Character card persists to JSON and SQLite.
  8. Character library reloads/displays records.

### Character Persistence

- Added Rust command `create_character_asset`.
- Added Rust command `list_character_assets`.
- Character data writes to:
  - `assets/characters/<id>/character.json`
  - `assets/characters/index.json`
  - `.jmtools/project.db`
- `list_character_assets`:
  - validates project root
  - reads `assets/characters/index.json`
  - syncs records into SQLite
  - returns records from SQLite
- Fixed legacy character index issue:
  - Error was `角色索引格式错误：missing field model at line 42 column 3`
  - `CharacterAssetRecord` now has serde defaults for compatibility with older records missing fields such as `model`, `providerName`, `status`, `palette`, `visualKeywords`, etc.

### Character Detail UI Direction

- Generated a local SVG preview:
  - `docs/previews/character-detail-workspace-preview.svg`
- User later provided a better reference image for an action-production workspace.
- Current preferred direction after discussion:
  - not a generic character detail page
  - should be a “角色动作制作工作台”
  - left: character archive/model info/supported action types
  - center: large model/animation preview + frame preview strips
  - right: action generation panel + export settings
- Do not implement from the SVG preview directly without reconsidering the latest reference. The reference emphasizes action production and frame review more strongly than the earlier SVG.

## Files Touched Or Investigated

Important touched/investigated files:

- `AGENTS.md`
- `docs/initial-concept.md`
- `docs/data-architecture-notes.md`
- `docs/previews/character-detail-workspace-preview.svg`
- `src/App.tsx`
- `src/App.css`
- `src/main.tsx`
- `src/lib/tauri/commands.ts`
- `src/lib/logger.ts`
- `src/stores/workspaceStore.ts`
- `src/features/workspace/ProjectWorkspaceView.tsx`
- `src/features/workspace/components/WorkspaceTopbar.tsx`
- `src/features/workspace/components/WorkspaceSidebar.tsx`
- `src/features/settings/**`
- `src/features/ai-models/**`
- `src/features/characters/**`
- `src-tauri/Cargo.toml`
- `src-tauri/src/lib.rs`
- `src-tauri/src/commands/mod.rs`
- `src-tauri/src/commands/project.rs`
- `src-tauri/src/commands/settings.rs`
- `src-tauri/src/commands/ai_models.rs`
- `src-tauri/src/commands/ai_generation.rs`
- `src-tauri/src/commands/characters.rs`
- `src-tauri/src/commands/logging.rs`
- `src-tauri/src/logging/mod.rs`
- `src-tauri/src/storage/database.rs`

Reference materials investigated:

- `cankao/数据结构.md`
- `cankao/角色工坊建议.md`
- `cankao/角色定位.md`
- `cankao/产品定位.md`
- `jineng.md`

## Commands And Tests Already Run

Common checks used throughout:

```powershell
bun run build
```

```powershell
cd src-tauri
cargo check
```

```powershell
cd src-tauri
cargo fmt
```

Recent successful checks:

- `cargo fmt` after character/SQLite changes.
- `cargo check` passed after:
  - adding `create_character_asset`
  - adding `list_character_assets`
  - adding project-level SQLite schema
  - fixing old index compatibility
- `bun run build` passed after:
  - adding character library UI
  - adding character asset wrapper
  - adding role creation flow
  - adding settings/AI UI changes

Useful maintenance command already run in report-only mode:

```powershell
python C:\Users\mh_12\.codex\skills\keep-codex-fast\scripts\keep_codex_fast.py
```

Report summary:

- Active Codex sessions around `2.794 GB`.
- Old session candidates: `6`, about `1.441 GB`.
- One thread metadata-bloat candidate.
- Logs about `277.2 MB`.
- Suggested to create this handoff before archiving old history.

## Known Errors, Warnings, Or Failing Checks

Resolved:

- Tailwind/PostCSS Vite error:
  - `ENOENT: no such file or directory, open '...\tailwindcss'`
  - Was addressed earlier in setup.
- Rust logger panic:
  - `attempted to set a logger after the logging system was already initialized`
  - Fixed by avoiding duplicate logger initialization.
- Character index compatibility:
  - `missing field model`
  - Fixed by adding serde defaults and syncing legacy records into SQLite.
- AI generation initially made UI look unresponsive due to blocking behavior.
  - `generate_ai_text` now uses `spawn_blocking`.

Current known caveats:

- Image-generation tool sometimes produced unrelated poster-like images instead of UI mockups; avoid relying on it for exact UI. Use real code or local SVG/Figma-style mockups when precision matters.
- Repository is not a Git repository, so no branch/diff workflow is currently available.
- Some `rg --files` searches include `src-tauri/target` build outputs; ignore target files when summarizing source work.
- Tauri MCP bridge is configured in debug builds, but connection/use should be verified in the new session if needed.
- Role/character list currently uses placeholder pixel-art CSS silhouettes, not real generated images.
- SQLite project index exists, but search/filter/sort are not yet powered by SQL queries in the frontend beyond the basic list command.
- Character details/action workspace is not implemented yet.
- PixiJS preview is not yet wired into character workspace.

## Open Decisions

1. Character detail/workspace layout:
   - Latest preferred direction is the reference-style action production UI:
     - left character/model/action types
     - center preview + frame strips
     - right action generation/export
   - Need one more UI implementation pass, likely in real React/CSS rather than static image.

2. Project SQLite strategy:
   - Current hybrid approach is accepted:
     - JSON for readable project/asset records
     - SQLite for indexes/cache/history/queries
   - Need decide whether future project-level commands should read directly from SQLite first or continue syncing JSON-first.

3. Character image generation:
   - Need decide exact first output:
     - role master image only
     - four-direction sheet
     - avatar
     - Idle frames
   - Current likely first target: “生成角色形象/母版图”， then actions.

4. PixiJS:
   - Needs integration for preview stage and timeline playback.
   - Should not imply exported assets are PixiJS-specific.

5. UI image preview:
   - Need decide if preview thumbnails are CSS placeholders, loaded from future asset files, or generated images.

6. Tauri MCP Bridge:
   - User wants it available for screenshot/debugging.
   - New session should verify current bridge connection if doing visual QA.

## Constraints, Preferences, And Do-Not-Touch Areas

- Use Bun commands. Do not switch to npm/pnpm/yarn.
- Use shadcn/ui primitives for common controls, but do not modify `src/components/ui` directly.
- Use Chinese UI labels.
- Keep desktop app feel. Avoid web admin/marketing patterns.
- Keep changes componentized. Do not dump everything into `App.tsx` or one giant CSS file if avoidable.
- Avoid arbitrary refactors outside the requested feature.
- Do not revert user changes.
- Do not permanently delete sessions/logs/worktrees or Codex local state during maintenance.
- For Codex local maintenance, first runs must be report-only; apply only after handoffs exist and Codex is closed or user explicitly approves.
- Keep actual assets as files, not blobs in SQLite.
- Do not treat PixiJS as final game resource format; it is mainly for app-side preview/editing.
- Prefer mature/open-source libraries over hand-rolled systems when appropriate.
- Use tracing/tracing-appender/tracing-subscriber for Rust logging direction.
- Avoid visible overlapping UI and awkward scrollbars; the user has repeatedly caught layout overlap in small windows.
- Wide-screen layouts should not stretch content into awkward empty spaces; constrain content and let side margins grow where appropriate.

## Next 3-7 Concrete Steps

1. Implement the character detail/action workspace entry:
   - Clicking a character card in `CharacterAssetLibraryView` should switch from library mode into a selected-character workspace mode.
   - Add state to `CharacterWorkshopView` for `selectedCharacter`.

2. Build the first real character action workspace UI:
   - Left: character card, model info, supported action types.
   - Center: large preview stage, view/action tabs, playback controls, frame strips.
   - Right: action generation form and export settings.
   - Use the latest reference image as direction, not the earlier generic SVG.

3. Keep the UI data-driven:
   - Use `CharacterAssetRecord` for display.
   - Add small helper functions for status labels, timestamp formatting, action state.
   - Avoid hardcoding too much into one component.

4. Add backend read/update commands for a single character:
   - `get_character_asset(project_root, character_id)`
   - optional `update_character_asset`
   - keep JSON and SQLite in sync.

5. Start PixiJS preview integration:
   - Add reusable preview surface under `src/lib/pixi` or feature-local module.
   - Begin with placeholder pixel/sprite rendering and animation loop.
   - Verify at min/max window sizes.

6. Add first AI action after details UI:
   - “生成角色形象” or “生成 Idle 动作”.
   - Save output metadata in character record and project SQLite.
   - Keep actual generated image files in `assets/characters/<id>/...`.

7. Optional after workspace stabilizes:
   - Use SQL-backed character search/filter/sort from `.jmtools/project.db`.
   - Add tags/favorites/recent-opened behavior.
   - Add export-history table.

## Maintenance Follow-Up

After confirming this handoff exists and the current Codex app is closed, safe maintenance can be applied with:

```powershell
python C:\Users\mh_12\.codex\skills\keep-codex-fast\scripts\keep_codex_fast.py --apply --archive-older-than-days 10 --worktree-older-than-days 7
```

Optional metadata bloat repair is separate and should only be used if the user explicitly opts in:

```powershell
python C:\Users\mh_12\.codex\skills\keep-codex-fast\scripts\keep_codex_fast.py --apply --repair-thread-metadata-bloat
```

Normal maintenance archives/moves with backups; it should not permanently delete chats, logs, memories, plugins, skills, or worktrees.
