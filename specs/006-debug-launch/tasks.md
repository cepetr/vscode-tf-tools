# Tasks: Debug Launch

**Input**: Design documents from `specs/006-debug-launch/`
**Prerequisites**: `plan.md` (required), `spec.md` (required for user stories), `research.md`, `data-model.md`, `contracts/`, `quickstart.md`
**Informal Spec Slice**: `6. Debug Launch`
**Scope Guard**: Tasks in this file stay within the Debug Launch slice. They cover component-scoped manifest `debug` parsing and validation, declaration-order first-match resolution, derived executable artifact handling, `tfTools.debug.templatesPath`, tf-tools substitution including `${tfTools.debugProfileName}`, the `Executable` row and its row action, the Configuration view header and overflow `Start Debugging` actions, Command Palette visibility, debug API launch, and debug-specific user feedback and output-channel logging. They do not include Build/Clippy/Check/Clean behavior, Flash/Upload execution, `Binary` and `Map File` ownership, compile-commands provider behavior, excluded-file visibility, multi-root support, or `launch.json` persistence.

**Tests**: Automated unit and integration tests are required for every user story. Regression coverage is included for manifest parsing, VS Code menu visibility, Configuration view state, output-channel logging, and invocation-time failure handling.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently.

**Slice Rule**: Include only work that belongs to the Debug Launch slice.

**Critical Detail Rule**: This task list includes explicit work for hard-cutover manifest validation, optional `component.debug[].when` match-all behavior, first-match declaration-order selection, derived `${tfTools.executable}` and `${tfTools.executablePath}` values, `${tfTools.debugProfileName}` substitution, invocation-time template loading, root-traversal rejection, nested single-pass tf-tools substitution, visible-but-disabled Start Debugging surfaces, Command Palette hiding for blocked contexts, executable tooltip messaging, and persistent debug-failure logging.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Refresh fixtures and shared test seams for the revised Debug Launch contract.

