# Feature Specification: Build Workflow

**Feature Branch**: `002-build-workflow`
**Created**: 2026-04-03
**Status**: Draft
**Input**: User description: "Specify the second feature (Build Workflow) from feature-split.md document."

## Informal Spec Alignment *(mandatory)*

- **Source Documents**: `informal_spec/user-spec.md`, `informal_spec/tech-spec.md`, `informal_spec/feature-split.md`
- **Selected Slice**: `2. Build Workflow`
- **Scope Guard**: This feature includes manifest-driven Build Options rendering and selection, `when` parsing/validation/evaluation against the active model/target/component, task and command execution for `Build`, `Clippy`, `Check`, and `Clean`, dynamic task labels, command argument derivation from the effective configuration, and Configuration view title actions with `Build` as the primary header action while `Build`, `Clippy`, `Check`, and `Clean` are also available from the overflow menu. This feature excludes Build Artifacts section behavior, artifact-status refresh, Flash/Upload actions, Debug launch, IntelliSense integration, compile-commands refresh behavior, and excluded-file visibility.
- **Critical Informal Details**: Build Options must become user-operable rather than placeholder-only; only options whose `when` logic matches the active build context may influence the UI or effective command arguments; any invalid build-option `when` expression makes the manifest unreliable for Build Workflow and blocks `Build`, `Clippy`, and `Check` until the manifest is fixed; `Build`, `Clippy`, and `Check` must expose context-aware labels so users can tell what will run before starting a task; `Clean` remains part of the workflow but does not depend on effective build-option arguments; the user-facing workflow command titles are `Trezor: Build`, `Trezor: Run Clippy`, `Trezor: Run Check`, and `Trezor: Run Clean`; `Build` uses the VS Code `tools` codicon; `Build` stays as the primary header action in the Configuration view and also appears in the overflow menu; `Run Clippy`, `Run Check`, and `Run Clean` remain in the view overflow menu; and `Refresh IntelliSense` stays after those Build Workflow entries as the last overflow item.

## Clarifications

### Session 2026-04-03

- Q: How should invalid build-option `when` expressions affect workflow execution? → A: Any invalid build-option `when` expression makes the manifest invalid for Build Workflow, so `Build`, `Clippy`, and `Check` are blocked until fixed.
- Q: How should blocked workflow actions appear in the Configuration view title area? → A: `Build` remains visible in the primary header and also remains visible in the overflow menu, while `Run Clippy`, `Run Check`, and `Run Clean` remain visible in the overflow menu, and blocked actions are disabled when prerequisites are not met.
- Q: What counts as an unsupported workspace for Build Workflow? → A: Any workspace with no open folder or with more than one open workspace folder is unsupported for Build Workflow.
- Q: How should `Clean` behave when the workspace is supported but the manifest is missing or invalid? → A: `Clean` still ignores active build-option arguments, but it is blocked when the manifest is missing or invalid so the workflow surface stays disabled for broken manifest state.
- Q: Where should the Build Workflow commands appear in the Configuration view title area? → A: `Build` stays in the primary header and also appears in the overflow menu, while `Run Clippy`, `Run Check`, and `Run Clean` remain in the overflow menu.
- Q: What user-facing titles should the overflow workflow commands use? → A: Use `Run Clippy`, `Run Check`, and `Run Clean`.
- Q: Which icon should the Build command use? → A: Use the VS Code `tools` codicon.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configure Effective Build Options (Priority: P1)

As a firmware developer, I want the Build Options section to show only the options that apply to my active model, target, and component so I can prepare the correct effective build configuration without guessing which toggles matter.

**Why this priority**: Build Options are the first new user-visible capability in this slice. Without trustworthy option visibility and selection behavior, later build actions would run with unclear or incorrect intent.

**Independent Test**: Load a manifest containing checkbox and multistate options with mixed grouping and `when` rules, switch active build context values, and confirm the visible options, selected values, and preserved hidden values match the effective context.

**Acceptance Scenarios**:

