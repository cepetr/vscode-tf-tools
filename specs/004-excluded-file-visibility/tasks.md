# Tasks: Excluded-File Visibility

**Input**: Design documents from `specs/004-excluded-file-visibility/`
**Prerequisites**: `plan.md` (required), `spec.md` (required for user stories), `research.md`, `data-model.md`, `contracts/`, `quickstart.md`
**Informal Spec Slice**: `4. Excluded-File Visibility`
**Scope Guard**: Tasks in this file stay within the Excluded-File Visibility slice. They cover excluded-file matching, Explorer badges and optional graying, editor overlays, settings-driven scope evaluation, refresh wiring, and stale-state clearing. They do not implement new compile-commands parsing rules, cpptools provider behavior, compile-commands artifact UI changes, build or artifact actions, Flash/Upload, Debug, alternate providers, or multi-root behavior.

**Tests**: Automated unit and integration tests are required for every user story. Integration coverage is included wherever the work touches VS Code file decorations, editor decorations, settings changes, serialized refresh behavior, or implementation-sensitive UI state.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently.

**Slice Rule**: Include only work that belongs to the Excluded-File Visibility slice.

**Critical Detail Rule**: This file includes explicit tasks for the easy-to-miss behaviors from `spec.md` and `plan.md`: basename-only filename matching, case-sensitive evaluation, absolute and workspace-relative folder globs, `/`-separator normalization, empty-scope disabling, `✗` Explorer badges, optional graying, optional first-line editor overlays, reuse of the existing `Trezor: Refresh IntelliSense` command, and clearing stale markers whenever the active compile-database payload changes or disappears.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare dependencies, settings contributions, fixtures, and shared test seams for excluded-file visibility work.

