# Tasks: Flash/Upload Actions

**Input**: Design documents from `specs/005-flash-upload-actions/`
**Prerequisites**: `plan.md` (required), `spec.md` (required for user stories), `research.md`, `data-model.md`, `contracts/`, `quickstart.md`
**Informal Spec Slice**: `5. Flash/Upload Actions`
**Scope Guard**: Tasks in this file stay within the Flash/Upload Actions slice. They cover manifest-driven `flashWhen` and `uploadWhen` handling, Binary and Map File artifact rows, conditional Command Palette exposure, task-backed Flash and Upload execution, map-file opening, and visible failure reporting. They do not implement compile-commands status behavior, cpptools integration, excluded-file visibility, Build/Clippy/Check/Clean changes, Debug, multi-root behavior, or automatic post-success refresh.

**Tests**: Automated unit and integration tests are required for every user story. Integration coverage is included wherever the work touches VS Code commands, menus, tree-item actions, task execution, manifest parsing, output-channel logging, or implementation-sensitive Build Artifacts behavior.

**Organization**: Tasks are grouped by user story to enable independent implementation and validation.

**Slice Rule**: Include only work that belongs to the Flash/Upload Actions slice.

**Critical Detail Rule**: This file includes explicit tasks for the easy-to-miss behaviors from `spec.md` and `plan.md`: parsing `flashWhen` and `uploadWhen` with the existing condition language, resolving Binary and Map File paths from `<tfTools.artifactsPath>/<artifact-folder>/<artifact-name><artifact-suffix>`, showing both Binary-row actions when both rules are true, using dynamic Flash/Upload Command Palette titles aligned to `{model-name} | {target-display} | {component-name}`, hiding inapplicable Flash/Upload commands from the Command Palette, keeping the Map File action row-only and out of the Command Palette, keeping applicable Binary-row actions visible but disabled when the binary artifact is missing, keeping the Map File action visible but disabled when the map artifact is missing, logging blocked and post-start failures, and never auto-refreshing after successful Flash or Upload completion.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare fixtures and shared test seams for Flash/Upload and Map File behavior.

