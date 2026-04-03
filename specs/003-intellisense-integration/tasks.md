# Tasks: IntelliSense Integration

**Input**: Design documents from `/specs/003-intellisense-integration/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/
**Informal Spec Slice**: `3. IntelliSense Integration`
**Scope Guard**: Tasks in this file stay within the IntelliSense Integration slice only. They cover compile-commands artifact resolution, cpptools provider integration, compile-commands status visibility in the `Build Artifacts` section, provider warnings, manual IntelliSense refresh, stale-state clearing, and refresh triggers. They do not implement excluded-file visibility, Binary or Map File behavior, Flash/Upload, Debug launch, alternate C/C++ providers, or multi-root behavior.

**Tests**: Automated unit and integration tests are required for every user story. Integration coverage is included for VS Code command contributions, manifest parsing, settings-driven refresh, output-channel logging, and tree-view behavior.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare fixtures and test helpers needed by the IntelliSense slice.

- [ ] T001 Create IntelliSense manifest fixtures in `test-fixtures/manifests/intellisense-valid/tf-tools.yaml`, `test-fixtures/manifests/intellisense-missing-artifact/tf-tools.yaml`, and `test-fixtures/manifests/intellisense-suffixed-target/tf-tools.yaml`
- [ ] T002 Create artifact-path workspace fixtures in `test-fixtures/workspaces/intellisense-valid/.gitkeep` and `test-fixtures/workspaces/intellisense-missing-artifact/.gitkeep`
- [ ] T003 [P] Extend VS Code and provider test doubles for IntelliSense scenarios in `src/test/unit/vscode-mock.ts`
- [ ] T004 [P] Add shared IntelliSense test utilities in `src/test/unit/workflow-test-helpers.ts` and `src/test/integration/index.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the shared IntelliSense infrastructure required before any user story can be implemented.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T005 Define manifest artifact-field types and IntelliSense state types in `src/manifest/manifest-types.ts`
- [ ] T006 [P] Extend manifest parsing and validation for `artifact-folder`, `artifact-name`, and `artifact-suffix` in `src/manifest/validate-manifest.ts`
- [ ] T007 [P] Add `tfTools.artifactsPath` settings support in `package.json` and `src/workspace/settings.ts`
- [ ] T008 [P] Create IntelliSense artifact-resolution and runtime-state helpers in `src/intellisense/artifact-resolution.ts` and `src/intellisense/intellisense-types.ts`
- [ ] T009 Implement shared IntelliSense refresh orchestration scaffolding in `src/intellisense/intellisense-service.ts` and `src/extension.ts`
- [ ] T010 Extend manifest reload and refresh publication for IntelliSense inputs in `src/manifest/manifest-service.ts` and `src/extension.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin.

---

## Phase 3: User Story 1 - See Correct IntelliSense For The Active Context (Priority: P1) 🎯 MVP

**Goal**: Keep editor assistance aligned with the exact active model, target, and component, with no fallback to another compile database and explicit stale-state clearing when the active artifact is missing.

**Independent Test**: Activate the extension with a valid compile-commands artifact, switch active model, component, target, and `tfTools.artifactsPath`, then verify IntelliSense follows the exact active context and clears previously applied state when the expected artifact is missing.

### Tests for User Story 1 ⚠️

- [ ] T011 [P] [US1] Add unit tests for artifact-path derivation and no-fallback resolution in `src/test/unit/workflow/intellisense-artifact-resolution.test.ts`
- [ ] T012 [P] [US1] Add unit tests for stale-state clearing and refresh serialization in `src/test/unit/workflow/intellisense-service.test.ts`
- [ ] T013 [P] [US1] Extend manifest validation tests for IntelliSense artifact fields in `src/test/unit/manifest/validate-manifest.test.ts`
- [ ] T014 [P] [US1] Add integration tests for active-context IntelliSense refresh and stale-state clearing in `src/test/integration/build-context-selection.integration.test.ts`

### Implementation for User Story 1

- [ ] T015 [P] [US1] Implement compile-commands path derivation from `artifact-folder`, `artifact-name`, and `artifact-suffix` in `src/intellisense/artifact-resolution.ts` and `src/manifest/manifest-types.ts`
- [ ] T016 [P] [US1] Implement cpptools adapter boundary for compile-database application and clearing in `src/intellisense/cpptools-provider.ts`
- [ ] T017 [US1] Implement IntelliSense refresh, exact-artifact application, and stale-state clearing in `src/intellisense/intellisense-service.ts`
- [ ] T018 [US1] Wire IntelliSense activation, active-context refresh, build-trigger refresh, and `tfTools.artifactsPath` refresh through `src/extension.ts` and `src/workspace/settings.ts`
- [ ] T019 [US1] Record missing-artifact runtime events without popup fallback behavior in `src/intellisense/intellisense-service.ts` and `src/observability/log-channel.ts`

**Checkpoint**: User Story 1 should now be functional and independently testable.

---

## Phase 4: User Story 2 - Inspect Compile Commands Availability (Priority: P2)

**Goal**: Show whether the active compile-commands artifact is present and where it is expected in the `Build Artifacts` section.

**Independent Test**: Open the Configuration view with valid and missing compile-commands artifacts, then verify the `Compile Commands` row shows `valid` or `missing` and the tooltip reports the exact expected path for the active configuration.

### Tests for User Story 2 ⚠️

- [ ] T020 [P] [US2] Add unit tests for `Build Artifacts` compile-commands row rendering in `src/test/unit/ui/configuration-tree.test.ts`
- [ ] T021 [P] [US2] Add integration tests for compile-commands status and tooltip refresh in `src/test/integration/configuration-health.integration.test.ts`

### Implementation for User Story 2

- [ ] T022 [P] [US2] Extend tree item models for compile-commands artifact status and tooltip text in `src/ui/configuration-tree.ts`
- [ ] T023 [US2] Publish compile-commands artifact state from IntelliSense refresh into the tree view in `src/intellisense/intellisense-service.ts` and `src/extension.ts`
- [ ] T024 [US2] Recompute the `Compile Commands` row on model, component, target, manifest, and `tfTools.artifactsPath` changes in `src/extension.ts` and `src/ui/configuration-tree.ts`

**Checkpoint**: User Stories 1 and 2 should both work, and compile-commands availability should be visible and independently testable.

---

## Phase 5: User Story 3 - Receive Explicit Provider Warnings (Priority: P3)

**Goal**: Warn clearly when IntelliSense prerequisites are unavailable or misconfigured and provide a manual refresh command from both required surfaces.

**Independent Test**: Start the extension with cpptools missing and with cpptools installed but not configured to use Trezor Firmware Tools, then verify both cases show a visible warning, write a persistent log entry, and expose `Refresh IntelliSense` from the Configuration view title/overflow and the Command Palette.

### Tests for User Story 3 ⚠️

- [ ] T025 [P] [US3] Add unit tests for provider-readiness evaluation and warning transitions in `src/test/unit/workflow/intellisense-provider-readiness.test.ts`
- [ ] T026 [P] [US3] Add integration tests for provider warnings and recovery in `src/test/integration/configuration-health.integration.test.ts`
- [ ] T027 [P] [US3] Add integration tests for `Refresh IntelliSense` command contributions and execution in `src/test/integration/build-workflow.integration.test.ts`

### Implementation for User Story 3

- [ ] T028 [P] [US3] Implement provider-readiness checks and warning-state clearing in `src/intellisense/cpptools-provider.ts` and `src/intellisense/intellisense-service.ts`
- [ ] T029 [P] [US3] Extend persistent IntelliSense warning logging and user-facing messages in `src/observability/log-channel.ts` and `src/intellisense/intellisense-service.ts`
- [ ] T030 [P] [US3] Add `Refresh IntelliSense` command and Configuration view title or overflow contributions in `package.json`
- [ ] T031 [US3] Wire manual refresh, provider-change refresh, and provider-warning recovery through `src/extension.ts`

**Checkpoint**: All user stories should now be independently functional and the IntelliSense slice should be complete without crossing into later slices.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final consistency, regression coverage, and end-to-end validation for the completed feature.

- [ ] T032 [P] Review command and menu contributions for cross-slice drift in `package.json` and `src/extension.ts`
- [ ] T033 [P] Expand regression coverage for `tfTools.artifactsPath` changes and target suffix transitions in `src/test/integration/configuration-health.integration.test.ts` and `src/test/unit/workflow/intellisense-artifact-resolution.test.ts`
- [ ] T034 Validate end-to-end IntelliSense scenarios from `specs/003-intellisense-integration/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - blocks all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational completion
- **User Story 2 (Phase 4)**: Depends on Foundational completion and reuses the artifact-resolution and refresh state from User Story 1
- **User Story 3 (Phase 5)**: Depends on Foundational completion and extends the IntelliSense service and command surfaces from User Stories 1 and 2
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - establishes exact compile-commands resolution, provider application, and stale-state clearing
- **User Story 2 (P2)**: Depends on User Story 1 artifact-state publication so the tree can show the active compile-commands status accurately
- **User Story 3 (P3)**: Depends on User Story 1 provider integration and extends it with explicit readiness warnings and manual refresh surfaces

