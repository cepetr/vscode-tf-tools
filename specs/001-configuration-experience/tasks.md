# Tasks: Configuration Experience

**Input**: Design documents from `/specs/001-configuration-experience/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/
**Informal Spec Slice**: `1. Configuration Experience`
**Scope Guard**: Tasks in this file stay within the Configuration Experience slice only. They cover manifest discovery and validation for build-context configuration, build-context selection, workspace-scoped persistence, status-bar presentation, diagnostics, and log output. They do not implement Build Options behavior, `when` parsing or evaluation, build execution, artifact status evaluation, IntelliSense integration, excluded-file visibility, flash/upload, or debug launch.

**Tests**: Automated unit and integration tests are required for every user story. Integration coverage is included for VS Code view wiring, manifest parsing, diagnostics, logging, file watching, and persisted state.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the extension project and test harness described by the implementation plan.

- [X] T001 Create the extension package manifest, contribution skeleton, and npm scripts in `package.json`
- [X] T002 Configure TypeScript compilation for the extension and tests in `tsconfig.json`
- [X] T003 [P] Configure linting and packaging ignore rules in `eslint.config.mjs` and `.vscodeignore`
- [X] T004 [P] Configure the VS Code integration test runner in `src/test/integration/runTest.ts` and `package.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the core manifest, state, and observability infrastructure required by all user stories.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T005 Define manifest and active-configuration types in `src/manifest/manifest-types.ts` and `src/configuration/active-config.ts`
- [X] T006 [P] Implement workspace setting and workspace-guard helpers in `src/workspace/settings.ts` and `src/workspace/workspace-guard.ts`
- [X] T007 [P] Implement diagnostics and output-channel services in `src/observability/diagnostics.ts` and `src/observability/log-channel.ts`
- [X] T008 [P] Create reusable manifest and workspace fixtures in `test-fixtures/manifests/valid-basic/tf-tools.yaml`, `test-fixtures/manifests/invalid-structure/tf-tools.yaml`, and `test-fixtures/workspaces/missing-manifest/.gitkeep`
- [X] T009 Implement manifest parsing, structural validation, and file watching in `src/manifest/validate-manifest.ts` and `src/manifest/manifest-service.ts`
- [X] T010 Wire extension activation, shared commands, and provider registration in `src/extension.ts`
- [X] T011 Align stale feature validation artifacts with the narrowed scope in `specs/001-configuration-experience/quickstart.md` and `specs/001-configuration-experience/contracts/vscode-contribution-contract.md`

**Checkpoint**: Foundation ready - user story implementation can now begin.

---

## Phase 3: User Story 1 - Inspect Workspace Configuration Health (Priority: P1) 🎯 MVP

**Goal**: Let the user open the extension and immediately understand whether the workspace manifest is valid, missing, or invalid.

**Independent Test**: Launch the extension against valid, missing, and invalid manifest fixtures and verify the configuration UI, diagnostics, notifications, and log output match each state.

### Tests for User Story 1 ⚠️

- [X] T012 [P] [US1] Add unit tests for manifest parsing and validation issue generation in `src/test/unit/manifest/validate-manifest.test.ts`
- [X] T013 [P] [US1] Add integration tests for valid, missing, and invalid manifest health states in `src/test/integration/configuration-health.integration.test.ts`
- [X] T014 [P] [US1] Add integration tests that assert no `Build` or `Debug` title-bar actions and no cross-slice commands are exposed in `src/test/integration/configuration-scope.integration.test.ts`

### Implementation for User Story 1

- [X] T015 [P] [US1] Implement manifest issue to diagnostic translation in `src/observability/diagnostics.ts`
- [X] T016 [P] [US1] Implement the `Trezor: Show Logs` command and output-channel reveal flow in `src/observability/log-channel.ts` and `src/extension.ts`
- [X] T017 [US1] Implement configuration-view health states for loaded, missing, and invalid manifests in `src/ui/configuration-tree.ts`
- [X] T018 [US1] Implement manifest failure notifications and refresh debouncing in `src/manifest/manifest-service.ts`
- [X] T019 [US1] Add explicit activation guards that prevent `Build`, `Debug`, and other cross-slice commands from being contributed in `src/extension.ts`
- [X] T020 [US1] Connect manifest status changes to the tree view, diagnostics, and logs in `src/extension.ts`

**Checkpoint**: User Story 1 should now be functional and independently testable.

---

## Phase 4: User Story 2 - Choose Active Build Context (Priority: P2)

**Goal**: Let the user choose the active model, target, and component from the configuration UI and keep that selection valid against the manifest.

**Independent Test**: Launch against a valid manifest, change each selector, and confirm the active configuration updates immediately and normalizes stale values safely.

### Tests for User Story 2 ⚠️

- [X] T021 [P] [US2] Add unit tests for active-configuration normalization in `src/test/unit/configuration/normalize-config.test.ts`
- [X] T022 [P] [US2] Add integration tests for build-context selector behavior in `src/test/integration/build-context-selection.integration.test.ts`

### Implementation for User Story 2

- [X] T023 [P] [US2] Implement model, target, and component normalization helpers in `src/configuration/normalize-config.ts`
- [ ] T024 [P] [US2] Implement workspace-scoped active-configuration storage and mutation helpers in `src/configuration/active-config.ts`
- [ ] T025 [US2] Implement interactive build-context selector rows and selection commands in `src/ui/configuration-tree.ts`
- [ ] T026 [US2] Integrate selector updates, manifest normalization, and tree refresh in `src/extension.ts`

**Checkpoint**: User Stories 1 and 2 should both work, and build-context selection should remain valid across manifest changes.

---

## Phase 5: User Story 3 - Recover My Context After Reload (Priority: P3)

