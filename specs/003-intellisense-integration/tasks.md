# Tasks: IntelliSense Integration

**Input**: Design documents from `specs/003-intellisense-integration/`
**Prerequisites**: `plan.md` (required), `spec.md` (required for user stories), `research.md`, `data-model.md`, `contracts/`, `quickstart.md`
**Informal Spec Slice**: `3. IntelliSense Integration`
**Scope Guard**: Tasks in this file stay within the IntelliSense Integration slice. They cover compile-commands artifact resolution, eager compile-database parsing, cpptools custom configuration provider integration, compile-commands status visibility in the `Build Artifacts` section, provider warnings, the wrong-provider workspace-setting fix, and manual IntelliSense refresh. They do not implement excluded-file visibility, Binary or Map File behavior, Flash/Upload actions, Debug launch, alternate C/C++ providers, or multi-root behavior.

**Tests**: Automated unit and integration tests are required for every user story. Integration coverage is included wherever work touches VS Code APIs, output-channel logging, persisted state, command contributions, settings changes, or tree-view behavior.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently.

**Slice Rule**: Include only work that belongs to the IntelliSense Integration slice.

**Critical Detail Rule**: This file includes explicit tasks for the easy-to-miss behaviors from `spec.md` and `plan.md`: no fallback artifacts, eager `.cc.json` parsing, entry-relative path normalization, per-entry C versus C++ inference, first-entry-wins duplicate handling, strict tf-tools provider selection, the workspace-setting fix for wrong-provider warnings, latest-refresh-wins serialization, explicit provider-availability and manifest-path triggers, and the `Refresh IntelliSense` command in both required surfaces.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare fixtures and shared test helpers for the updated cpptools integration work.

