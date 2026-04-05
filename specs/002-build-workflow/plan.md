# Implementation Plan: Build Workflow

**Branch**: `002-build-workflow` | **Date**: 2026-04-03 | **Spec**: `specs/002-build-workflow/spec.md`
**Input**: Feature specification from `specs/002-build-workflow/spec.md`

## Summary

Deliver the second user-visible slice for Trezor Firmware Tools: make Build Options real and manifest-driven, parse and validate option `when` conditions, derive effective build arguments from the active model/target/component plus applicable options, and expose `Build`, `Run Clippy`, `Run Check`, and `Run Clean` through the Configuration view title area and the VS Code task system. The implementation will extend the existing manifest model and tree provider with build-option definitions and availability evaluation, add a workflow command/task layer that blocks on invalid manifest or unsupported workspace conditions, preserve disabled-but-visible title-area actions for blocked states, and add unit plus integration coverage for manifest validation, option rendering, task labels, command titles, overflow ordering, command argument derivation, and failure visibility.

## Informal Spec Alignment

**Selected Slice**: `2. Build Workflow`
**Source Anchor**: `Build Options behavior, when parsing/validation/evaluation, build, clippy, check, and clean actions; dynamic task labels; command argument derivation; build-artifact status refresh.`
**Scope Guard**: This plan includes Build Options UI behavior, manifest `when` parsing/validation/evaluation, effective build-option persistence and normalization, `Build`/`Clippy`/`Check`/`Clean` commands and tasks, dynamic task labels, command argument derivation, and Configuration view title actions with `Build` as the only primary header action while `Clippy`, `Check`, and `Clean` are placed in the overflow menu. It explicitly excludes Build Artifacts behavior and status refresh, Flash/Upload actions, Debug launch, IntelliSense integration, compile-commands refresh, and excluded-file visibility.
**Critical Informal Details**: Build Options must stop being placeholders and preserve manifest order with grouped and ungrouped entries; options with `when == false` disappear from UI and effective arguments but keep their persisted value for later reuse; any invalid build-option `when` makes the manifest invalid for Build Workflow and blocks `Build`, `Clippy`, and `Check`; `Build`, `Clippy`, and `Check` share the same effective configuration while `Clean` ignores build-option arguments; the user-facing workflow command titles are `Trezor: Build`, `Trezor: Run Clippy`, `Trezor: Run Check`, and `Trezor: Run Clean`; only `Build` stays in the primary header while the other three commands stay visible from overflow and remain disabled when blocked; `Refresh IntelliSense` follows those items as the last overflow entry; task labels use `{model-id}-{target-display}-{component-name}` with target short name fallback; failure signals must remain visible through notifications plus diagnostics/logging; and later-slice artifact, flash/upload, debug, and IntelliSense behavior must remain untouched.

## Technical Context

**Language/Version**: TypeScript 5.x targeting VS Code 1.110+ desktop extension host
**Primary Dependencies**: VS Code Extension API, existing `yaml` parser for range-aware manifest parsing, Node.js path/process APIs, Mocha test runner, `@vscode/test-electron` for integration tests
**Storage**: Manifest file for build-option definitions and availability rules, workspace state for active build context plus build-option selections, VS Code settings for workspace paths and visibility, output channel and diagnostics collection for failure reporting
**Testing**: Unit tests for `when` parsing/validation/evaluation, build-option key generation/persistence, effective-argument derivation, task label formatting, and blocked-action gating; integration tests for tree rendering, grouped option ordering, disabled header actions, command/task registration, task execution delegation, manifest-change refresh, diagnostics, and log output
**Target Platform**: VS Code 1.110+ desktop extension host
**Project Type**: Single-package VS Code extension
**Performance Goals**: Option-tree refresh and header enablement updates should complete without perceptible UI lag for local manifests with tens of models/targets/components/options; manifest reload and `when` re-evaluation should be bounded to one debounced refresh per file change burst
**Constraints**: Single-root workspace only, manifest/settings remain authoritative, no silent fallbacks for invalid `when` logic, explicit diagnostics and output-channel logging for manifest and workflow failures, keep abstractions small, preserve current Configuration Experience behavior, do not implement later-slice artifact or debugger behavior
**Scale/Scope**: One manifest file and one active build context per workspace, four workflow actions, one task-provider surface, and one configuration tree view extended with interactive Build Options

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

