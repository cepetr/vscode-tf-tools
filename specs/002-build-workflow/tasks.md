# Tasks: Build Workflow

**Input**: Design documents from `/specs/002-build-workflow/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/
**Informal Spec Slice**: `2. Build Workflow`
**Scope Guard**: Tasks in this file stay within the Build Workflow slice only. They cover Build Options rendering and persistence, `when` parsing/validation/evaluation, `Build`/`Clippy`/`Check`/`Clean` commands and build tasks, dynamic task labels, effective command argument derivation, blocked-but-visible header actions, and failure visibility. They do not implement Build Artifacts behavior or artifact-status refresh, Flash/Upload, Debug, IntelliSense, compile-commands refresh, or excluded-file visibility.

**Tests**: Automated unit and integration tests are required for every user story. Integration coverage is included for VS Code view wiring, manifest parsing, task execution, diagnostics, logging, and persisted state.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare fixtures and test helpers needed by the Build Workflow slice.

- [X] T001 Create Build Workflow manifest fixtures in `test-fixtures/manifests/options-grouped/tf-tools.yaml`, `test-fixtures/manifests/options-hidden-preserved/tf-tools.yaml`, and `test-fixtures/manifests/invalid-when/tf-tools.yaml`
- [X] T002 Create unsupported-workflow fixture scaffolding in `test-fixtures/workspaces/unsupported-workflow/.gitkeep`
- [X] T003 [P] Extend VS Code/task test doubles for workflow execution in `src/test/unit/vscode-mock.ts`
- [X] T004 [P] Add shared workflow test utilities in `src/test/unit/setup.ts` and `src/test/integration/index.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the shared Build Workflow infrastructure required before any user story can be implemented.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T005 Define build-option and validation types in `src/manifest/manifest-types.ts`
- [X] T006 [P] Implement `when` expression parsing and evaluation in `src/manifest/when-expressions.ts`
- [X] T007 [P] Extend manifest parsing and validation for options, flags, states, and invalid `when` diagnostics in `src/manifest/validate-manifest.ts`
- [X] T008 [P] Add workflow-related settings helpers for cargo workspace resolution in `src/workspace/settings.ts` and `package.json`
- [X] T009 Implement persisted build-option selection state and normalization helpers in `src/configuration/build-options.ts` and `src/configuration/active-config.ts`
- [X] T010 Extend manifest reload and blocking-state publication for Build Workflow in `src/manifest/manifest-service.ts` and `src/observability/diagnostics.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin.

---

## Phase 3: User Story 1 - Configure Effective Build Options (Priority: P1) 🎯 MVP

**Goal**: Let the user see and manage only the build options that apply to the active model, target, and component.

**Independent Test**: Load grouped and ungrouped option fixtures, switch active build context values, and confirm visible options, selected values, and preserved hidden values match the effective context.

### Tests for User Story 1 ⚠️

- [X] T011 [P] [US1] Add unit tests for `when` parsing and evaluation in `src/test/unit/manifest/when-expressions.test.ts`
- [X] T012 [P] [US1] Extend manifest validation tests for grouped options, duplicate flags, defaults, and invalid `when` rules in `src/test/unit/manifest/validate-manifest.test.ts`
- [X] T013 [P] [US1] Add unit tests for build-option persistence and normalization in `src/test/unit/configuration/build-options.test.ts`
- [X] T014 [P] [US1] Add integration tests for Build Options ordering, visibility, and hidden-value restoration in `src/test/integration/build-options-when.integration.test.ts`

### Implementation for User Story 1

- [X] T015 [P] [US1] Expand manifest option parsing and loaded-state option data in `src/manifest/manifest-types.ts` and `src/manifest/validate-manifest.ts`
- [X] T016 [P] [US1] Implement workspace-scoped build-option storage and normalization in `src/configuration/build-options.ts` and `src/configuration/active-config.ts`
- [X] T017 [US1] Render grouped checkbox and multistate Build Options rows in `src/ui/configuration-tree.ts`
- [X] T018 [US1] Wire Build Options refresh to manifest and build-context changes in `src/extension.ts`
- [X] T019 [US1] Surface invalid build-option `when` diagnostics and logs in `src/observability/diagnostics.ts` and `src/observability/log-channel.ts`

**Checkpoint**: User Story 1 should now be functional and independently testable.

---

## Phase 4: User Story 2 - Launch Build Tasks From The Active Context (Priority: P2)

**Goal**: Let the user run `Build`, `Clippy`, `Check`, and `Clean` from the Configuration view and standard VS Code build-task entry points.

**Independent Test**: With a valid manifest and active configuration, invoke all four workflow actions and confirm task labels, command titles, and build-task exposure match the active context.

### Tests for User Story 2 ⚠️

- [X] T020 [P] [US2] Add unit tests for workflow label formatting in `src/test/unit/workflow/task-labels.test.ts`
- [X] T021 [P] [US2] Add unit tests for effective argument derivation in `src/test/unit/workflow/build-arguments.test.ts`
- [X] T022 [P] [US2] Add integration tests for workflow commands and view-header actions in `src/test/integration/build-workflow.integration.test.ts`
- [X] T023 [P] [US2] Add integration tests for VS Code build-task exposure and labels in `src/test/integration/task-provider.integration.test.ts`

### Implementation for User Story 2

- [X] T024 [P] [US2] Add Build Workflow command, menu, and setting contributions in `package.json`
- [X] T025 [P] [US2] Implement effective workflow configuration and argument derivation in `src/commands/build-workflow.ts`
- [X] T026 [P] [US2] Implement VS Code build-task exposure for `Build`, `Clippy`, `Check`, and `Clean` in `src/tasks/build-task-provider.ts`
- [X] T027 [US2] Wire workflow commands, task provider, and active-context execution through `src/extension.ts`
- [X] T028 [US2] Keep `Build`, `Clippy`, `Check`, and `Clean` synchronized with the Configuration view header in `package.json` and `src/extension.ts`

**Checkpoint**: User Stories 1 and 2 should both work, and workflow actions should launch from both the Configuration view and standard task entry points.

---

## Phase 5: User Story 3 - Trust Derived Arguments And Failures (Priority: P3)

**Goal**: Make derived arguments and blocked or failed workflow states explicit, consistent, and recoverable.

**Independent Test**: Trigger invalid-`when`, unsupported-workspace, and failing-task scenarios, then verify blocked-state UI, user-facing errors, diagnostics, and logs all match the effective configuration.

### Tests for User Story 3 ⚠️

- [X] T029 [P] [US3] Add unit tests for blocked-action gating and failure reasons in `src/test/unit/workflow/preconditions.test.ts`
- [X] T030 [P] [US3] Extend integration tests for invalid manifest and blocked header actions in `src/test/integration/build-workflow.integration.test.ts`
- [X] T031 [P] [US3] Extend integration tests for task failure notifications and logging in `src/test/integration/task-provider.integration.test.ts`

### Implementation for User Story 3

- [X] T032 [P] [US3] Implement shared workflow precondition checks and blocked reasons in `src/commands/build-workflow.ts`
- [X] T033 [P] [US3] Extend workflow failure notifications and output-channel logging in `src/commands/build-workflow.ts` and `src/observability/log-channel.ts`
- [X] T034 [US3] Keep blocked workflow actions visible but disabled in `package.json`, `src/extension.ts`, and `src/tasks/build-task-provider.ts`
- [X] T035 [US3] Prevent out-of-scope post-build refresh behavior during workflow execution in `src/tasks/build-task-provider.ts` and `src/extension.ts`

**Checkpoint**: All user stories should now be independently testable and the Build Workflow slice should be complete without crossing into later slices.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final consistency, regression coverage, and end-to-end validation for the completed feature.

- [X] T036 [P] Review package and activation wiring for cross-slice command drift in `package.json` and `src/extension.ts`
- [X] T037 [P] Expand regression coverage for preserved hidden values and target short-name fallback in `src/test/integration/build-options-when.integration.test.ts` and `src/test/unit/workflow/task-labels.test.ts`
- [X] T038 Validate end-to-end Build Workflow scenarios from `specs/002-build-workflow/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - blocks all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational completion
- **User Story 2 (Phase 4)**: Depends on Foundational completion and reuses Build Option data/model infrastructure from User Story 1
- **User Story 3 (Phase 5)**: Depends on Foundational completion and extends the workflow execution path from User Story 2
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - establishes manifest-driven Build Options behavior and hidden-value persistence
- **User Story 2 (P2)**: Depends on the Build Option and effective-configuration behavior from User Story 1
- **User Story 3 (P3)**: Depends on User Story 2 workflow execution so blocked and failure states can be enforced against the launched actions

