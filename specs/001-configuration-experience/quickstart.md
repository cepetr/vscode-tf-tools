# Quickstart: Configuration Experience

## Goal

Verify the first feature slice end-to-end in a VS Code Extension Development Host: manifest loading, configuration tree rendering, build-context selection, persistence, diagnostics, and log output.

## Prerequisites

- Install repository dependencies after the extension scaffold is added.
- Compile the extension sources.
- Prepare fixture workspaces containing:
  - a valid `tf-tools.yaml`
  - a missing-manifest workspace
  - an invalid-manifest workspace

## Scenario 1: Valid manifest renders configuration UI

1. Launch the extension in an Extension Development Host against a fixture workspace with a valid manifest.
2. Open the `Trezor` activity-bar container.
3. Confirm the `Configuration` view shows the top-level sections `Build Context`, `Build Options`, and `Build Artifacts`.
4. Confirm `Build Context` shows interactive `Model`, `Target`, and `Component` rows.
5. Confirm `Build Options` and `Build Artifacts` show placeholder or status content only.
6. Change each selector and confirm the active values update immediately.
7. Confirm the status bar shows `{model-name} | {target-display} | {component-name}`.

## Scenario 2: Reload restores normalized selection

1. In a valid workspace, choose a non-default model, target, and component.
2. Reload the Extension Development Host window.
3. Confirm the same valid selection is restored.
4. Modify the fixture manifest so one saved value is no longer valid.
5. Reload or trigger manifest refresh.
6. Confirm the invalid saved value is replaced with the first valid manifest value and the UI remains usable.

## Scenario 3: Invalid manifest exposes diagnostics and logs

1. Launch against a workspace with malformed or structurally invalid `tf-tools.yaml`.
2. Confirm the `Build Context` section shows a warning-style state instead of selectors.
3. Confirm the Problems view contains manifest diagnostics.
4. Run `Trezor: Show Logs` and confirm the output channel contains the manifest failure details.

## Scenario 4: Missing manifest fails visibly

1. Launch against a workspace where `tf-tools.yaml` is absent at the configured path.
2. Confirm the configuration view does not show stale selector values.
3. Confirm the user receives visible failure feedback.
4. Confirm the output channel contains the missing-manifest entry.

## Automated Test Expectations

- Unit tests cover manifest parsing, validation, normalization, and status-bar formatting.
- Integration tests cover tree rendering, manifest watcher refresh, diagnostics publication, log command behavior, and workspace-state restoration.
- Package smoke validation confirms the bundled `out/extension.js` loads with only the `vscode` host API externalized and that the generated VSIX contains the expected bundle and icon assets.