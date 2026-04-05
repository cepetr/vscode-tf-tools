# Implementation Plan: Flash/Upload Actions

**Branch**: `005-flash-upload-actions` | **Date**: 2026-04-05 | **Spec**: `specs/005-flash-upload-actions/spec.md`
**Input**: Feature specification from `specs/005-flash-upload-actions/spec.md`

**File Reference Rule**: Use workspace-relative paths for any repository file references written into this plan.

## Summary

Implement Flash/Upload Actions by extending the manifest model to carry parsed component action rules, generalizing artifact resolution so the active `Binary` and `Map File` rows can be resolved from the same manifest-driven path formula already used for compile commands, and adding a small artifact-actions layer that computes availability, updates context keys, launches on-demand VS Code tasks for Flash and Upload, and opens the resolved map file. The work stays inside the existing activation root and tree-provider architecture: `src/extension.ts` remains the composition root, `src/ui/configuration-tree.ts` grows the new artifact rows and context values, `package.json` gains the VS Code command and menu contributions, and tests cover manifest validation, dynamic Flash/Upload Command Palette titles, row rendering, disabled-state handling, map-file command exclusion from the Command Palette, task launch, map-file open, failure logging, and the explicit no-auto-refresh rule.

## Informal Spec Alignment

**Selected Slice**: `5. Flash/Upload Actions`
**Source Anchor**: `Binary artifact row behavior, flashWhen and uploadWhen handling, Map File action behavior, VS Code task execution, and failure reporting.`
**Scope Guard**: This plan includes component-level `flashWhen` and `uploadWhen` parsing and validation, manifest-driven Binary and Map File artifact state, Binary-row Flash and Upload actions, Command Palette exposure for applicable Flash and Upload commands, an internal Map File open action, task-backed Flash and Upload execution, and failure/logging behavior. It explicitly excludes compile-commands row ownership, cpptools integration, excluded-file visibility, Build/Clippy/Check/Clean behavior, Debug profile resolution and launch, multi-root support, and automatic refresh after successful Flash or Upload completion.
**Critical Informal Details**: Binary and Map File paths must be resolved from `<tfTools.artifactsPath>/<artifact-folder>/<artifact-name><artifact-suffix>` using model `artifact-folder`, component `artifact-name`, and optional target `artifact-suffix`; Flash and Upload are available only when the selected component rule evaluates to `true` for the active model, target, and component; omitted or false rules make the action unavailable; both actions may appear simultaneously; applicable actions remain visible on the `Binary` row but disabled when the binary artifact is missing; the `Map File` action remains visible but disabled when the map artifact is missing; Flash and Upload must also be available from the Command Palette, but only when each specific action is applicable for the active context, and those palette entries must use dynamic titles aligned to `{model-name} | {target-display} | {component-name}`; the internal Map File action must stay out of the Command Palette; Flash and Upload run as VS Code tasks rather than ad hoc process spawning; blocked starts and post-start failures must show explicit errors and write persistent log entries; successful Flash and Upload completion must not trigger an automatic extension refresh.

## Technical Context

**Language/Version**: TypeScript 5.x targeting VS Code 1.110+ desktop extension host
**Primary Dependencies**: VS Code Extension API, existing manifest parser and when-expression evaluator, existing task-execution helpers, existing artifact-resolution helper module, Node.js `fs` and `path` APIs, Mocha test runner, `@vscode/test-electron` integration harness
**Storage**: Existing manifest file and resource-scoped settings (`tfTools.artifactsPath`, `tfTools.manifestPath`, `tfTools.cargoWorkspacePath`), existing workspace-state active configuration, and extension-memory artifact/action state; no new persisted workspace state required
**Testing**: Unit tests for manifest validation, artifact path derivation, action applicability, command/task gating, and tree-item row state; integration tests for command contributions, Binary/Map File row rendering, Command Palette visibility, task launch/blocking, map-file opening, output-channel logging, and no-auto-refresh behavior
**Target Platform**: VS Code 1.110+ desktop extension host
**Project Type**: Single-package VS Code extension
**Performance Goals**: No perceptible tree-view or command-surface lag when active configuration or artifact presence changes; artifact-state recomputation remains bounded to the active configuration and three resolved artifact paths rather than scanning directories
**Constraints**: Single-root workspace only, manifest/settings remain authoritative, no silent fallback artifacts, explicit diagnostics and output-channel logging for failures, Flash/Upload command visibility must track the active context, and added abstractions must stay minimal
**Scale/Scope**: One extension package, one active build context, three artifact rows in the existing Configuration tree, two task-backed artifact actions, one internal map-file open action, and fixture coverage for applicable, inapplicable, missing-artifact, and failing-workflow states

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

