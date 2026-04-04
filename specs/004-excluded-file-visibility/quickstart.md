# Quickstart: Excluded-File Visibility

## Goal

Verify excluded-file visibility end to end in a VS Code Extension Development Host: Explorer badge and optional graying, editor overlays, basename-only and folder-scope matching, forward-slash normalization, settings-driven refresh, and stale-state clearing when the active compile-database payload changes or disappears.

## Prerequisites

- Install repository dependencies and compile the extension.
- Prepare fixture manifests and workspaces that provide a valid active compile-database payload for at least one configuration.
- Include files that are:
  - present in the active compile-database payload
  - absent from the payload but inside excluded-file scope
  - absent from the payload and outside excluded-file scope
- Configure representative excluded-file settings, including:
  - `fileNamePatterns = ["*.c"]`
  - `folderGlobs = ["core/embed/**", "core/vendor/**"]`
  - `grayInTree = true`
  - `showEditorOverlay = true`

## Scenario 1: Explorer marks excluded files only inside scope

1. Launch the extension against a workspace whose active compile-database payload includes some C files and omits others.
2. Open the workspace Explorer.
3. Confirm an omitted file such as `core/embed/projects/foo.c` shows badge `✗` when it matches both the basename filter and folder glob.
4. Confirm an included file does not show any excluded-file decoration.
5. Confirm a file like `docs/foo.c` does not show a decoration because it falls outside `folderGlobs`.
6. Disable `tfTools.excludedFiles.grayInTree` and confirm the badge remains while the gray color disappears.

## Scenario 2: Editor overlay is optional and clears correctly

1. Open an excluded file while `tfTools.excludedFiles.showEditorOverlay` is enabled.
2. Confirm the first line shows a warning overlay and hover text explaining that the file is not included in the active build configuration.
3. Open an included file and confirm no excluded-file overlay is shown.
4. Disable `tfTools.excludedFiles.showEditorOverlay` and confirm the overlay disappears from the excluded file without restart.
5. Re-enable the setting and confirm the overlay returns on the next refresh.

## Scenario 3: Matching semantics follow the clarified contract

1. Set `fileNamePatterns = ["*.c"]` and confirm `main.c` can be marked while `main.h` cannot.
2. Set `fileNamePatterns = ["src/*.c"]` and confirm it does not gain path-aware behavior because filename matching is basename-only.
3. Set `folderGlobs = ["core/embed/**"]` and confirm a matching file under the workspace root can be marked.
4. Replace the folder glob with an absolute path equivalent and confirm matching behavior is unchanged.
5. On a platform that uses `\` separators, confirm matching still works because candidate paths are normalized to `/` before evaluation.
6. Clear `fileNamePatterns` or `folderGlobs` and confirm all excluded-file markers disappear until the setting is repopulated.

## Scenario 4: Refresh follows active-context and payload changes

1. Start with a configuration whose active compile-database payload excludes at least one file that is currently marked.
2. Change model, target, or component so the active compile-database payload changes.
3. Confirm stale Explorer badges and editor overlays from the previous configuration disappear and the new configuration’s excluded files are marked instead.
4. Trigger `Trezor: Refresh IntelliSense` manually and confirm excluded-file state recomputes through the same path.
5. Remove or invalidate the active compile-database input and confirm excluded-file markers are cleared rather than left stale.

## Automated Test Expectations

- Unit tests cover basename-only filename matching, ignored subpath filename patterns, forward-slash normalization, case-sensitive matching, empty-list disabling, and absolute versus workspace-relative folder glob handling.
- Integration tests cover Explorer `FileDecorationProvider` output, editor overlay rendering and clearing, settings changes without restart, active-context-driven refresh, and stale-state clearing after payload loss.
- Regression tests confirm existing IntelliSense refresh behavior and existing tree or command surfaces continue to work while excluded-file visibility is added.