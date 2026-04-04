# Implementation Plan: Configuration Experience Root Sections Default Expansion

**Branch**: `001-configuration-experience` | **Date**: 2026-04-04 | **Spec**: `specs/001-configuration-experience/spec.md`
**Input**: Fix the Configuration tree so `Build Context`, `Build Options`, and `Build Artifacts` remain expanded by default, matching `informal_spec/user-spec.md` UI-02.

## Summary

Correct the Configuration tree root-section behavior so all three top-level sections render expanded on first display. The current implementation collapses `Build Options` and `Build Artifacts` by default, which hides required placeholder and status content and makes the `Compile Commands` status less discoverable than the existing specification intends. The fix stays inside the Configuration Experience slice: update the root section tree items, preserve plain-text section headers, and add regression coverage that verifies the initial expanded state without introducing any new Build Options, Build Artifacts, or IntelliSense behavior.

## Informal Spec Alignment

**Selected Slice**: `1. Configuration Experience`
**Source Anchor**: `Manifest load and validation, configuration tree, persisted active selection, status bar, diagnostics, and log output.`
**Scope Guard**: This bugfix only changes the initial expansion state of the three existing root sections in the Configuration tree and the associated tests and documentation. It does not add new tree actions, Build Options interactivity, Build Artifacts behavior, IntelliSense behavior, or any view-title actions.
**Critical Informal Details**:

- The root of the `Configuration` tree contains exactly three top-level sections: `Build Context`, `Build Options`, and `Build Artifacts`.
- Those three sections remain expanded by default when the view first renders.
- `Build Options` and `Build Artifacts` may still show placeholder or status content in this slice, but that content must be visible without requiring the user to expand those sections manually.
- The top-level sections remain plain-text group headers without dedicated icons.

## Technical Context

**Language/Version**: TypeScript 5.x targeting VS Code 1.110+ desktop extension host
**Primary Dependencies**: VS Code Extension API, existing tree-view implementation in `src/ui/configuration-tree.ts`, Mocha test runner, `@vscode/test-electron` integration harness already present in the repository
**Storage**: No storage changes; this fix affects only derived tree item state
**Testing**: Focused unit coverage for root section collapsible state and integration coverage for initial Configuration view rendering
**Target Platform**: VS Code 1.110+ desktop extension host on single-root workspaces
**Project Type**: Single-package VS Code extension
**Performance Goals**: No measurable performance impact; tree rendering should remain instantaneous
**Constraints**: Stay within the Configuration Experience slice, preserve existing root section labels and plain-text presentation, do not couple root section expansion to manifest status or persisted UI state
**Scale/Scope**: One tree provider file, associated tests, and supporting design documentation

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] Host compatibility: change remains inside the TypeScript VS Code extension targeting VS Code 1.110+.
- [x] Informal-spec alignment: fix is limited to the Configuration Experience slice and directly restores a required UI behavior from `user-spec.md`.
- [x] Manifest authority: no source-of-truth changes are introduced; only derived view state is corrected.
- [x] Test discipline: regression tests will be added for the default expanded state so this behavior cannot silently regress again.
- [x] Failure visibility: no new failure modes are introduced; existing warning and placeholder states simply become visible as intended.
- [x] Simplicity: the fix is a minimal tree-item state change plus regression coverage.

## Research Summary

- VS Code root tree section defaults are entirely controlled by the `TreeItemCollapsibleState` emitted by the provider, so the smallest correct fix is to emit `Expanded` for all three top-level section items.
- Because this slice intentionally renders placeholder and status content inside `Build Options` and `Build Artifacts`, collapsing those sections by default hides required information and weakens discoverability for later-slice status rows such as `Compile Commands`.
- No additional persistence, command wiring, or manifest-state branching is needed; the bug is isolated to root section presentation.

## Phase 1 Design

### Design Changes

- Update `SectionItem` in `src/ui/configuration-tree.ts` so `Build Context`, `Build Options`, and `Build Artifacts` all emit `vscode.TreeItemCollapsibleState.Expanded` by default.
- Preserve the existing section ids, labels, and plain-text header presentation so downstream code and tests continue to address the same root items.
- Keep child rendering logic unchanged: `Build Options` and `Build Artifacts` still return placeholder or status rows appropriate to the current slice and manifest state.

