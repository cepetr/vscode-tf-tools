# VS Code Contribution Contract: Configuration Experience Root Sections Default Expansion

## Purpose

This contract captures the user-visible VS Code surfaces relevant to the root-section default-expansion fix in the Configuration Experience slice.

## Views

- **Activity Bar Container**: `Trezor`
- **Primary View**: `Configuration`
- **View Model**:
  - top-level sections are `Build Selection`, `Build Options`, and `Build Artifacts`
  - all three top-level sections remain expanded by default
  - only `Build Selection` is interactive in this feature
  - `Build Options` and `Build Artifacts` show placeholder or warning content only in this slice
  - selector headers show user-facing selected values inline: model `name`, target `shortName` when present otherwise target `name`, and component `name`
- **Tree View Icons**:
  - `Build Selection`, `Build Options`, and `Build Artifacts` render without dedicated icons
  - `Model` uses the VS Code `circuit-board` theme icon
  - `Target` uses the VS Code `target` theme icon
  - `Component` uses the VS Code `extensions` theme icon
  - active selector choice rows may use the VS Code `check` theme icon
  - inactive selector choice rows use an empty spacer icon so labels stay aligned without a semantic icon
- **Selector Expansion Model**:
  - `Model`, `Target`, and `Component` behave like an accordion
  - expanding one selector collapses any other open selector

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