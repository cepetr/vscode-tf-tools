---

description: "Task list template for feature implementation"
---

# Tasks: [FEATURE NAME]

**Input**: Design documents from `specs/[###-feature-name]/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/
**Informal Spec Slice**: [Name the slice from spec.md and plan.md]
**Scope Guard**: [Tasks in this file stay within the selected slice; reject cross-slice scope creep]

**Tests**: Generate automated test tasks for every user story. Include regression coverage for bug fixes and integration coverage whenever the change crosses VS Code APIs, manifest parsing, task execution, diagnostics, persisted state, or implementation-sensitive UI/event-ordering behavior from the informal spec.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

**Slice Rule**: Include only tasks and stories that belong to the selected informal-spec slice.

**Critical Detail Rule**: Include explicit tasks for the critical informal-spec details named in spec.md and plan.md. Do not assume those details are covered implicitly by broader implementation tasks.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact workspace-relative file paths in descriptions

## Path Conventions

- **Extension project**: `src/` for runtime code, `src/test/` for automated tests, `test-fixtures/` for manifest/workspace fixtures
- Adjust paths if plan.md documents a different structure, but keep tests in-repo and runnable by automation

<!--
  ============================================================================
  IMPORTANT: The tasks below are SAMPLE TASKS for illustration purposes only.

  The /speckit.tasks command MUST replace these with actual tasks based on:
  - User stories from spec.md (with their priorities P1, P2, P3...)
  - Feature requirements from plan.md
  - Entities from data-model.md
  - Endpoints from contracts/

  Tasks MUST be organized by user story so each story can be:
  - Implemented independently
  - Tested independently
  - Delivered as an MVP increment

  DO NOT keep these sample tasks in the generated tasks.md file.
  ============================================================================
-->

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create extension project structure per implementation plan
- [ ] T002 Initialize TypeScript extension dependencies and scripts in package.json
- [ ] T003 [P] Configure linting, formatting, and type-checking
- [ ] T004 [P] Configure unit and VS Code integration test runners

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

Examples of foundational tasks (adjust based on your project):

- [ ] T005 Define shared extension state, configuration, and manifest models
- [ ] T006 [P] Implement manifest/config loading and validation infrastructure
- [ ] T007 [P] Set up diagnostics and output-channel logging infrastructure
- [ ] T008 [P] Register base commands, providers, or view wiring needed by all stories
- [ ] T009 Create reusable test fixtures for manifests and workspace scenarios

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - [Title] (Priority: P1) 🎯 MVP

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T010 [P] [US1] Add unit tests for [behavior] in src/test/unit/[name].test.ts
- [ ] T011 [P] [US1] Add integration test for [user journey] in src/test/integration/[name].test.ts

### Implementation for User Story 1

- [ ] T012 [P] [US1] Create [module] in src/core/[module].ts
- [ ] T013 [P] [US1] Create supporting view or command code in src/ui/[file].ts
- [ ] T014 [US1] Implement [service/behavior] in src/core/[service].ts (depends on T012, T013)
- [ ] T015 [US1] Wire [feature] through src/commands/[file].ts or src/extension.ts
- [ ] T016 [US1] Add validation and explicit failure handling
- [ ] T017 [US1] Add diagnostics and log output for user story 1 failure paths

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - [Title] (Priority: P2)

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

### Tests for User Story 2 ⚠️

- [ ] T018 [P] [US2] Add unit tests for [behavior] in src/test/unit/[name].test.ts
- [ ] T019 [P] [US2] Add integration test for [user journey] in src/test/integration/[name].test.ts

### Implementation for User Story 2

- [ ] T020 [P] [US2] Create supporting module in src/core/[module].ts
- [ ] T021 [US2] Implement [service/behavior] in src/core/[service].ts
- [ ] T022 [US2] Implement [feature] in src/ui/[file].ts or src/commands/[file].ts
- [ ] T023 [US2] Integrate with user story 1 components and extend diagnostics/logging if needed

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - [Title] (Priority: P3)

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

### Tests for User Story 3 ⚠️

- [ ] T024 [P] [US3] Add unit tests for [behavior] in src/test/unit/[name].test.ts
- [ ] T025 [P] [US3] Add integration test for [user journey] in src/test/integration/[name].test.ts

### Implementation for User Story 3

- [ ] T026 [P] [US3] Create supporting module in src/core/[module].ts
- [ ] T027 [US3] Implement [service/behavior] in src/core/[service].ts
- [ ] T028 [US3] Implement [feature] in src/ui/[file].ts or src/commands/[file].ts

**Checkpoint**: All user stories should now be independently functional

---

[Add more user story phases as needed, following the same pattern]

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] TXXX [P] Documentation updates in docs/ or specs/
- [ ] TXXX Code cleanup and refactoring
- [ ] TXXX Review identifier length and simplify unjustified abstractions
- [ ] TXXX [P] Expand automated test coverage for cross-story behavior in src/test/
- [ ] TXXX Validate diagnostics, logging, and failure messaging end to end
- [ ] TXXX Run quickstart.md validation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - May integrate with US1 but should be independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - May integrate with US1/US2 but should be independently testable

### Within Each User Story

- Tests (if included) MUST be written and FAIL before implementation
- Models before services
- Services before endpoints
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- All tests for a user story marked [P] can run in parallel
- Models within a story marked [P] can run in parallel
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together (if tests requested):
Task: "Contract test for [endpoint] in tests/contract/test_[name].py"
Task: "Integration test for [user journey] in tests/integration/test_[name].py"

# Launch all models for User Story 1 together:
Task: "Create [Entity1] model in src/models/[entity1].py"
Task: "Create [Entity2] model in src/models/[entity2].py"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1
   - Developer B: User Story 2
   - Developer C: User Story 3
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- State the selected informal-spec slice at the top of the file and reject scope drift into other slices
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Complete and commit one task at a time; do not batch multiple tasks into a
  single commit
- Implementation-phase commit subjects should use `T001: concise description`
  and only use interval prefixes such as `T002-T003:` for explicitly approved
  multi-task commits
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
