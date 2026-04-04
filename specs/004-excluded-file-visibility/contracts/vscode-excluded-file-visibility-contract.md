# VS Code Contribution Contract: Excluded-File Visibility

## Purpose

This contract captures the user-visible VS Code surfaces introduced or changed by the Excluded-File Visibility feature so implementation and tests can verify the same extension-facing behavior.

## Settings

- **`tfTools.excludedFiles.grayInTree`**:
  - Type: `boolean`, resource-scoped
  - Default: `true`
  - Controls whether excluded Explorer items are additionally grayed
- **`tfTools.excludedFiles.showEditorOverlay`**:
  - Type: `boolean`, resource-scoped
  - Default: `true`
  - Controls whether excluded editors show a first-line warning overlay
- **`tfTools.excludedFiles.fileNamePatterns`**:
  - Type: `string[]`, resource-scoped
  - Default includes `*.c`
  - Matches basename only, including name and extension
  - Case-sensitive
  - Does not support subpath matching
- **`tfTools.excludedFiles.folderGlobs`**:
  - Type: `string[]`, resource-scoped
  - Default includes workspace source-folder globs such as `core/embed/**` and `core/vendor/**`
  - Case-sensitive
  - May be written as absolute paths or as paths relative to the workspace root
- **Pattern semantics**:
  - configured patterns use `/` separators
  - candidate file paths are normalized to `/` before matching
  - if either `fileNamePatterns` or `folderGlobs` is empty, excluded-file marking is disabled until that list is repopulated

## Explorer Surface

- **Decoration contract**:
  - excluded files in scope show badge `✗`
  - tooltip explains that the file is not included in the active build configuration
  - gray color is applied only when `tfTools.excludedFiles.grayInTree` is enabled
  - included files and out-of-scope files do not show excluded-file decorations

## Editor Surface

- **Overlay contract**:
  - when `tfTools.excludedFiles.showEditorOverlay` is enabled, excluded files show a first-line warning overlay
  - hover text explains that the file is not included in the active build configuration
  - included files and out-of-scope files do not show the overlay
  - disabling the setting removes the overlay without restart

## Refresh Behavior

- **Automatic refresh triggers**:
  - activation
  - active model, target, or component changes
  - successful build completion
  - manifest changes
  - workspace changes
  - `tfTools.artifactsPath` changes
  - excluded-file setting changes
- **Manual refresh contract**:
  - the feature reuses `Trezor: Refresh IntelliSense`
  - invoking that command recomputes excluded-file state through the same serialized refresh path
- **Stale-state contract**:
  - when the active compile-database inclusion payload changes, Explorer and editor markers update to the latest configuration
  - when the active compile-database inclusion payload becomes unavailable, excluded-file markers are cleared rather than left stale

## Integration Contract

- Excluded-file visibility consumes the active compile-database inclusion payload produced by the IntelliSense slice.
- This feature does not add new compile-commands parsing rules, artifact resolution rules, cpptools-provider behavior, or alternate inclusion sources.
- This feature does not add new commands, diagnostics, or log-channel warnings beyond the existing refresh and IntelliSense surfaces.

## Non-Goals For This Contract

- No changes to compile-commands artifact row behavior
- No Binary or Map File behavior
- No Flash or Upload commands
- No Debug launch behavior
- No alternate provider or multi-root support