- [X] T001 Add representative compile-database fixtures with mixed C/C++, relative paths, and duplicate entries under `test-fixtures/workspaces/intellisense-valid/`
- [X] T002 Add missing-artifact and wrong-provider workspace scenarios under `test-fixtures/workspaces/intellisense-missing-artifact/` and `test-fixtures/workspaces/intellisense-valid/`
- [X] T003 [P] Extend IntelliSense-specific VS Code mocks and helper factories in `src/test/unit/vscode-mock.ts` and `src/test/unit/workflow-test-helpers.ts`
- [X] T004 [P] Add cpptools provider test seams and fixture loaders in `src/test/unit/workflow-test-helpers.ts` and `src/test/integration/index.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish shared parser and provider scaffolding required before story implementation.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T005 Define parsed compile-entry, browse snapshot, provider payload, and warning-fix types in `src/intellisense/intellisense-types.ts`
- [X] T006 [P] Create compile-database parsing and normalization helpers in `src/intellisense/compile-commands-parser.ts`
- [X] T007 [P] Refactor the cpptools boundary to support provider registration and test injection in `src/intellisense/cpptools-provider.ts`
- [X] T008 [P] Add shared logging helpers for missing-artifact and provider-warning events in `src/observability/log-channel.ts`

**Checkpoint**: Parser and provider foundations are ready; user stories can now proceed.

---

## Phase 3: User Story 1 - See Correct IntelliSense For The Active Context (Priority: P1) 🎯 MVP

**Goal**: Keep IntelliSense aligned with the exact active model, target, and component by parsing the active compile database eagerly, translating per-file cpptools configurations, and clearing stale state when the expected artifact is missing.

**Independent Test**: Activate the extension with a valid compile-commands artifact, switch active model, component, target, and `tfTools.artifactsPath`, and verify IntelliSense follows the exact active context without fallback; then remove the expected artifact and verify stale provider state is cleared instead of reused.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests first and ensure they fail before implementation.**

- [X] T009 [P] [US1] Add parser unit tests for relative-path normalization, flag preservation, language inference, and duplicate handling in `src/test/unit/workflow/compile-commands-parser.test.ts`
- [X] T010 [P] [US1] Add provider adapter unit tests for per-file and browse configuration publication in `src/test/unit/workflow/cpptools-provider.test.ts`
- [X] T011 [P] [US1] Extend refresh-service unit tests for eager parsing, latest-refresh-wins serialization, no-fallback behavior, and stale-state clearing in `src/test/unit/workflow/intellisense-service.test.ts`
- [X] T012 [P] [US1] Add integration coverage for active-context refresh, target-suffix changes, and stale-state clearing in `src/test/integration/build-context-selection.integration.test.ts`

### Implementation for User Story 1

- [X] T013 [P] [US1] Implement compile-database tokenization, entry indexing, and cpptools field derivation in `src/intellisense/compile-commands-parser.ts`
- [X] T014 [P] [US1] Implement cpptools custom configuration provider registration, per-file lookup, and browse snapshot support in `src/intellisense/cpptools-provider.ts`
- [X] T015 [US1] Update refresh orchestration to eagerly parse the active `.cc.json`, apply provider state, ignore later duplicate entries, clear stale state, and write missing-artifact log entries in `src/intellisense/intellisense-service.ts`
- [X] T016 [US1] Wire activation, active-context changes, successful-build refresh, provider-availability changes, manifest-path changes, manifest-content changes, and `tfTools.artifactsPath` refresh through `src/extension.ts` and `src/workspace/settings.ts`
- [X] T017 [US1] Preserve exact artifact-resolution semantics for `artifact-folder`, `artifact-name`, and `artifact-suffix` in `src/intellisense/artifact-resolution.ts` and `src/intellisense/intellisense-types.ts`

**Checkpoint**: User Story 1 is fully functional and independently testable.

---

## Phase 4: User Story 2 - Inspect Compile Commands Availability (Priority: P2)

**Goal**: Show whether the active compile-commands artifact is present and where it is expected in the `Build Artifacts` section for the current active configuration.

**Independent Test**: Open the Configuration view with different active contexts and artifact states, then verify the `Compile Commands` row shows `valid` or `missing` and the tooltip reports the exact expected path plus missing-artifact explanation when applicable.

### Tests for User Story 2 ⚠️

- [X] T018 [P] [US2] Extend tree-view unit tests for compile-commands status and tooltip wording in `src/test/unit/ui/configuration-tree.test.ts`
- [X] T019 [P] [US2] Extend integration coverage for compile-commands row recomputation across model, component, target, manifest-content, manifest-path, and `tfTools.artifactsPath` changes in `src/test/integration/configuration-health.integration.test.ts`

### Implementation for User Story 2

- [X] T020 [P] [US2] Publish resolved compile-commands artifact state from the IntelliSense service into the UI update path in `src/intellisense/intellisense-service.ts` and `src/extension.ts`
- [X] T021 [US2] Update the `Compile Commands` tree item to show the expected path and missing explanation exactly as specified in `src/ui/configuration-tree.ts`
- [X] T022 [US2] Recompute and refresh `Build Artifacts` compile-commands state on active-context and settings changes in `src/extension.ts` and `src/ui/configuration-tree.ts`

**Checkpoint**: User Stories 1 and 2 work independently, and compile-commands availability is visible and testable from the tree view.

---

## Phase 5: User Story 3 - Receive Explicit Provider Warnings (Priority: P3)

**Goal**: Warn clearly when cpptools is missing or misconfigured, offer a workspace-setting fix for wrong-provider cases, and expose `Refresh IntelliSense` from both required VS Code surfaces.

**Independent Test**: Start the extension with cpptools missing and with cpptools installed but not configured to use Trezor Firmware Tools, then verify each case shows a visible warning, writes a persistent log entry, offers the wrong-provider workspace-setting fix where applicable, and keeps `Refresh IntelliSense` available from both the Configuration view title or overflow and the Command Palette.

### Tests for User Story 3 ⚠️

- [X] T023 [P] [US3] Extend provider-readiness unit tests for strict provider selection and workspace-setting fix behavior in `src/test/unit/workflow/intellisense-provider-readiness.test.ts`
- [X] T024 [P] [US3] Add integration tests for missing-provider, wrong-provider, provider-availability changes, and warning recovery flows in `src/test/integration/configuration-health.integration.test.ts`
- [X] T025 [P] [US3] Add integration tests for `Refresh IntelliSense` command contributions and execution in `src/test/integration/intellisense-workflow.integration.test.ts`

### Implementation for User Story 3

- [X] T026 [P] [US3] Enforce strict tf-tools provider readiness and implement the workspace-setting fix path in `src/intellisense/cpptools-provider.ts` and `src/extension.ts`
- [X] T027 [P] [US3] Extend visible warning and persistent logging behavior for provider failures and recovery in `src/intellisense/intellisense-service.ts` and `src/observability/log-channel.ts`
- [X] T028 [US3] Contribute and wire `Refresh IntelliSense` in both required surfaces through `package.json` and `src/extension.ts`

**Checkpoint**: All user stories are independently functional and the IntelliSense slice is complete without crossing into later slices.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, regression coverage, and scope review across the completed slice.

- [X] T029 [P] Expand regression coverage for mixed-language compile databases and target suffix changes in `src/test/unit/workflow/compile-commands-parser.test.ts` and `src/test/integration/configuration-health.integration.test.ts`
- [X] T030 [P] Review command and menu contributions for cross-slice drift in `package.json` and `src/extension.ts`
- [X] T031 Validate end-to-end IntelliSense scenarios from `specs/003-intellisense-integration/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion; blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational completion.
- **User Story 2 (Phase 4)**: Depends on Foundational completion and reuses the artifact state published by User Story 1.
- **User Story 3 (Phase 5)**: Depends on Foundational completion and extends the provider integration established by User Story 1.
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational and delivers the MVP.
- **User Story 2 (P2)**: Depends on User Story 1 because the tree view consumes the active artifact state produced by the IntelliSense refresh flow.
- **User Story 3 (P3)**: Depends on User Story 1 because provider warnings and the workspace-setting fix extend the registered provider integration.

