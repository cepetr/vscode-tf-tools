# Implementation Plan: IntelliSense Integration

**Branch**: `003-intellisense-integration` | **Date**: 2026-04-03 | **Spec**: `specs/003-intellisense-integration/spec.md`
**Input**: Feature specification from `specs/003-intellisense-integration/spec.md`

## Summary

Deliver the third user-visible slice for Trezor Firmware Tools: resolve the active compile-commands artifact from `tfTools.artifactsPath` plus manifest-driven `artifact-folder`, `artifact-name`, and optional `artifact-suffix`, surface that artifact's presence and expected path in the `Build Artifacts` section, integrate with Microsoft C/C++ through a tf-tools custom configuration provider, warn explicitly when provider prerequisites are missing or misconfigured, and refresh IntelliSense deterministically on activation, context changes, successful builds, explicit refresh, and relevant workspace/provider changes. The implementation will extend manifest typing and validation for IntelliSense-specific artifact fields, add a focused IntelliSense service plus cpptools adapter, update the configuration tree and package contributions with a `Refresh IntelliSense` action, and add unit plus integration coverage for artifact resolution, stale-state clearing, provider warnings, refresh triggers, and UI status behavior.

## Informal Spec Alignment

**Selected Slice**: `3. IntelliSense Integration`
**Source Anchor**: `Compile-commands resolution, cpptools configuration provider integration, provider warnings, and IntelliSense refresh behavior.`
**Scope Guard**: This plan includes compile-commands artifact resolution for the active configuration, `Build Artifacts` compile-commands row state and tooltip behavior, cpptools custom-configuration-provider registration and refresh, explicit provider warnings and logging, and the manual `Refresh IntelliSense` surface in both the Configuration view title/overflow and the Command Palette. It explicitly excludes excluded-file explorer badges and overlays, Binary and Map File artifact behavior, Flash/Upload actions, Debug launch, alternate C/C++ providers, and any multi-root workspace behavior.
**Critical Informal Details**: IntelliSense must always follow the active model, target, and component with no artifact fallback; compile-commands resolution must use `<tfTools.artifactsPath>/<artifact-folder>/<artifact-name><artifact-suffix>.cc.json`, where `artifact-folder` comes from the selected model, `artifact-name` comes from the selected component, and `artifact-suffix` comes from the selected target and defaults to an empty string; missing compile-commands artifacts must show `missing` plus expected-path tooltip but no popup; missing or misconfigured provider prerequisites must produce both visible warnings and persistent log entries; when the expected compile database is missing, previously applied IntelliSense configuration must be cleared rather than left stale; and refresh triggers are limited to activation, active-context changes, successful builds, explicit refresh, relevant settings changes, manifest changes, and provider availability changes.

## Technical Context

**Language/Version**: TypeScript 5.x targeting VS Code 1.110+ desktop extension host
**Primary Dependencies**: VS Code Extension API, existing `yaml` parser for range-aware manifest parsing, Node.js `fs`/`path` APIs, existing diagnostics and output-channel helpers, Mocha test runner, `@vscode/test-electron` for integration tests
**Storage**: Manifest file for artifact metadata and provider-facing context, workspace state for active model/target/component selection, VS Code resource-scoped settings for manifest and artifacts paths plus provider selection state, and output channel logging for runtime failure reporting
**Testing**: Unit tests for manifest IntelliSense-field validation, artifact-path resolution, provider-readiness evaluation, stale-state clearing, and tree artifact-row rendering; integration tests for view-title and Command Palette command availability, compile-commands row updates, refresh triggers, provider warning flows, and no-fallback behavior across active-context changes
**Target Platform**: VS Code 1.110+ desktop extension host
**Project Type**: Single-package VS Code extension
**Performance Goals**: IntelliSense refresh and compile-commands row recomputation should complete without perceptible UI lag for one local workspace and should settle within the spec target of 5 seconds for activation, configuration change, successful build, and manual refresh paths
**Constraints**: Single-root workspace only, manifest/settings are authoritative, no silent fallback to alternate artifacts or stale IntelliSense state, cpptools is the only supported provider, failures must be visible through notifications and output-channel logging, and the implementation should stay small enough to fit within the existing activation composition pattern
**Scale/Scope**: One workspace, one active build context, one compile-commands artifact for IntelliSense, one `Build Artifacts` row added to the existing tree view, and one provider integration path through Microsoft C/C++

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

