# Quickstart: Debug Launch

## Goal

Verify Debug Launch end to end in a VS Code Extension Development Host: manifest-driven profile resolution, executable-row state, visible-but-disabled Start Debugging surfaces, conditional Command Palette visibility, invocation-time template loading, tf-tools substitution, debug API launch, and explicit failure plus logging behavior.

## Prerequisites

- Install repository dependencies and compile the extension.
- Add fixture manifests and workspaces that cover:
  - a unique matching debug profile with an existing executable
  - multiple matching profiles with different priorities
  - multiple matching profiles tied at the highest priority
  - no matching debug profile
  - a unique profile whose executable is missing
  - a unique profile whose template file is missing
  - a unique profile whose template contains invalid JSONC
  - a unique profile whose variables include an unknown token or a cycle
  - a template path that attempts to escape the configured templates root
- Ensure the workspace has resolvable `tfTools.manifestPath`, `tfTools.artifactsPath`, and `tfTools.debug.templatesPath` settings.

## Scenario 1: A unique highest-priority profile launches from every supported surface

1. Launch the extension with a manifest whose active model, target, and component match exactly one highest-priority debug profile.
2. Ensure the resolved executable exists under the selected model artifact folder.
3. Open the `Build Artifacts` section and confirm the `Executable` row shows `valid`.
4. Invoke `Trezor: Start Debugging` from the Configuration view header and confirm the debug session starts.
5. Repeat from the view overflow menu, the `Executable` row action, and the Command Palette.
6. Confirm all four surfaces launch the same resolved configuration.

## Scenario 2: Priority decides among multiple matching profiles

1. Start with a manifest where two or more debug profiles match the active context.
2. Give one matching profile a strictly higher `priority` than the others.
3. Confirm the visible Start Debugging surfaces remain enabled and the Command Palette entry is shown.
4. Invoke `Trezor: Start Debugging`.
5. Confirm the launched configuration uses the highest-priority profile's template and executable values.

## Scenario 3: Ambiguous and unmatched contexts stay discoverable but blocked

1. Switch to a context where no debug profile matches.
2. Confirm the visible header, overflow, and `Executable` row Start Debugging actions remain shown but disabled.
3. Confirm `Trezor: Start Debugging` is absent from the Command Palette.
4. Switch to a context where two matching profiles tie at the highest priority.
5. Confirm the visible Start Debugging actions remain shown but disabled and the Command Palette entry remains absent.
6. Attempt to invoke Start Debugging through a visible surface if the test harness supports it and confirm the extension shows an explicit error and records the resolution failure in the output channel.

## Scenario 4: The `Executable` row explains readiness

1. Start with a unique matching profile whose resolved executable exists.
2. Confirm the `Executable` row reports `valid` and its tooltip includes the expected executable path.
3. Switch to a context where the same profile resolves to a missing executable.
4. Confirm the row reports `missing`, the tooltip includes the expected path plus a missing reason, and visible Start Debugging actions remain shown but disabled.
5. Switch between models, targets, components, and artifacts-path settings and confirm the row and enablement update without restarting the extension.

## Scenario 5: Template failures happen at invocation time, not during enablement

1. Start with a unique matching profile whose executable exists but whose template file is missing.
2. Confirm the visible Start Debugging actions remain enabled before invocation and the Command Palette entry is shown.
3. Invoke `Trezor: Start Debugging`.
4. Confirm launch is blocked with an explicit error and a new output-channel log entry that includes the template path.
5. Repeat with a malformed JSONC template and confirm the same invocation-time failure behavior.

## Scenario 6: tf-tools substitution resolves nested values and preserves non-tf-tools variables

1. Use a template that contains tf-tools variables in nested objects, nested arrays, and embedded within larger strings.
2. Include ordinary VS Code or debugger variables in the same template.
3. Invoke `Trezor: Start Debugging` with a uniquely matching profile.
4. Confirm tf-tools variables resolve to the active context values while non-tf-tools variables remain unchanged for downstream debugger handling.
5. Repeat with a profile variable that references an unknown token or a cyclic variable definition and confirm launch is blocked with an explicit error and output-channel log entry.

## Scenario 7: Template-root traversal is rejected

1. Configure a debug profile whose `template` path attempts to escape `tfTools.debug.templatesPath`.
2. Ensure the profile otherwise resolves uniquely and the executable exists.
3. Invoke `Trezor: Start Debugging`.
4. Confirm the extension blocks launch, shows an explicit error, and logs the traversal rejection.

## Automated Test Expectations

- Unit tests cover manifest parsing for debug profiles, priority and ambiguity resolution, relative and absolute executable resolution, JSONC template parsing, root-traversal rejection, tf-tools substitution semantics, and cycle detection.
- Integration tests cover `Executable` row rendering and order, tooltip content, header and overflow contribution ordering, row-action visibility, Command Palette visibility, invocation-time template failures, successful debug launch through the VS Code debug API, and required output-channel logging for blocked launches.
- Regression tests confirm Flash/Upload actions, compile-commands state, excluded-file features, and Build Workflow behavior remain unchanged while Debug Launch is added.