### Within Each User Story

- Tests MUST be written and fail before implementation tasks begin
- Manifest and state helpers come before activation wiring and UI publication
- Provider integration and refresh behavior come before tree or command surfaces that expose their state
- Observability and warning recovery must land before the story is considered done

### Parallel Opportunities

- `T003` and `T004` can run in parallel after `T001` and `T002`
- `T006`, `T007`, and `T008` can run in parallel after `T005`
- `T011`, `T012`, `T013`, and `T014` can run in parallel for User Story 1
- `T015` and `T016` can run in parallel for User Story 1
- `T020` and `T021` can run in parallel for User Story 2
- `T025`, `T026`, and `T027` can run in parallel for User Story 3
- `T028`, `T029`, and `T030` can run in parallel for User Story 3

---

## Parallel Example: User Story 1

```bash
# Launch the User Story 1 tests together:
Task: "T011 Add unit tests for artifact-path derivation and no-fallback resolution in src/test/unit/workflow/intellisense-artifact-resolution.test.ts"
Task: "T012 Add unit tests for stale-state clearing and refresh serialization in src/test/unit/workflow/intellisense-service.test.ts"
Task: "T013 Extend manifest validation tests for IntelliSense artifact fields in src/test/unit/manifest/validate-manifest.test.ts"
Task: "T014 Add integration tests for active-context IntelliSense refresh and stale-state clearing in src/test/integration/build-context-selection.integration.test.ts"

# Launch the core IntelliSense implementation together:
Task: "T015 Implement compile-commands path derivation from artifact-folder, artifact-name, and artifact-suffix in src/intellisense/artifact-resolution.ts and src/manifest/manifest-types.ts"
Task: "T016 Implement cpptools adapter boundary for compile-database application and clearing in src/intellisense/cpptools-provider.ts"
```

