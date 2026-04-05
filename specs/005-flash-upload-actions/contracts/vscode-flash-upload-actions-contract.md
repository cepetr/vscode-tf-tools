# VS Code Contribution Contract: Flash/Upload Actions

## Purpose

This contract captures the user-visible VS Code surfaces introduced or changed by the Flash/Upload Actions feature so implementation and tests can verify the same extension-facing behavior.

## Commands

- **`tfTools.flash`**:
  - Public command
  - Category: `Trezor`
  - Appears in the Command Palette only when Flash is applicable for the active build context
  - Launches the Flash workflow as a VS Code task
- **`tfTools.upload`**:
  - Public command
  - Category: `Trezor`
  - Appears in the Command Palette only when Upload is applicable for the active build context
  - Launches the Upload workflow as a VS Code task
- **`tfTools.openMapFile`**:
  - Internal command used only for the `Map File` row action
  - Not exposed as a standalone Command Palette entry
  - Opens the resolved map file in the current editor when the file exists

## Command Palette Surface

- **Visibility contract**:
  - `tfTools.flash` is shown only when Flash is applicable for the active model, target, and component
  - `tfTools.upload` is shown only when Upload is applicable for the active model, target, and component
  - inapplicable Flash or Upload commands are not shown in the Command Palette
- **Execution contract**:
  - selecting an applicable command starts the corresponding VS Code task
  - blocked starts show an explicit error instead of starting a task

## Build Artifacts Tree Surface

- **Rows**:
  - `Binary` row shows `valid` or `missing`
  - `Map File` row shows `valid` or `missing`
- **Tooltip contract**:
  - each row tooltip includes the expected artifact path
  - missing rows include a missing-reason explanation
- **Binary row actions**:
  - Flash and Upload actions are shown only when the selected component rule makes that specific action applicable
  - both actions may be shown at the same time
  - applicable actions remain visible but disabled when the binary artifact is missing
- **Map File row action**:
  - open action is always present on the row
  - it is enabled only when the resolved map file exists

## Menus And Context Keys

- **`menus.commandPalette`**:
  - uses derived context keys so only applicable Flash or Upload commands appear
- **`menus.view/item/context`**:
  - adds Binary-row action buttons for Flash and Upload
  - adds a Map File row action button for file open
  - uses row-specific `contextValue` plus enablement keys so missing artifacts disable rather than hide applicable row actions
- **Context-key expectations**:
  - separate keys exist for Flash applicability, Upload applicability, Binary presence, and Map presence
  - the active-context refresh path recomputes these keys when model, target, component, manifest validity, workspace support, or artifact presence changes

## Execution And Failure Contract

- Flash and Upload run as VS Code tasks, not as direct spawned processes.
- Flash uses `xtask flash <component-id> -m <model-id>`.
- Upload uses `xtask upload <component-id>`.
- Missing or invalid manifest, unsupported workspace, inapplicable action state, or missing binary artifact blocks task start with an explicit error.
- Post-start Flash or Upload failures show an explicit error and write a dedicated output-channel log entry.
- Successful Flash or Upload completion does not trigger automatic IntelliSense, excluded-file, or artifact refresh.

## Non-Goals For This Contract

- No change to `Compile Commands` row ownership or cpptools behavior
- No new excluded-file decorations or overlay behavior
- No change to Build, Clippy, Check, or Clean task-provider exposure
- No Debug command or Debug row behavior
- No multi-root support