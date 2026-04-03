# VS Code Contribution Contract: Configuration Experience

## Purpose

This contract captures the user-visible VS Code surfaces introduced by the Configuration Experience feature so implementation and tests can verify the same extension-facing behavior.

## Views

- **Activity Bar Container**: `Trezor`
- **Primary View**: `Configuration`
- **View Model**:
  - top-level sections are `Build Context`, `Build Options`, and `Build Artifacts`
  - only `Build Context` is interactive in this feature
  - `Build Options` and `Build Artifacts` show placeholder or warning content only
- **Tree View Icons**:
  - `Build Context` uses the VS Code `symbol-folder` theme icon
  - `Build Options` uses the VS Code `symbol-folder` theme icon
  - `Build Artifacts` uses the VS Code `info` theme icon
  - `Model` uses the VS Code `circuit-board` theme icon
  - `Target` uses the VS Code `target` theme icon
  - `Component` uses the VS Code `extensions` theme icon
  - active selector choice rows may use the VS Code `check` theme icon
  - inactive selector choice rows use an empty spacer icon so labels stay aligned without a semantic icon

## View Title Actions

- This feature contributes no `Build` or `Debug` actions to the `Configuration` view title bar.

## Status Bar

- **Visibility Setting**: `tfTools.showConfigurationInStatusBar`
- **Display Format**: `{model-name} | {target-display} | {component-name}`
- **Activation Behavior**: selecting the item reveals the `Configuration` view

## Commands

- **User-facing command**: `Trezor: Show Logs`
  - reveals the dedicated `Trezor Firmware Tools` output channel
- **Internal command contract**: reveal the configuration view from the status-bar item
  - may remain internal if no separate Command Palette entry is needed for this slice

## Settings

- **Required in this feature**:
  - `tfTools.manifestPath`
  - `tfTools.showConfigurationInStatusBar`
- **Deferred to later slices**:
  - `tfTools.artifactsPath`
  - `tfTools.debug.templatesPath`
  - excluded-file settings

## Diagnostics And Logging

- Manifest problems produce diagnostics attached to `tf-tools.yaml` when a concrete range is available.
- Runtime failures related to manifest loading, normalization, and refresh are written to the `Trezor Firmware Tools` output channel.
- Missing or invalid manifest conditions also produce immediate visible feedback in the editor UI.

## Non-Goals For This Contract

- No build task contributions
- No artifact-row commands
- No debug launch command
- No IntelliSense provider registration