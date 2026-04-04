# Research: Excluded-File Visibility

## Decision 1: Consume only the active IntelliSense payload as the source of inclusion truth

- **Decision**: Reuse the active compile-database payload already produced by `src/intellisense/intellisense-service.ts` and `src/intellisense/compile-commands-parser.ts` as the sole inclusion source for excluded-file evaluation.
- **Rationale**: The feature split and constitution both forbid extending compile-commands resolution or adding fallback artifact logic in this slice. Reusing the active payload keeps exclusion state aligned with the exact active model, target, and component while preventing drift between IntelliSense and excluded-file visibility.
- **Alternatives considered**:
  - Re-parse the active `.cc.json` inside the excluded-files feature: rejected because it duplicates compile-database logic and crosses back into the IntelliSense slice.
  - Scan source folders heuristically when the payload is unavailable: rejected because it would create a silent fallback file set that is not manifest-driven.

## Decision 2: Add one dedicated matching service and keep UI presentation in thin adapters

- **Decision**: Introduce a small excluded-files service that evaluates settings and inclusion data into exclusion decisions, then consume that service from a `FileDecorationProvider` for Explorer presentation and a reusable text-editor decoration manager for overlays.
- **Rationale**: Matching logic and UI rendering have different responsibilities and refresh cadences. Separating them keeps the matching rules unit-testable while leaving Explorer and editor integration thin and replaceable.
- **Alternatives considered**:
  - Put matching logic directly into `src/extension.ts`: rejected because activation would become too dense and harder to test.
  - Put matching logic inside the tree provider: rejected because excluded-file visibility targets Explorer resources and editors, not tree rows.

## Decision 3: Use FileDecorationProvider for Explorer badge and optional graying

- **Decision**: Implement Explorer presentation with a dedicated `FileDecorationProvider` that returns badge `✗`, tooltip text, and optional gray color when a file is excluded.
- **Rationale**: VS Code 1.110+ exposes `window.registerFileDecorationProvider`, `FileDecorationProvider`, and `FileDecoration`, which match the product need directly and avoid custom Explorer workarounds.
- **Alternatives considered**:
  - Attempt to surface excluded state through the configuration tree only: rejected because the spec explicitly requires Explorer visibility for files in the workspace.
  - Reuse diagnostics for Explorer visibility: rejected because diagnostics do not provide the requested badge and optional graying behavior.

## Decision 4: Manage editor overlays with one reusable decoration type

- **Decision**: Create one reusable `TextEditorDecorationType` for the first-line warning overlay and apply it only to visible excluded editors when `tfTools.excludedFiles.showEditorOverlay` is enabled.
- **Rationale**: One shared decoration type minimizes editor resource churn and keeps refresh logic straightforward. First-line whole-line decoration plus hover text matches the spec while staying within stable VS Code APIs.
- **Alternatives considered**:
  - Emit diagnostics instead of overlays: rejected because the spec calls for an optional first-line editor warning, not a Problems entry.
  - Create per-editor decoration types: rejected because it adds unnecessary lifecycle complexity.

## Decision 5: Use forward-slash normalized, case-sensitive matching with basename-only filename patterns

- **Decision**: Normalize candidate paths to `/` before matching, evaluate `fileNamePatterns` against the basename only, keep all matching case-sensitive, and treat `folderGlobs` as either absolute paths or workspace-relative paths depending on how the pattern is written.
- **Rationale**: This follows the clarified spec exactly and gives users a portable rule that matches common VS Code glob-writing habits without creating Windows-specific divergence. Basename-only filename patterns also prevent accidental path-sensitive behavior in the filename filter.
- **Alternatives considered**:
  - Accept native path separators per platform: rejected because it creates platform-specific settings and extra escaping ambiguity.
  - Allow subpath globbing in `fileNamePatterns`: rejected because it blurs the boundary between the two setting categories and contradicts the clarified spec.

## Decision 6: Use `minimatch` rather than inventing a custom glob matcher

- **Decision**: Add the small `minimatch` dependency for basename and folder-glob evaluation, with repo-specific normalization layered above it.
- **Rationale**: The repo does not already include a reusable glob matcher. Implementing even a constrained wildcard engine would add avoidable complexity and risk subtle bugs in `**`, `*`, and path-separator handling. `minimatch` is small, well-known, and sufficient once the feature normalizes inputs and constrains where each setting applies.
- **Alternatives considered**:
  - Hand-roll wildcard matching: rejected because it is more complex to get correct than introducing one focused dependency.
  - Use VS Code search APIs as a matcher: rejected because those APIs are built for file search, not repeated in-memory matching during refresh.

## Decision 7: Treat empty pattern lists and missing payloads as explicit clear-state conditions

- **Decision**: When `fileNamePatterns` or `folderGlobs` is empty, or when the active inclusion payload becomes unavailable, clear Explorer badges and editor overlays instead of retaining previous excluded state.
- **Rationale**: The clarified spec states that empty lists disable matching, and the feature spec requires stale state to disappear immediately when inputs no longer support a previous exclusion decision.
- **Alternatives considered**:
  - Keep the last exclusion snapshot until new data arrives: rejected because it leaves stale warnings from a previous configuration.
  - Warn the user when lists are empty: rejected because empty lists are an intentional configuration, not an error state.

## Decision 8: Reuse the existing serialized refresh path and manual refresh command

- **Decision**: Wire excluded-file recomputation into the existing IntelliSense refresh lifecycle and reuse `tfTools.refreshIntelliSense` as the manual user-invoked refresh entry point rather than adding a new command.
- **Rationale**: The extension already serializes refreshes through `IntelliSenseService.scheduleRefresh`, and the spec lists explicit refresh as a trigger without requiring a second command. Reusing that path prevents race conditions and keeps the public command surface unchanged.
- **Alternatives considered**:
  - Add a separate `Refresh Excluded Files` command: rejected because it duplicates functionality and expands the command surface for little value.
  - Recompute excluded files independently on each event: rejected because concurrent settings and active-context changes could otherwise apply stale state out of order.

## Decision 9: Keep failure visibility lightweight and rely on existing artifact and log surfaces

- **Decision**: Do not add new diagnostics or new output-channel warnings for excluded-file matching itself. Instead, clear markers when inputs are unavailable and rely on the existing compile-commands artifact row plus existing IntelliSense/logging surfaces to explain why inclusion data is absent.
- **Rationale**: The feature spec explicitly allows no new persistent signal for these failure modes, and adding duplicate logs would fragment troubleshooting across slices.
- **Alternatives considered**:
  - Add a dedicated excluded-file warning log entry on every missing-payload refresh: rejected because it duplicates the IntelliSense slice’s missing-artifact explanation.
  - Add diagnostics for excluded files: rejected because the product requirement is a visual marker, not a file-backed error.