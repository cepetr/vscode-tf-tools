# Implementation Plan: Debug Launch

**Branch**: `006-debug-launch` | **Date**: 2026-04-05 | **Spec**: `specs/006-debug-launch/spec.md`
**Input**: Feature specification from `specs/006-debug-launch/spec.md`

**File Reference Rule**: Use workspace-relative paths for any repository file references written into this plan.

## Summary

Implement Debug Launch by extending the manifest model with parsed `debug` profiles, adding a focused debug-resolution layer that selects exactly one highest-priority profile for the active model, target, and component, resolves the executable artifact and tf-tools substitution variables, safely loads a JSONC debugger template from `tfTools.debug.templatesPath`, and starts the final configuration through the VS Code debug API. The work stays inside the existing activation-root and tree-provider architecture: `src/extension.ts` remains the composition root, `src/intellisense/artifact-resolution.ts` grows executable-artifact state, `src/ui/configuration-tree.ts` gains the `Executable` row and row action surface, `package.json` gains the new setting plus the header, overflow, row, and Command Palette contributions for `tfTools.startDebugging`, and tests cover manifest validation, profile priority resolution, ambiguity handling, template loading and traversal rejection, substitution semantics, executable-row state, command visibility and enablement, debug API launch, and required error and log behavior.

## Informal Spec Alignment

**Selected Slice**: `6. Debug Launch`
**Source Anchor**: `Debug profile resolution, priority handling, template loading, executable artifact handling, Executable row behavior, header and overflow Start Debugging actions, substitution variables, debug API launch, and debug-specific errors and logging.`
**Scope Guard**: This plan includes manifest-defined debug profile parsing and validation, priority-based profile matching, executable artifact resolution, `tfTools.debug.templatesPath`, the always-present `Executable` artifact row, the icon-only `Start Debugging` row action, the Configuration view header and overflow `Start Debugging` actions, Command Palette exposure only for a uniquely startable debug context, JSONC template loading, tf-tools substitution, debug launch through the VS Code debug API, and debug-specific visible failure handling and output-channel logging. It explicitly excludes Build, Clippy, Check, and Clean behavior; Flash and Upload execution; `Binary` and `Map File` ownership; compile-commands provider behavior; excluded-file visibility; multi-root support; and any broader tree redesign.
**Critical Informal Details**: Only manifest-defined debug profiles make a build context debuggable; the extension must resolve the active context to exactly one matching profile before launch; the highest `priority` wins, but ties at the highest priority remain ambiguous and must disable visible Start Debugging actions and block launch; the selected template is read from `tfTools.debug.templatesPath` on each invocation rather than cached; missing or malformed templates must not pre-disable visible Start Debugging actions when profile resolution and executable existence are otherwise valid; the `Executable` artifact path comes from the selected profile's required `executable` field, resolved relative to the active model artifact folder unless already absolute; the `Build Artifacts` section must always include an `Executable` row showing `valid` or `missing`, with the expected path in the tooltip when a unique profile resolves and an explicit blocked-reason tooltip when it does not; the `Executable` row must expose an icon-only `Start Debugging` action backed by `Trezor: Start Debugging`; the Configuration view must show the same action in the visible header and overflow menu, keeping those surfaces discoverable but disabled whenever no unique valid profile is resolved or the executable is missing; the Command Palette must show `Trezor: Start Debugging` only when exactly one valid profile is resolved and the executable exists; tf-tools substitution must walk nested string fields across objects and arrays, replace supported tf-tools variables in a single pass without re-expanding results, leave non-tf-tools variables untouched, and fail visibly for unknown variables, unresolved required values, cyclic profile-defined variables, invalid template content, or missing templates; all debug-specific blocked launches and runtime failures must show explicit errors and create persistent output-channel entries.

## Technical Context

