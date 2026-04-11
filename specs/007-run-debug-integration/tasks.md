# Tasks: Run And Debug Integration

**Input**: Design documents from `specs/007-run-debug-integration/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/run-debug-configurations.md`, `quickstart.md`
**Affected Product Areas**: `Workflow Actions`, `Build Artifacts`, `Start Debugging`, `command surface`, `debug profile`, `debug profile resolution`, `declaration order`
**Scope Guard**: Tasks in this file stay within Run and Debug integration for tf-tools-managed debugging, default-profile selection by declaration order, profile-specific Run and Debug entries, and aligned failure visibility. Reject unrelated changes to build workflows, artifact derivation rules, multi-root support, or user-managed `.vscode/launch.json` workflows.

**Tests**: Automated tests are required for every user story. Include unit coverage for matching/default logic and integration coverage for VS Code Run and Debug behavior, command surfaces, failure visibility, and no-`launch.json` persistence.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing where the feature architecture allows. User Story 2 and User Story 3 extend the Run and Debug provider baseline established by User Story 1.

**Scope Rule**: Include only tasks and stories that belong to the scoped feature change described by `spec.md` and `plan.md`.

**Critical Detail Rule**: Include explicit tasks for default-profile declaration-order behavior, invocation-time template failures, aligned executable readiness across surfaces, no-`launch.json` persistence, and consolidated product documentation updates.

## Phase 1: Setup (Shared Documentation And Fixtures)

**Purpose**: Align consolidated product docs and seed reusable fixtures for the feature scope

- [x] T001 Update `specs/product-spec.md` for Run and Debug surfaces, matching-profile sets, and default-profile behavior
- [x] T002 [P] Update `specs/glossary.md` for `debug profile resolution` and `declaration order` terminology changes

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared fixtures and helpers that all stories depend on

**⚠️ CRITICAL**: No user story work should begin until this phase is complete

- [ ] T003 [P] Extend matching-profile manifest fixtures in `test-fixtures/manifests/debug-launch-valid/tf-tools-manifest.yaml`
- [ ] T004 [P] Extend Run and Debug workspace fixtures in `test-fixtures/workspaces/debug-launch-valid/tf-tools-manifest.yaml`
- [ ] T005 Create shared debug-profile fixture helpers in `src/test/unit/workflow-test-helpers.ts`

**Checkpoint**: Foundation ready - debug provider and launch behavior can now be implemented and tested

---

## Phase 3: User Story 1 - Start The Default Debug Session With F5 (Priority: P1) 🎯 MVP

**Goal**: Expose a tf-tools-generated default Run and Debug entry for the active build context so F5 can start the default debug profile without `launch.json`

**Independent Test**: Select a tf-tools Run and Debug entry for a valid active build context and start it through Run and Debug or F5 without creating `.vscode/launch.json`

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests first and confirm they fail before implementation**

- [ ] T006 [P] [US1] Add unit tests for matching-set and default-profile resolution in `src/test/unit/workflow/debug-launch.test.ts`
- [ ] T007 [P] [US1] Add integration tests for the default Run and Debug entry and F5 launch path in `src/test/integration/run-debug-default.integration.test.ts`

### Implementation for User Story 1

- [ ] T008 [US1] Implement matching-set, default-profile, and launch-materialization helpers in `src/commands/debug-launch.ts`
- [ ] T009 [US1] Implement the tf-tools Run and Debug provider baseline in `src/debug/run-debug-provider.ts`
- [ ] T010 [US1] Register the Run and Debug provider lifecycle in `src/extension.ts`
- [ ] T011 [US1] Contribute proxy debug activation and compatibility metadata in `package.json`

**Checkpoint**: User Story 1 should support a default tf-tools Run and Debug entry, F5 launch, and no-`launch.json` persistence

---

## Phase 4: User Story 2 - Choose An Alternate Matching Debug Profile (Priority: P2)

**Goal**: Expose one profile-specific Run and Debug entry per matching debug profile while keeping direct `Start Debugging` bound to the default profile

**Independent Test**: Use a context with multiple matching profiles and verify that Run and Debug shows one default entry plus one entry per matching profile, then launch an alternate profile explicitly

### Tests for User Story 2 ⚠️

- [ ] T012 [P] [US2] Add unit tests for profile-specific generated entries and labels in `src/test/unit/workflow/debug-launch.test.ts`
- [ ] T013 [P] [US2] Add integration tests for multi-profile Run and Debug selection in `src/test/integration/run-debug-multiprofile.integration.test.ts`

### Implementation for User Story 2

- [ ] T014 [US2] Generate default and profile-specific Run and Debug entries in `src/debug/run-debug-provider.ts`
- [ ] T015 [US2] Surface matching-set metadata in executable readiness resolution in `src/intellisense/artifact-resolution.ts`
- [ ] T016 [US2] Keep direct `Start Debugging` bound to the default matching profile in `src/commands/debug-launch.ts`

**Checkpoint**: User Stories 1 and 2 should both work, with Run and Debug exposing alternate matching profiles while direct actions still use the default profile

---

## Phase 5: User Story 3 - Keep Availability And Failures Predictable Across Surfaces (Priority: P3)