- [X] T001 Add Flash/Upload manifest fixtures for applicable, inapplicable, dual-action, and invalid-action contexts in `test-fixtures/manifests/flash-upload-valid/tf-tools-manifest.yaml` and `test-fixtures/manifests/flash-upload-invalid/tf-tools-manifest.yaml`
- [X] T002 [P] Add workspace fixtures for present and missing binary/map artifact scenarios in `test-fixtures/workspaces/flash-upload-valid/.vscode/settings.json` and `test-fixtures/workspaces/flash-upload-missing-artifacts/.vscode/settings.json`
- [X] T003 [P] Extend shared VS Code and task mocks for artifact-row actions, Command Palette menus, and on-demand task execution in `src/test/unit/vscode-mock.ts`, `src/test/unit/workflow-test-helpers.ts`, and `src/test/integration/index.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish manifest, artifact-state, and action helper scaffolding required before any user story can be implemented.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T004 Extend component manifest types for parsed `flashWhen` and `uploadWhen` rules in `src/manifest/manifest-types.ts`
- [X] T005 [P] Parse and validate component `flashWhen` and `uploadWhen` rules in `src/manifest/validate-manifest.ts`
- [X] T006 [P] Generalize artifact-resolution inputs and artifact-state helpers for `.bin` and `.map` files in `src/intellisense/intellisense-types.ts` and `src/intellisense/artifact-resolution.ts`
- [X] T007 Create shared artifact action applicability and request helpers in `src/commands/artifact-actions.ts`

**Checkpoint**: Manifest action rules, artifact-path derivation, and shared artifact-action helpers are ready; user stories can now proceed.

---

## Phase 3: User Story 1 - Run Device Actions From The Active Artifact (Priority: P1) 🎯 MVP

**Goal**: Let users launch Flash and Upload for the active build context from the Binary row and from the Command Palette when each action is applicable.

**Independent Test**: Activate the extension with a valid manifest and active configuration where the selected component makes Flash, Upload, or both applicable, ensure the binary artifact exists, and verify that each visible Binary-row action and each applicable Command Palette command starts the matching VS Code task without triggering automatic refresh.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests first and ensure they fail before implementation.**

- [X] T008 [P] [US1] Add unit tests for Flash/Upload applicability, task request building, blocked-start rules, and no-auto-refresh outcomes in `src/test/unit/workflow/flash-upload-actions.test.ts`
- [X] T009 [P] [US1] Add integration tests for dynamic Flash/Upload Command Palette titles, Binary-row action launch, blocked starts, and output-channel logging in `src/test/integration/flash-upload-actions.integration.test.ts` and `src/test/integration/configuration-scope.integration.test.ts`

### Implementation for User Story 1

- [X] T010 [P] [US1] Contribute `tfTools.flash` and `tfTools.upload` commands plus dynamic title support and conditional `menus.commandPalette` visibility in `package.json` and `src/extension.ts`
- [X] T011 [US1] Implement Flash/Upload task creation, blocked-start handling, failure logging, and no-auto-refresh behavior in `src/commands/artifact-actions.ts` and `src/observability/log-channel.ts`
- [X] T012 [US1] Wire `tfTools.flash` and `tfTools.upload` command registration, applicability context keys, and task execution in `src/extension.ts`

**Checkpoint**: User Story 1 is fully functional and independently testable from the Binary row and the Command Palette.

---

## Phase 4: User Story 2 - Understand Why Actions Are Or Are Not Available (Priority: P2)

**Goal**: Show Binary and Map File row state with expected-path tooltips, missing reasons, and Binary-row action visibility or disabled state that matches the active component rules and artifact presence.

**Independent Test**: Vary the active component rules and artifact presence so that actions are applicable, inapplicable, and blocked by missing artifacts, then verify the Binary and Map File rows show the right `valid` or `missing` status, tooltips, visible actions, and disabled states.

### Tests for User Story 2 ⚠️

- [ ] T013 [P] [US2] Add unit tests for Binary/Map artifact derivation, row status, missing-reason messaging, and dual-action visibility in `src/test/unit/workflow/intellisense-artifact-resolution.test.ts` and `src/test/unit/ui/configuration-tree.test.ts`
- [ ] T014 [P] [US2] Add integration tests for Binary and Map File row rendering, Binary-row action visibility, and disabled-state behavior in `src/test/integration/flash-upload-artifacts.integration.test.ts`

### Implementation for User Story 2

- [ ] T015 [P] [US2] Implement Binary and Map File artifact row items, tooltip text, and row-scoped action context values in `src/ui/configuration-tree.ts`
- [ ] T016 [P] [US2] Contribute `menus.view/item/context` actions and enablement rules for Binary-row Flash/Upload actions in `package.json`
- [ ] T017 [US2] Wire Binary and Map File artifact state updates plus action enablement context keys in `src/extension.ts` and `src/ui/configuration-tree.ts`

**Checkpoint**: User Story 2 is fully functional and independently testable from the Build Artifacts section.

---

## Phase 5: User Story 3 - Open The Active Map File (Priority: P3)

**Goal**: Let users open the resolved map file directly from the Build Artifacts section when the file exists, while keeping the action visible but disabled when the map artifact is missing.

**Independent Test**: Activate the extension with present and missing map artifacts and verify that the Map File row action opens the resolved file in the current editor only when that file exists.

### Tests for User Story 3 ⚠️

- [ ] T018 [P] [US3] Add unit tests for map-file open requests, missing-file guards, and disabled-state behavior in `src/test/unit/workflow/open-map-file.test.ts`
- [ ] T019 [P] [US3] Add integration tests for Map File row action enablement, editor open behavior, and Command Palette exclusion in `src/test/integration/map-file-action.integration.test.ts`

### Implementation for User Story 3

- [ ] T020 [P] [US3] Contribute the internal `tfTools.openMapFile` row action command, `menus.view/item/context` entry, and explicit Command Palette exclusion in `package.json`
- [ ] T021 [P] [US3] Implement map-file open execution and missing-file guards in `src/commands/artifact-actions.ts`
- [ ] T022 [US3] Wire `tfTools.openMapFile` registration and Map File action enablement in `src/extension.ts` and `src/ui/configuration-tree.ts`

**Checkpoint**: All user stories are independently functional, and the Build Artifacts section supports Flash, Upload, and Map File operations for the active context.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final regression coverage, scope validation, and quickstart verification across the completed slice.

- [ ] T023 [P] Expand regression coverage for invalid `flashWhen` and `uploadWhen` expressions plus unknown-id validation in `src/test/unit/manifest/validate-manifest.test.ts`
- [ ] T024 [P] Verify no scope drift into Compile Commands, Excluded Files, Build/Clippy/Check/Clean, or Debug in `src/test/integration/configuration-scope.integration.test.ts` and `package.json`
- [ ] T025 Validate end-to-end Flash/Upload and Map File scenarios from `specs/005-flash-upload-actions/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion; blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational completion.
- **User Story 2 (Phase 4)**: Depends on Foundational completion.
- **User Story 3 (Phase 5)**: Depends on Foundational completion and reuses the Map File row state added in User Story 2.
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational and delivers the MVP.
- **User Story 2 (P2)**: Can start after Foundational and remains independently testable once Binary and Map File row state is rendered.
- **User Story 3 (P3)**: Depends on User Story 2 because the Map File action is attached to the row state and tooltip behavior delivered there.