- Extend `src/manifest/manifest-types.ts` and `src/manifest/validate-manifest.ts` so components carry parsed `flashWhen` and `uploadWhen` expressions and invalid expressions continue surfacing as manifest validation problems; enforce with unit coverage in `src/test/unit/manifest/validate-manifest.test.ts` for omitted rules, valid rules, invalid syntax, and unknown ids.
- Generalize artifact-path resolution in `src/intellisense/artifact-resolution.ts` or a small shared artifact-state helper so the Binary and Map File rows use the same model/component/target-driven path formula as compile commands without adding fallback scanning; enforce with unit tests alongside `src/test/unit/workflow/intellisense-artifact-resolution.test.ts` for `.bin` and `.map` suffixes and missing-reason handling.
- Grow `src/ui/configuration-tree.ts` to render `Binary` and `Map File` rows with distinct context values, `valid` or `missing` descriptions, expected-path tooltips, missing-reason text, and row actions; enforce with unit tests in `src/test/unit/ui/configuration-tree.test.ts` and integration tests for the Build Artifacts section so the Binary row shows both actions when both rules are true and keeps applicable actions visible-but-disabled when the binary is missing.
- Add a small artifact-actions module under `src/commands/` that evaluates action applicability from the active manifest/configuration state, launches on-demand VS Code `Task` objects for Flash and Upload, and opens the resolved map file; enforce with unit tests for applicability and integration tests for task launch, blocked starts, logged failures, and the absence of automatic post-success refresh.
- Update `package.json` and `src/extension.ts` together so `tfTools.flash` and `tfTools.upload` are contributed commands, appear in the Command Palette only when applicable, use dynamic active-context titles there, and remain scoped out of standard build-task entry points; enforce with integration tests covering `menus.commandPalette`, dynamic title rendering, tree-item action visibility, and updated scope-guard expectations in `src/test/integration/configuration-scope.integration.test.ts`.
- Keep the internal `tfTools.openMapFile` command row-only by explicitly excluding it from the Command Palette; enforce with integration tests that the command remains absent from that surface while still backing the Map File row action.
- Preserve failure visibility through `src/observability/log-channel.ts`, existing manifest diagnostics, and explicit error notifications in command handlers; enforce with integration tests that missing-manifest, invalid-manifest, unsupported-workspace, missing-binary, and post-start workflow failures all produce the required visible or persistent signals.
- Preserve slice boundaries by leaving compile-commands provider logic, excluded-file surfaces, Build/Clippy/Check/Clean behavior, and Debug launch untouched; enforce with scope-review assertions and by confining code changes to manifest parsing, artifact state, package contributions, extension wiring, command/task helpers, tree rendering, and focused tests.

## Project Structure

### Documentation (this feature)

```text
specs/005-flash-upload-actions/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── vscode-flash-upload-actions-contract.md
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
├── tasks/
├── ui/
└── test/
  ├── integration/
  └── unit/

test-fixtures/
├── manifests/
└── workspaces/
```

**Structure Decision**: Keep artifact-action behavior close to the existing task and activation layers instead of creating a new subsystem. Extend `src/manifest/` for parsed component action rules, reuse `src/intellisense/artifact-resolution.ts` for shared artifact path derivation, add one focused artifact-actions helper under `src/commands/` for applicability, task launch, and map-file open behavior, extend `src/ui/configuration-tree.ts` for Binary and Map File rows, and keep `src/extension.ts` as the composition root that computes context keys and wires command registration. Update `package.json` for command and menu surfaces, and concentrate coverage in `src/test/unit/` and `src/test/integration/` with dedicated fixtures for applicable, inapplicable, and missing-artifact contexts. This is the smallest structure that satisfies the slice without leaking into excluded-file or debug behavior.

## Post-Design Constitution Check

- [x] Host compatibility remains limited to a TypeScript VS Code extension for VS Code 1.110+.
- [x] Design remains within the Flash/Upload Actions slice; compile-commands status ownership, excluded-file visibility, Build/Clippy/Check/Clean behavior, and Debug stay out of scope.
- [x] Manifest data and resource-scoped settings remain authoritative; artifact paths and action rules come from manifest/configuration state rather than hardcoded model or component tables.
- [x] The design defines unit and integration tests before implementation, including manifest-validation, row-state, command-visibility, task-launch, failure-logging, and no-auto-refresh regressions.
- [x] Failure handling stays visible through explicit error notifications, existing manifest diagnostics for invalid action rules, and output-channel logging for runtime failures.
- [x] No complexity exception is required; one manifest extension, one shared artifact-state enhancement, and one focused artifact-actions helper are sufficient.

## Complexity Tracking

No constitutional violations or justified complexity exceptions were identified for this feature.
