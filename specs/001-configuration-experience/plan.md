# Implementation Plan: Configuration Experience

**Branch**: `001-configuration-experience` | **Date**: 2026-04-03 | **Spec**: `/home/pcernin/repos/tf-tools/specs/001-configuration-experience/spec.md`
**Input**: Feature specification from `/specs/001-configuration-experience/spec.md`

**Note**: This plan covers only the first informal-spec slice. The repository does not yet contain extension scaffold files such as `package.json`, `tsconfig.json`, or `src/`, so this feature includes the minimum extension bootstrap needed to ship the Configuration Experience slice.

## Summary

Deliver the first usable VS Code extension slice for Trezor Firmware Tools: load and validate `tf-tools.yaml` for the configuration context, render the build-context configuration UI, persist and normalize model/target/component selection in workspace state, surface the active configuration in the status bar, and make failures inspectable through diagnostics, notifications, and a dedicated output channel. The implementation will initialize a minimal single-package TypeScript extension scaffold at the repository root, use a manifest service backed by range-aware YAML parsing plus handwritten validation for the configuration slice, and add unit plus integration tests before feature code lands.

## Informal Spec Alignment

**Selected Slice**: `1. Configuration Experience`
**Source Anchor**: `Manifest load and validation, configuration tree, persisted active selection, status bar, diagnostics, and log output.`
**Scope Guard**: This plan includes manifest discovery, diagnostics, output-channel logging, build-context configuration rendering, workspace-state persistence, manifest-change refresh, and status-bar presentation. It defers Build Options behavior, `when` parsing/validation/evaluation, artifact status evaluation, task execution, IntelliSense integration, excluded-file visibility, flash/upload actions, debug launch, and any `Build` or `Debug` view-title actions.

## Technical Context

**Language/Version**: TypeScript 5.x targeting VS Code 1.110+ desktop extension host
**Primary Dependencies**: VS Code Extension API, `yaml` for range-aware manifest parsing, Node.js filesystem APIs, Mocha test runner, `@vscode/test-electron` for integration tests
**Storage**: VS Code workspace settings for manifest path and status-bar visibility, workspace state for active configuration, repository manifest file for build-context source data
**Testing**: Mocha unit tests for parsing, configuration-context validation, normalization, and status-bar formatting; `@vscode/test-electron` integration tests for build-context rendering, file watching, status-bar updates, diagnostics, and workspace-state restoration
**Target Platform**: VS Code 1.110+ desktop extension host on single-root workspaces
**Project Type**: Single-package VS Code extension initialized at repository root
**Performance Goals**: Initial manifest load and selection-driven tree/status refresh should feel instantaneous for local manifests with tens of entries; filesystem-triggered refreshes should be debounced to avoid duplicate work and should complete without perceptible UI lag
**Constraints**: Single-root workspace only, manifest and settings remain authoritative, no silent fallbacks to hardcoded configuration, visible failures through diagnostics or logs, no support below VS Code 1.110, keep identifiers and abstractions minimal while the codebase is being bootstrapped
**Scale/Scope**: One extension package, one manifest file per opened firmware workspace, one persisted active build-context selection per workspace

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] Host compatibility: scoped to a TypeScript VS Code extension targeting VS Code 1.110+.
- [x] Informal-spec alignment: the selected slice is stated, the design stays within it, and cross-slice work is deferred or split.
- [x] Manifest authority: build/debug/configuration choices derive from settings and manifest data, not hardcoded matrices.
- [x] Test discipline: tests are defined before implementation and cover each changed behavior plus regressions.
- [x] Failure visibility: diagnostics, notifications, and log-channel behavior are specified for new failure modes.
- [x] Simplicity: abstractions are minimal and any identifier or design complexity exception is justified.

## Project Structure

### Documentation (this feature)

```text
specs/001-configuration-experience/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── vscode-contribution-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
package.json
tsconfig.json
.vscodeignore
src/
├── extension.ts
├── manifest/
│   ├── manifest-service.ts
│   ├── manifest-types.ts
│   └── validate-manifest.ts
├── configuration/
│   ├── active-config.ts
│   └── normalize-config.ts
├── ui/
│   ├── configuration-tree.ts
│   └── status-bar.ts
├── observability/
│   ├── diagnostics.ts
│   └── log-channel.ts
├── workspace/
│   ├── settings.ts
│   └── workspace-guard.ts
└── test/
    ├── unit/
    └── integration/

test-fixtures/
├── manifests/
└── workspaces/
```

**Structure Decision**: The repository currently contains only specification assets plus generated `out/` and dependency directories, so this feature will create the minimal root-level extension scaffold needed for implementation. The structure keeps manifest parsing, build-context state, UI surfaces, and observability in separate folders because those boundaries already exist in the technical spec and map directly to the feature scope. Later slices can add Build Options, artifacts, and execution logic without forcing a second bootstrap or a broad refactor.

## Post-Design Constitution Check

- [x] Host compatibility remains limited to a TypeScript VS Code extension for VS Code 1.110+.
- [x] Design remains within the Configuration Experience slice; Build Options, `when` handling, build, IntelliSense, excluded-file, flash/upload, and debug work stay deferred.
- [x] Manifest and settings remain the only authority for selectable build context and configuration visibility.
- [x] The design defines both unit and integration tests before implementation.
- [x] Failure handling includes notifications, diagnostics for file-backed issues, and output-channel logging for runtime failures.
- [x] No complexity exception is required; handwritten validation is preferred over a heavier schema stack to keep the initial scaffold small.

## Complexity Tracking

No constitutional violations or justified complexity exceptions were identified for this feature.