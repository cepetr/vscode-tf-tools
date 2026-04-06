# Implementation Plan: Debug Launch

**Branch**: `006-debug-launch` | **Date**: 2026-04-06 | **Spec**: `specs/006-debug-launch/spec.md`
**Input**: Feature specification from `specs/006-debug-launch/spec.md`

**File Reference Rule**: Use workspace-relative paths for any repository file references written into this plan.

## Summary

Implement Debug Launch by replacing the old top-level debug-profile model with component-scoped debug profiles, deriving the executable artifact path from the selected component and target instead of from manifest-provided executable strings, exposing the informal-spec debug token set during template substitution, and resolving the first matching debug profile in declaration order. The work stays within the existing VS Code extension architecture: manifest parsing and validation move into `src/manifest/`, executable-state derivation stays in `src/intellisense/artifact-resolution.ts`, debug launch orchestration stays in `src/commands/debug-launch.ts`, UI state remains driven from `src/extension.ts` and `src/ui/configuration-tree.ts`, and tests and fixtures are updated to the hard-cutover schema with no legacy compatibility layer.

## Informal Spec Alignment

**Selected Slice**: `6. Debug Launch`
**Source Anchor**: `Component-scoped debug-profile resolution, declaration-order matching, template loading, derived executable artifact handling, Executable row behavior, header and overflow Start Debugging actions, substitution variables, debug API launch, and debug-specific errors and logging.`
**Scope Guard**: This plan includes component-scoped manifest `debug` parsing and validation, first-match debug-profile resolution, derived executable artifact handling, `tfTools.debug.templatesPath`, the always-present `Executable` row, the icon-only `Start Debugging` row action, Configuration view header and overflow `Start Debugging` actions, conditional Command Palette exposure, template loading, tf-tools substitution including `${tfTools.artifactPath}`, `${tfTools.component.id}`, `${tfTools.component.name}`, `${tfTools.debugProfileName}`, `${tfTools.model.id}`, `${tfTools.model.name}`, `${tfTools.target.id}`, `${tfTools.target.name}`, `${tfTools.executable}`, `${tfTools.executablePath}`, and `${tfTools.debug.var:<name>}`, debug API launch, and debug-specific visible failure handling and output-channel logging. It excludes Build, Clippy, Check, and Clean behavior; Flash and Upload execution; `Binary` and `Map File` ownership; compile-commands provider behavior; excluded-file visibility; multi-root support; and any compatibility layer for the legacy top-level debug schema, `priority`, profile-level `executable`, or `${tfTools.debugConfigName}`.
**Critical Informal Details**: Only the selected component's manifest-defined debug profiles make the active context debuggable; `component.debug[].when` is optional and omission means match-all for that component; the first matching debug profile in declaration order wins; legacy top-level debug schema and old tokens are unsupported; the selected template is read from `tfTools.debug.templatesPath` on each invocation rather than cached; the executable path is always derived as `<artifactName><artifactSuffix><executableExtension>` under the active model artifact folder; the debug variable map exposes the active artifact path, model id and name, target id and name, component id and name, debug profile name, executable values, and `${tfTools.debug.var:<name>}` entries; the `Build Artifacts` section always includes an `Executable` row showing `valid` or `missing` with expected-path tooltips; visible Start Debugging surfaces stay discoverable but disabled when no matching debug profile resolves or when the executable is missing; missing or malformed templates do not pre-disable visible actions; successful launches should reveal the `Run and Debug` view; tf-tools substitution walks nested string fields, performs single-pass replacement, leaves non-tf-tools variables untouched, and fails on unknown, unresolved, or cyclic tf-tools values; blocked launches and runtime failures must show explicit errors and create persistent output-channel entries.

## Technical Context

**Language/Version**: TypeScript 5.x targeting VS Code 1.110+ desktop extension host
**Primary Dependencies**: VS Code Extension API, existing `yaml` parser, existing `when` parser and evaluator, Node.js `fs` and `path` APIs, `jsonc-parser`, Mocha test runner, `@vscode/test-electron`
**Storage**: Existing manifest file; resource-scoped VS Code settings for `tfTools.manifestPath`, `tfTools.artifactsPath`, and `tfTools.debug.templatesPath`; existing workspace-state active model/target/component selection; extension-memory executable-state and debug-availability snapshots; no new persisted workspace state
**Testing**: Automated unit tests plus VS Code integration tests; manifest fixtures and workspace fixtures updated to the new schema are required
**Target Platform**: VS Code 1.110+ desktop extension host
**Project Type**: Single-package VS Code extension
**Performance Goals**: No perceptible Configuration view lag on model/target/component or setting changes; executable-state recomputation remains bounded to the active configuration and selected component debug entries; template files are read only at invocation time
**Constraints**: Single-root workspace only; manifest and settings remain authoritative; hard cutover to the new debug schema; explicit diagnostics or logs for failures; no launch.json persistence; no silent fallback to legacy fields or tokens
**Scale/Scope**: One extension package, one active build context, one public debug command, one resource-scoped template-path setting, one always-present `Executable` row, one component-scoped debug-entry resolution path, and updated fixtures and tests for the new schema

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