**Language/Version**: TypeScript 5.x targeting VS Code 1.110+ desktop extension host
**Primary Dependencies**: VS Code Extension API, existing `yaml`-backed manifest parser and `when` evaluator, existing artifact-resolution and log-channel helpers, Node.js `fs` and `path` APIs, `jsonc-parser` for debugger template files, Mocha test runner, `@vscode/test-electron` integration harness
**Storage**: Existing manifest file plus new `debug` entries, existing workspace-state active model/target/component selection, resource-scoped VS Code settings for `tfTools.manifestPath`, `tfTools.artifactsPath`, and `tfTools.debug.templatesPath`, and extension-memory debug availability and artifact state; no new persisted workspace state required
**Testing**: Unit tests for manifest validation, profile matching and priority handling, executable-path derivation, template traversal and JSONC parsing, tf-tools substitution, and row-state helpers; integration tests for command/menu contributions, row rendering and tooltips, enablement and Command Palette visibility, debug launch wiring, and explicit failure plus logging behavior
**Target Platform**: VS Code 1.110+ desktop extension host
**Project Type**: Single-package VS Code extension
**Performance Goals**: No perceptible Configuration view lag when the active context, manifest, artifacts path, or templates path changes; executable-state recomputation remains bounded to the active configuration and one resolved profile; template files are read only on invocation and not preloaded during normal refreshes
**Constraints**: Single-root workspace only, manifest/settings remain authoritative, no silent fallback profiles or artifacts, missing or malformed templates must fail at invocation rather than disable visible actions early, debug launch must use the VS Code debug API instead of persisting `launch.json`, and all new failure modes must surface through explicit notifications and output-channel logging
**Scale/Scope**: One extension package, one active build context, one new public command, one new settings key, one always-present `Executable` tree row, one debug-resolution layer, and new fixtures covering matching, ambiguous, unmatched, missing-template, invalid-template, unresolved-variable, cyclic-variable, traversal, and missing-executable states

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] Host compatibility: scoped to a TypeScript VS Code extension targeting VS Code 1.110+.
- [x] Informal-spec alignment: the selected slice is stated, the design stays within it, and cross-slice work is deferred or split.
- [x] Informal-spec detail capture: critical user-visible and implementation-sensitive behaviors from the selected slice are explicitly carried into this plan.
- [x] Manifest authority: build/debug/configuration choices derive from settings and manifest data, not hardcoded matrices.
- [x] Test discipline: tests are defined before implementation and cover each changed behavior plus regressions.
- [x] Failure visibility: diagnostics, notifications, and log-channel behavior are specified for new failure modes.
- [x] Simplicity: abstractions are minimal and any identifier or design complexity exception is justified.

## Critical Detail Reconciliation