### Critical Detail Reconciliation

- **UI-02 / Root sections expanded by default**: enforce in `src/ui/configuration-tree.ts` by removing the special-case collapse behavior for non-`build-context` root items.
- **Configuration Experience scope guard**: verify no new commands, icons, or interactions are added while fixing the root section state.
- **Visibility of placeholder/status content**: cover with tests so `Build Options` and `Build Artifacts` child content is visible immediately after the view loads.

### Files Expected To Change

- `src/ui/configuration-tree.ts`
- `src/test/unit/ui/configuration-tree.test.ts`
- `src/test/integration/configuration-health.integration.test.ts` or the nearest existing integration suite that asserts initial tree rendering
- `specs/001-configuration-experience/quickstart.md`
- `specs/001-configuration-experience/contracts/vscode-contribution-contract.md`

## Phase 2 Implementation Outline

1. Add or update tests that assert all three root sections are emitted as expanded tree items by default.
2. Update `SectionItem` so all root sections use the expanded collapsible state on initial render.
3. Run the relevant unit and integration tests that exercise Configuration view rendering.
4. Confirm the quickstart and contract artifacts reflect that the root sections are expanded by default.

## Project Structure

### Documentation (this bugfix)

```text
specs/001-configuration-experience/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    └── vscode-contribution-contract.md
```

### Source Code (changed by this bugfix)

```text
src/
├── ui/
│   └── configuration-tree.ts
└── test/
    ├── integration/
    └── unit/
```

## Post-Design Constitution Check

- [x] Host compatibility remains limited to the VS Code extension codebase already in place.
- [x] Design remains inside the Configuration Experience slice and does not pull in later Build Workflow or IntelliSense behavior.
- [x] Manifest and settings remain authoritative; only derived tree presentation changes.
- [x] Regression coverage is explicitly planned before implementation.
- [x] No new observability paths are required because this fix restores visibility of existing UI states.
- [x] No complexity exception is required.

## Complexity Tracking

No constitutional violations or justified complexity exceptions were identified for this bugfix.# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Informal Spec Alignment

**Selected Slice**: [Name the feature slice carried from spec.md]
**Source Anchor**: [Quote or cite the relevant section from informal_spec/feature-split.md]
**Scope Guard**: [Describe which nearby capabilities remain out of scope for this plan]
**Critical Informal Details**: [Carry forward the concrete interaction and integration details from spec.md and informal_spec that are easy to omit during implementation]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: [TypeScript 5.x targeting VS Code 1.110+ or NEEDS CLARIFICATION]
**Primary Dependencies**: [VS Code Extension API, existing extension libraries, and feature-specific packages]
**Storage**: [workspace state, VS Code settings, repository files, or justified alternative]
**Testing**: [automated unit tests plus VS Code integration tests are REQUIRED]
**Target Platform**: [VS Code 1.110+ desktop extension host]
**Project Type**: [single-package VS Code extension]
**Performance Goals**: [no perceptible UI lag, bounded refresh cost, or NEEDS CLARIFICATION]
**Constraints**: [single-root workspace, manifest-driven behavior, explicit diagnostics/logging, no support below VS Code 1.110]
**Scale/Scope**: [one extension package serving trezor-firmware workflows]

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [ ] Host compatibility: scoped to a TypeScript VS Code extension targeting VS Code 1.110+.
- [ ] Informal-spec alignment: the selected slice is stated, the design stays within it, and cross-slice work is deferred or split.
- [ ] Informal-spec detail capture: critical user-visible and implementation-sensitive behaviors from the selected slice are explicitly carried into this plan.
- [ ] Manifest authority: build/debug/configuration choices derive from settings and manifest data, not hardcoded matrices.
- [ ] Test discipline: tests are defined before implementation and cover each changed behavior plus regressions.
- [ ] Failure visibility: diagnostics, notifications, and log-channel behavior are specified for new failure modes.
- [ ] Simplicity: abstractions are minimal and any identifier or design complexity exception is justified.

## Critical Detail Reconciliation

- [List the concrete informal-spec details most likely to be missed during implementation and the files, tests, or validation steps that will enforce them]

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── extension.ts
├── commands/
├── core/
├── state/
├── ui/
└── test/
    ├── unit/
    └── integration/

test-fixtures/
├── manifests/
└── workspaces/
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
