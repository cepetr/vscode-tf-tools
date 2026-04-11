# Implementation Plan: Run And Debug Integration

**Branch**: `[007-run-debug-integration]` | **Date**: 2026-04-11 | **Spec**: `specs/007-run-debug-integration/spec.md`
**Input**: Feature specification from `specs/007-run-debug-integration/spec.md`

**Note**: This plan follows the `/speckit.plan` workflow and keeps repository file references workspace-relative.

**File Reference Rule**: Use workspace-relative paths for any repository file references written into this plan.

## Summary

Add native Run and Debug integration for tf-tools by generating dynamic debug configurations for the active build context while preserving the existing `Start Debugging` command surfaces. The design introduces a tf-tools-owned proxy debug configuration contract for Run and Debug, refactors the current single-profile launch flow into shared matching-set and launch-materialization helpers, keeps the first matching profile as the default, and preserves the existing no-`launch.json` / invocation-time template validation behavior.

## Product Documentation Alignment

**Affected Product Areas**: `Workflow Actions`, `Build Artifacts`, `Start Debugging`, `command surface`, `debug profile`, `debug profile resolution`, and `declaration order`

**Source Anchor**:

- `specs/product-spec.md`: `Start Debugging` must start a VS Code debug session for the active build context, remain exposed from the `Configuration view` and Command Palette, keep executable-artifact gating, and treat template and variable issues as invocation-time failures.
- `specs/glossary.md`: terminology must continue using `Start Debugging`, `debug profile`, `debug template`, `active build context`, `command surface`, and updated `debug profile resolution` / `declaration order` semantics.

**Scope Guard**: This plan adds dynamic Run and Debug entries and default-profile F5 support for the active build context. It does not add multi-root support, change artifact naming rules, introduce launch.json persistence as a required workflow, or redesign the existing tree-view actions.

**Terminology Guard**: Use `Start Debugging`, `debug profile`, `active build context`, `Configuration view`, `executable artifact`, `debug template`, `debug variable`, `command surface`, `debug profile resolution`, and `declaration order` exactly as defined or updated in `specs/glossary.md`.

**Critical Product Details**:

- The manifest remains the source of truth for component-owned debug profiles.
- The default profile is the first matching profile in declaration order for the selected component.
- Direct `Start Debugging` actions still launch immediately and use the default profile without a profile picker.
- Run and Debug must expose one default entry plus one profile-specific entry per matching profile.
- The executable artifact must still exist before tf-tools debugging is considered launchable.
- Template files remain launch-time inputs; missing or invalid templates must not hide otherwise discoverable debug choices.
- The feature must preserve the current no-`launch.json` workflow and continue surfacing launch failures through user-visible errors plus log output.

## Technical Context

**Language/Version**: TypeScript 5.x targeting VS Code 1.110+
**Primary Dependencies**: VS Code Extension API, existing `yaml` parser-backed manifest model, existing `jsonc-parser` template loader, Node.js `fs`/`path` APIs, existing output-channel logging helpers
**Storage**: Existing workspace state for active build context, resource-scoped settings for manifest/artifacts/templates paths, manifest file debug entries, and extension-memory provider registration state; no new persisted user data required
**Testing**: Automated unit tests plus VS Code integration tests, with regression coverage for command surfaces, provider behavior, artifact readiness, and launch-time failures
**Target Platform**: VS Code 1.110+ desktop extension host
**Project Type**: Single-package VS Code extension
**Performance Goals**: No perceptible delay when opening Run and Debug or pressing F5; readiness refresh remains bounded to manifest/context evaluation and executable existence checks without eager template parsing
**Constraints**: Single-root workspace, manifest-driven behavior, explicit failure visibility, no required `.vscode/launch.json`, template and variable failures remain invocation-time only, support stays within stable VS Code debug APIs
**Scale/Scope**: One extension package serving tf-tools build, artifact, IntelliSense, and debugging workflows for `trezor-firmware`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Post-Phase-1 re-check: passed.

- [x] Host compatibility: scoped to a TypeScript VS Code extension targeting VS Code 1.110+.
- [x] Product-spec alignment: affected product areas are stated, the design stays within them, and consolidated product docs are scheduled for update in the same change.
- [x] Product-detail capture: critical user-visible and implementation-sensitive behaviors from the consolidated product docs are explicitly carried into this plan.
- [x] Manifest authority: build/debug/configuration choices derive from settings and manifest data, not hardcoded matrices.
- [x] Test discipline: tests are defined before implementation and cover each changed behavior plus regressions.
- [x] Failure visibility: notifications and log-channel behavior are specified for new failure and blocked-launch paths.
- [x] Simplicity: the design reuses the existing debug-launch pipeline and adds one focused provider layer instead of introducing launch.json synchronization or a new persistence model.

## Critical Detail Reconciliation

- Preserve direct-action behavior: `Start Debugging` still launches immediately from `package.json`, `src/extension.ts`, and tree-row actions, but must now delegate to shared default-profile helpers. Enforce with integration tests covering command registration and direct-action launch behavior.
- Preserve invocation-time template failure handling: `src/commands/debug-launch.ts` and new provider resolution logic must defer template loading, template parsing, and tf-tools variable resolution until launch. Enforce with integration tests for missing-template, invalid-template, and variable-failure scenarios through both direct command and Run and Debug entries.
- Expand resolution semantics without changing manifest ownership: `src/manifest/manifest-types.ts`, `src/commands/debug-launch.ts`, `src/intellisense/artifact-resolution.ts`, and glossary/product-doc updates must move from single-profile selection to matching-set plus default-profile derivation. Enforce with unit tests for matching order and integration tests for multiple matching entries.
- Keep executable readiness as the shared gate: `src/intellisense/artifact-resolution.ts`, `src/extension.ts`, and provider entry generation must use the same artifact existence rules so tree-view enablement and Run and Debug availability stay aligned. Enforce with integration tests that compare tree-row enablement against generated configuration availability.
- Preserve no-launch.json workflow: `package.json`, provider implementation, and tests under `src/test/integration/configuration-scope.integration.test.ts` must confirm the feature does not require or write `.vscode/launch.json`.
- Update consolidated docs in the same change: `specs/product-spec.md` and `specs/glossary.md` must reflect Run and Debug surfaces, matching-set semantics, and default-profile terminology before implementation is considered complete.

## Project Structure

### Documentation (this feature)

```text
specs/007-run-debug-integration/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── run-debug-configurations.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── debug/
├── extension.ts
├── commands/
│   └── debug-launch.ts
├── intellisense/
│   └── artifact-resolution.ts
├── manifest/
│   ├── manifest-types.ts
│   └── validate-manifest.ts
├── observability/
├── ui/
└── test/
    ├── integration/
    └── unit/

test-fixtures/
├── manifests/
└── workspaces/
```

**Structure Decision**: Keep the existing debug-launch core in `src/commands/debug-launch.ts`, add a focused Run and Debug provider module under a new `src/debug/` slice or equivalent narrow location, reuse `src/intellisense/artifact-resolution.ts` for readiness alignment, update manifest typing only where matching-set semantics require it, and extend the existing unit/integration test suites plus fixtures rather than introducing a separate test harness.

## Complexity Tracking

No constitutional violations are required for this design.