## Parallel Example: User Story 3

```bash
# Launch the User Story 3 tests together:
Task: "T025 Add unit tests for provider-readiness evaluation and warning transitions in src/test/unit/workflow/intellisense-provider-readiness.test.ts"
Task: "T026 Add integration tests for provider warnings and recovery in src/test/integration/configuration-health.integration.test.ts"
Task: "T027 Add integration tests for Refresh IntelliSense command contributions and execution in src/test/integration/build-workflow.integration.test.ts"

# Launch the provider-warning and command-surface work together:
Task: "T028 Implement provider-readiness checks and warning-state clearing in src/intellisense/cpptools-provider.ts and src/intellisense/intellisense-service.ts"
Task: "T029 Extend persistent IntelliSense warning logging and user-facing messages in src/observability/log-channel.ts and src/intellisense/intellisense-service.ts"
Task: "T030 Add Refresh IntelliSense command and Configuration view title or overflow contributions in package.json"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Validate active-context IntelliSense alignment and stale-state clearing independently
5. Demo the first IntelliSense increment

### Incremental Delivery

1. Complete Setup + Foundational to establish artifact metadata, settings, and refresh scaffolding
2. Add User Story 1 to make IntelliSense follow the exact active compile database
3. Add User Story 2 to surface compile-commands availability and expected path in the tree
4. Add User Story 3 to harden provider warnings and manual refresh surfaces
5. Finish with polish and end-to-end validation

### Parallel Team Strategy

1. One developer prepares fixtures and test doubles while another extends manifest/settings support after setup
2. After foundation is complete, one developer can focus on artifact resolution and provider integration while another prepares tree-row and integration tests
3. Provider warnings and command-surface work can proceed in parallel once the IntelliSense service exists

---

## Notes

- `[P]` tasks touch different files and can run in parallel safely
- `[US1]`, `[US2]`, and `[US3]` map each task back to a single user story for traceability
- This task list intentionally rejects scope drift into excluded-file visibility, Binary or Map File behavior, Flash/Upload, Debug launch, alternate providers, and multi-root behavior
- Complete and commit one task at a time; do not batch multiple tasks into one commit