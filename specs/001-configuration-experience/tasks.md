# Tasks: Configuration Experience Root Sections Default Expansion

**Input**: Design documents from `/specs/001-configuration-experience/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md
**Informal Spec Slice**: `1. Configuration Experience`
**Scope Guard**: Tasks in this file stay within the Configuration Experience slice and only fix the default expanded state of the `Build Context`, `Build Options`, and `Build Artifacts` root sections. These tasks must not add Build Options interactivity, Build Artifacts commands, IntelliSense behavior, view-title actions, or any later-slice functionality.

**Tests**: Automated tests are required for this bugfix. Include regression coverage for the tree-item default state and integration coverage for initial Configuration view rendering because the change affects VS Code tree-view behavior.

**Organization**: Tasks are grouped by user story to keep the bugfix independently testable and traceable to the affected user-visible behavior.

**Slice Rule**: Include only work that belongs to the Configuration Experience slice.

**Critical Detail Rule**: Include explicit tasks for the root-section default expanded state, the immediate visibility of placeholder or status content, and the preservation of plain-text section headers without dedicated icons.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare the narrowed bugfix acceptance assets before code changes.

- [X] T001 Align the narrowed bugfix acceptance notes in `specs/001-configuration-experience/quickstart.md` and `specs/001-configuration-experience/contracts/vscode-contribution-contract.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the shared regression target for the root-section behavior before story work begins.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 Define the shared root-section regression expectations in `src/test/unit/ui/configuration-tree.test.ts` and `src/test/integration/configuration-health.integration.test.ts`

**Checkpoint**: Regression target is defined and story work can proceed.

---

## Phase 3: User Story 1 - See All Root Sections Immediately (Priority: P1) 🎯 MVP

**Goal**: Let the user open the Configuration view and immediately see `Build Context`, `Build Options`, and `Build Artifacts` without manually expanding any root section.

**Independent Test**: Launch the extension against valid, missing, and invalid manifest states and confirm all three root sections are expanded by default with their current-slice child content visible immediately.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T003 [P] [US1] Add unit tests for expanded-by-default root section items in `src/test/unit/ui/configuration-tree.test.ts`
- [X] T004 [P] [US1] Add integration tests for initially visible root section placeholder and status content in `src/test/integration/configuration-health.integration.test.ts`

### Implementation for User Story 1

- [X] T005 [US1] Update root `SectionItem` defaults so `Build Context`, `Build Options`, and `Build Artifacts` all render expanded in `src/ui/configuration-tree.ts`
- [X] T006 [US1] Preserve plain-text section headers and existing child rendering while applying the root expansion fix in `src/ui/configuration-tree.ts` and `src/test/unit/ui/configuration-tree.test.ts`

**Checkpoint**: User Story 1 should now be fully functional and testable independently.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and documentation consistency for the bugfix.

- [X] T007 Validate the narrowed quickstart scenarios against `src/test/unit/ui/configuration-tree.test.ts`, `src/test/integration/configuration-health.integration.test.ts`, and `specs/001-configuration-experience/quickstart.md`
- [X] T008 [P] Review the finished bugfix for scope compliance and remove any cross-slice drift in `src/ui/configuration-tree.ts` and `specs/001-configuration-experience/tasks.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion; blocks story implementation.
- **User Story 1 (Phase 3)**: Depends on Foundational completion.
- **Polish (Phase 4)**: Depends on User Story 1 completion.

### User Story Dependencies

- **User Story 1 (P1)**: Starts after the shared regression target is defined; no dependency on any other story.

### Within User Story 1

- Tests must be written and fail before implementation.
- Tree-item default state changes come before final regression validation.
- Root-section presentation must be fixed without altering later-slice behavior.

### Parallel Opportunities

- `T003` and `T004` can run in parallel after `T002`.
- `T007` can run in parallel with a review of `T008` after `T006` is complete.

---

## Parallel Example: User Story 1

```bash
# Launch both regression test tasks together:
Task: "Add unit tests for expanded-by-default root section items in src/test/unit/ui/configuration-tree.test.ts"
Task: "Add integration tests for initially visible root section placeholder and status content in src/test/integration/configuration-health.integration.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. **STOP and VALIDATE**: Confirm all three root sections are expanded by default for representative manifest states.

### Incremental Delivery

1. Align quickstart and contract expectations with the narrowed bugfix.
2. Add regression tests for root-section default state.
3. Implement the tree-provider fix.
4. Validate the quickstart and scope guard before closing the bugfix.

### Parallel Team Strategy

With multiple developers:

1. One developer updates the unit regression coverage while another adds the integration regression coverage after `T002`.
2. The implementation task starts once both failing tests capture the mismatch.
3. Final validation and scope review can split across two developers after implementation.

---

## Notes

- `[P]` tasks touch different files and can run in parallel safely.
- `[US1]` maps each story task to the user-visible bugfix outcome.
- This task list intentionally rejects scope drift into Build Workflow, Build Artifacts behavior, IntelliSense integration, excluded-file visibility, flash or upload actions, and debug launch.
- Verify the regression tests fail before implementing the code change.
- Complete and commit one task at a time; do not batch multiple tasks into one commit.