1. **Given** a valid manifest with grouped and ungrouped options, **When** the Configuration view opens, **Then** the Build Options section shows options in manifest declaration order, preserving group headings and option ordering.
2. **Given** a checkbox option whose availability rule matches the active build context, **When** the user toggles it, **Then** the effective configuration updates immediately and the selected state persists for that workspace.
3. **Given** a multistate option with a default state, **When** the user chooses a non-default state, **Then** the active state is shown inline and remains selected until the user changes it or the manifest no longer supports it.
4. **Given** an option whose availability rule becomes false after the user changes model, target, or component, **When** the tree refreshes, **Then** the option disappears from the visible list, contributes no effective build arguments, and its last selected value is retained for later reuse if the option becomes available again.

---

### User Story 2 - Launch Build Tasks From The Active Context (Priority: P2)

As a firmware developer, I want to run Build, Clippy, Check, and Clean directly from VS Code so I can execute the standard workflow without manually reconstructing command arguments in a terminal.

**Why this priority**: Once the effective configuration is visible and editable, executing the workflow from that configuration is the next direct source of user value.

**Independent Test**: With a valid manifest and active configuration, invoke each of the four actions from the Configuration view and from standard task entry points, then verify the launched task names and action availability reflect the current build context.

**Acceptance Scenarios**:

1. **Given** a valid active configuration, **When** the user starts `Build`, **Then** VS Code launches a build task whose label identifies the active model, target display name, and component.
2. **Given** the same active configuration, **When** the user starts `Clippy` or `Check`, **Then** each action launches its own task with the same effective configuration as `Build` and with a label that identifies the same active context.
3. **Given** a supported workspace with a valid manifest, **When** the user starts `Clean`, **Then** VS Code launches the `Clean` task without depending on build-option selections.
4. **Given** a supported workspace whose manifest is missing or invalid, **When** the user starts `Clean`, **Then** the action does not start and the user receives visible failure feedback because Build Workflow is blocked by broken manifest state.
5. **Given** the Configuration view is visible, **When** the user looks at the view title area, **Then** `Build` appears as the primary header action, `Build`, `Run Clippy`, `Run Check`, and `Run Clean` are available from the overflow menu, and `Refresh IntelliSense` appears after them as the last overflow item when present, with each action matching the currently active build context when runnable and remaining visible but disabled when prerequisites are not met.

---

### User Story 3 - Trust Derived Arguments And Failures (Priority: P3)

As a firmware developer, I want build actions to derive their arguments from the current effective configuration and to fail clearly when prerequisites are missing so I can trust what was attempted and correct problems quickly.

**Why this priority**: Users need confidence that task labels correspond to the actual command context and that failures are specific enough to recover from.

**Independent Test**: Run Build, Clippy, and Check across different combinations of model, target, component, and Build Options, then verify the launched workflow uses the effective configuration and surfaces visible errors when the manifest, availability rules, or workspace constraints block execution.

**Acceptance Scenarios**:

1. **Given** a valid active configuration with enabled options, **When** the user starts `Build`, `Clippy`, or `Check`, **Then** the launched action derives its effective arguments from the selected model, target, component, and currently applicable build options.
2. **Given** the manifest is missing, invalid, or contains any invalid build-option availability rule, **When** the user attempts `Build`, `Clippy`, or `Check`, **Then** the action does not start and the user receives a visible error plus a persistent failure record.
3. **Given** a workspace with no open folder or with more than one open workspace folder, **When** the user attempts any build action, **Then** the action does not start and the failure explains that the workspace is unsupported.
4. **Given** a supported workspace whose manifest is missing or invalid, **When** the user attempts `Clean`, **Then** the action does not start and the user receives visible failure feedback because Build Workflow is blocked by broken manifest state.
5. **Given** a build action starts and later fails, **When** the task finishes unsuccessfully, **Then** the user receives a visible failure message and no out-of-scope post-build refresh behavior is triggered by this feature.

### Edge Cases

