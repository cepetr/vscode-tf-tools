# Feature Specification: Configuration Experience

**Feature Branch**: `001-configuration-experience`
**Created**: 2026-04-03
**Status**: Draft
**Input**: User description: "Specify the first feature (Configuration Experience) from feature-split.md document."

## Informal Spec Alignment *(mandatory)*

- **Source Documents**: `informal_spec/user-spec.md`, `informal_spec/tech-spec.md`, `informal_spec/feature-split.md`
- **Selected Slice**: `1. Configuration Experience`
- **Scope Guard**: This feature includes manifest discovery, manifest validation feedback, the configuration activity-bar surface, build-context selection for model/target/component, workspace-scoped persistence and normalization of the active selection, status-bar visibility of the active selection, and persistent diagnostics/log output for configuration-related failures. This feature does not expose `Build Options` behavior, `Build Artifacts` behavior, or `Build` and `Debug` view-title actions. This feature explicitly excludes build, clippy, check, clean, build-option editing, `when` handling, build-artifact status evaluation, IntelliSense integration, excluded-file visibility, flash/upload actions, and debug launch.

## Clarifications

### Session 2026-04-03

- Q: What exact format should the status-bar item use for the active configuration? → A: `{model-name} | {target-display} | {component-name}`.
- Q: Should this feature expose `Build` or `Debug` actions in the view title bar? → A: No. This feature does not expose `Build` or `Debug` view-title actions.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Inspect Workspace Configuration Health (Priority: P1)

As a firmware developer, I want to open the extension and immediately see whether the workspace manifest is available and valid so I can trust the available configuration choices before I start working.

**Why this priority**: Without a trustworthy manifest state, every later action is ambiguous. This is the minimum viable slice because it gives the user immediate visibility into whether the extension can operate.

**Independent Test**: Open a workspace with a valid, missing, and invalid manifest in separate runs; confirm the configuration surface shows the correct state and that validation problems remain inspectable after notifications disappear.

**Acceptance Scenarios**:

1. **Given** a workspace with a valid manifest, **When** the extension loads, **Then** the configuration view shows selectable model, target, and component values derived from that manifest.
2. **Given** a workspace where the manifest file is missing, **When** the extension loads, **Then** the configuration view shows a warning state instead of stale selectors and the failure is recorded in persistent logs.
3. **Given** a workspace with invalid manifest content, **When** the extension loads or the manifest is edited, **Then** the user can inspect validation problems from persistent diagnostics and the configuration view does not present invalid choices.

---

### User Story 2 - Choose Active Build Context (Priority: P2)

As a firmware developer, I want to choose the active model, target, and component from the extension UI so the workspace reflects the build context I am currently working in.

**Why this priority**: Once the manifest state is reliable, selection is the core configuration action the extension must support.

**Independent Test**: With a valid manifest, change each selector from the configuration view and confirm the active values update immediately and remain constrained to values defined by the manifest.

**Acceptance Scenarios**:

1. **Given** a valid manifest with multiple models, targets, and components, **When** the user changes one selector, **Then** the extension records the new active value and keeps the other active values valid.
2. **Given** a valid manifest, **When** the user expands a selector, **Then** the extension shows only the values defined for that selector and clearly indicates the currently selected value.
3. **Given** saved configuration values that are no longer present in the manifest, **When** the extension restores workspace state, **Then** it replaces invalid values with valid defaults instead of leaving the workspace in a broken state.

---

### User Story 3 - Recover My Context After Reload (Priority: P3)

As a firmware developer, I want the chosen configuration to remain visible after I reload the window so I can resume work without reselecting the same build context.

**Why this priority**: Persistence and visibility reduce friction, but they depend on the core loading and selection behaviors already working.

**Independent Test**: Select a model, target, and component, reload the workspace, and confirm the same valid selection is restored and shown in the configuration view and status bar.

**Acceptance Scenarios**:

1. **Given** a valid active selection, **When** the user reloads the workspace, **Then** the extension restores the same selection if it is still valid.
2. **Given** status-bar visibility is enabled, **When** the active selection changes, **Then** the status bar updates without requiring a reload and shows the text `{model-name} | {target-display} | {component-name}` for the current selection.
3. **Given** status-bar visibility is enabled, **When** the user activates the status-bar item, **Then** the extension reveals the configuration view so the user can adjust the selection.

### Edge Cases

