# Implementation Plan: IntelliSense Integration

**Branch**: `003-intellisense-integration` | **Date**: 2026-04-04 | **Spec**: `specs/003-intellisense-integration/spec.md`
**Input**: Feature specification from `specs/003-intellisense-integration/spec.md`

## Summary

Bring the IntelliSense slice from scaffolded artifact-path tracking to a real cpptools custom configuration provider implementation. The codebase already resolves the active compile-commands path, shows the `Compile Commands` row, serializes refreshes, and contributes `Trezor: Refresh IntelliSense`; the remaining work is to eagerly parse the active `.cc.json` file, translate entries into cpptools per-file and browse configurations, clear stale provider state when the exact artifact is missing, require the tf-tools provider to be explicitly selected, offer a workspace-setting fix for wrong-provider cases, and add focused unit and integration coverage around entry parsing, translation, provider registration, and failure visibility.

## Informal Spec Alignment

**Selected Slice**: `3. IntelliSense Integration`
**Source Anchor**: `Compile-commands resolution, cpptools configuration provider integration, provider warnings, and IntelliSense refresh behavior.`
**Scope Guard**: This plan includes compile-commands artifact resolution, `Compile Commands` row state and tooltip behavior, cpptools custom configuration provider registration and refresh, compile-database parsing and translation, missing-provider and wrong-provider warnings, the workspace-setting fix for wrong-provider cases, and refresh triggers tied to activation, configuration, manifest, build, and provider changes. It explicitly excludes excluded-file explorer badges and overlays, Binary and Map File behavior, Flash and Upload actions, Debug launch, alternate C/C++ providers, and any multi-root behavior.
**Critical Informal Details**: IntelliSense must use only the exact active model, target, and component artifact derived from `artifact-folder`, `artifact-name`, and `artifact-suffix`; no fallback artifact or stale provider state is allowed; the provider must eagerly parse the active `.cc.json` file during refresh, normalize entry-relative paths against each entry `directory`, preserve ordered compile flags after the compiler executable token, infer C versus C++ mode per entry from `-std=` first and file/compiler cues second, use first-entry-wins for duplicate source files with a persistent log record, expose a `Compile Commands` row tooltip showing the expected path and missing explanation, keep `Trezor: Refresh IntelliSense` available from both the Configuration view title or overflow and the Command Palette, treat Microsoft C/C++ as the only supported provider, and when another configuration provider is active show a visible warning that also offers a workspace-setting fix to switch `C_Cpp.default.configurationProvider` to `cepetr.tf-tools`.

## Technical Context

**Language/Version**: TypeScript 5.x targeting VS Code 1.110+ desktop extension host
**Primary Dependencies**: VS Code Extension API, existing `yaml` parser-backed manifest model, Node.js `fs` and `path` APIs, cpptools custom configuration provider API exposed by `ms-vscode.cpptools`, Mocha test runner, `@vscode/test-electron` integration harness
**Storage**: Workspace state for active model, target, and component selection; resource-scoped VS Code settings for `tfTools.artifactsPath` and `C_Cpp.default.configurationProvider`; manifest file fields for `artifact-folder`, `artifact-name`, and `artifact-suffix`; output-channel logs for persistent warning and duplicate-entry reporting
**Testing**: Unit tests for artifact resolution, compile-database parsing, flag translation, language inference, duplicate handling, provider readiness evaluation, provider-setting fix flow, and service refresh serialization; integration tests for tree-row state, manual refresh surfaces, missing-artifact clearing, provider warnings, and active-context path changes
**Target Platform**: VS Code 1.110+ desktop extension host on single-root workspaces
**Project Type**: Single-package VS Code extension
**Performance Goals**: Refresh should complete within the existing success target of 5 seconds for representative firmware compile databases, tree updates must remain free of perceptible UI lag, and eager parsing must stay bounded to the single active `.cc.json` file rather than scanning the artifact root
**Constraints**: Single-root workspace only, manifest and settings remain authoritative, no silent fallback to another artifact or provider, warnings and duplicate conditions must be visible through notifications and logs, preserve current Build Workflow behavior, and keep provider-facing abstractions small and testable
**Scale/Scope**: One extension package, one active compile database per workspace, one cpptools provider registration, one Configuration tree surface, and targeted fixture coverage for representative C and C++ compile entries

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