- Preserve Build Options ordering and grouping in `src/ui/configuration-tree.ts`, enforced by new unit tests for tree item ordering and an integration test that loads a mixed grouped/ungrouped fixture manifest.
- Keep unavailable options hidden but persisted by extending `src/configuration/active-config.ts` and `src/configuration/normalize-config.ts`, enforced by unit tests for normalization and integration tests that switch active context after selecting options.
- Treat any invalid build-option `when` as a manifest-invalid state for workflow execution by extending `src/manifest/validate-manifest.ts` and diagnostics/logging modules, enforced by unit validation tests and an integration test that confirms `Build`, `Clippy`, and `Check` stay blocked.
- Keep `Build` visible but disabled in the primary header and keep `Clippy`, `Check`, and `Clean` visible but disabled in the overflow menu through `package.json`, `src/extension.ts`, and new workflow command modules, enforced by integration tests that inspect contributed title-area actions and blocked execution behavior.
- Derive identical effective arguments for `Build`, `Clippy`, and `Check` while keeping `Clean` context-independent in a new workflow layer under `src/commands/` and `src/tasks/`, enforced by unit tests for argument/label formatting and integration tests that run each action. Task execution uses `cargo xtask <subcommand>` with argument format `<component-id> -m <model-id> [target-flag] [option-flags]`; `Clean` runs as `cargo xtask clean` with no further arguments.
- Preserve current scope boundaries by leaving Build Artifacts row behavior, flash/upload, debug, and IntelliSense code absent from new modules, enforced by contract checks plus task planning that omits those capabilities.

## Project Structure

### Documentation (this feature)

```text
specs/002-build-workflow/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── vscode-build-workflow-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
package.json
src/
├── extension.ts
├── configuration/
│   ├── active-config.ts
│   ├── build-options.ts
│   └── normalize-config.ts
├── manifest/
│   ├── manifest-service.ts
│   ├── manifest-types.ts
│   ├── validate-manifest.ts
│   └── when-expressions.ts
├── commands/
│   └── build-workflow.ts
├── tasks/
│   └── build-task-provider.ts
├── observability/
│   ├── diagnostics.ts
│   └── log-channel.ts
├── ui/
│   ├── configuration-tree.ts
│   └── status-bar.ts
└── workspace/
  ├── settings.ts
  └── workspace-guard.ts

src/test/
├── integration/
│   ├── build-workflow.integration.test.ts
│   ├── build-options-when.integration.test.ts
│   └── task-provider.integration.test.ts
└── unit/
  ├── configuration/
  │   └── build-options.test.ts
  ├── manifest/
  │   ├── validate-manifest.test.ts
  │   └── when-expressions.test.ts
  └── workflow/
    ├── build-arguments.test.ts
    └── task-labels.test.ts

test-fixtures/
├── manifests/
│   ├── invalid-when/
│   ├── options-grouped/
│   └── options-hidden-preserved/
└── workspaces/
  └── unsupported-workflow/
```

**Structure Decision**: Extend the existing root-level extension instead of introducing a second abstraction layer. Manifest parsing stays under `src/manifest/`, persistent build-option state lives beside active configuration under `src/configuration/`, workflow command orchestration gets one focused command module plus one task-provider module, and the existing tree provider remains the single UI composition surface for both Build Context and Build Options. This keeps the implementation small, matches the current code layout, and avoids dragging Build Artifacts or debugger concerns into the Build Workflow slice.

## Post-Design Constitution Check

- [x] Host compatibility remains limited to a TypeScript VS Code extension for VS Code 1.110+.
- [x] Design remains within the Build Workflow slice; Build Artifacts behavior, Flash/Upload, Debug, IntelliSense, compile-commands refresh, and excluded-file visibility stay deferred.
- [x] Manifest and settings remain the only authority for build options, workflow labels, and effective arguments.
- [x] The design defines both unit and integration tests before implementation.
- [x] Failure handling includes notifications, diagnostics for file-backed manifest issues, and output-channel logging for workflow failures.
- [x] No complexity exception is required; one new `when` module plus one task-provider module is sufficient without introducing a broader workflow framework.

## Complexity Tracking

No constitutional violations or justified complexity exceptions were identified for this feature.
