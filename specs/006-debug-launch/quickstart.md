# Quickstart: Debug Launch

## Goal

Verify Debug Launch end to end in a VS Code Extension Development Host using the revised manifest contract: component-scoped debug profiles, optional `when` match-all behavior, declaration-order selection, derived executable-row state, visible-but-disabled Start Debugging surfaces when blocked, conditional Command Palette visibility, invocation-time template loading, `${tfTools.debugProfileName}` substitution, debug API launch, and explicit failure plus logging behavior.

## Prerequisites

- Install repository dependencies and compile the extension.
- Update fixture manifests and workspaces so they cover:
  - a selected component whose first matching debug profile launches successfully
  - a selected component whose first profile omits `when` and therefore matches all contexts
  - multiple matching profiles where declaration order decides the selected profile
  - no matching debug profile on the selected component
  - a matching debug profile whose derived executable is missing
  - a matching debug profile whose template file is missing
  - a matching debug profile whose template contains invalid JSONC
  - a matching debug profile whose variables include an unknown token or a cycle
  - a template path that attempts to escape the configured templates root
  - unsupported legacy manifest debug schema to confirm hard-cutover rejection when covered by tests
- Ensure the workspace has resolvable `tfTools.manifestPath`, `tfTools.artifactsPath`, and `tfTools.debug.templatesPath` settings.

## Scenario 1: The first matching component debug profile launches from every supported surface

1. Launch the extension with a manifest where the selected component declares ordered `debug` entries and at least one entry matches the active model, target, and component.
2. Ensure the derived executable exists under `<tfTools.artifactsPath>/<artifactFolder>/` with the expected file name `<artifactName><artifactSuffix><executableExtension>`.
3. Open the `Build Artifacts` section and confirm the `Executable` row shows `valid`.
4. Invoke `Trezor: Start Debugging` from the Configuration view header and confirm the debug session starts.
5. Repeat from the view overflow menu, the `Executable` row action, and the Command Palette.
6. Confirm all four surfaces launch the same resolved configuration.

## Scenario 2: Declaration order decides among multiple matching debug profiles

1. Start with a manifest where the selected component contains two or more debug profiles whose `when` expressions all match the active context.
2. Place a different template in the first matching profile than in later matching profiles.
3. Confirm the visible Start Debugging surfaces remain enabled and the Command Palette entry is shown.
4. Invoke `Trezor: Start Debugging`.
5. Confirm the launched configuration uses the first matching profile's template and `${tfTools.debugProfileName}` value.

## Scenario 3: Omitted `when` acts as a component-wide default profile

1. Configure a selected component with a first debug profile whose `when` is omitted.
2. Switch across multiple models or targets for that same component.
3. Confirm the profile continues to match all active contexts for that component unless a still-earlier matching profile exists.
4. Confirm Start Debugging remains enabled when the derived executable exists.

## Scenario 4: No-match and missing-executable contexts stay discoverable but blocked

1. Switch to a context where the selected component has no matching debug profile.
2. Confirm the visible header, overflow, and `Executable` row Start Debugging actions remain shown but disabled.
3. Confirm `Trezor: Start Debugging` is absent from the Command Palette.
4. Switch to a context where a debug profile matches but the derived executable file does not exist.
5. Confirm the `Executable` row reports `missing`, the tooltip includes the expected path plus a missing reason, visible Start Debugging actions remain shown but disabled, and the Command Palette entry remains absent.

## Scenario 5: The `Executable` row explains derived readiness

1. Start with a matching debug profile and a target that defines `artifactSuffix` and `executableExtension`.
2. Confirm the `Executable` row tooltip shows the derived path `<artifacts-root>/<artifactFolder>/<artifactName><artifactSuffix><executableExtension>`.
3. Change the active target to one with different or omitted suffix and extension fields.
4. Confirm the `Executable` row path and enablement update without restarting the extension.
5. Change `tfTools.artifactsPath` and confirm the row and enablement recompute again.

## Scenario 6: Template failures happen at invocation time, not during enablement

1. Start with a matching debug profile whose derived executable exists but whose template file is missing.
2. Confirm the visible Start Debugging actions remain enabled before invocation and the Command Palette entry is shown.
3. Invoke `Trezor: Start Debugging`.
4. Confirm launch is blocked with an explicit error and a new output-channel log entry that includes the template path.
5. Repeat with a malformed JSONC template and confirm the same invocation-time failure behavior.

## Scenario 7: tf-tools substitution resolves nested values and preserves non-tf-tools variables

1. Use a template that contains tf-tools variables in nested objects, nested arrays, and embedded within larger strings.
2. Include `${tfTools.debugProfileName}`, `${tfTools.executable}`, and `${tfTools.executablePath}` in the template.
3. Include ordinary VS Code or debugger variables in the same template.
4. Invoke `Trezor: Start Debugging` with a matching debug profile.
5. Confirm tf-tools variables resolve to active-context values while non-tf-tools variables remain unchanged for downstream debugger handling.
6. Repeat with a debug variable that references an unknown token or a cyclic variable definition and confirm launch is blocked with an explicit error and output-channel log entry.

## Scenario 8: Template-root traversal and legacy schema are rejected

1. Configure a debug profile whose `template` path attempts to escape `tfTools.debug.templatesPath`.
2. Ensure the entry otherwise matches and the derived executable exists.
3. Invoke `Trezor: Start Debugging`.
4. Confirm the extension blocks launch, shows an explicit error, and logs the traversal rejection.
5. Separately validate a manifest that still uses legacy top-level `debug`, `priority`, profile-level `executable`, or `${tfTools.debugConfigName}` usage and confirm the extension treats it as unsupported rather than silently translating it.

## Automated Test Expectations

- Unit tests cover manifest parsing for component-scoped debug profiles, omitted-`when` match-all semantics, declaration-order resolution, derived executable naming, JSONC template parsing, root-traversal rejection, `${tfTools.debugProfileName}` substitution, and cycle detection.
- Integration tests cover `Executable` row rendering and order, tooltip content, header and overflow contribution ordering, row-action visibility, Command Palette visibility, invocation-time template failures, successful debug launch through the VS Code debug API, and required output-channel logging for blocked launches.
- Regression tests confirm Flash/Upload actions, compile-commands state, excluded-file features, and Build Workflow behavior remain unchanged while Debug Launch is updated.
