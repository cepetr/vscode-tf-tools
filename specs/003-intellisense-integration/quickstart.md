# Quickstart: IntelliSense Integration

## Goal

Verify IntelliSense Integration end to end in a VS Code Extension Development Host: compile-commands path resolution, `Build Artifacts` compile-commands status visibility, cpptools provider readiness warnings, stale-state clearing, and manual refresh behavior.

## Prerequisites

- Install repository dependencies.
- Compile the extension sources.
- Prepare fixture manifests covering:
  - valid artifact metadata with model `artifact-folder`, component `artifact-name`, and target `artifact-suffix`
  - valid workspaces with and without the expected compile-commands artifact
  - manifests or workspaces that cause model, component, target, and `tfTools.artifactsPath` changes to alter the expected compile-commands path
- Have a workspace scenario for each provider case:
  - Microsoft C/C++ unavailable
  - Microsoft C/C++ installed but not configured to use the Trezor provider
  - Microsoft C/C++ installed and configured correctly

## Scenario 1: Compile Commands row follows the active configuration

1. Launch the extension against a valid workspace with a compile-commands artifact at the expected active path.
2. Open the `Trezor` activity-bar container and the `Configuration` view.
3. Confirm the `Build Artifacts` section shows a `Compile Commands` row with status `valid`.
4. Hover the row and confirm the tooltip shows the expected path `<artifacts-root>/<artifact-folder>/<artifact-name><artifact-suffix>.cc.json`.
5. Change the active model to one with a different `artifact-folder` and confirm the row recomputes to the new folder.
6. Change the active component to one with a different `artifact-name` and confirm the row recomputes to the new basename.
7. Change the active target to one with `artifact-suffix` and confirm the row recomputes to the suffixed basename.

## Scenario 2: Missing artifact clears stale IntelliSense state

1. Start from a valid active configuration whose compile-commands artifact exists and has been applied successfully.
2. Remove or rename the active compile-commands artifact without changing to another valid artifact path.
3. Trigger `Refresh IntelliSense` from the Configuration view title or overflow.
4. Confirm the `Compile Commands` row changes to `missing` and the tooltip says the artifact was not found at the expected path.
5. Confirm the extension does not keep using a stale compile-commands configuration for the old context.
6. Open `Trezor: Show Logs` and confirm the missing-artifact condition is recorded persistently without a popup notification.

## Scenario 3: Provider readiness warnings are explicit

1. Launch the extension without Microsoft C/C++ installed.
2. Trigger IntelliSense refresh and confirm a visible warning says IntelliSense integration is unavailable.
3. Open the log output and confirm the missing-provider condition was recorded.
4. Install Microsoft C/C++ but leave the workspace configured to another active provider.
5. Trigger IntelliSense refresh again and confirm a visible warning explains the wrong active provider configuration and offers to switch the workspace setting.
6. Accept the offered fix and confirm `C_Cpp.default.configurationProvider` is updated to the Trezor Firmware Tools provider id for the workspace.
7. Confirm the stale warning state clears on the next refresh.

## Scenario 4: Manual refresh is available from both required surfaces

1. Launch the extension in a valid workspace.
2. Confirm `Refresh IntelliSense` appears in the Configuration view title or overflow menu.
3. Open the Command Palette and confirm `Trezor: Refresh IntelliSense` appears there as well.
4. Invoke the command from each surface and confirm both routes execute the same refresh behavior.

## Scenario 5: Relevant settings and build events trigger recomputation

1. Start with a valid active compile-commands artifact.
2. Change `tfTools.artifactsPath` and confirm the compile-commands row and IntelliSense state recompute for the new root.
3. Modify the manifest so `artifact-folder`, `artifact-name`, or `artifact-suffix` changes for the active context and confirm refresh follows the new path.
4. Run a successful build that produces the active compile-commands artifact and confirm IntelliSense refresh follows the updated artifact.

## Automated Test Expectations

- Unit tests cover manifest IntelliSense-field validation, compile-commands path resolution, provider-readiness state evaluation, stale-state clearing, and tree row tooltip/status generation.
- Integration tests cover active-context-driven path changes, missing-artifact no-fallback behavior, manual-refresh command availability in both required surfaces, provider warning notifications/logging, and `tfTools.artifactsPath` refresh behavior.
- Regression tests confirm Build Workflow task behavior and Configuration Experience selectors/status bar continue to function while IntelliSense integration is added.