# Quickstart: Build Workflow

## Goal

Verify Build Workflow end-to-end in a VS Code Extension Development Host: Build Options rendering, `when`-driven availability, blocked-state behavior, workflow task labels, and effective command argument derivation.

## Prerequisites

- Install repository dependencies.
- Compile the extension sources.
- Prepare fixture manifests covering:
  - valid grouped and ungrouped build options
  - valid options with `when` rules that toggle availability by model, target, or component
  - invalid build-option `when` expressions
  - an unsupported workspace fixture

## Scenario 1: Build Options render and persist correctly

1. Launch the extension against a fixture workspace with a valid manifest containing grouped, ungrouped, checkbox, and multistate options.
2. Open the `Trezor` activity-bar container and the `Configuration` view.
3. Confirm the `Build Options` section renders manifest-defined options in declaration order, preserving grouped and ungrouped placement.
4. Toggle a checkbox option and select a non-default multistate value.
5. Reload the Extension Development Host.
6. Confirm the same visible selections are restored.

## Scenario 2: `when` rules hide options but preserve values

1. In a valid workspace, select a build option that is available only for one model, target, or component combination.
2. Change the active build context so the option's `when` rule evaluates to false.
3. Confirm the option disappears from the `Build Options` section.
4. Trigger `Build` or inspect derived argument state and confirm the hidden option contributes no flag.
5. Restore the previous build context and confirm the option reappears with its prior value.

## Scenario 3: Invalid build-option `when` blocks workflow execution

1. Launch against a workspace whose manifest contains an invalid build-option `when` expression.
2. Confirm the manifest problem appears in the Problems view and the manifest editor.
3. Confirm `Build` remains visible in the Configuration view header while `Run Clippy`, `Run Check`, and `Run Clean` remain visible in the overflow menu and are disabled.
4. Attempt to run one of those actions and confirm the user receives visible failure feedback.
5. Run `Trezor: Show Logs` and confirm the output channel records the blocking manifest failure.

## Scenario 4: Workflow labels and commands track the active context

1. Launch against a valid workspace and choose a model, target, and component where the target defines a short name.
2. Confirm the title-area actions use `Build`, `Run Clippy`, `Run Check`, and `Run Clean`, while task labels continue to use `Build {model-id}-{target-display}-{component-name}`, `Clippy ...`, and `Check ...`.
3. Confirm `target-display` uses `shortName` when present and falls back to the full target name when absent.
4. Run `Clean` and confirm it uses the plain label `Clean`.

## Scenario 5: Unsupported workspace blocks all workflow actions

1. Launch against a workspace that violates the supported workspace guard.
2. Confirm `Build` remains visible but disabled in the primary header, `Run Clippy`, `Run Check`, and `Run Clean` remain visible but disabled in the overflow menu, and `Refresh IntelliSense` appears after them.
3. Attempt to invoke any workflow action and confirm a visible unsupported-workspace error is shown.
4. Confirm the output channel contains the failure details.

## Automated Test Expectations

- Unit tests cover `when` parsing/validation/evaluation, build-option key normalization, hidden-value preservation, effective-argument derivation, and task label formatting.
- Integration tests cover Build Options tree rendering, grouped ordering, context-driven hiding/restoration, blocked header actions for invalid manifest and unsupported workspace states, command/task launch behavior, and persistent diagnostics/logging.
- Regression tests confirm the existing build-context selectors and status-bar behavior remain intact while Build Options and workflow commands are added.