# Tasks: Debug Launch

**Input**: Design documents from `specs/006-debug-launch/`
**Prerequisites**: `plan.md` (required), `spec.md` (required for user stories), `research.md`, `data-model.md`, `contracts/`, `quickstart.md`
**Informal Spec Slice**: `6. Debug Launch`
**Scope Guard**: Tasks in this file stay within the Debug Launch slice. They cover manifest-defined debug profile parsing, priority-based profile resolution, `tfTools.debug.templatesPath`, the `Executable` artifact row and row action, header and overflow `Start Debugging` actions, conditional Command Palette exposure, tf-tools substitution, debug API launch, and explicit debug-specific failure reporting. They do not implement Build/Clippy/Check/Clean changes, Flash or Upload execution, `Binary` or `Map File` ownership, compile-commands provider behavior, excluded-file visibility, multi-root support, or `launch.json` persistence.

**Tests**: Automated unit and integration tests are required for every user story. Integration coverage is included wherever the work touches VS Code commands, menus, tree-item actions, settings refresh, manifest parsing, output-channel logging, or debug API launch behavior.

**Organization**: Tasks are grouped by user story to enable independent implementation and validation.

**Slice Rule**: Include only work that belongs to the Debug Launch slice.

**Critical Detail Rule**: This file includes explicit tasks for the easy-to-miss behaviors from `spec.md` and `plan.md`: matching only manifest-defined debug profiles, honoring highest-priority wins without silent declaration-order fallback, blocking equal highest-priority ties as ambiguous, loading templates from `tfTools.debug.templatesPath` on every invocation, rejecting template-root traversal, resolving relative executables against `<tfTools.artifactsPath>/<artifactFolder>/`, always rendering the `Executable` row, keeping header/overflow/row Start Debugging actions visible but disabled when no unique valid profile resolves or the executable is missing, hiding `Trezor: Start Debugging` from the Command Palette unless the context is uniquely startable, failing missing or malformed templates only at invocation time, applying tf-tools substitutions across nested strings without re-expansion, leaving non-tf-tools variables untouched, and logging all blocked debug-launch failures persistently.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare fixtures and shared test seams for Debug Launch scenarios.