- An option changes from visible to hidden because the active model, target, or component changed after the user selected a value.
- A manifest contains an invalid `when` expression for a build option, preventing reliable option gating.
- Multiple build-option groups are interleaved in the manifest and must still preserve first-seen group order.
- The active target has no short display name, so task labels must fall back to the full target name.
- The user triggers a build action immediately after the manifest changes and before the effective configuration is stable.
- `Clean` is blocked when the manifest is missing or invalid even though it does not use active build-option arguments.
- The user opens no workspace folder or a multi-root workspace, making Build Workflow unsupported.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST render the `Build Options` section from the manifest-defined option list when the manifest is valid.
- **FR-002**: The system MUST preserve manifest declaration order for ungrouped options and MUST preserve first-seen group order for grouped options.
- **FR-003**: The system MUST display grouped options under their group heading while leaving ungrouped options at the same hierarchy level as group headings.
- **FR-004**: The system MUST allow users to toggle checkbox build options on and off from the Configuration view.
- **FR-005**: The system MUST allow users to select exactly one state for each multistate build option and MUST present the currently active state inline.
- **FR-005A**: The system MUST ensure that only one multistate choice list is open at a time, collapsing any previously open list when another is expanded.
- **FR-005B**: The system MUST visually emphasize the label of any checkbox or multistate build option whose value is not the default, and MUST visually emphasize a group heading label when the group is collapsed and contains at least one non-default option.
- **FR-005C**: When a build option defines a `description` field, the system MUST display that description as the tooltip for the option row. Build option rows without a `description` field MUST have no tooltip. Group headings, Model, Target, and Component selector rows MUST have no tooltip.
- **FR-006**: The system MUST apply a default state for multistate options when no explicit workspace selection is stored.
- **FR-007**: The system MUST parse, validate, and evaluate each option `when` rule against the active model, target, and component before rendering Build Options or deriving effective build arguments.
- **FR-008**: The system MUST show only build options whose `when` rule evaluates to true or that omit a `when` rule.
- **FR-009**: When an option becomes unavailable for the active context, the system MUST remove it from the visible Build Options list and MUST exclude it from effective build arguments.
- **FR-010**: When an option becomes unavailable for the active context, the system MUST retain the user’s last selected value so it can be restored if the option becomes available again.
- **FR-011**: The system MUST treat any invalid build-option `when` expression as an actionable manifest validation failure that makes the manifest invalid for Build Workflow.
- **FR-012**: The system MUST expose `Build`, `Clippy`, `Check`, and `Clean` as user-runnable build workflow actions from the Configuration view.
- **FR-013**: The system MUST expose `Build`, `Clippy`, `Check`, and `Clean` through standard VS Code task entry points rather than limiting them to custom commands.
- **FR-014**: The `Build` task label MUST follow the format `Build {model-name} | {target-display} | {component-name}`.
- **FR-015**: The `Clippy` task label MUST follow the format `Clippy {model-name} | {target-display} | {component-name}`.
- **FR-016**: The `Check` task label MUST follow the format `Check {model-name} | {target-display} | {component-name}`.
- **FR-017**: The `Clean` task label MUST be `Clean`.
- **FR-018**: The `target-display` portion of workflow task labels MUST use the target short display name when one exists and otherwise MUST use the full target name.
- **FR-019**: The system MUST derive the effective `Build`, `Clippy`, and `Check` workflow arguments from the active model, target, component, and currently applicable build-option selections. Arguments MUST follow the format `<component-id> -m <model-id> [target-flag] [option-flags]`, where `target-flag` is the manifest-defined target `flag` value (omitted when absent or null).
- **FR-020**: The system MUST use the same effective configuration for `Build`, `Clippy`, and `Check`, differing only by the workflow action being run.
- **FR-021**: The `Clean` workflow MUST execute as `cargo xtask clean` with no configuration-derived arguments when it is allowed to start.
- **FR-021A**: The user-facing Build Workflow command titles MUST be `Trezor: Build`, `Trezor: Run Clippy`, `Trezor: Run Check`, and `Trezor: Run Clean`.
- **FR-021B**: The Build command MUST use the VS Code `tools` codicon.
- **FR-022**: The Configuration view title area MUST expose `Build`, `Clippy`, `Check`, and `Clean` actions only after their behavior is implemented in this slice.
- **FR-022A**: The Configuration view MUST keep `Build` as the primary header action and MUST also expose `Build`, `Run Clippy`, `Run Check`, and `Run Clean` from the view overflow menu.
- **FR-022C**: When `Refresh IntelliSense` is present in the Configuration view overflow menu, it MUST appear after the Build Workflow overflow entries as the last overflow item.
- **FR-022B**: Blocked Build Workflow actions MUST remain visible in their contributed surface, and blocked actions MUST be disabled rather than hidden.
- **FR-023**: If the manifest is missing, invalid, or contains any invalid build-option `when` logic, the system MUST prevent `Build`, `Clippy`, `Check`, and `Clean` from starting and MUST show visible failure feedback.
- **FR-024**: If the workspace has no open folder or has more than one open workspace folder, the system MUST treat it as unsupported, MUST prevent all four workflow actions from starting, and MUST show visible failure feedback.
- **FR-025**: If a workflow task fails after starting, the system MUST show a visible failure notification and MUST write a persistent log entry for the failure.
- **FR-026**: This feature MUST NOT implement Build Artifacts section behavior, build-artifact status refresh, Flash/Upload actions, Debug launch, IntelliSense refresh, compile-commands refresh, or excluded-file visibility behavior.