- The manifest file appears after the extension started with no manifest present.
- The manifest changes while the user has a saved selection that is now partially invalid.
- The manifest is syntactically valid YAML but structurally invalid for required configuration fields.
- The workspace contains only one valid value for a selector and the user still needs to understand what is active.
- The status-bar surface is disabled after previously being enabled.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST resolve the workspace configuration manifest from the configured manifest path and treat that file as the source of truth for available model, target, and component selections.
- **FR-002**: The system MUST classify manifest state as valid, missing, or invalid each time the extension loads or the manifest changes.
- **FR-003**: The system MUST present a dedicated configuration view in the extension activity-bar container for this feature slice.
- **FR-004**: The configuration view MUST show build-context selectors for model, target, and component when the manifest state is valid.
- **FR-005**: The configuration view MUST show a warning state instead of selectable values when the manifest is missing or invalid.
- **FR-006**: Users MUST be able to select exactly one active model, one active target, and one active component from values defined by the current manifest.
- **FR-007**: The system MUST persist the active model, target, and component per workspace and restore them on the next session.
- **FR-008**: When restored values are absent from the current manifest, the system MUST replace them with valid manifest-defined defaults and discard invalid persisted values.
- **FR-009**: The system MUST keep the configuration view synchronized with manifest changes so stale choices are not shown after the manifest is updated.
- **FR-010**: The system MUST provide a status-bar surface for the active configuration when that surface is enabled in workspace settings.
- **FR-011**: The status-bar surface MUST display the active configuration in the format `{model-name} | {target-display} | {component-name}` and update whenever the active selection changes.
- **FR-012**: Activating the status-bar surface MUST reveal the configuration view.
- **FR-013**: The system MUST produce persistent diagnostics for actionable manifest validation problems so users can inspect them after transient notifications disappear.
- **FR-014**: The system MUST record configuration-related runtime warnings and errors in a dedicated persistent log surface.
- **FR-015**: The system MUST fail visibly when the manifest is missing, unreadable, or invalid by combining immediate user feedback with at least one persistent signal.
- **FR-016**: The configuration view for this feature MUST not expose `Build` or `Debug` actions in the view title bar.
- **FR-017**: This feature MUST not expose build execution, build-option behavior, `when` handling, build-artifact status evaluation, IntelliSense state, excluded-file markers, flash/upload actions, or debug launch controls.
- **FR-018**: The configuration tree MUST use the following VS Code theme icons in this slice: `symbol-folder` for `Build Context` and `Build Options`, `info` for `Build Artifacts`, `circuit-board` for the `Model` selector, `target` for the `Target` selector, and `extensions` for the `Component` selector.
- **FR-019**: Expanded selector choice rows in this slice MUST rely on selection state rather than dedicated semantic inactive icons; the active choice may use a `check` icon, and inactive choices MUST render with an empty spacer icon so choice labels remain aligned.

### Key Entities *(include if feature involves data)*

- **Manifest State**: The current availability and validity state of the workspace manifest, including whether it is valid, missing, or invalid and any associated validation problems.
- **Active Configuration**: The workspace-scoped selection of one model, one target, and one component currently chosen from the manifest.
- **Validation Issue**: A user-inspectable problem tied to the manifest content or structure that explains why configuration choices cannot be trusted.

## Operational Constraints *(mandatory)*

- Supported host/version: VS Code 1.110+.
- Source of truth inputs: Workspace settings, the manifest file, and workspace-scoped persisted selection state.
- Workspace assumptions: Single-root workspace only.
- Compatibility exclusions: Multi-root workspaces, alternate manifest sources, and silent fallback to hardcoded configuration values are out of scope.

## Failure Modes & Diagnostics *(mandatory)*

- **Trigger**: Manifest file is missing or unreadable.
  - **User-visible response**: The configuration view shows a warning state and the user receives a visible error or warning message.
  - **Persistent signal**: Dedicated log entry.
- **Trigger**: Manifest content is invalid or incomplete.
  - **User-visible response**: The configuration view withholds invalid selectors and the user receives visible failure feedback.
  - **Persistent signal**: Diagnostics for actionable manifest problems and a dedicated log entry.
- **Trigger**: Persisted selection values no longer exist in the manifest.
  - **User-visible response**: The extension replaces stale selections with valid defaults instead of leaving an unusable state.
  - **Persistent signal**: Dedicated log entry describing normalization.
- **Trigger**: Configuration status-bar visibility is disabled.
  - **User-visible response**: The status-bar surface disappears while the configuration view remains available.
  - **Persistent signal**: No additional persistent signal required.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In usability validation with representative workspaces, 95% of users can determine within 30 seconds whether the manifest is valid, missing, or invalid.
- **SC-002**: In usability validation with representative workspaces, 90% of users can change the active model, target, and component from the configuration surface in under 1 minute without external instructions.
- **SC-003**: In reload validation across representative workspaces, 100% of valid saved selections are restored after workspace reload and 100% of invalid saved selections are normalized to valid choices.
- **SC-004**: In validation testing with malformed manifests, 100% of actionable manifest errors remain inspectable through persistent diagnostics or logs after initial notifications disappear.

## Assumptions

- Users work in a single firmware workspace at a time.
- The manifest provides at least one valid model, target, and component whenever it is considered valid.
- The first valid value for each selector is the default fallback when saved values can no longer be restored.
- Workspace settings already provide the manifest path and status-bar visibility preference needed by this feature.