### Within Each User Story

- Tests must be written and fail before implementation begins.
- Manifest and artifact-state helpers come before command wiring or tree rendering.
- Menu contributions come before extension wiring that depends on their context keys.
- Failure visibility and no-auto-refresh behavior must be complete before the story is marked done.

### Parallel Opportunities

- `T002` and `T003` can run in parallel after `T001`.
- `T005` and `T006` can run in parallel after `T004`.
- `T008` and `T009` can run in parallel for User Story 1.
- `T010` can run in parallel with `T011` for User Story 1 before `T012`.
- `T013` and `T014` can run in parallel for User Story 2.
- `T015` and `T016` can run in parallel for User Story 2 before `T017`.
- `T018` and `T019` can run in parallel for User Story 3.
- `T020` and `T021` can run in parallel for User Story 3 before `T022`.
- `T023` and `T024` can run in parallel during Polish before `T025`.

---

## Parallel Example: User Story 1

```bash
# Launch the User Story 1 tests together:
Task: "T008 Add unit tests for Flash/Upload applicability, task request building, blocked-start rules, and no-auto-refresh outcomes in src/test/unit/workflow/flash-upload-actions.test.ts"
Task: "T009 Add integration tests for dynamic Flash/Upload Command Palette titles, Binary-row action launch, blocked starts, and output-channel logging in src/test/integration/flash-upload-actions.integration.test.ts and src/test/integration/configuration-scope.integration.test.ts"

# Launch the core implementation together:
Task: "T010 Contribute tfTools.flash and tfTools.upload commands plus dynamic title support and conditional menus.commandPalette visibility in package.json and src/extension.ts"
Task: "T011 Implement Flash/Upload task creation, blocked-start handling, failure logging, and no-auto-refresh behavior in src/commands/artifact-actions.ts and src/observability/log-channel.ts"
```

---

## Parallel Example: User Story 2

```bash
# Launch the User Story 2 tests together:
Task: "T013 Add unit tests for Binary/Map artifact derivation, row status, missing-reason messaging, and dual-action visibility in src/test/unit/workflow/intellisense-artifact-resolution.test.ts and src/test/unit/ui/configuration-tree.test.ts"
Task: "T014 Add integration tests for Binary and Map File row rendering, Binary-row action visibility, and disabled-state behavior in src/test/integration/flash-upload-artifacts.integration.test.ts"

# Launch the core implementation together:
Task: "T015 Implement Binary and Map File artifact row items, tooltip text, and row-scoped action context values in src/ui/configuration-tree.ts"
Task: "T016 Contribute menus.view/item/context actions and enablement rules for Binary-row Flash/Upload actions in package.json"
```

---

## Parallel Example: User Story 3

```bash
# Launch the User Story 3 tests together:
Task: "T018 Add unit tests for map-file open requests, missing-file guards, and disabled-state behavior in src/test/unit/workflow/open-map-file.test.ts"
Task: "T019 Add integration tests for Map File row action enablement, editor open behavior, and Command Palette exclusion in src/test/integration/map-file-action.integration.test.ts"

# Launch the core implementation together:
Task: "T020 Contribute the internal tfTools.openMapFile row action command, menus.view/item/context entry, and explicit Command Palette exclusion in package.json"
Task: "T021 Implement map-file open execution and missing-file guards in src/commands/artifact-actions.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Validate User Story 1 independently before continuing.

### Incremental Delivery

1. Complete Setup and Foundational work to establish parsed action rules, shared artifact-state helpers, and test fixtures.
2. Deliver User Story 1 for Flash/Upload execution from the Binary row and Command Palette.
3. Deliver User Story 2 for Binary and Map File row state, tooltips, and disabled-state behavior.
4. Deliver User Story 3 for map-file open behavior.
5. Finish with regression coverage and quickstart validation.

### Parallel Team Strategy

1. One developer can prepare fixtures and mocks while another extends manifest and artifact-state helpers.
2. After the foundation is complete, one developer can focus on Flash/Upload command behavior while another builds Binary/Map row rendering.
3. Once artifact row state is stable, map-file open work and polish/regression tasks can proceed in parallel until quickstart validation.

---

## Notes

- `[P]` tasks touch different files and are safe to run in parallel.
- `[US1]`, `[US2]`, and `[US3]` map tasks back to individual user stories for traceability.
- The MVP scope is User Story 1.
- This task list intentionally keeps Flash/Upload execution out of the standard build-task provider surface while still using VS Code task execution.
- This task list intentionally rejects scope drift into Compile Commands ownership, Excluded Files, Build/Clippy/Check/Clean changes, Debug, and multi-root behavior.
- Complete and commit one task at a time; do not batch multiple tasks into a single commit.