- [X] T001 Add Debug Launch manifest fixtures for valid, ambiguous, unmatched, and invalid debug-profile scenarios in `test-fixtures/manifests/debug-launch-valid/tf-tools-manifest.yaml` and `test-fixtures/manifests/debug-launch-invalid/tf-tools-manifest.yaml`
- [X] T002 [P] Add workspace fixtures for executable-present, missing-executable, missing-template, malformed-template, traversal, variable-error, and unsupported-workspace scenarios in `test-fixtures/workspaces/debug-launch-valid/.vscode/settings.json`, `test-fixtures/workspaces/debug-launch-failures/.vscode/settings.json`, and `test-fixtures/workspaces/unsupported-workflow/.vscode/settings.json`
- [X] T003 [P] Extend shared VS Code and debug-launch test helpers for `vscode.debug.startDebugging`, output-channel assertions, and settings-driven refresh coverage in `src/test/unit/vscode-mock.ts`, `src/test/unit/workflow-test-helpers.ts`, and `src/test/integration/index.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish manifest, setting, resolution, and executable-state scaffolding required before any user story can be implemented.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T004 Add the `jsonc-parser` dependency and contribute the `tfTools.debug.templatesPath` setting in `package.json`
- [X] T005 [P] Add debug-template path resolution helpers to `src/workspace/settings.ts`
- [X] T006 [P] Extend manifest debug-profile types and validation state in `src/manifest/manifest-types.ts`
- [X] T007 Parse and validate manifest `debug` entries, priorities, executables, templates, and optional vars in `src/manifest/validate-manifest.ts`
- [X] T008 [P] Create shared debug profile resolution, template loading, and tf-tools substitution helpers in `src/commands/debug-launch.ts`
- [X] T009 [P] Extend executable artifact path and status helpers in `src/intellisense/artifact-resolution.ts`

**Checkpoint**: Debug profile parsing, template-path resolution, substitution scaffolding, and executable artifact state are ready; user stories can now proceed.

---

## Phase 3: User Story 1 - Launch The Correct Debug Profile (Priority: P1) 🎯 MVP

**Goal**: Let users start debugging for the active build context through the visible Start Debugging surfaces when exactly one highest-priority debug profile resolves and the executable exists.

**Independent Test**: Activate the extension with a valid manifest and active configuration where exactly one highest-priority profile resolves and the executable exists, then verify that invoking Start Debugging from the header, overflow, Executable row, and Command Palette launches the same resolved configuration.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests first and ensure they fail before implementation.**

- [X] T010 [P] [US1] Add unit tests for profile matching, priority selection, relative and absolute executable resolution, per-invocation template reload, single-pass tf-tools substitution, and non-tf-tools variable pass-through in `src/test/unit/workflow/debug-launch.test.ts`
- [X] T011 [P] [US1] Add integration tests for successful Start Debugging launch from the header, overflow, Executable row, and Command Palette in `src/test/integration/debug-launch.integration.test.ts`

### Implementation for User Story 1

- [X] T012 [P] [US1] Contribute the `tfTools.startDebugging` command and Command Palette visibility rule in `package.json`
- [X] T013 [US1] Implement per-invocation JSONC template resolution, single-pass tf-tools variable application without re-expansion, non-tf-tools variable pass-through, and `vscode.debug.startDebugging` launch flow in `src/commands/debug-launch.ts`
- [X] T014 [US1] Register `tfTools.startDebugging` and wire successful debug-launch execution through `src/extension.ts`

**Checkpoint**: User Story 1 is fully functional and independently testable from all supported Start Debugging surfaces.

---

## Phase 4: User Story 2 - Understand Debug Availability Before Launch (Priority: P2)

**Goal**: Show executable readiness and Start Debugging availability clearly in the Configuration view through the `Executable` row, its tooltip, and disabled-but-visible action surfaces.

**Independent Test**: Switch between contexts with valid, missing, ambiguous, and unmatched debug states and verify the `Executable` row status, tooltip, row action, header action, overflow action, and Command Palette visibility all match the active debug state.

### Tests for User Story 2 ⚠️

- [X] T015 [P] [US2] Add unit tests for Executable artifact status, missing-reason messaging, tooltip content, and tree-row disabled-state behavior in `src/test/unit/workflow/intellisense-artifact-resolution.test.ts` and `src/test/unit/ui/configuration-tree.test.ts`
- [ ] T016 [P] [US2] Add integration tests for Executable row rendering, header and overflow enablement, Command Palette hiding, and availability refresh after model, target, component, manifest, artifacts-path, and templates-path changes in `src/test/integration/debug-launch-artifacts.integration.test.ts`

### Implementation for User Story 2

- [X] T017 [P] [US2] Implement the `Executable` artifact row, tooltip text, and row context values in `src/ui/configuration-tree.ts`
- [ ] T018 [P] [US2] Contribute header, overflow, and Executable-row Start Debugging menu entries with ordered enablement in `package.json`
- [ ] T019 [US2] Wire executable artifact refresh, startability context keys, and recomputation after active model, target, component, manifest, `tfTools.artifactsPath`, and `tfTools.debug.templatesPath` changes in `src/extension.ts` and `src/workspace/settings.ts`

**Checkpoint**: User Story 2 is fully functional and independently testable from the Configuration view and Command Palette.

---

## Phase 5: User Story 3 - Diagnose Debug Launch Failures Quickly (Priority: P3)

**Goal**: Block invalid debug launches with specific errors and persistent log entries for no-match, ambiguous, unsupported-workspace, template, variable, and missing-executable failures.

**Independent Test**: Trigger no-match, missing-template, malformed-template, unresolved-variable, ambiguous-profile, traversal, unsupported-workspace, and missing-executable failures and verify each blocked launch shows an explicit error and records a persistent output-channel entry.

### Tests for User Story 3 ⚠️

- [ ] T020 [P] [US3] Add unit tests for template-root traversal rejection, JSONC parse failures, unknown variables, and cyclic debug vars in `src/test/unit/workflow/debug-template-resolution.test.ts`
- [ ] T021 [P] [US3] Add integration tests for no-match, missing-template, malformed-template, unresolved-variable, ambiguous-profile, traversal, unsupported-workspace, and missing-executable failures in `src/test/integration/debug-launch-failures.integration.test.ts`

### Implementation for User Story 3

- [ ] T022 [P] [US3] Implement explicit debug failure logging for no-match, ambiguous-profile, unsupported-workspace, template, variable, and missing-executable errors in `src/commands/debug-launch.ts` and `src/observability/log-channel.ts`
- [ ] T023 [US3] Surface blocked-launch errors for no-match, unsupported-workspace, missing-executable, and invocation-time template failures from visible Start Debugging actions in `src/extension.ts` and `src/ui/configuration-tree.ts`

**Checkpoint**: All user stories are independently functional, and blocked debug launches fail visibly with persistent logs.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final regression coverage, scope validation, and quickstart verification across the completed slice.

- [ ] T024 [P] Expand manifest regression coverage for valid and invalid `debug` entries in `src/test/unit/manifest/validate-manifest.test.ts`
- [ ] T025 [P] Verify Debug Launch scope boundaries and command or menu contributions in `src/test/integration/configuration-scope.integration.test.ts` and `src/test/integration/debug-launch.integration.test.ts`
- [ ] T026 Validate end-to-end Debug Launch scenarios from `specs/006-debug-launch/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion; blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational completion.
- **User Story 2 (Phase 4)**: Depends on Foundational completion and reuses the executable-resolution helpers from Phase 2.
- **User Story 3 (Phase 5)**: Depends on Foundational completion and builds on the command and visible-surface behavior delivered in User Stories 1 and 2.
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational and delivers the MVP.
- **User Story 2 (P2)**: Can start after Foundational, but it integrates best after User Story 1 introduces the public Start Debugging command surface.
- **User Story 3 (P3)**: Depends on User Story 1 for the launch path and on User Story 2 for the visible action-state contract.