- [X] T001 Add the `minimatch` dependency and contribute `tfTools.excludedFiles.grayInTree`, `tfTools.excludedFiles.showEditorOverlay`, `tfTools.excludedFiles.fileNamePatterns`, and `tfTools.excludedFiles.folderGlobs` in `package.json`
- [X] T002 [P] Add excluded-file manifest and workspace fixtures under `test-fixtures/manifests/excluded-files-valid/` and `test-fixtures/workspaces/excluded-files-scope/`
- [X] T003 [P] Extend shared VS Code mocks and workflow test helpers for file decorations, editor decorations, and excluded-file payload fixtures in `src/test/unit/vscode-mock.ts`, `src/test/unit/workflow-test-helpers.ts`, and `src/test/integration/index.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish shared settings, state, and adapter scaffolding required before any user story can be implemented.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T004 Add excluded-file settings readers and normalized scope helpers in `src/workspace/settings.ts`
- [X] T005 [P] Create the excluded-file matching and snapshot service in `src/intellisense/excluded-files-service.ts`
- [X] T006 [P] Extend IntelliSense runtime types and refresh outputs for excluded-file consumers in `src/intellisense/intellisense-types.ts` and `src/intellisense/intellisense-service.ts`
- [X] T007 [P] Create shared Explorer and editor adapter scaffolding in `src/ui/excluded-file-decorations.ts` and `src/ui/excluded-file-overlays.ts`

**Checkpoint**: Excluded-file settings, matching state, and UI adapter scaffolding are ready; user stories can now proceed.

---

## Phase 3: User Story 1 - See Excluded Files In The Explorer (Priority: P1) 🎯 MVP

**Goal**: Show excluded files in the Explorer with the required `✗` badge and optional graying, limited strictly to files outside the active compile-database inclusion set and inside the configured basename and folder scope.

**Independent Test**: Activate the extension with a valid active compile-database payload, open the Explorer, and verify that omitted in-scope files show the `✗` badge, included files do not, out-of-scope files do not, basename-only matching ignores subpath globbing, and `tfTools.excludedFiles.grayInTree` toggles gray coloring without removing the badge.

### Tests for User Story 1 ⚠️

> **NOTE: Write these tests first and ensure they fail before implementation.**

- [X] T008 [P] [US1] Add unit tests for basename-only matching, case-sensitive evaluation, `/`-separator normalization, absolute and workspace-relative folder globs, and empty-scope disabling in `src/test/unit/workflow/excluded-files-service.test.ts`
- [X] T009 [P] [US1] Add integration tests for Explorer `FileDecorationProvider` badge, tooltip, and optional gray color behavior in `src/test/integration/excluded-file-visibility.integration.test.ts`

### Implementation for User Story 1

- [X] T010 [P] [US1] Implement basename-only, case-sensitive excluded-file matching and normalized snapshot generation in `src/intellisense/excluded-files-service.ts`
- [X] T011 [P] [US1] Implement Explorer `FileDecorationProvider` badge, tooltip, and optional gray color behavior in `src/ui/excluded-file-decorations.ts`
- [X] T012 [US1] Register Explorer excluded-file decorations and connect `tfTools.excludedFiles.grayInTree`, `tfTools.excludedFiles.fileNamePatterns`, and `tfTools.excludedFiles.folderGlobs` to refresh handling in `src/extension.ts`

**Checkpoint**: User Story 1 is fully functional and independently testable from the Explorer.

---

## Phase 4: User Story 2 - See Excluded Status Inside Open Editors (Priority: P2)

**Goal**: Show an optional first-line warning overlay in open excluded files and clear it immediately when the file becomes included or the overlay preference is disabled.

**Independent Test**: Open included and excluded files under the active configuration and verify that only excluded files show the first-line warning overlay and hover text while `tfTools.excludedFiles.showEditorOverlay` is enabled, and that toggling the setting removes and restores the overlay without restart.

### Tests for User Story 2 ⚠️

- [X] T014 [P] [US2] Add unit tests for editor overlay state selection and clearing behavior in `src/test/unit/ui/excluded-file-overlays.test.ts`
- [X] T015 [P] [US2] Extend integration coverage for first-line overlay rendering, hover text, and `tfTools.excludedFiles.showEditorOverlay` toggling in `src/test/integration/excluded-file-visibility.integration.test.ts`

### Implementation for User Story 2

- [ ] T016 [P] [US2] Implement the first-line excluded-file overlay manager and hover messaging in `src/ui/excluded-file-overlays.ts`
- [ ] T017 [ ] [US2] Extend excluded-file snapshot consumption for visible editors in `src/intellisense/excluded-files-service.ts` and `src/ui/excluded-file-overlays.ts`
- [ ] T018 [US2] Wire editor overlay lifecycle and `tfTools.excludedFiles.showEditorOverlay` refresh handling in `src/extension.ts`

**Checkpoint**: User Stories 1 and 2 both work independently, and excluded status is visible in the Explorer and editors.

---

## Phase 5: User Story 3 - Keep Excluded Markers In Sync With Context Changes (Priority: P3)

**Goal**: Recompute and clear excluded-file markers automatically when the active build context, active compile-database payload, workspace state, or excluded-file settings change.

**Independent Test**: Start from visible excluded-file markers, then change active model, target, or component, change excluded-file settings, trigger `Trezor: Refresh IntelliSense`, and simulate payload loss to verify stale Explorer badges and editor overlays are removed and the final state matches the latest active configuration.

### Tests for User Story 3 ⚠️

- [ ] T019 [P] [US3] Add unit tests for excluded-file refresh requests, payload-loss clearing, and latest-state snapshot updates in `src/test/unit/workflow/excluded-files-refresh.test.ts`
- [ ] T020 [P] [US3] Add integration tests for active-config refresh, settings-driven refresh, manual refresh reuse, workspace-change refresh, and stale-state clearing in `src/test/integration/excluded-file-refresh.integration.test.ts`

### Implementation for User Story 3

- [ ] T021 [P] [US3] Publish excluded-file snapshots from the serialized IntelliSense refresh flow in `src/intellisense/intellisense-service.ts` and `src/intellisense/excluded-files-service.ts`
- [ ] T022 [P] [US3] Wire excluded-file refresh to the same serialized IntelliSense refresh rules and triggers, including manual refresh, activation, active-config, successful-build, workspace, manifest, `tfTools.artifactsPath`, and excluded-files setting changes, in `src/extension.ts` and `src/workspace/settings.ts`
- [ ] T023 [US3] Clear stale Explorer badges and editor overlays when the active compile-database payload changes or becomes unavailable in `src/ui/excluded-file-decorations.ts`, `src/ui/excluded-file-overlays.ts`, and `src/extension.ts`

**Checkpoint**: All user stories are independently functional and excluded-file visibility stays aligned with the latest active context.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final regression coverage, scope validation, and quickstart verification across the completed slice.

- [ ] T024 [P] Expand regression coverage for path-separator normalization, case-sensitive matching, and empty-scope disabling in `src/test/unit/workflow/excluded-files-service.test.ts` and `src/test/integration/excluded-file-refresh.integration.test.ts`
- [ ] T025 [P] Review settings and command contribution scope drift in `package.json` and `src/extension.ts`
- [ ] T026 Validate end-to-end excluded-file scenarios from `specs/004-excluded-file-visibility/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion; blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational completion.
- **User Story 2 (Phase 4)**: Depends on Foundational completion and reuses the excluded-file service plus adapter scaffolding from Phase 2.
- **User Story 3 (Phase 5)**: Depends on Foundational completion and integrates the Explorer and editor surfaces delivered by User Stories 1 and 2.
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational and delivers the MVP.
- **User Story 2 (P2)**: Depends on the shared excluded-file service from Phase 2 but remains independently testable once the overlay manager is implemented.
- **User Story 3 (P3)**: Depends on User Stories 1 and 2 because refresh synchronization must clear and update both Explorer badges and editor overlays.