- Extend `src/manifest/manifest-types.ts` and `src/manifest/validate-manifest.ts` so manifest `debug` entries are parsed into a typed profile model with validated `when`, `priority`, `template`, `executable`, and optional `vars` fields; enforce with unit coverage in `src/test/unit/manifest/validate-manifest.test.ts` for valid profiles, invalid `when`, missing required fields, duplicate-ambiguity scenarios, and invalid variable definitions.
- Add `tfTools.debug.templatesPath` to `package.json` and `src/workspace/settings.ts`, with default `${workspaceFolder}/core/embed/.tf-tools` and resource-scoped resolution semantics aligned to the existing workspace-setting helpers; enforce with integration coverage that settings changes refresh executable resolution and Start Debugging enablement without restart.
- Introduce a focused debug-resolution helper under `src/commands/` or a small new `src/debug/` module so `src/extension.ts` can derive one authoritative debug state snapshot: matched profile set, unique-vs-ambiguous result, resolved executable path, executable presence, and Start Debugging enablement; enforce with unit tests in `src/test/unit/workflow/debug-launch.test.ts` for priority wins, equal-priority ambiguity, no-match behavior, relative vs absolute executable resolution, and built-in variable-map construction.
- Extend `src/intellisense/artifact-resolution.ts` and `src/ui/configuration-tree.ts` so the `Build Artifacts` section always renders an `Executable` row after `Map File` when present and after `Compile Commands` otherwise, using `valid` or `missing` descriptions plus tooltips that carry the expected path when a unique profile resolves and a visible blocked reason when it does not; enforce with unit UI coverage and integration tests for row order, tooltip content, and disabled row action behavior.
- Update `package.json` and `src/extension.ts` together so `tfTools.startDebugging` is contributed as a public command, appears as a visible Configuration view header action and overflow action at the correct ordering slot, appears on the `Executable` row as an icon-only action, and appears in the Command Palette only when exactly one valid debug profile is resolved and the executable exists; enforce with integration tests for `menus.commandPalette`, `menus.view/title`, `menus.view/item/context`, command ordering, and scope-guard expectations.
- Keep visible Start Debugging surfaces enabled only from profile resolution and executable presence, not from template readability, so missing or malformed templates fail only when invoked; enforce with integration tests that template failures still leave the visible header, overflow, and row actions enabled before invocation.
- Implement template loading, root-traversal rejection, JSONC parsing, tf-tools substitution, and `vscode.debug.startDebugging` launch through one command handler, while preserving non-tf-tools variables and blocking on unknown, unresolved, or cyclic tf-tools variables; enforce with unit tests for substitution semantics and integration tests for successful launch, template errors, variable errors, ambiguous-profile errors, missing-executable errors, and output-channel logging.
- Preserve slice boundaries by leaving Build Workflow, Flash/Upload, compile-commands provider logic, excluded-file surfaces, and any launch.json persistence untouched; enforce with scope-review assertions and by confining implementation changes to manifest parsing, debug settings, debug-resolution helpers, artifact state, package contributions, extension wiring, and focused tests and fixtures.

## Project Structure

### Documentation (this feature)

```text
specs/006-debug-launch/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── vscode-debug-launch-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
package.json
src/
├── extension.ts
├── commands/
├── intellisense/
│   └── artifact-resolution.ts
├── manifest/
├── observability/
├── ui/
└── workspace/

src/test/
├── integration/
└── unit/

test-fixtures/
├── manifests/
└── workspaces/
```

**Structure Decision**: Keep debug-launch behavior close to the current activation and artifact-state seams instead of creating a large new subsystem. Extend `src/manifest/` for typed debug-profile parsing and validation, extend `src/workspace/settings.ts` and `package.json` for the new templates-path setting, extend `src/intellisense/artifact-resolution.ts` for executable artifact state, add one focused debug-resolution and launch helper near `src/commands/` for profile selection, template loading, substitution, and debug API launch, and keep `src/extension.ts` as the composition root that recomputes context keys and wires the `tfTools.startDebugging` command. Concentrate coverage in `src/test/unit/` and `src/test/integration/`, and add dedicated debug fixtures under `test-fixtures/manifests/` and `test-fixtures/workspaces/` for valid, ambiguous, unmatched, missing-template, invalid-template, unresolved-variable, traversal, and missing-executable cases. This is the smallest structure that satisfies the slice without leaking into Flash/Upload or IntelliSense ownership.

## Post-Design Constitution Check

- [x] Host compatibility remains limited to a TypeScript VS Code extension for VS Code 1.110+.
- [x] Design remains within the Debug Launch slice; Build Workflow, Flash/Upload behavior, compile-commands provider behavior, excluded-file visibility, and launch.json persistence remain out of scope.
- [x] Manifest data and resource-scoped settings remain authoritative; profile matching, executable resolution, and template-root selection derive from manifest and settings state rather than hardcoded tables.
- [x] The design defines unit and integration tests before implementation, including manifest-validation, profile-resolution, substitution, row-state, menu-visibility, debug-launch, and failure-logging regressions.
- [x] Failure handling stays visible through explicit error notifications, existing manifest diagnostics for invalid debug definitions, and output-channel logging for profile, template, variable, and executable failures.
- [x] No complexity exception is required; one manifest extension, one executable-artifact enhancement, and one focused debug-resolution and launch helper are sufficient.

## Complexity Tracking

No constitutional violations or justified complexity exceptions were identified for this feature.