**Goal**: Keep the `Configuration view`, Command Palette, and Run and Debug surfaces aligned on readiness while preserving invocation-time failure handling and explicit log output

**Independent Test**: Vary manifest validity, matching profiles, executable presence, stale selections, and template validity and verify that availability and failure behavior stay aligned across direct actions and Run and Debug launches

### Tests for User Story 3 ⚠️

- [ ] T017 [P] [US3] Add unit tests for stale-context rejection and invocation-time failure handling in `src/test/unit/workflow/debug-launch.test.ts`
- [ ] T018 [P] [US3] Add integration tests for blocked availability and provider-launched failure paths in `src/test/integration/run-debug-failures.integration.test.ts`

### Implementation for User Story 3

- [ ] T019 [US3] Reject stale Run and Debug entries during launch resolution in `src/debug/run-debug-provider.ts`
- [ ] T020 [US3] Align tree-view and Command Palette debug gating with generated configuration availability in `src/extension.ts`
- [ ] T021 [US3] Preserve invocation-time template and variable failure handling for provider launches in `src/commands/debug-launch.ts`
- [ ] T022 [US3] Extend provider-specific blocked-launch logging in `src/observability/log-channel.ts`

**Checkpoint**: All story surfaces should now agree on availability, stale entries should be rejected safely, and provider launches should preserve existing failure visibility rules

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final regression coverage, user-facing documentation, and end-to-end validation

- [ ] T023 [P] Update Run and Debug and F5 workflow guidance in `README.md`
- [ ] T024 [P] Expand no-`launch.json` persistence regression coverage in `src/test/integration/configuration-scope.integration.test.ts`
- [ ] T025 [P] Expand package contribution and command-surface regression coverage in `src/test/integration/debug-launch.integration.test.ts`
- [ ] T026 Run `specs/007-run-debug-integration/quickstart.md` validation scenarios
- [ ] T027 Run repository validation commands declared in `package.json`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - blocks all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational completion
- **User Story 2 (Phase 4)**: Depends on Foundational completion and extends the provider baseline created in User Story 1
- **User Story 3 (Phase 5)**: Depends on Foundational completion and the provider launch path created in User Story 1
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: No story dependency beyond Foundational; this is the MVP baseline
- **User Story 2 (P2)**: Builds on User Story 1's provider baseline to add profile-specific entries
- **User Story 3 (P3)**: Builds on User Story 1's provider baseline to align readiness and failure behavior; it does not require User Story 2 to validate blocked and stale-launch handling

### Within Each User Story

- Tests MUST be written and fail before implementation
- Shared launch/materialization helpers before provider registration
- Provider entry generation before surface wiring
- Surface wiring before final regression validation

### Parallel Opportunities

- T002 can run in parallel with T001
- T003 and T004 can run in parallel once Setup completes
- T006 and T007 can run in parallel
- T012 and T013 can run in parallel
- T017 and T018 can run in parallel
- T023, T024, and T025 can run in parallel after story work completes

---

## Parallel Example: User Story 1

```bash
# Run the User Story 1 tests in parallel:
Task: "Add unit tests for matching-set and default-profile resolution in src/test/unit/workflow/debug-launch.test.ts"
Task: "Add integration tests for the default Run and Debug entry and F5 launch path in src/test/integration/run-debug-default.integration.test.ts"
```

---

## Parallel Example: User Story 2

```bash
# Run the User Story 2 tests in parallel:
Task: "Add unit tests for profile-specific generated entries and labels in src/test/unit/workflow/debug-launch.test.ts"
Task: "Add integration tests for multi-profile Run and Debug selection in src/test/integration/run-debug-multiprofile.integration.test.ts"
```

---

## Parallel Example: User Story 3

```bash
# Run the User Story 3 tests in parallel:
Task: "Add unit tests for stale-context rejection and invocation-time failure handling in src/test/unit/workflow/debug-launch.test.ts"
Task: "Add integration tests for blocked availability and provider-launched failure paths in src/test/integration/run-debug-failures.integration.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Confirm Run and Debug shows the default tf-tools entry and F5 launches without `.vscode/launch.json`

### Incremental Delivery

1. Finish Setup + Foundational to align docs, fixtures, and helpers
2. Deliver User Story 1 for default Run and Debug / F5 support
3. Deliver User Story 2 for profile-specific Run and Debug entries
4. Deliver User Story 3 for aligned availability and failure behavior
5. Finish Polish with README, regression coverage, quickstart validation, and repository validation

### Parallel Team Strategy

1. One contributor updates consolidated docs while another prepares fixtures and helpers in Setup/Foundational
2. After Foundational completes:
   - Contributor A works on User Story 1 provider and baseline tests
   - Contributor B prepares User Story 2 multi-profile tests and fixture extensions
   - Contributor C prepares User Story 3 failure-path tests and logging assertions

---

## Notes

- `[P]` tasks touch different files and can run in parallel after their dependencies are satisfied
- `[US1]`, `[US2]`, and `[US3]` labels map tasks directly to the user stories in `spec.md`
- Keep all work inside the scoped Run and Debug integration change; do not broaden into unrelated workflow or artifact behavior
- Preserve manifest authority, explicit failure visibility, and no-`launch.json` persistence throughout implementation