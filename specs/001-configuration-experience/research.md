# Research: Configuration Experience

## Decision 1: Bootstrap a minimal single-package TypeScript VS Code extension at the repository root

- **Decision**: Initialize the implementation as one root-level VS Code extension package with `package.json`, `tsconfig.json`, `.vscodeignore`, `src/`, and `test-fixtures/` rather than nesting the extension in a subpackage or waiting for a later feature to add scaffolding.
- **Rationale**: The repo does not yet contain extension source files, but this feature is user-visible and cannot be delivered without a functioning extension entry point, contribution manifest, and test harness. A single root package matches the constitution, keeps tooling simple, and avoids introducing a monorepo or packaging boundary before there is evidence it is needed.
- **Alternatives considered**:
  - Put the extension in a subdirectory such as `extension/`: rejected because it adds path complexity without serving the first feature.
  - Delay scaffold creation until a later feature: rejected because Configuration Experience itself needs activation, view registration, diagnostics, and tests.

## Decision 2: Use `yaml` plus handwritten validation for manifest loading and diagnostics

- **Decision**: Parse `tf-tools.yaml` with the `yaml` package and implement a handwritten validator that emits manifest-domain validation issues with attached source ranges when available.
- **Rationale**: The feature needs precise diagnostics in the Problems view, explicit control over user-facing error messages, and a small dependency footprint. `yaml` provides range-aware parsing support, while handwritten validation keeps the initial codebase simpler than adding a generic schema-validation layer for a manifest shape that is small and domain-specific.
- **Alternatives considered**:
  - `js-yaml`: rejected because it is less suitable for producing precise editor diagnostics with source locations.
  - `yaml` plus `ajv`: rejected for this slice because schema indirection adds setup and translation overhead before the manifest surface is large enough to justify it.

## Decision 3: Separate ephemeral manifest state from persisted active configuration

- **Decision**: Maintain two primary state layers: ephemeral manifest state (`loaded`, `missing`, `invalid` plus diagnostics) and persisted active configuration (`model`, `target`, `component`, `persistedAt`) stored in workspace state and normalized immediately after manifest load or manifest change.
- **Rationale**: This matches the technical specification, prevents stale selections from leaking into UI rendering, and keeps the placeholder sections stateless for this slice. Normalizing once on load and on manifest refresh is simpler and safer than re-validating every access path in the UI.
- **Alternatives considered**:
  - Store everything in one mutable view model: rejected because it mixes source-of-truth state with derived UI state and makes diagnostics harder to reason about.
  - Persist configuration in global state: rejected because the feature is explicitly workspace-scoped.

## Decision 4: Preserve the final tree shape but keep future sections inert

- **Decision**: Render `Build Context`, `Build Options`, and `Build Artifacts` as the three top-level sections immediately, but keep only `Build Context` interactive in this slice. `Build Options` and `Build Artifacts` render non-interactive placeholder or status content, and the view title bar exposes no `Build` or `Debug` actions.
- **Rationale**: This captures the accepted clarification, preserves the eventual UI shape, and avoids a redesign when later slices add real behavior. It also prevents the first feature from implying support for tasks, artifacts, or debugging that do not exist yet.
- **Alternatives considered**:
  - Show only `Build Context`: rejected because it would force a structural UI change in later slices.
  - Show disabled `Build` or `Debug` actions: rejected because disabled future actions still imply behavior outside the slice.

## Decision 5: Use Mocha for unit tests and `@vscode/test-electron` for integration coverage

- **Decision**: Use Mocha as the initial unit test runner and `@vscode/test-electron` for extension-host integration tests.
- **Rationale**: This is a simple, conventional stack for VS Code extensions, works well with TypeScript compilation to `out/`, and satisfies the constitution requirement for integration coverage around VS Code APIs, manifest parsing, diagnostics, and persisted state.
- **Alternatives considered**:
  - Vitest for unit tests: rejected for now because it adds another runtime/tooling choice without clear value for this initial scaffold.
  - Unit tests only: rejected because this feature directly touches tree views, workspace state, file watching, diagnostics, and status-bar behavior.

## Decision 6: Debounce manifest-triggered refreshes and keep failure signals layered

- **Decision**: Debounce file-watcher-triggered manifest refreshes, and surface failures through a layered combination of notifications, diagnostics for file-backed issues, and a dedicated `Trezor Firmware Tools` output channel.
- **Rationale**: Editors often emit multiple file events during save operations. Debouncing keeps the first implementation stable and responsive. Layered failure reporting is explicitly required by the constitution and the feature specification.
- **Alternatives considered**:
  - Refresh on every file event immediately: rejected because it is noisy and can duplicate work.
  - Log-only failure reporting: rejected because the feature requires visible user feedback and persistent diagnostics.