# Quickstart: Flash/Upload Actions

## Goal

Verify Flash/Upload Actions end to end in a VS Code Extension Development Host: manifest-driven action applicability, Binary and Map File row state, conditional Command Palette exposure, task-backed Flash and Upload execution, map-file open behavior, explicit failures, and the absence of automatic post-success refresh.

## Prerequisites

- Install repository dependencies and compile the extension.
- Prepare fixture manifests and workspaces that cover:
  - a component where only Flash is applicable
  - a component where only Upload is applicable
  - a component where both Flash and Upload are applicable
  - a component where neither action is applicable
  - active contexts with present and missing binary artifacts
  - active contexts with present and missing map artifacts
- Ensure the workspace has a resolvable `tfTools.cargoWorkspacePath`, `tfTools.manifestPath`, and `tfTools.artifactsPath`.

## Scenario 1: Binary row shows only applicable actions

1. Launch the extension with a valid manifest and an active configuration whose selected component makes only Flash applicable.
2. Open the `Build Artifacts` section.
3. Confirm the `Binary` row shows the Flash action and does not show Upload.
4. Switch to a component where only Upload is applicable and confirm the row now shows Upload only.
5. Switch to a component where both actions are applicable and confirm both actions are present at the same time.
6. Switch to a component that omits both rules and confirm neither action is shown.

## Scenario 2: Command Palette visibility matches applicability

1. With Flash applicable and Upload inapplicable, open the Command Palette.
2. Confirm the Flash command is listed with the active `{model-name} | {target-display} | {component-name}` context in its title and Upload is absent.
3. Change the active component so Upload becomes applicable and Flash becomes inapplicable.
4. Reopen the Command Palette and confirm the visibility and titles flip accordingly.
5. Change to a component where both actions are applicable and confirm both commands are listed with the active context in their titles.
6. Change to a component where neither action is applicable and confirm neither command is listed.

## Scenario 3: Missing artifacts disable row actions and block starts

1. Start with a context where Flash or Upload is applicable but the binary artifact is missing.
2. Confirm the applicable action remains visible on the `Binary` row but is disabled.
3. Confirm the `Binary` row displays `missing` and the tooltip shows the expected path plus a missing reason.
4. Attempt to invoke the applicable command from another surface and confirm the extension blocks the start with an explicit error.
5. With the map artifact missing, confirm the `Map File` row shows `missing` and its open action is disabled.

## Scenario 4: Flash and Upload execute as VS Code tasks

1. Start from a context where Flash is applicable and the binary artifact exists.
2. Invoke Flash from the `Binary` row and confirm a VS Code task starts in the configured cargo workspace.
3. Repeat by invoking Flash from the Command Palette and confirm the same workflow starts.
4. Switch to an Upload-applicable context with a present binary and confirm Upload starts as a VS Code task from both supported surfaces.
5. Confirm successful completion does not trigger automatic artifact or IntelliSense refresh.

## Scenario 5: Map file action opens the resolved file

1. Start from a context where the resolved map artifact exists.
2. Invoke the `Map File` row action.
3. Confirm the resolved `.map` file opens in the current editor as a normal editable file.
4. Open the Command Palette and confirm no standalone Map File command is listed.
5. Change to a context where the map file is missing and confirm the row action becomes disabled.

## Scenario 6: Failures stay visible

1. Make the manifest invalid with an invalid `flashWhen` or `uploadWhen` expression.
2. Confirm manifest diagnostics appear and Flash/Upload commands do not become startable.
3. Restore a valid manifest but use an unsupported workspace state or missing binary artifact and confirm starts are blocked with explicit errors.
4. Force the underlying Flash or Upload task to fail after start and confirm the user sees an error plus a new output-channel log entry.

## Automated Test Expectations

- Unit tests cover manifest parsing for `flashWhen` and `uploadWhen`, generalized artifact path derivation for `.bin` and `.map`, action applicability, blocked-start rules, and tree-item row state.
- Integration tests cover Binary and Map File row rendering, Command Palette visibility, row-action enablement, task launch, map-file opening, failure logging, and the no-auto-refresh rule after successful Flash or Upload completion.
- Regression tests confirm compile-commands row behavior, excluded-file features, Build/Clippy/Check/Clean workflows, and Debug remain unchanged while Flash/Upload Actions are added.