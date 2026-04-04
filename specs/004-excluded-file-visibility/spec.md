# Feature Specification: Excluded-File Visibility

**Feature Branch**: `004-excluded-file-visibility`
**Created**: 2026-04-04
**Status**: Draft
**Input**: User description: "Specify the fourth feature in feature-split.md. Ask questions if the scope is not clear."

**File Reference Rule**: Use workspace-relative paths for any repository file references written into this specification.

## Informal Spec Alignment *(mandatory)*

- **Source Documents**: `informal_spec/user-spec.md`, `informal_spec/tech-spec.md`, `informal_spec/feature-split.md`
- **Selected Slice**: `4. Excluded-File Visibility`
- **Scope Guard**: This feature includes showing excluded-file state in the explorer and editors, applying optional explorer graying and optional editor overlays, honoring excluded-file file-name and folder-scope settings, and refreshing those surfaces when the active configuration or excluded-file inputs change. This feature consumes compile-database inclusion data already produced by the IntelliSense slice. It excludes new compile-commands resolution, cpptools provider behavior, compile-database parsing rules, compile-commands artifact status UI, build/clippy/check/clean actions, Flash/Upload actions, Debug launch, and any new manifest-validation or artifact-resolution rules.
- **Critical Informal Details**: Excluded-file visibility must use inclusion data from the active compile database for the currently selected build context; a file is marked only when it is outside the active compile database and also matches the configured file-name and folder-scope rules; the explorer must show an exclusion cross badge and may gray entries only when the corresponding preference is enabled; open editors may show a first-line warning overlay only when the corresponding preference is enabled; the tooltip and overlay text must explain that the file is not included in the active build configuration; excluded-file state refreshes on activation, configuration changes, successful builds, explicit refresh, workspace changes, manifest changes, artifact-path changes, and excluded-file setting changes; stale excluded-file markers must not remain after the active context or inclusion data changes.

## Clarifications

### Session 2026-04-04

- Q: How should excluded-file scope behave when `fileNamePatterns` or `folderGlobs` is empty? → A: Treat an empty list as disabling excluded-file marking for that dimension, so no files are marked until that list is populated again.
- Q: How should filename and folder matching work? → A: `fileNamePatterns` matches basename only, using name plus extension with no subpath globbing; matching is case-sensitive; `folderGlobs` may be absolute or relative to the VS Code workspace root.
- Q: How should path separators work in glob matching? → A: Use `/` separators in configured patterns and normalize candidate paths to `/` before matching.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See Excluded Files In The Explorer (Priority: P1)

As a firmware developer, I want files outside the active build configuration to stand out in the explorer so I can avoid editing code that is not part of the currently selected build context.

**Why this priority**: Explorer visibility is the primary user-facing outcome of the slice. If excluded files are not marked accurately in the file tree, the feature does not deliver its main value.

**Independent Test**: Open a workspace with valid compile-database inclusion data for the active configuration, then browse files that are inside and outside that inclusion set while varying the excluded-file scope settings to verify that only matching out-of-scope files receive explorer markers.

**Acceptance Scenarios**:

1. **Given** a file is outside the active compile database and matches the configured file-name and folder-scope rules, **When** the explorer renders that file, **Then** the file shows an exclusion cross badge.
2. **Given** a file is present in the active compile database, **When** the explorer renders that file, **Then** the file does not show an excluded-file badge.
3. **Given** a file is outside the active compile database but does not match the configured file-name patterns or folder globs, **When** the explorer renders that file, **Then** the file does not show excluded-file markers.
4. **Given** a file's basename matches a configured `fileNamePatterns` entry but only its parent path would match a pattern containing subpath segments, **When** excluded-file scope is evaluated, **Then** the file-name pattern match uses basename only and ignores subpath globbing.
5. **Given** `tfTools.excludedFiles.grayInTree` is enabled and a file is marked as excluded, **When** the explorer renders that file, **Then** the file appears grayed in addition to showing the exclusion badge.
6. **Given** `tfTools.excludedFiles.grayInTree` is disabled and a file is marked as excluded, **When** the explorer renders that file, **Then** the file keeps normal tree coloring while still showing the exclusion badge.