- [X] T001 Refresh the valid component-scoped debug manifest fixture in `test-fixtures/manifests/debug-launch-valid/tf-tools-manifest.yaml`
- [X] T002 [P] Refresh the invalid legacy-schema and validation-error manifest fixture in `test-fixtures/manifests/debug-launch-invalid/tf-tools-manifest.yaml`
- [X] T003 [P] Update the successful debug workspace fixture in `test-fixtures/workspaces/debug-launch-valid/tf-tools-manifest.yaml`, `test-fixtures/workspaces/debug-launch-valid/.vscode/settings.json`, and `test-fixtures/workspaces/debug-launch-valid/debug-templates/gdb-remote.json`
- [X] T004 [P] Update the failure-path debug workspace fixture in `test-fixtures/workspaces/debug-launch-failures/tf-tools-manifest.yaml`, `test-fixtures/workspaces/debug-launch-failures/.vscode/settings.json`, `test-fixtures/workspaces/debug-launch-failures/debug-templates/malformed-template.json`, and `test-fixtures/workspaces/debug-launch-failures/debug-templates/unknown-var-template.json`
- [X] T005 [P] Extend shared debug-launch test helpers for debug API spies, output-channel assertions, and settings refresh in `src/test/unit/vscode-mock.ts`, `src/test/unit/workflow-test-helpers.ts`, and `src/test/integration/index.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the schema, settings, and executable-state foundations required by every story.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T006 Add the `tfTools.debug.templatesPath` setting contribution and Start Debugging command metadata updates in `package.json`
- [X] T007 [P] Add debug templates-path setting helpers and refresh wiring support in `src/workspace/settings.ts`
- [X] T008 [P] Update debug-related manifest model types for component-scoped `debug[]` entries and target `executableExtension` in `src/manifest/manifest-types.ts`
- [X] T009 [P] Add unit coverage for component-scoped debug schema, optional `when`, and legacy-schema rejection in `src/test/unit/manifest/validate-manifest.test.ts`
- [X] T010 Parse and validate component-scoped debug entries, optional `when`, target `executableExtension`, and hard-cutover legacy-schema rejection in `src/manifest/validate-manifest.ts`
- [X] T011 [P] Rework shared executable artifact derivation for `<artifactName><artifactSuffix><executableExtension>` in `src/intellisense/artifact-resolution.ts`

**Checkpoint**: The manifest schema, templates-path setting, and executable derivation rules are ready for story work.

---

## Phase 3: User Story 1 - Launch The Correct Debug Profile (Priority: P1) 🎯 MVP

**Goal**: Launch the selected component's first matching debug entry with the derived executable and resolved template from every supported entry point.

**Independent Test**: Use a valid component-scoped debug manifest with a present derived executable and verify that the header action, overflow action, `Executable` row action, and Command Palette all launch the same resolved debug configuration.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests first and ensure they fail before implementation.**

- [X] T012 [P] [US1] Add unit tests for first-match declaration-order resolution, omitted-`when` match-all behavior, derived executable built-ins, and `${tfTools.debugProfileName}` substitution in `src/test/unit/workflow/debug-launch.test.ts`
- [X] T013 [P] [US1] Add unit tests for nested single-pass tf-tools substitution, non-tf-tools variable pass-through, and per-invocation template reload in `src/test/unit/workflow/debug-template-resolution.test.ts`
- [X] T014 [P] [US1] Add integration coverage for successful Start Debugging launch from the header, overflow, `Executable` row, and Command Palette in `src/test/integration/debug-launch.integration.test.ts`

### Implementation for User Story 1

- [X] T015 [US1] Implement first-match component debug resolution, built-in variable derivation, and debug configuration assembly in `src/commands/debug-launch.ts`
- [X] T016 [US1] Wire the `tfTools.startDebugging` command, active-context resolution, and `vscode.debug.startDebugging` launch flow in `src/extension.ts`
- [X] T017 [US1] Restrict Command Palette visibility for `tfTools.startDebugging` to startable contexts in `package.json`

**Checkpoint**: User Story 1 is independently functional and delivers the MVP launch path.

---

## Phase 4: User Story 2 - Understand Debug Availability Before Launch (Priority: P2)

**Goal**: Show executable readiness and Start Debugging availability clearly in the Configuration view and keep blocked contexts discoverable.

**Independent Test**: Switch between matching, no-match, and missing-executable contexts and verify `Executable` row status, tooltip text, visible action enablement, and Command Palette visibility update correctly.

### Tests for User Story 2 ⚠️

- [X] T018 [P] [US2] Add unit tests for executable artifact status, expected-path tooltip text, and blocked-reason messaging in `src/test/unit/workflow/intellisense-artifact-resolution.test.ts`
- [X] T019 [P] [US2] Add unit tests for `Executable` row placement, context values, and visible-but-disabled Start Debugging actions in `src/test/unit/ui/configuration-tree.test.ts`
- [X] T020 [P] [US2] Add integration coverage for `Executable` row rendering, header and overflow enablement, Command Palette hiding, and settings-driven refresh in `src/test/integration/debug-launch-artifacts.integration.test.ts`
- [X] T021 [P] [US2] Add dedicated integration coverage proving missing and malformed templates do not disable visible Start Debugging actions before invocation in `src/test/integration/debug-launch-artifacts.integration.test.ts`

### Implementation for User Story 2

- [X] T022 [US2] Derive executable artifact state, missing reasons, and startability snapshots from the selected component and target in `src/intellisense/artifact-resolution.ts`
- [X] T023 [US2] Render the always-present `Executable` row with tooltip detail, row action state, correct ordering, and template-failure-independent enablement in `src/ui/configuration-tree.ts`
- [X] T024 [US2] Wire Start Debugging context keys and refresh behavior for model, target, component, manifest, artifacts path, and templates path changes in `src/extension.ts` and `src/workspace/settings.ts`
- [X] T025 [US2] Contribute visible header, overflow, and `Executable` row Start Debugging menus with disabled-state enablement rules in `package.json`

**Checkpoint**: User Story 2 is independently functional from the Configuration view and Command Palette.

---

## Phase 5: User Story 3 - Diagnose Debug Launch Failures Quickly (Priority: P3)

**Goal**: Block invalid debug launches with explicit errors and persistent logs for template, variable, resolution, and executable failures.

**Independent Test**: Trigger missing-template, malformed-template, unknown-variable, cyclic-variable, traversal, no-match, and missing-executable failures and verify each blocked attempt shows a specific error and creates a persistent output-channel entry.

### Tests for User Story 3 ⚠️

- [X] T026 [P] [US3] Add unit tests for traversal rejection, malformed JSONC templates, unknown tf-tools variables, and cyclic debug vars in `src/test/unit/workflow/debug-template-resolution.test.ts`
- [X] T027 [P] [US3] Add integration coverage for no-match, missing-template, malformed-template, variable, traversal, missing-executable, unsupported-workspace, and manifest-invalid launch failures in `src/test/integration/debug-launch-failures.integration.test.ts`

### Implementation for User Story 3

- [X] T028 [US3] Implement invocation-time template loading failures, variable-resolution failures, unsupported-workspace handling, manifest-invalid handling, and explicit blocked-launch error creation in `src/commands/debug-launch.ts`
- [X] T029 [US3] Write persistent debug-launch failure logs for resolution, template, variable, executable, unsupported-workspace, and manifest-invalid failures in `src/commands/debug-launch.ts` and `src/observability/log-channel.ts`
- [X] T030 [US3] Surface blocked-launch behavior consistently across visible Start Debugging actions in `src/extension.ts` and `src/ui/configuration-tree.ts`

**Checkpoint**: All user stories are independently functional and failure paths are visible and diagnosable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Close regression gaps and validate the slice end to end.

- [X] T031 [P] Extend scope-regression coverage for Debug Launch command and menu boundaries, including no `launch.json` persistence, in `src/test/integration/configuration-scope.integration.test.ts`
- [X] T032 [P] Add end-to-end quickstart regression coverage for the revised Debug Launch scenarios in `src/test/integration/debug-launch-quickstart.integration.test.ts`
- [X] T033 Validate the manual Debug Launch scenarios in `specs/006-debug-launch/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion; blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational completion.
- **User Story 2 (Phase 4)**: Depends on Foundational completion and integrates cleanly after User Story 1 establishes the launch path.
- **User Story 3 (Phase 5)**: Depends on Foundational completion and builds on the launch and availability behavior from User Stories 1 and 2.
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Can start immediately after Foundational; this is the MVP.
- **User Story 2 (P2)**: Depends on Foundational and reuses the executable derivation and startability model introduced for User Story 1.
- **User Story 3 (P3)**: Depends on User Story 1 for launch execution and User Story 2 for visible blocked-state behavior.