**Goal**: Restore the active build context on reload and keep the status bar synchronized with the current selection.

**Independent Test**: Select a non-default build context, reload the extension host, and verify the selection and status bar are restored and remain valid after manifest changes.

### Tests for User Story 3 ⚠️

- [ ] T027 [P] [US3] Add unit tests for status-bar text and visibility rules in `src/test/unit/ui/status-bar.test.ts`
- [ ] T028 [P] [US3] Add integration tests for restore-on-reload and status-bar reveal behavior in `src/test/integration/persistence-status-bar.integration.test.ts`

### Implementation for User Story 3

- [ ] T029 [P] [US3] Implement the status-bar presenter and reveal command handling in `src/ui/status-bar.ts`
- [ ] T030 [P] [US3] Extend persisted active-configuration restore logic in `src/configuration/active-config.ts`
- [ ] T031 [US3] Wire status-bar updates and restore-on-activation behavior in `src/extension.ts`
- [ ] T032 [US3] Handle manifest-change re-normalization for restored selections in `src/manifest/manifest-service.ts` and `src/extension.ts`

**Checkpoint**: All user stories should now be independently testable and the core Configuration Experience slice is functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final consistency, documentation, and end-to-end validation for the completed feature.

- [ ] T033 Validate end-to-end diagnostics, logging, and reload scenarios from `specs/001-configuration-experience/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - blocks all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational completion
- **User Story 2 (Phase 4)**: Depends on Foundational completion and extends the tree infrastructure from User Story 1
- **User Story 3 (Phase 5)**: Depends on Foundational completion and builds on the persisted selection flow from User Story 2
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - establishes manifest-health visibility and observability
- **User Story 2 (P2)**: Builds on the configuration view from User Story 1 to add interactive build-context selection
- **User Story 3 (P3)**: Builds on User Story 2 to add restore-on-reload and status-bar synchronization

### Within Each User Story

- Tests MUST be written and fail before implementation tasks begin
- State and normalization helpers come before UI command wiring
- UI behavior comes before activation wiring that exposes it through VS Code
- Story-specific observability changes are completed before the story is considered done

### Parallel Opportunities

- `T003` and `T004` can run in parallel after `T001` and `T002`
- `T006`, `T007`, and `T008` can run in parallel after `T005`
- `T012`, `T013`, and `T014` can run in parallel for User Story 1
- `T015` and `T016` can run in parallel for User Story 1
- `T021` and `T022` can run in parallel for User Story 2
- `T023` and `T024` can run in parallel for User Story 2
- `T027` and `T028` can run in parallel for User Story 3
- `T029` and `T030` can run in parallel for User Story 3

---

## Parallel Example: User Story 1

```bash
# Launch the User Story 1 tests together:
Task: "T012 Add unit tests for manifest parsing and validation issue generation in src/test/unit/manifest/validate-manifest.test.ts"
Task: "T013 Add integration tests for valid, missing, and invalid manifest health states in src/test/integration/configuration-health.integration.test.ts"
Task: "T014 Add integration tests that assert no Build or Debug title-bar actions and no cross-slice commands are exposed in src/test/integration/configuration-scope.integration.test.ts"

# Launch the user-facing observability work together:
Task: "T015 Implement manifest issue to diagnostic translation in src/observability/diagnostics.ts"
Task: "T016 Implement the Trezor: Show Logs command and output-channel reveal flow in src/observability/log-channel.ts and src/extension.ts"
```

## Parallel Example: User Story 2

```bash
# Launch the User Story 2 tests together:
Task: "T021 Add unit tests for active-configuration normalization in src/test/unit/configuration/normalize-config.test.ts"
Task: "T022 Add integration tests for build-context selector behavior in src/test/integration/build-context-selection.integration.test.ts"

# Launch the state helpers together:
Task: "T023 Implement model, target, and component normalization helpers in src/configuration/normalize-config.ts"
Task: "T024 Implement workspace-scoped active-configuration storage and mutation helpers in src/configuration/active-config.ts"
```

## Parallel Example: User Story 3

```bash
# Launch the User Story 3 tests together:
Task: "T027 Add unit tests for status-bar text and visibility rules in src/test/unit/ui/status-bar.test.ts"
Task: "T028 Add integration tests for restore-on-reload and status-bar reveal behavior in src/test/integration/persistence-status-bar.integration.test.ts"

# Launch the status-bar and persistence work together:
Task: "T029 Implement the status-bar presenter and reveal command handling in src/ui/status-bar.ts"
Task: "T030 Extend persisted active-configuration restore logic in src/configuration/active-config.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Validate manifest health behavior with valid, missing, and invalid fixtures
5. Demo the first usable UI slice

### Incremental Delivery

1. Complete Setup + Foundational to establish the extension scaffold and core services
2. Add User Story 1 to make manifest health visible and diagnosable
3. Add User Story 2 to make build-context selection interactive and normalized
4. Add User Story 3 to restore selection on reload and synchronize the status bar
5. Finish with polish and end-to-end validation

### Parallel Team Strategy

1. One developer bootstraps the extension package while another prepares the test runner once `package.json` and `tsconfig.json` exist
2. After foundation is complete, one developer can focus on manifest health visibility while another prepares normalization tests for User Story 2
3. Status-bar work for User Story 3 can start in parallel with restore-logic work after User Story 2 state helpers are stable

---

## Notes

- `[P]` tasks touch different files and can run in parallel safely
- `[US1]`, `[US2]`, and `[US3]` map each task back to a single user story for traceability
- This task list intentionally rejects scope drift into Build Options, `when` handling, build execution, artifacts, IntelliSense, excluded-file visibility, flash/upload, and debug launch
- Complete and commit one task at a time; do not batch multiple tasks into one commit