---

### User Story 2 - See Excluded Status Inside Open Editors (Priority: P2)

As a firmware developer, I want an open excluded file to explain its status in the editor so I can immediately understand why it is outside the active configuration without returning to the explorer.

**Why this priority**: Editor feedback is secondary to explorer visibility but still important because users often reach a file through search, history, or source navigation instead of the file tree.

**Independent Test**: Open files that are included and excluded under the active configuration while toggling the editor-overlay preference, then verify that only excluded files show the first-line warning overlay and that the message explains the exclusion.

**Acceptance Scenarios**:

1. **Given** an open file is outside the active compile database, matches the configured scope rules, and `tfTools.excludedFiles.showEditorOverlay` is enabled, **When** the editor renders that file, **Then** a first-line warning overlay explains that the file is not included in the active build configuration.
2. **Given** an open file is outside the active compile database and matches the configured scope rules, **When** the user hovers the excluded-file decoration, **Then** the tooltip explains that the file is not included in the active build configuration.
3. **Given** `tfTools.excludedFiles.showEditorOverlay` is disabled, **When** an excluded file is open in the editor, **Then** no first-line warning overlay is shown.
4. **Given** an open file is included in the active compile database, **When** the editor renders that file, **Then** no excluded-file overlay or excluded-file tooltip is shown.

---

### User Story 3 - Keep Excluded Markers In Sync With Context Changes (Priority: P3)

As a firmware developer, I want excluded-file markers to update automatically when my build context or visibility settings change so that the editor never leaves stale warnings from a previous configuration.

**Why this priority**: Refresh correctness matters after the primary surfaces exist. It ensures users can trust the markers as they switch models, targets, components, or workspace settings.

**Independent Test**: Start with visible excluded-file markers, then change the active configuration, modify excluded-file settings, change artifact-related inputs that alter the active compile database, and trigger a manual refresh to verify that markers recompute and stale markers disappear.

**Acceptance Scenarios**:

1. **Given** excluded-file markers are visible for one active configuration, **When** the user changes model, target, or component, **Then** excluded-file state is recomputed for the new active configuration and stale markers from the previous configuration are removed.
2. **Given** excluded-file markers are visible, **When** `tfTools.excludedFiles.grayInTree`, `tfTools.excludedFiles.showEditorOverlay`, `tfTools.excludedFiles.fileNamePatterns`, or `tfTools.excludedFiles.folderGlobs` changes, **Then** the excluded-file surfaces update without requiring a restart.
3. **Given** the active compile-database input changes because of activation, a successful build, manifest change, workspace change, artifact-path change, or explicit refresh, **When** refresh completes, **Then** excluded-file state reflects the latest inclusion data for the active configuration.
4. **Given** excluded-file markers were previously visible and the active compile-database inclusion data becomes unavailable, **When** refresh completes, **Then** stale excluded-file markers are cleared rather than left in place from the previous state.

### Edge Cases