- Replace the manifest debug model in `src/manifest/manifest-types.ts` and `src/manifest/validate-manifest.ts` so `targets` expose optional `executableExtension`, `components` expose optional `debug[]`, `component.debug[].when` is optional match-all, and legacy top-level `debug`, `priority`, and profile-level `executable` are rejected; enforce with unit coverage in `src/test/unit/manifest/validate-manifest.test.ts`.
- Rework `src/commands/debug-launch.ts` so selection uses the selected component's debug entries only, the first matching declaration-order entry wins, the informal-spec token set is exposed, `${tfTools.executable}` and `${tfTools.executablePath}` are derived from `artifactName`, `artifactSuffix`, and `executableExtension`, and legacy token handling is removed; enforce with unit coverage in `src/test/unit/workflow/debug-launch.test.ts` and `src/test/unit/workflow/debug-template-resolution.test.ts`.
- Rework `src/intellisense/artifact-resolution.ts` so executable-state derivation depends on selected component and target fields instead of manifest debug executable strings, and blocked-state messages cover only manifest-invalid, no-match, and missing-executable outcomes; enforce with unit and integration coverage in `src/test/unit/workflow/intellisense-artifact-resolution.test.ts` and `src/test/integration/debug-launch-artifacts.integration.test.ts`.
- Update `src/extension.ts`, `src/ui/configuration-tree.ts`, and `package.json` so Command Palette visibility, visible action enablement, row tooltips, and row ordering all derive from the new first-match startability snapshot while still keeping visible surfaces unconditional in the Configuration view; enforce with integration coverage in `src/test/integration/debug-launch.integration.test.ts`, `src/test/integration/debug-launch-artifacts.integration.test.ts`, and `src/test/integration/configuration-scope.integration.test.ts`.
- Replace debug fixtures under `test-fixtures/manifests/` and `test-fixtures/workspaces/` with component-scoped debug entries and templates that exercise omitted `when`, declaration-order selection, derived executable paths, target suffix or extension changes, missing executables, template failures, and hard-cutover rejection of legacy schema; enforce with quickstart and regression coverage.
- Preserve slice boundaries by leaving Build Workflow, Flash/Upload execution, compile-commands provider behavior, excluded-file visibility, and launch.json persistence untouched; enforce through scope-review assertions and by limiting source changes to manifest parsing, debug launch, executable state, package contributions, fixtures, and focused tests.

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

**Structure Decision**: Keep Debug Launch implementation inside the existing extension seams instead of creating a new subsystem. Extend `src/manifest/` for the new schema, keep selection, template loading, and substitution in `src/commands/debug-launch.ts`, keep executable artifact state in `src/intellisense/artifact-resolution.ts`, keep command and context-key wiring in `src/extension.ts`, keep row rendering in `src/ui/configuration-tree.ts`, and concentrate validation in unit and integration tests plus refreshed fixtures. This is the smallest structure that satisfies the revised slice without adding a compatibility layer.

## Post-Design Constitution Check

- [x] Host compatibility remains limited to a TypeScript VS Code extension for VS Code 1.110+.
- [x] Design remains within the Debug Launch slice; Build Workflow, Flash/Upload behavior, compile-commands provider behavior, excluded-file visibility, and launch.json persistence remain out of scope.
- [x] Manifest data and resource-scoped settings remain authoritative; startability, executable-state derivation, and template-root selection all come from manifest and settings state rather than hardcoded tables.
- [x] The design defines unit and integration tests before implementation, including manifest parsing, first-match selection, omitted-`when` semantics, derived executable paths, substitution, row-state, menu visibility, launch flow, and failure logging.
- [x] Failure handling stays visible through explicit user errors, manifest diagnostics for unsupported or invalid debug schema, and output-channel logging for resolution, template, variable, and executable failures.
- [x] No complexity exception is required; removing the old compatibility path keeps the implementation simpler than maintaining dual schema support.

## Complexity Tracking

No constitutional violations or justified complexity exceptions were identified for this feature.