### Within Each User Story

- Tests must be written and fail before implementation begins.
- Manifest and executable derivation helpers come before UI and menu wiring.
- Command Palette visibility stays separate from visible Configuration view actions.
- Template loading and parse validation remain invocation-time checks, not pre-enablement checks.
- Persistent logging must be complete before failure-path work is considered done.

### Parallel Opportunities

- `T002`, `T003`, `T004`, and `T005` can run in parallel.
- `T007`, `T008`, `T009`, and `T011` can run in parallel after `T006`, with `T010` depending on `T008` and `T009`.
- `T012`, `T013`, and `T014` can run in parallel for User Story 1.
- `T018`, `T019`, `T020`, and `T021` can run in parallel for User Story 2.
- `T026` and `T027` can run in parallel for User Story 3.
- `T031` and `T032` can run in parallel during Polish before `T033`.

---

## Parallel Example: User Story 1

```bash
# Launch the User Story 1 tests together:
Task: "T012 Add unit tests for first-match declaration-order resolution, omitted-when match-all behavior, derived executable built-ins, and tfTools.debugProfileName substitution in src/test/unit/workflow/debug-launch.test.ts"
Task: "T013 Add unit tests for nested single-pass tf-tools substitution, non-tf-tools variable pass-through, and per-invocation template reload in src/test/unit/workflow/debug-template-resolution.test.ts"
Task: "T014 Add integration coverage for successful Start Debugging launch from the header, overflow, Executable row, and Command Palette in src/test/integration/debug-launch.integration.test.ts"
```

---

## Parallel Example: User Story 2

```bash
# Launch the User Story 2 tests together:
Task: "T018 Add unit tests for executable artifact status, expected-path tooltip text, and blocked-reason messaging in src/test/unit/workflow/intellisense-artifact-resolution.test.ts"
Task: "T019 Add unit tests for Executable row placement, context values, and visible-but-disabled Start Debugging actions in src/test/unit/ui/configuration-tree.test.ts"
Task: "T020 Add integration coverage for Executable row rendering, header and overflow enablement, Command Palette hiding, and settings-driven refresh in src/test/integration/debug-launch-artifacts.integration.test.ts"
Task: "T021 Add dedicated integration coverage proving missing and malformed templates do not disable visible Start Debugging actions before invocation in src/test/integration/debug-launch-artifacts.integration.test.ts"
```

---

## Parallel Example: User Story 3

```bash
# Launch the User Story 3 tests together:
Task: "T026 Add unit tests for traversal rejection, malformed JSONC templates, unknown tf-tools variables, and cyclic debug vars in src/test/unit/workflow/debug-template-resolution.test.ts"
Task: "T027 Add integration coverage for no-match, missing-template, malformed-template, variable, traversal, missing-executable, unsupported-workspace, and manifest-invalid launch failures in src/test/integration/debug-launch-failures.integration.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Stop and validate the launch flow independently.

### Incremental Delivery

1. Complete Setup and Foundational work to establish the new schema, fixtures, settings, and executable derivation.
2. Deliver User Story 1 so Start Debugging launches correctly from every supported surface.
3. Deliver User Story 2 so readiness and blocked states are visible before launch.
4. Deliver User Story 3 so failure paths are explicit and logged.
5. Finish with scope regression and quickstart validation.

### Parallel Team Strategy

1. One developer can refresh fixtures and test helpers while another updates settings and manifest types.
2. After Foundational work completes, one developer can focus on launch flow while another prepares availability and tree-view assertions.
3. Failure-path logging and polish work can proceed in parallel once the main launch and availability behavior is stable.

---

## Notes

- `[P]` tasks touch different files and can run in parallel.
- `[US1]`, `[US2]`, and `[US3]` map tasks back to specific user stories.
- The suggested MVP scope is User Story 1.
- This file intentionally excludes Flash/Upload ownership, Build Workflow behavior, compile-commands integration, excluded-file features, and any backward-compatibility layer for the legacy debug schema.