- A file matches the configured file-name patterns but falls outside every configured folder glob.
- A file falls under a configured folder glob but does not match any configured file-name pattern.
- `tfTools.excludedFiles.fileNamePatterns` or `tfTools.excludedFiles.folderGlobs` is empty.
- A `fileNamePatterns` entry includes path segments even though only basename matching is supported.
- A `folderGlobs` entry is expressed as an absolute path in one workspace and as a workspace-relative path in another.
- Two paths differ only by letter case.
- A path originates from a platform that uses `\` separators.
- The user disables explorer graying or editor overlays while excluded markers are already visible.
- The active configuration changes from one compile database to another where the same file moves from excluded to included, or from included to excluded.
- The active compile-database input becomes unavailable after markers were previously shown.
- Workspace-folder or artifact-path changes alter which compile database is considered active for excluded-file evaluation.
- Multiple editors are open for files with different inclusion states when refresh runs.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST determine excluded-file visibility from the active compile-database inclusion data for the currently selected build configuration.
- **FR-002**: The system MUST mark a file as excluded only when all of the following are true: the file is not included in the active compile database, the file matches at least one configured file-name pattern from `tfTools.excludedFiles.fileNamePatterns`, and the file matches at least one configured folder glob from `tfTools.excludedFiles.folderGlobs`.
- **FR-002A**: If `tfTools.excludedFiles.fileNamePatterns` is empty, or if `tfTools.excludedFiles.folderGlobs` is empty, the system MUST treat that empty list as disabling excluded-file marking for that dimension and MUST NOT mark any files excluded until the list is populated again.
- **FR-002B**: The system MUST evaluate `tfTools.excludedFiles.fileNamePatterns` against the file basename only, including name and extension, and MUST NOT support subpath globbing in `fileNamePatterns`.
- **FR-002C**: The system MUST evaluate excluded-file matching case-sensitively.
- **FR-002D**: The system MUST allow `tfTools.excludedFiles.folderGlobs` entries to be expressed either as absolute paths or as paths relative to the VS Code workspace root.
- **FR-002E**: The system MUST interpret configured `fileNamePatterns` and `folderGlobs` using `/` as the path separator in glob patterns.
- **FR-002F**: Before evaluating excluded-file matching, the system MUST normalize candidate file paths to use `/` separators.
- **FR-003**: The system MUST show an exclusion cross badge in the explorer for every file that meets the excluded-file conditions.
- **FR-004**: When `tfTools.excludedFiles.grayInTree` is enabled, the system MUST gray excluded files in the explorer in addition to showing the exclusion badge.
- **FR-005**: When `tfTools.excludedFiles.grayInTree` is disabled, the system MUST continue to show the exclusion badge for excluded files without applying grayed explorer styling.
- **FR-006**: When `tfTools.excludedFiles.showEditorOverlay` is enabled, the system MUST show a first-line warning overlay for open files that meet the excluded-file conditions.
- **FR-007**: When `tfTools.excludedFiles.showEditorOverlay` is disabled, the system MUST suppress the first-line warning overlay even if the file is excluded.
- **FR-008**: The excluded-file overlay and the excluded-file decoration tooltip MUST explain that the file is not included in the active build configuration.
- **FR-009**: The system MUST remove excluded-file markers and overlays from files that no longer meet the excluded-file conditions after refresh.
- **FR-010**: The system MUST recompute excluded-file state when refresh is triggered by extension activation, active build-context changes, successful build completion, explicit refresh, workspace changes, manifest changes, `tfTools.artifactsPath` changes, or excluded-file setting changes.
- **FR-011**: Changes to `tfTools.excludedFiles.grayInTree`, `tfTools.excludedFiles.showEditorOverlay`, `tfTools.excludedFiles.fileNamePatterns`, or `tfTools.excludedFiles.folderGlobs` MUST take effect without requiring a restart.
- **FR-012**: If active compile-database inclusion data is unavailable for the current build context, the system MUST clear previously applied excluded-file markers and overlays instead of leaving stale excluded-file state visible.
- **FR-013**: The system MUST apply excluded-file visibility only within the configured marker scope and MUST NOT show excluded-file markers for files outside that scope.
- **FR-014**: This feature MUST consume compile-database inclusion data from the IntelliSense slice and MUST NOT add new compile-database parsing behavior, cpptools-provider behavior, compile-commands artifact resolution rules, or alternate fallback data sources.

### Key Entities *(include if feature involves data)*

- **Excluded-File Match Rule**: The combined rule that decides whether a file is marked, consisting of active compile-database inclusion state plus the configured file-name patterns and folder globs.
- **Excluded-File Marker Preferences**: The user-controlled settings that enable or disable explorer graying and editor overlays for excluded files.
- **Excluded-File Presentation State**: The current set of explorer badges, optional graying, tooltips, and editor overlays derived from the active configuration and match rule.
- **Excluded-File Refresh Trigger**: A user or workspace event that requires excluded-file visibility to be recomputed for the active configuration.

## Operational Constraints *(mandatory)*

- Supported host/version: VS Code 1.110+.
- Source of truth inputs: The active model/target/component selection already established by earlier slices, the active compile-database inclusion data from the IntelliSense slice, `tfTools.artifactsPath` when it changes the active compile-database input, and the resource-scoped settings `tfTools.excludedFiles.grayInTree`, `tfTools.excludedFiles.showEditorOverlay`, `tfTools.excludedFiles.fileNamePatterns`, and `tfTools.excludedFiles.folderGlobs`.
- Workspace assumptions: Single-root workspace only.
- Compatibility exclusions: Multi-root workspace behavior, new IntelliSense-provider functionality, compile-commands artifact-status UI changes, build and artifact actions, debug launch, and any feature that changes manifest structure or validation are out of scope.

## Failure Modes & Diagnostics *(mandatory)*

- **Trigger**: Active compile-database inclusion data is unavailable for the current build context.
  - **User-visible response**: Excluded-file badges, graying, and overlays are cleared so the workspace does not continue showing stale excluded-file state.
  - **Persistent signal**: No new persistent signal is required from this slice; users continue to rely on the existing compile-commands and logging surfaces provided by earlier slices.
- **Trigger**: A file is outside the active compile database but falls outside the configured marker scope.
  - **User-visible response**: No excluded-file badge, graying, or overlay is shown for that file.
  - **Persistent signal**: No persistent signal required.
- **Trigger**: `tfTools.excludedFiles.fileNamePatterns` or `tfTools.excludedFiles.folderGlobs` is empty.
  - **User-visible response**: No files are marked excluded until the emptied list is populated again.
  - **Persistent signal**: No persistent signal required.
- **Trigger**: A `fileNamePatterns` entry relies on subpath globbing rather than basename matching.
  - **User-visible response**: The entry does not widen matching beyond basename comparison, so files are marked only when their basename itself matches.
  - **Persistent signal**: No persistent signal required.
- **Trigger**: A candidate path originates from a platform that uses `\` separators.
  - **User-visible response**: Excluded-file matching behaves the same as on `/`-separator platforms because candidate paths are normalized before evaluation.
  - **Persistent signal**: No persistent signal required.
- **Trigger**: An excluded-file visibility setting changes while markers are already visible.
  - **User-visible response**: Explorer and editor surfaces update to match the new preference or scope rules without requiring a restart.
  - **Persistent signal**: No persistent signal required.
- **Trigger**: The active build configuration or active compile-database input changes.
  - **User-visible response**: Excluded-file markers are recomputed for the new active context and stale markers from the previous context are removed.
  - **Persistent signal**: No persistent signal required when refresh succeeds normally.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In validation testing across representative included and excluded files, 100% of files that are outside the active build configuration and inside the configured marker scope show the expected excluded-file badge in the explorer, and 0% of files outside that scope are marked.
- **SC-002**: In usability testing, at least 90% of users can determine within 15 seconds from the explorer or editor message alone that a marked file is not included in the active build configuration.
- **SC-003**: In refresh testing across activation, configuration changes, successful builds, explicit refresh, artifact-path changes, and excluded-file setting changes, 100% of excluded-file surfaces reflect the latest active configuration without leaving stale markers from the previous state.

## Assumptions

- The IntelliSense Integration slice already provides the active compile-database inclusion data needed to distinguish included files from excluded files for the current build context.
- The existing refresh flow can trigger excluded-file recomputation after activation, successful builds, configuration changes, manifest changes, workspace changes, and explicit refresh.
- Resource-scoped excluded-file settings already exist with defaults defined in the informal spec, including `grayInTree` and `showEditorOverlay` defaulting to `true`, `fileNamePatterns` including `*.c`, and `folderGlobs` including the firmware source folders.
- If active compile-database inclusion data is unavailable, clearing stale excluded-file state is preferable to presenting warnings based on an older build context.
- Empty excluded-file scope lists are treated as an intentional configuration that disables excluded-file marking until the user provides at least one value in each required list.
- Users may configure `folderGlobs` using either absolute paths or workspace-relative paths, but `fileNamePatterns` are intended only for basename matching.
- Glob patterns are written with `/` separators even on platforms whose native filesystem separator is `\`.
