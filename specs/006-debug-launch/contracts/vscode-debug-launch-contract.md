# VS Code Contribution Contract: Debug Launch

## Purpose

This contract captures the user-visible VS Code surfaces introduced or changed by the revised Debug Launch feature so implementation and tests verify the same extension-facing behavior.

## Settings

- **`tfTools.debug.templatesPath`**:
  - Resource-scoped setting
  - Default value: `${workspaceFolder}/core/embed/.tf-tools`
  - Resolves the root directory for component debug-entry template files
  - Changing this setting refreshes derived executable resolution and Start Debugging availability without requiring a restart

## Commands

- **`tfTools.startDebugging`**:
  - Public command
  - Category: `Trezor`
  - User-facing title: `Trezor: Start Debugging`
  - Launches the resolved debug configuration for the active build context through the VS Code debug API
  - Appears in the Command Palette only when the selected component yields a matching debug entry and the derived executable exists

## Command Palette Surface

- **Visibility contract**:
  - `tfTools.startDebugging` is shown only when the selected component yields a matching debug entry for the active model, target, and component and the derived executable artifact exists
  - it is absent when no debug entry matches or when the executable is missing
  - template readability and template parse validity do not affect pre-invocation Command Palette visibility
- **Execution contract**:
  - selecting the command loads the template on demand, resolves tf-tools variables, and launches debugging through the VS Code debug API
  - blocked launch attempts show an explicit error instead of starting debugging

## Configuration View Title Surface

- **Header action contract**:
  - `tfTools.startDebugging` appears as a visible header action in the Configuration view
  - the action remains visible but disabled when the active context is not startable or the executable is missing
- **Overflow contract**:
  - `tfTools.startDebugging` also appears in the Configuration view overflow menu
  - it is ordered after the applicable Flash and Upload overflow entries and before `Refresh IntelliSense`
  - it remains visible but disabled under the same conditions as the header action
- **Enablement boundary**:
  - missing templates or malformed template content do not disable these visible actions before invocation when entry resolution and executable checks pass

## Build Artifacts Tree Surface

- **Rows**:
  - the `Build Artifacts` section always includes an `Executable` row
  - the `Executable` row appears after `Map File` when Binary and Map rows are present, and immediately after `Compile Commands` when they are not
- **Status contract**:
  - the row displays `valid` when a matching debug entry exists and the derived executable exists
  - the row displays `missing` when no matching debug entry resolves or when the expected executable path does not exist
- **Tooltip contract**:
  - when derivation succeeds, the tooltip includes the expected executable path
  - when the row is `missing`, the tooltip also includes the reason the artifact is unavailable
- **Row action contract**:
  - the row exposes an icon-only `Start Debugging` action backed by `tfTools.startDebugging`
  - the action remains visible but disabled when no matching debug entry resolves or the executable is missing
  - template readability and template parse validity do not affect pre-invocation row-action enablement

## Menus And Context Keys

- **`menus.commandPalette`**:
  - uses a derived startability context key so `tfTools.startDebugging` appears only when the active context is startable
- **`menus.view/title`**:
  - contributes the header and overflow `Start Debugging` actions for the Configuration view
  - keeps those visible regardless of startability and uses `enablement` for disabled-state behavior
- **`menus.view/item/context`**:
  - contributes the `Executable` row action using the row-specific `contextValue`
  - uses the same startability key for action enablement
- **Context-key expectations**:
  - one authoritative startability context is recomputed whenever model, target, component, manifest state, workspace support, artifacts path, templates path, or executable presence changes
  - command visibility and visible-surface enablement derive from that same snapshot so the UI cannot disagree across surfaces

## Launch And Failure Contract

- Debug matching uses only the selected component's `debug` entries and the same condition semantics as other manifest `when` expressions.
- `component.debug[].when` is optional; omission means the entry matches all active contexts for that component.
- The first matching entry in declaration order is the selected debug entry.
- The derived executable file name is `<artifactName><artifactSuffix><executableExtension>` and the absolute executable path is built under the selected model artifact folder.
- The selected template is loaded from `tfTools.debug.templatesPath` on every invocation.
- Template paths that escape the configured root are rejected.
- Templates parse as a single JSONC debug configuration object.
- tf-tools substitution applies to every string field in nested objects and arrays, replaces embedded tf-tools tokens, leaves non-tf-tools variables untouched, exposes `${tfTools.debugProfileName}`, and does not re-expand replacement results.
- Unknown, unresolved, or cyclic tf-tools variables block launch.
- Launch uses `vscode.debug.startDebugging` and does not persist `launch.json`.
- No-match, missing-template, invalid-template, substitution, missing-executable, and debug API failures all show explicit errors and write persistent output-channel entries.
- Legacy top-level `debug`, `priority`, profile-level `executable`, and `${tfTools.debugConfigName}` are unsupported and must not be silently translated.

## Non-Goals For This Contract

- No change to Build, Clippy, Check, or Clean behavior
- No change to Flash or Upload execution or to `Binary` and `Map File` ownership
- No change to compile-commands provider behavior
- No new excluded-file decorations or overlays
- No multi-root support
- No generation or persistence of `launch.json`
- No backward compatibility layer for the legacy debug schema or legacy debug token