### Key Entities *(include if feature involves data)*

- **Build Option Definition**: A manifest-defined option that includes its presentation type, display text, optional grouping, optional availability rule, and any selectable states.
- **Effective Build Configuration**: The active model, target, component, and currently applicable build-option selections that determine what a workflow action should run.
- **Workflow Action**: One of the four user-runnable actions in this slice: `Build`, `Clippy`, `Check`, or `Clean`, including its user-facing label and launch preconditions.
- **Availability Rule**: A manifest-defined condition that determines whether a build option is currently visible and able to influence the effective build configuration.

## Operational Constraints *(mandatory)*

- Supported host/version: VS Code 1.110+.
- Source of truth inputs: Workspace settings, the manifest file, the active build-context selection restored by the previous slice, and workspace-scoped persisted build-option values.
- Workspace assumptions: Single-root workspace only; a workspace with no open folder or with more than one open workspace folder is unsupported for this slice.
- Compatibility exclusions: Multi-root workspaces, alternate manifest sources, Build Artifact behaviors, Flash/Upload actions, Debug launch, IntelliSense integration, and excluded-file visibility are out of scope.

## Failure Modes & Diagnostics *(mandatory)*

- **Trigger**: The manifest is missing, invalid, or contains any invalid build-option `when` logic.
  - **User-visible response**: `Build` remains visible but disabled in the Configuration view header, `Build`, `Run Clippy`, `Run Check`, and `Run Clean` remain visible but disabled in the view overflow menu, the actions do not start, and the user sees a specific error explaining that the manifest is invalid for Build Workflow.
  - **Persistent signal**: Manifest diagnostics for actionable manifest problems and a dedicated log entry.
- **Trigger**: The workspace is unsupported for workflow execution.
  - **User-visible response**: `Build` remains visible but disabled in the Configuration view header, `Build`, `Run Clippy`, `Run Check`, and `Run Clean` remain visible but disabled in the view overflow menu, the actions do not start, and the user sees a specific unsupported-workspace error explaining that Build Workflow requires exactly one open workspace folder.
  - **Persistent signal**: Dedicated log entry.
- **Trigger**: A workflow task starts and then fails.
  - **User-visible response**: The user sees a failure notification tied to the workflow action that ran.
  - **Persistent signal**: Dedicated log entry.
- **Trigger**: A previously selected build option becomes unavailable in the current context.
  - **User-visible response**: The option disappears from the visible Build Options list and no longer affects the next workflow action.
  - **Persistent signal**: No additional persistent signal required beyond normal persisted state handling.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In validation testing with representative manifests, 95% of users can identify and set the intended Build Options for the active build context in under 1 minute.
- **SC-002**: In task-picker and view-header usability testing, 90% of users can choose the correct `Build`, `Clippy`, `Check`, or `Clean` action on the first attempt based on the label shown.
- **SC-003**: In workflow validation across representative build contexts, 100% of launched `Build`, `Clippy`, and `Check` actions use the effective configuration that was visible to the user at launch time.
- **SC-004**: In failure-path validation, 100% of blocked or failed workflow actions produce a visible user-facing error and a persistent log or diagnostic record appropriate to the failure.

## Assumptions

- The Configuration Experience slice already provides stable active model, target, and component selection, workspace persistence, and the Configuration tree surface.
- Manifest-authored build-option flags and states are the only supported source for Build Option behavior in this slice.
- Users expect `Build`, `Clippy`, and `Check` to honor the same effective configuration, while `Clean` remains context-independent with respect to build-option arguments but still participates in Build Workflow blocking rules.
- Successful workflow execution in this slice does not automatically refresh Build Artifacts, IntelliSense state, or other later-slice surfaces.