### Within Each User Story

- Tests MUST be written and fail before implementation tasks begin
- Manifest and state helpers come before UI or workflow wiring
- Command/task derivation comes before activation wiring that exposes it through VS Code
- Observability and blocked-state handling must land before the story is considered done

### Parallel Opportunities

- `T003` and `T004` can run in parallel after `T001` and `T002`
- `T006`, `T007`, and `T008` can run in parallel after `T005`
- `T011`, `T012`, `T013`, and `T014` can run in parallel for User Story 1
- `T015` and `T016` can run in parallel for User Story 1
- `T020`, `T021`, `T022`, and `T023` can run in parallel for User Story 2
- `T024`, `T025`, and `T026` can run in parallel for User Story 2
- `T029`, `T030`, and `T031` can run in parallel for User Story 3
- `T032` and `T033` can run in parallel for User Story 3

---

## Parallel Example: User Story 1

```bash
# Launch the User Story 1 tests together:
Task: "T011 Add unit tests for when parsing and evaluation in src/test/unit/manifest/when-expressions.test.ts"
Task: "T012 Extend manifest validation tests for grouped options, duplicate flags, defaults, and invalid when rules in src/test/unit/manifest/validate-manifest.test.ts"
Task: "T013 Add unit tests for build-option persistence and normalization in src/test/unit/configuration/build-options.test.ts"
Task: "T014 Add integration tests for Build Options ordering, visibility, and hidden-value restoration in src/test/integration/build-options-when.integration.test.ts"

# Launch the core Build Option infrastructure together:
Task: "T015 Expand manifest option parsing and loaded-state option data in src/manifest/manifest-types.ts and src/manifest/validate-manifest.ts"
Task: "T016 Implement workspace-scoped build-option storage and normalization in src/configuration/build-options.ts and src/configuration/active-config.ts"
```