- Enforce manifest-driven artifact resolution in `src/manifest/manifest-types.ts`, `src/manifest/validate-manifest.ts`, and a new IntelliSense resolution module so `artifact-folder`, `artifact-name`, and `artifact-suffix` replace any implicit model-id/component-id artifact naming; validate with unit tests and fixture manifests that cover missing fields and suffix changes.
- Keep `Build Artifacts` limited to the `Compile Commands` row in `src/ui/configuration-tree.ts`, with `valid`/`missing` status plus expected-path tooltip, and verify with unit tests for row rendering and an integration test that switches active model, component, target, and `tfTools.artifactsPath`.
- Register `Refresh IntelliSense` in both the Configuration view title/overflow and the Command Palette through `package.json` plus `src/extension.ts`, enforced by integration tests that verify both contribution surfaces remain available.
- Prevent stale IntelliSense state by clearing any previously applied compile-commands configuration when the expected artifact is missing in a new `src/intellisense/` service layer, enforced by unit tests for refresh behavior and integration tests that remove or relocate the active artifact after it was previously valid.
- Surface provider-prerequisite failures through `src/observability/log-channel.ts` and user notifications from the IntelliSense service, enforced by integration tests that simulate missing cpptools and wrong active provider configuration.
- Keep later-slice boundaries intact by leaving Binary and Map File behavior, excluded-file visibility, Flash/Upload, and Debug absent from the implementation plan and from the contract and test matrix.

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
├── commands/
│   └── build-workflow.ts
├── configuration/
│   ├── active-config.ts
│   ├── build-options.ts
│   └── normalize-config.ts
├── intellisense/
│   ├── artifact-resolution.ts
│   ├── cpptools-provider.ts
│   ├── intellisense-service.ts
│   └── intellisense-types.ts
├── manifest/
│   ├── manifest-service.ts
│   ├── manifest-types.ts
│   └── validate-manifest.ts
├── observability/
│   ├── diagnostics.ts
│   └── log-channel.ts
├── tasks/
│   └── build-task-provider.ts
├── ui/
│   ├── configuration-tree.ts
│   └── status-bar.ts
├── workspace/
│   ├── settings.ts
│   └── workspace-guard.ts
└── test/
    ├── integration/
    └── unit/

test-fixtures/
├── manifests/
└── workspaces/
```

**Structure Decision**: Keep the current single-package extension layout and add one focused IntelliSense area rather than a broader architecture rewrite. Manifest field extensions remain under `src/manifest/`, settings changes remain under `src/workspace/`, the existing tree provider remains the only UI composition surface, and new IntelliSense behavior should be implemented as a small service/adapter pair under `src/intellisense/` wired from `src/extension.ts`. Tests stay split between focused unit coverage and VS Code integration coverage under the existing `src/test/` layout.

## Post-Design Constitution Check

- [x] Host compatibility remains limited to a TypeScript VS Code extension for VS Code 1.110+.
- [x] Design remains within the IntelliSense Integration slice; excluded-file visibility, Binary and Map File behavior, Flash/Upload, Debug launch, alternate providers, and multi-root behavior remain deferred.
- [x] Manifest data and settings remain the only authority for artifact resolution and provider refresh inputs.
- [x] The design defines both unit and integration tests before implementation.
- [x] Failure handling includes notifications for provider readiness issues, output-channel logging for runtime failures, and explicit non-popup artifact-missing UI state in the tree.
- [x] No complexity exception is required; one focused IntelliSense service plus one provider adapter is sufficient.

## Complexity Tracking

No constitutional violations or justified complexity exceptions were identified for this feature.