### Within Each User Story

- Tests must be written and fail before implementation begins.
- Manifest and executable-state helpers come before menu and tree wiring.
- Menu contributions come before extension wiring that depends on their context keys.
- Invocation-time template failures must remain separated from pre-invocation enablement logic.
- Logging and explicit blocked-start messaging must be complete before the story is marked done.

### Parallel Opportunities

- `T002` and `T003` can run in parallel after `T001`.
- `T005`, `T006`, `T008`, and `T009` can run in parallel after `T004`, with `T007` depending on `T006`.
- `T010` and `T011` can run in parallel for User Story 1.
- `T012` can run in parallel with `T013` for User Story 1 before `T014`.
- `T015` and `T016` can run in parallel for User Story 2.
- `T017` and `T018` can run in parallel for User Story 2 before `T019`.
- `T020` and `T021` can run in parallel for User Story 3.
- `T022` can proceed in parallel with log assertion refinements in `T021` before `T023`.
- `T024` and `T025` can run in parallel during Polish before `T026`.

---

## Parallel Example: User Story 1

```bash
# Launch the User Story 1 tests together:
Task: "T010 Add unit tests for profile matching, priority selection, relative and absolute executable resolution, and tf-tools substitution in src/test/unit/workflow/debug-launch.test.ts"
Task: "T011 Add integration tests for successful Start Debugging launch from the header, overflow, Executable row, and Command Palette in src/test/integration/debug-launch.integration.test.ts"

# Launch the core implementation together:
Task: "T012 Contribute the tfTools.startDebugging command and Command Palette visibility rule in package.json"
Task: "T013 Implement JSONC template resolution, tf-tools variable application, and vscode.debug.startDebugging launch flow in src/commands/debug-launch.ts"
```

---

## Parallel Example: User Story 2

```bash
# Launch the User Story 2 tests together:
Task: "T015 Add unit tests for Executable artifact status, missing-reason messaging, tooltip content, and tree-row disabled-state behavior in src/test/unit/workflow/intellisense-artifact-resolution.test.ts and src/test/unit/ui/configuration-tree.test.ts"
Task: "T016 Add integration tests for Executable row rendering, header and overflow enablement, Command Palette hiding, and settings-driven availability refresh in src/test/integration/debug-launch-artifacts.integration.test.ts"

# Launch the core implementation together:
Task: "T017 Implement the Executable artifact row, tooltip text, and row context values in src/ui/configuration-tree.ts"
Task: "T018 Contribute header, overflow, and Executable-row Start Debugging menu entries with ordered enablement in package.json"
```

---

## Parallel Example: User Story 3

```bash
# Launch the User Story 3 tests together:
Task: "T020 Add unit tests for template-root traversal rejection, JSONC parse failures, unknown variables, and cyclic debug vars in src/test/unit/workflow/debug-template-resolution.test.ts"
Task: "T021 Add integration tests for missing-template, malformed-template, unresolved-variable, ambiguous-profile, traversal, and missing-executable failures in src/test/integration/debug-launch-failures.integration.test.ts"

# Launch the core implementation together:
Task: "T022 Implement explicit debug failure logging for profile-resolution, template, and variable errors in src/commands/debug-launch.ts and src/observability/log-channel.ts"
Task: "T023 Surface blocked-launch errors and invocation-time template-failure behavior from visible Start Debugging actions in src/extension.ts and src/ui/configuration-tree.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Validate User Story 1 independently before continuing.

### Incremental Delivery

1. Complete Setup and Foundational work to establish fixtures, typed manifest debug profiles, template-path resolution, substitution helpers, and executable artifact state.
2. Deliver User Story 1 for successful debug launch from every supported surface.
3. Deliver User Story 2 for executable readiness, tooltip accuracy, and disabled-but-visible Start Debugging actions.
4. Deliver User Story 3 for explicit failure handling and persistent debug-launch logging.
5. Finish with manifest regression checks, scope validation, and quickstart validation.

### Parallel Team Strategy

1. One developer can prepare fixtures and mocks while another adds the setting and manifest debug-profile scaffolding.
2. After the foundation is complete, one developer can focus on successful launch flow while another prepares Executable row and visibility tests.
3. Once the main command and row state are stable, failure-handling work and polish or regression tasks can proceed in parallel until quickstart validation.

---

## Notes

- `[P]` tasks touch different files and are safe to run in parallel.
- `[US1]`, `[US2]`, and `[US3]` map tasks back to individual user stories for traceability.
- The MVP scope is User Story 1.
- This task list intentionally keeps Debug Launch separate from Flash/Upload ownership, compile-commands integration, excluded-file surfaces, and any `launch.json` persistence.
- Complete and commit one task at a time; do not batch multiple tasks into a single commit.