### Within Each User Story

- Tests must be written and fail before implementation begins.
- Settings and matching primitives come before UI presentation wiring.
- UI adapters come before refresh orchestration that clears and updates them.
- Failure visibility and stale-state clearing must be complete before the story is marked done.

### Parallel Opportunities

- `T002` and `T003` can run in parallel after `T001`.
- `T005`, `T006`, and `T007` can run in parallel after `T004`.
- `T008` and `T009` can run in parallel for User Story 1.
- `T010` and `T011` can run in parallel for User Story 1 before `T012`.
- `T014` and `T015` can run in parallel for User Story 2.
- `T016` and `T017` can run in parallel for User Story 2 before `T018`.
- `T019` and `T020` can run in parallel for User Story 3.
- `T021` and `T022` can run in parallel for User Story 3 before `T023`.

---

## Parallel Example: User Story 1

```bash
# Launch the User Story 1 tests together:
Task: "T008 Add unit tests for basename-only matching, case-sensitive evaluation, /-separator normalization, absolute and workspace-relative folder globs, and empty-scope disabling in src/test/unit/workflow/excluded-files-service.test.ts"
Task: "T009 Add integration tests for Explorer FileDecorationProvider badge, tooltip, and optional gray color behavior in src/test/integration/excluded-file-visibility.integration.test.ts"

# Launch the core implementation together:
Task: "T010 Implement basename-only, case-sensitive excluded-file matching and normalized snapshot generation in src/intellisense/excluded-files-service.ts"
Task: "T011 Implement Explorer FileDecorationProvider badge, tooltip, and optional gray color behavior in src/ui/excluded-file-decorations.ts"
```

---

## Parallel Example: User Story 2

```bash
# Launch the User Story 2 tests together:
Task: "T014 Add unit tests for editor overlay state selection and clearing behavior in src/test/unit/ui/excluded-file-overlays.test.ts"
Task: "T015 Extend integration coverage for first-line overlay rendering, hover text, and tfTools.excludedFiles.showEditorOverlay toggling in src/test/integration/excluded-file-visibility.integration.test.ts"

# Launch the core implementation together:
Task: "T016 Implement the first-line excluded-file overlay manager and hover messaging in src/ui/excluded-file-overlays.ts"
Task: "T017 Extend excluded-file snapshot consumption for visible editors in src/intellisense/excluded-files-service.ts and src/ui/excluded-file-overlays.ts"
```

---

## Parallel Example: User Story 3

```bash
# Launch the User Story 3 tests together:
Task: "T019 Add unit tests for excluded-file refresh requests, payload-loss clearing, and latest-state snapshot updates in src/test/unit/workflow/excluded-files-refresh.test.ts"
Task: "T020 Add integration tests for active-config refresh, settings-driven refresh, manual refresh reuse, workspace-change refresh, and stale-state clearing in src/test/integration/excluded-file-refresh.integration.test.ts"

# Launch the refresh implementation together:
Task: "T021 Publish excluded-file snapshots from the serialized IntelliSense refresh flow in src/intellisense/intellisense-service.ts and src/intellisense/excluded-files-service.ts"
Task: "T022 Add activation, active-config, successful-build, workspace, manifest, tfTools.artifactsPath, and excluded-files setting triggers to excluded-file refresh wiring in src/extension.ts and src/workspace/settings.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Validate User Story 1 independently before continuing.

### Incremental Delivery

1. Complete Setup and Foundational work to establish excluded-file settings, matching, and adapter scaffolding.
2. Deliver User Story 1 for Explorer excluded-file visibility.
3. Deliver User Story 2 for editor overlay visibility.
4. Deliver User Story 3 for synchronized refresh and stale-state clearing.
5. Finish with regression coverage and quickstart validation.

### Parallel Team Strategy

1. One developer can prepare fixtures and mocks while another adds settings contributions.
2. After the foundation is complete, one developer can focus on the excluded-file matching service while another implements the Explorer adapter.
3. Once the matching service is stable, editor overlay work and refresh orchestration can proceed in parallel until final stale-state clearing is wired.

---

## Notes

- `[P]` tasks touch different files and are safe to run in parallel.
- `[US1]`, `[US2]`, and `[US3]` map tasks back to individual user stories for traceability.
- The MVP scope is User Story 1.
- This task list intentionally pins the excluded-file matching logic under `src/intellisense/excluded-files-service.ts` and keeps the presentation adapters under `src/ui/`.
- This task list intentionally rejects scope drift into compile-commands parsing changes, compile-commands artifact UI changes, build or artifact actions, Flash/Upload, Debug, alternate providers, and multi-root behavior.
- Complete and commit one task at a time; do not batch multiple tasks into a single commit.