- Replace the current cpptools stub in `src/intellisense/cpptools-provider.ts` with a real custom configuration provider boundary, enforced by new unit tests for provider registration, per-file lookups, browse configuration, and wrong-provider workspace-fix behavior.
- Keep refresh orchestration in `src/intellisense/intellisense-service.ts` but extend it to parse and index the active compile database before notifying cpptools, enforced by unit tests that confirm final-state correctness across serialized refreshes and missing-artifact clearing.
- Add a focused compile-database parsing and translation module under `src/intellisense/` for tokenization, path normalization, flag preservation, standard detection, and duplicate handling, enforced by new unit tests using mixed C and C++ `.cc.json` fixtures plus duplicate-entry cases.
- Preserve exact artifact resolution semantics in `src/intellisense/artifact-resolution.ts` and `src/workspace/settings.ts`, enforced by existing artifact-resolution tests plus integration coverage for model, component, target-suffix, and `tfTools.artifactsPath` changes.
- Keep the `Compile Commands` row behavior in `src/ui/configuration-tree.ts` aligned with the active expected path and missing explanation only, enforced by existing tree-item tests plus a tooltip regression for the refreshed missing-artifact wording.
- Surface wrong-provider warnings as both a visible notification and a persistent log entry, and add a one-step workspace-setting fix in `src/extension.ts` or the provider adapter path, enforced by unit tests around configuration writes and an integration test that verifies the fix updates `C_Cpp.default.configurationProvider` for the workspace.
- Preserve slice boundaries by leaving excluded-file visibility, Binary and Map File actions, Flash and Upload, and Debug code untouched, enforced by scope review in tasks and by not changing unrelated tree sections or command contributions.

## Project Structure

### Documentation (this feature)

```text
specs/003-intellisense-integration/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── vscode-intellisense-integration-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
package.json
src/
├── extension.ts
├── intellisense/
│   ├── artifact-resolution.ts
│   ├── cpptools-provider.ts
│   ├── intellisense-service.ts
│   └── intellisense-types.ts
├── ui/
│   └── configuration-tree.ts
├── observability/
│   ├── diagnostics.ts
│   └── log-channel.ts
├── workspace/
│   └── settings.ts
└── test/

src/test/
├── integration/
│   ├── build-context-selection.integration.test.ts
│   └── configuration-health.integration.test.ts
└── unit/
  ├── workflow/
  │   ├── intellisense-artifact-resolution.test.ts
  │   ├── intellisense-provider-readiness.test.ts
  │   └── intellisense-service.test.ts
  └── workflow-test-helpers.ts

test-fixtures/
├── manifests/
│   └── intellisense-valid/
└── workspaces/
  ├── intellisense-missing-artifact/
  └── intellisense-valid/
```

**Structure Decision**: Keep the existing `src/intellisense/` split and add the missing compile-database parsing and translation logic beside the service and adapter rather than inside `src/extension.ts` or `src/ui/configuration-tree.ts`. `src/extension.ts` remains the composition root that wires refresh triggers and command surfaces, `src/intellisense/intellisense-service.ts` remains the serialized coordinator, `src/intellisense/cpptools-provider.ts` becomes the cpptools boundary, and test coverage stays concentrated in `src/test/unit/workflow/` plus a small number of integration flows. This is the smallest structure that can satisfy the updated cpptools requirements without leaking provider concerns into unrelated UI or workflow modules.

## Post-Design Constitution Check

- [x] Host compatibility remains limited to a TypeScript VS Code extension for VS Code 1.110+.
- [x] Design remains within the IntelliSense Integration slice; excluded-file visibility, Binary and Map File behavior, Flash and Upload, Debug launch, alternate providers, and multi-root support stay out of scope.
- [x] Manifest and settings remain the only authority for artifact resolution and provider selection behavior.
- [x] The design defines both unit and integration tests before implementation, including cpptools translation and failure-path regressions that are currently missing.
- [x] Failure handling includes visible notifications for provider issues, output-channel logs for provider and duplicate-entry conditions, and tree-row state for missing artifacts without extra popups.
- [x] No complexity exception is required; one parser or translator module plus the existing service and adapter split is sufficient.

## Complexity Tracking

No constitutional violations or justified complexity exceptions were identified for this feature.
