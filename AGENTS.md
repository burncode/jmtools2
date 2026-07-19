# AGENTS.md

JMTools is a Tauri desktop application for a local-first game asset production pipeline. This file is the primary instruction document for coding agents working in this repository.

## Product Direction

- JMTools is not a generic web dashboard. It is a professional desktop tool for game asset generation, animation production, map asset generation, atlas creation, audio/music production, and export workflows.
- The Home screen is only the project entry area: create project, open project, restore recent project, and choose templates.
- Real production work belongs inside the future Project Workspace: character creation, scene generation, VFX, animation editing, UI asset production, atlas packing, audio tools, and export.
- Default UI language is Simplified Chinese. User-facing text should be Chinese unless there is a specific reason not to.
- Local-first is the default product assumption. Avoid designs that require cloud services for core project access.

## External Rule Notes

- `jineng.md` has been merged into this file as working-process guidance. Re-read it if the user says it has changed.
- If a rule in `jineng.md` conflicts with this file, prefer the more project-specific rule in `AGENTS.md` unless the user explicitly says otherwise.
- Do not blindly copy external rules. Adapt them to JMTools' Tauri, React, Rust, Bun, shadcn/ui, and PixiJS context.

## Working Principles

These principles intentionally favor caution and clarity over raw speed. For very small tasks, apply judgment, but do not ignore the spirit of the rules.

### Think Before Coding

- Do not assume silently. Make important assumptions explicit.
- Do not hide uncertainty. If a requirement has multiple reasonable interpretations, name them.
- If the task is ambiguous and a wrong assumption would be costly, stop and ask a focused question.
- If a simpler approach exists, say so. It is acceptable to push back on unnecessary complexity.
- Before substantial implementation, define the intended outcome and the main tradeoffs.

### Keep It Simple

- Solve the requested problem with the least code that fits the existing architecture.
- Do not implement features that were not requested.
- Do not add speculative flexibility, configuration, or extension points.
- Do not create an abstraction for code that is only used once.
- Do not add defensive handling for scenarios that cannot realistically occur in the current design.
- If a solution has grown much larger than necessary, simplify it before finishing.

### Surgical Changes

- Change only the files and lines needed for the task.
- Do not "improve" nearby code, comments, or formatting just because you noticed it.
- Do not refactor working code unless the refactor is necessary for the user's request.
- Match the existing local style, even if you would design it differently from scratch.
- If you notice unrelated dead or stale code, mention it instead of deleting it.
- Clean up unused imports, variables, functions, or references introduced by your own change.
- Every changed line should be traceable to the user's request or to required verification.

### Goal-Driven Execution

- Convert tasks into verifiable goals.
- For bug fixes, prefer a reproducible check before or during the fix when practical.
- For refactors, preserve behavior and verify before claiming success.
- For multi-step work, keep a short plan with checkpoints.
- Continue iterating until the success criteria are met or a blocker is clearly explained.

### Complete Implementation Standard

- When the user describes a feature to build, implement complete, modern, maintainable code rather than sketches or placeholders.
- Include appropriate logging, robust error handling, and modular structure so the feature can be safely debugged and changed later.
- Do not omit requested components or leave fake/non-functional controls unless the user explicitly asks for a prototype or placeholder.
- If a UI control represents a generation or asset parameter, wire it into state and the relevant generation/export flow instead of making it visual only.

## Tech Stack

- Package manager: Bun. Use `bun install`, `bun run build`, and `bun run tauri ...`. Do not switch to npm, pnpm, or yarn.
- Frontend: React, TypeScript, Vite, Tailwind CSS v4.
- Desktop shell: Tauri v2 with Rust commands.
- UI primitives: shadcn/ui generated components under `src/components/ui`.
- Icons: `lucide-react`.
- Rendering/game preview direction: PixiJS.
- State management: Zustand.
- Server/cache/query direction: TanStack Query where useful.
- Project data direction: current phase uses JSON manifests; long-term plan may add SQLite for indexes/cache/history.

## Common Commands

- Install dependencies: `bun install`
- Frontend build: `bun run build`
- Vite dev server: `bun run dev`
- Tauri command wrapper: `bun run tauri`
- Rust check: run `cargo check` from `src-tauri`

Before claiming a code change is complete, run the relevant checks:

- Frontend or UI changes: `bun run build`
- Rust or Tauri changes: `cargo check`
- Cross-boundary changes: run both

If a command cannot be run, clearly state why.

## Repository Structure

- `src/App.tsx`: current early app shell and project entry flow. Keep changes scoped; split into feature modules when complexity grows.
- `src/App.css`: current global app visual system. Avoid one-off color/spacing patches that fight the design system.
- `src/components/ui`: shadcn/ui base primitives. Do not manually edit these files.
- `src/components/shared`: preferred location for composed reusable app components when needed.
- `src/features`: domain modules such as projects, assets, workspace.
- `src/lib/tauri`: frontend wrappers for Tauri commands.
- `src/lib/pixi`: PixiJS setup and rendering helpers.
- `src/stores`: Zustand stores.
- `src-tauri/src/commands`: Rust command handlers.
- `docs`: architecture and planning notes.
- `cankao`: reference material from research or external discussions.