## Parallel Example: User Story 2

```bash
# Launch the User Story 2 tests together:
Task: "T020 Add unit tests for workflow label formatting in src/test/unit/workflow/task-labels.test.ts"
Task: "T021 Add unit tests for effective argument derivation in src/test/unit/workflow/build-arguments.test.ts"
Task: "T022 Add integration tests for workflow commands and view-header actions in src/test/integration/build-workflow.integration.test.ts"
Task: "T023 Add integration tests for VS Code build-task exposure and labels in src/test/integration/task-provider.integration.test.ts"

# Launch the workflow infrastructure together:
Task: "T024 Add Build Workflow command, menu, and setting contributions in package.json"
Task: "T025 Implement effective workflow configuration and argument derivation in src/commands/build-workflow.ts"
Task: "T026 Implement VS Code build-task exposure for Build, Clippy, Check, and Clean in src/tasks/build-task-provider.ts"
```

## Parallel Example: User Story 3

```bash
# Launch the User Story 3 tests together:
Task: "T029 Add unit tests for blocked-action gating and failure reasons in src/test/unit/workflow/preconditions.test.ts"
Task: "T030 Extend integration tests for invalid manifest and blocked header actions in src/test/integration/build-workflow.integration.test.ts"
Task: "T031 Extend integration tests for task failure notifications and logging in src/test/integration/task-provider.integration.test.ts"

# Launch the workflow failure-handling work together:
Task: "T032 Implement shared workflow precondition checks and blocked reasons in src/commands/build-workflow.ts"
Task: "T033 Extend workflow failure notifications and output-channel logging in src/commands/build-workflow.ts and src/observability/log-channel.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Validate Build Options ordering, visibility, and hidden-value restoration independently
5. Demo the first Build Workflow increment

### Incremental Delivery

1. Complete Setup + Foundational to establish Build Option parsing, persistence, and `when` infrastructure
2. Add User Story 1 to make Build Options real and context-aware
3. Add User Story 2 to expose workflow actions and build tasks
4. Add User Story 3 to harden blocked states, failures, and logs
5. Finish with polish and end-to-end validation

### Parallel Team Strategy

1. One developer prepares fixtures and test doubles while another starts `when` parsing and validation after setup
2. After foundation is complete, one developer can focus on Build Options UI while another prepares workflow label/argument tests
3. Once workflow execution exists, blocked-state and failure-path work can proceed in parallel with regression coverage expansion

---

## Notes

- `[P]` tasks touch different files and can run in parallel safely
- `[US1]`, `[US2]`, and `[US3]` map each task back to a single user story for traceability
- This task list intentionally rejects scope drift into Build Artifacts behavior, artifact-status refresh, Flash/Upload, Debug, IntelliSense, compile-commands refresh, and excluded-file visibility
- Complete and commit one task at a time; do not batch multiple tasks into one commit