### Within Each User Story

- Tests must be written and fail before implementation begins.
- Parser and provider primitives come before service orchestration.
- Service orchestration comes before tree publication and command surfaces.
- Failure visibility and recovery behavior must be complete before the story is marked done.

### Parallel Opportunities

- `T003` and `T004` can run in parallel after `T001` and `T002`.
- `T006`, `T007`, and `T008` can run in parallel after `T005`.
- `T009`, `T010`, `T011`, and `T012` can run in parallel for User Story 1.
- `T013` and `T014` can run in parallel for User Story 1 before `T015`.
- `T018` and `T019` can run in parallel for User Story 2.
- `T023`, `T024`, and `T025` can run in parallel for User Story 3.
- `T026` and `T027` can run in parallel for User Story 3 before `T028`.

---

## Parallel Example: User Story 1

```bash
# Launch the User Story 1 tests together:
Task: "T009 Add parser unit tests for relative-path normalization, flag preservation, language inference, and duplicate handling in src/test/unit/workflow/compile-commands-parser.test.ts"
Task: "T010 Add provider adapter unit tests for per-file and browse configuration publication in src/test/unit/workflow/cpptools-provider.test.ts"
Task: "T011 Extend refresh-service unit tests for eager parsing, latest-refresh-wins serialization, no-fallback behavior, and stale-state clearing in src/test/unit/workflow/intellisense-service.test.ts"
Task: "T012 Add integration coverage for active-context refresh, target-suffix changes, and stale-state clearing in src/test/integration/build-context-selection.integration.test.ts"

# Launch the core implementation together:
Task: "T013 Implement compile-database tokenization, entry indexing, and cpptools field derivation in src/intellisense/compile-commands-parser.ts"
Task: "T014 Implement cpptools custom configuration provider registration, per-file lookup, and browse snapshot support in src/intellisense/cpptools-provider.ts"
```

---

## Parallel Example: User Story 3

```bash
# Launch the User Story 3 tests together:
Task: "T023 Extend provider-readiness unit tests for strict provider selection and workspace-setting fix behavior in src/test/unit/workflow/intellisense-provider-readiness.test.ts"
Task: "T024 Add integration tests for missing-provider, wrong-provider, provider-availability changes, and warning recovery flows in src/test/integration/configuration-health.integration.test.ts"
Task: "T025 Add integration tests for Refresh IntelliSense command contributions and execution in src/test/integration/intellisense-workflow.integration.test.ts"

# Launch the provider-warning work together:
Task: "T026 Enforce strict tf-tools provider readiness and implement the workspace-setting fix path in src/intellisense/cpptools-provider.ts and src/extension.ts"
Task: "T027 Extend visible warning and persistent logging behavior for provider failures and recovery in src/intellisense/intellisense-service.ts and src/observability/log-channel.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Validate User Story 1 independently before continuing.

### Incremental Delivery

1. Complete Setup and Foundational work to establish parser and provider scaffolding.
2. Deliver User Story 1 for exact active-context IntelliSense behavior.
3. Deliver User Story 2 for visible compile-commands availability and expected-path diagnostics.
4. Deliver User Story 3 for explicit provider warnings, the workspace-setting fix, and manual refresh surfaces.
5. Finish with regression coverage and quickstart validation.

### Parallel Team Strategy

1. One developer prepares fixtures and mocks while another sets up parser and provider seams.
2. After the foundation is complete, one developer can focus on compile-database parsing while another implements provider registration and the accompanying tests.
3. Tree-view publication and provider-warning surfaces can proceed in parallel once the refresh service exposes the right state.

---

## Notes

- `[P]` tasks touch different files and are safe to run in parallel.
- `[US1]`, `[US2]`, and `[US3]` map tasks back to individual user stories for traceability.
- The MVP scope is User Story 1.
- This task list intentionally rejects scope drift into excluded-file visibility, Binary or Map File behavior, Flash/Upload actions, Debug launch, alternate providers, and multi-root behavior.
- Complete and commit one task at a time; do not batch multiple tasks into a single commit.