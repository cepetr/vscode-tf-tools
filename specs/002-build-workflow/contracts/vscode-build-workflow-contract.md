# VS Code Contribution Contract: Build Workflow

## Purpose

This contract captures the user-visible VS Code surfaces introduced or changed by the Build Workflow feature so implementation and tests can verify the same extension-facing behavior.

## Configuration View

- **Primary View**: `Configuration`
- **Build Options section**:
  - renders manifest-defined options instead of placeholder-only content
  - preserves grouped and ungrouped manifest declaration order
  - shows checkbox options as native checkbox rows (VS Code `checkboxState`); toggled via `onDidChangeCheckboxState`
  - shows multistate options as selector-style parent rows with inline active state
  - only one multistate choice list is open at a time; expanding one collapses the previous
  - omits options whose `when` expression evaluates to `false`
  - restores prior stored selections when an option becomes available again

## View Title Actions

- **Actions contributed by this feature**:
  - `Build`
  - `Run Clippy`
  - `Run Check`
  - `Run Clean`
- **Blocked-state contract**:
  - all four actions remain visible when blocked
  - blocked actions are disabled rather than hidden
  - `Build`, `Clippy`, and `Check` are blocked by invalid or missing manifest state relevant to Build Workflow
  - all four actions are blocked by unsupported workspace state

## Commands

- **User-facing titles**:
  - `Trezor: Build`
  - `Trezor: Run Clippy`
  - `Trezor: Run Check`
  - `Trezor: Run Clean`
  - `Trezor: Show Logs`
- **Overflow ordering**:
  - `Run Clippy`
  - `Run Check`
  - `Run Clean`
  - `Refresh IntelliSense`
- **Execution contract**:
  - `Build`, `Clippy`, and `Check` derive arguments from the active model, target, component, and currently applicable build-option selections
  - `Clean` runs without active build-option arguments
  - blocked commands show visible failure feedback instead of starting execution

## Tasks

- **Task labels**:
  - `Build {model-name} | {target-display} | {component-name}`
  - `Clippy {model-name} | {target-display} | {component-name}`
  - `Check {model-name} | {target-display} | {component-name}`
  - `Clean`
- **Task availability**:
  - tasks are exposed through standard VS Code build-task entry points
  - `target-display` uses target `shortName` when present, otherwise target `name`

## Diagnostics And Logging

- Invalid build-option `when` expressions produce diagnostics on `tf-tools.yaml`.
- Manifest or workflow-blocking failures are written to the `Trezor Firmware Tools` output channel.
- Task-launch failures produce visible user-facing errors plus log entries.

## Non-Goals For This Contract

- No Build Artifacts row behavior or artifact-status refresh
- No Flash or Upload commands
- No Debug launch behavior
- No IntelliSense or compile-commands refresh behavior
- No excluded-file visibility behavior