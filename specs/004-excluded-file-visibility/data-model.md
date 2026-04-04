# Data Model: Excluded-File Visibility

## Excluded Files Settings

- **Purpose**: Represents the resource-scoped user settings that control whether excluded-file markers are shown and where they may appear.
- **Fields**:
  - `grayInTree`: boolean preference for optional Explorer graying
  - `showEditorOverlay`: boolean preference for first-line editor overlays
  - `fileNamePatterns[]`: basename-only, case-sensitive filename glob patterns
  - `folderGlobs[]`: case-sensitive folder glob patterns that may be absolute or workspace-relative
- **Validation rules**:
  - `fileNamePatterns[]` is evaluated against basename only; subpath globbing is not supported
  - `folderGlobs[]` uses `/` separators in configured patterns
  - empty `fileNamePatterns[]` disables filename eligibility
  - empty `folderGlobs[]` disables folder-scope eligibility

## Normalized Path Candidate

- **Purpose**: Represents one workspace file path transformed into the forms needed for exclusion evaluation.
- **Fields**:
  - `absolutePath`: normalized absolute file path using `/` separators
  - `workspaceRelativePath`: normalized path relative to the workspace root using `/` separators
  - `basename`: final path segment including name and extension
- **Relationships**:
  - derived from a `vscode.Uri` or filesystem path before matching
- **Validation rules**:
  - matching is case-sensitive in all fields
  - `basename` is the only string used for `fileNamePatterns[]`

## Excluded File Decision

- **Purpose**: Represents the result of evaluating whether one file should be marked excluded for the active configuration.
- **Fields**:
  - `filePath`: normalized absolute path of the file being evaluated
  - `contextKey`: stable summary of the active model, target, and component
  - `includedInCompileDb`: boolean indicating whether the active IntelliSense payload contains the file
  - `matchesFileNamePattern`: boolean indicating whether basename matched at least one configured filename pattern
  - `matchesFolderGlob`: boolean indicating whether the file matched at least one configured folder glob
  - `isExcluded`: final exclusion result
  - `reason`: user-facing explanation when `isExcluded` is true
- **Validation rules**:
  - `isExcluded` is true only when `includedInCompileDb` is false and both match booleans are true
  - `reason` must explain that the file is not included in the active build configuration

## Excluded Files Snapshot

- **Purpose**: Represents the latest exclusion state derived from the active compile-database payload and current settings.
- **Fields**:
  - `contextKey`: active configuration key
  - `artifactPath`: active compile-database path or `null` when unavailable
  - `settings`: current `Excluded Files Settings`
  - `includedFiles`: normalized absolute path set from the active IntelliSense payload
  - `excludedFiles`: normalized absolute path set currently marked excluded
  - `generatedAt`: timestamp of the latest recomputation
- **Relationships**:
  - derived from `Excluded Files Settings`, the active workspace root, and the active IntelliSense payload
  - consumed by Explorer decoration and editor overlay layers
- **Validation rules**:
  - `excludedFiles` must be empty when `artifactPath` is null or either scope list is empty
  - `excludedFiles` must be recomputed whenever `contextKey`, `artifactPath`, or settings change

## Explorer Decoration State

- **Purpose**: Represents the decoration values that the Explorer layer exposes for one excluded file.
- **Fields**:
  - `badge`: fixed value `✗`
  - `tooltip`: explanation that the file is not included in the active build configuration
  - `color`: optional gray theme color when `grayInTree` is enabled
  - `propagate`: optional falsey/default behavior so only the file row is decorated
- **Validation rules**:
  - decoration is produced only for files contained in `Excluded Files Snapshot.excludedFiles`
  - `color` is omitted when `grayInTree` is false

## Editor Overlay State

- **Purpose**: Represents the first-line overlay applied to one visible excluded editor.
- **Fields**:
  - `uri`: editor resource URI
  - `range`: first-line range used for decoration
  - `hoverMessage`: explanation that the file is not included in the active build configuration
  - `enabled`: whether overlay rendering is currently allowed by settings
- **Validation rules**:
  - overlay is applied only when `showEditorOverlay` is true and the file is currently excluded
  - overlays are cleared immediately when a file is no longer excluded or the preference is disabled

## Excluded Files Refresh Request

- **Purpose**: Represents one trigger that requires recomputing excluded-file state.
- **Fields**:
  - `trigger`: one of `activation`, `active-config-change`, `successful-build`, `manual-refresh`, `provider-change`, `manifest-change`, `artifacts-path-change`, `workspace-change`, or `excluded-files-setting-change`
  - `requestedAt`: timestamp of the trigger
  - `targetContextKey`: active configuration key at scheduling time
- **Validation rules**:
  - concurrent refresh requests collapse through the shared serialized refresh path
  - completion must leave the snapshot aligned with the most recent trigger, not any earlier one