## TypeScript Rules

- All source, config, and documentation files must be saved as UTF-8. When reading Chinese text files through PowerShell, use `-Encoding UTF8`; do not rewrite Chinese files after reading them with the wrong console/default encoding.
- Prefer explicit types for shared data structures and public function boundaries.
- Use `import type` for type-only imports.
- Avoid `any`. If unknown input is truly dynamic, use `unknown` and narrow it.
- Avoid silent fallback catches such as `.catch(() => fallback)` unless the fallback is intentionally documented.
- Keep component state local unless shared state is genuinely needed.
- Use named exports for reusable helpers and components unless a framework convention requires otherwise.
- Do not let `App.tsx` become a permanent dumping ground. New workspace modules should move into `src/features/...` or composed components.

## React And UI Rules

- Use shadcn/ui primitives first for buttons, inputs, textareas, badges, tabs, tooltips, separators, and similar controls.
- Do not modify files in `src/components/ui` directly. Compose wrappers in `src/components/shared` if custom variants are needed.
- Use Lucide icons for structural icons. Do not use emoji as navigation, toolbar, action, or status icons.
- Use Chinese labels and concise desktop-software wording.
- Avoid marketing-page patterns for tool surfaces: no oversized decorative sections where dense work UI is needed.
- UI must feel like native desktop production software, not a web admin page or SaaS dashboard: prioritize compact toolbars, inspectors, panes, split views, dense controls, stable scroll regions, and workflow-oriented panels over web-style hero sections, oversized cards, decorative spacing, and landing-page composition.
- Use stable desktop layout patterns: fixed sidebar, fixed top toolbar, scrollable content region, predictable cards/panels.
- Maintain an 8px-based rhythm for spacing and an 8px default card/control radius unless an existing component requires otherwise.
- Avoid nested cards. Use cards for repeated items, panels, modals, or framed tools.
- Do not introduce random palettes. Keep dark blue-gray surfaces, blue primary actions, and restrained accent colors unless redesigning the whole visual system.
- Text must not overlap, clip awkwardly, or force horizontal scroll at the configured minimum Tauri window size.

## Tauri And Rust Rules

- Treat frontend input as untrusted. Validate paths, manifest contents, and versions in Rust commands.
- File system access should usually go through Tauri commands or approved Tauri plugins.
- Keep app-level data separate from project-level data.
- Return errors that can be shown in Chinese UI. Do not expose only low-level debug strings.
- When adding a Tauri plugin, update capabilities/configuration deliberately and explain why the permission is needed.
- Prefer small Rust command modules under `src-tauri/src/commands` (single file hard limit 600 lines; domain logic in `src-tauri/src/character/`). See `.cursor/rules/rust-commands-boundaries.mdc`.
- Use `cargo check` after Rust changes.

## Project Data Rules

- A project is represented by a project directory containing `jmproject.json`.
- Keep project metadata, asset indexes, generated cache, and export outputs conceptually separate.
- Current phase may use JSON manifests for readability and portability.
- Preserve schema versioning and migration room in project manifests.
- Do not store bulky generated assets directly inside the manifest.
- Do not mix temporary cache files with source assets or exported artifacts.

## PixiJS And Asset Pipeline Rules

- PixiJS is a core early dependency to avoid painful rendering migration later.
- Use PixiJS for canvas/game asset preview, atlas preview, animation preview, and future editor surfaces where appropriate.
- Do not hand-roll complex rendering or animation preview logic if PixiJS already provides a clean abstraction.
- Keep rendering setup reusable under `src/lib/pixi` or feature-local modules.

## Visual Asset Rules

- Generated images should live in an explicit project asset path such as `src/assets` for app UI assets.
- Be aware of bundle size. Large PNGs are acceptable for early exploration but should later be optimized to WebP/AVIF where possible.
- UI assets must have stable dimensions or aspect ratios to avoid layout shift.
- Do not depend on remote images for core app UI.

## Change Discipline

- Make focused changes that match the user's latest request and the defined success criteria.
- Prefer existing project patterns over inventing new abstractions.
- Add abstractions only when they remove real duplication or clarify a repeated pattern.
- When fixing UI layout, prefer improving the layout system over stacking one-off pixel patches.
- If an implementation path becomes unclear, pause and state the uncertainty instead of guessing silently.

## Verification Checklist

For every meaningful change, consider:

- Does the app still build with `bun run build`?
- Do Rust/Tauri changes pass `cargo check`?
- Does the UI work at the configured minimum window size?
- Are Chinese labels preserved?
- Are shadcn/ui primitives used where appropriate?
- Are file operations validated on the Rust side?
- Are project data and app data still separated?
- Did the change avoid unrelated refactors and speculative features?

## Communication Rules For Agents

- Explain important changes briefly and concretely.
- Mention files changed and checks run.
- If a check was not run, say so.
- If you make an assumption, name it.
- Keep final reports concise and useful.
