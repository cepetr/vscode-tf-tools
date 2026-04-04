# VS Code Contribution Contract: IntelliSense Integration

## Purpose

This contract captures the user-visible VS Code surfaces introduced or changed by the IntelliSense Integration feature so implementation and tests can verify the same extension-facing behavior.

## Settings

- **`tfTools.artifactsPath`**:
  - Type: `string`, resource-scoped
  - Default: `core/build-xtask/artifacts`
  - Resolved relative to the workspace root when not absolute; cleared or empty disables artifact resolution
  - Triggers a full IntelliSense refresh when changed

## Configuration View

- **Primary View**: `Configuration`
- **Build Artifacts section**:
  - contains a `Compile Commands` row for the active configuration
  - displays `valid` when the exact expected compile-commands artifact exists
  - displays `missing` when the exact expected compile-commands artifact does not exist
  - shows a tooltip with the expected artifact path for the active configuration
  - adds missing-artifact explanation text to the tooltip when the artifact is absent
  - recomputes row state when the active model, target, component, manifest content, or `tfTools.artifactsPath` changes
- **Scope guard**:
  - this feature does not add Binary or Map File behavior
  - this feature does not add Flash, Upload, or Debug behavior

## View Title Actions

- **Action contributed by this feature**:
  - `Refresh IntelliSense`
- **Surface contract**:
  - available from the Configuration view title or overflow menu
  - triggers the same refresh path used by activation and other automatic refresh sources

## Commands

- **User-facing titles**:
  - `Trezor: Refresh IntelliSense`
  - `Trezor: Show Logs`
- **Execution contract**:
  - `Trezor: Refresh IntelliSense` is available from the Command Palette
  - invoking the command recomputes active compile-commands artifact state and provider readiness
  - when the active artifact is missing, the command clears stale IntelliSense state instead of keeping the previous compile database active

## IntelliSense Provider Integration

- **Supported provider**:
  - Microsoft C/C++ (`ms-vscode.cpptools`) only
- **Provider contract**:
  - tf-tools registers and maintains a custom configuration provider for cpptools
  - tf-tools eagerly parses the active `.cc.json` database before notifying cpptools about configuration changes
  - tf-tools serves cpptools per-file `SourceFileConfiguration` objects keyed by normalized absolute source-file path
  - tf-tools infers C versus C++ language mode per compile entry from `-std=` first, then file extension, then compiler frontend name
  - tf-tools preserves the active compile-entry flags for cpptools translation after the compiler executable token, resolving relative paths against the entry `directory`
  - if duplicate compile-database entries exist for one file, tf-tools uses the first and logs the conflict
  - tf-tools returns a browse configuration whose `browsePath` is the de-duplicated union of include paths from the active compile database and whose representative compiler metadata comes from the first indexed entry
  - if cpptools is unavailable, the user receives a visible warning and the condition is logged persistently
  - if cpptools is installed but tf-tools is not the active provider, the user receives a visible warning and the condition is logged persistently
  - when provider prerequisites become valid again, stale warning state clears on the next refresh

## Diagnostics And Logging

- Missing compile-commands artifacts are represented through the `Compile Commands` row plus a persistent log entry, not a popup notification.
- Missing-provider and wrong-provider conditions produce both visible warnings and output-channel log entries.
- Runtime refresh failures are written to the `Trezor Firmware Tools` output channel.

## Non-Goals For This Contract

- No excluded-file explorer badges or editor overlays
- No Binary or Map File row behavior
- No Flash or Upload commands
- No Debug launch behavior
- No alternate C/C++ provider support