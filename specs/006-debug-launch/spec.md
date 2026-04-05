# Feature Specification: Debug Launch

**Feature Branch**: `006-debug-launch`
**Created**: 2026-04-05
**Status**: Draft
**Input**: User description: "Specify the last feature from the list: Debug Launch"

**File Reference Rule**: Use workspace-relative paths for any repository file references written into this specification.

## Informal Spec Alignment *(mandatory)*

- **Source Documents**: `informal_spec/user-spec.md`, `informal_spec/tech-spec.md`, `informal_spec/feature-split.md`
- **Selected Slice**: `6. Debug Launch`
- **Scope Guard**: This feature includes debug-profile matching from manifest-defined `debug` entries, priority-based resolution, debugger-template loading from the configured templates path, tf-tools substitution-variable expansion, executable artifact resolution and status reporting, the `Executable` row and its `Start Debugging` row action, the Configuration view header and overflow `Start Debugging` actions, debug launch through the VS Code debug API, and debug-specific user feedback and logging. This feature excludes Build, Clippy, Check, and Clean behaviors; Flash and Upload execution; `Binary` and `Map File` row ownership; compile-commands provider behavior; excluded-file visibility; and any manifest or tree redesign unrelated to debug launch.
- **Critical Informal Details**: Every build context is considered debuggable only through manifest-defined debug profiles; the extension must resolve the active build context to exactly one matching profile before launch; higher `priority` wins, but equal highest-priority matches remain ambiguous and must block launch; the selected template is loaded from `tfTools.debug.templatesPath` on each debug attempt; the `Executable` artifact path comes from the selected profile's required `executable` value and is resolved relative to the active model artifact folder when not already absolute; the `Build Artifacts` section must always include an `Executable` row that shows `valid` or `missing` and exposes the expected path in its tooltip; the `Executable` row must expose an icon-only `Start Debugging` action backed by `Trezor: Start Debugging`; the Configuration view must expose `Start Debugging` as both a visible header action and an overflow action; those visible Start Debugging actions must remain discoverable but disabled when no unique valid debug profile is available or when the executable artifact is missing; tf-tools substitution must inspect nested string fields in the template, replace supported tf-tools variables without re-expanding results, leave non-tf-tools variables untouched, and fail visibly for unknown variables, unresolved required values, invalid template content, or missing templates; debug-specific failures must produce user-visible errors and persistent log entries.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Launch The Correct Debug Profile (Priority: P1)

As a firmware developer, I want the extension to resolve the correct debug profile for the active model, target, and component and start debugging directly from the Configuration view so I can begin a debug session without hand-editing launch settings.

**Why this priority**: Starting the correct debug session is the core outcome of the slice. If the extension cannot reliably resolve one profile and launch it from the visible Start Debugging actions, the feature does not deliver user value.

**Independent Test**: Load a manifest with debug profiles, select an active build context with exactly one highest-priority matching profile, ensure the executable exists, and verify that invoking any visible Start Debugging entry starts the resolved debug session for that context.

**Acceptance Scenarios**:

1. **Given** the active build context matches exactly one debug profile and its executable artifact exists, **When** the user invokes `Trezor: Start Debugging` from the Configuration view header, **Then** the extension launches the resolved debug configuration for that active context.
2. **Given** the active build context matches exactly one debug profile and its executable artifact exists, **When** the user invokes `Start Debugging` from the `Executable` row, **Then** the extension launches the same resolved debug configuration.
3. **Given** multiple debug profiles match the active build context and one has a higher priority than the others, **When** the user invokes `Trezor: Start Debugging`, **Then** the extension launches the higher-priority profile.
4. **Given** a matching debug profile defines tf-tools variables in its executable path, template fields, or additional variables, **When** the user invokes `Trezor: Start Debugging`, **Then** the launched debug configuration uses the resolved values for the active build context.

---

### User Story 2 - Understand Debug Availability Before Launch (Priority: P2)

As a firmware developer, I want the Configuration view to show whether the active executable is available and whether debugging is currently startable so I can understand readiness before I attempt to launch.

**Why this priority**: Visible readiness and disabled-state behavior prevent confusing launch attempts and make the debug experience trustworthy.

**Independent Test**: Switch between contexts with valid, missing, ambiguous, and unmatched debug states and verify the `Executable` row status, tooltip, and enabled or disabled state of all visible Start Debugging actions.

**Acceptance Scenarios**:

1. **Given** the active build context resolves to a unique debug profile and its executable exists, **When** the user views the `Build Artifacts` section, **Then** the `Executable` row reports `valid` and the visible Start Debugging actions are enabled.
2. **Given** the active build context resolves to a unique debug profile but its executable artifact is missing, **When** the user views the `Build Artifacts` section or Configuration view actions, **Then** the `Executable` row reports `missing` and the visible Start Debugging actions remain shown but disabled.
3. **Given** no debug profile matches the active build context, **When** the user views the Configuration view, **Then** the visible Start Debugging actions remain shown but disabled.
4. **Given** multiple matching debug profiles remain tied at the highest priority, **When** the user views the Configuration view, **Then** the visible Start Debugging actions remain shown but disabled and debugging does not start automatically.

---

### User Story 3 - Diagnose Debug Launch Failures Quickly (Priority: P3)

As a firmware developer, I want explicit errors and persistent logs when debug launch cannot proceed so I can correct manifest, template, variable, or artifact problems without guessing.

**Why this priority**: Debug launch has distinct failure modes from build and flash/upload. Clear failure reporting is necessary to make the slice supportable.

**Independent Test**: Trigger missing-template, malformed-template, unresolved-variable, ambiguous-profile, and missing-executable failures and verify that each blocked launch produces a specific error and a persistent log entry.

**Acceptance Scenarios**:

1. **Given** the selected debug template file cannot be loaded or is malformed, **When** the user invokes `Trezor: Start Debugging`, **Then** the extension blocks launch, shows an explicit error, and records the failure in the log output.
2. **Given** the selected debug template references an unknown or invalid tf-tools substitution variable, **When** the user invokes `Trezor: Start Debugging`, **Then** the extension blocks launch, shows an explicit error, and records the unresolved variable in the log output.
3. **Given** no unique valid debug profile can be resolved for the active build context, **When** the user invokes `Trezor: Start Debugging`, **Then** the extension blocks launch, shows an explicit error, and records the resolution failure in the log output.

### Edge Cases

- The active build context matches no debug profile.
- The active build context matches multiple debug profiles with different priorities.
- The active build context matches multiple debug profiles tied at the same highest priority.
- The selected debug profile resolves an executable path that is relative to the artifact folder.
- The selected debug profile resolves an executable path that is already absolute.
- The selected debug profile references tf-tools variables inside nested arrays or nested objects in the template.
- A `debug.vars` value references another `debug.vars` value.
- `debug.vars` references form a cycle.
- The selected template includes ordinary VS Code or debugger variables that are not tf-tools variables.
- The active executable path changes when the user switches model, target, component, or artifacts path settings.
- The user attempts to start debugging after the manifest becomes invalid or after the workspace becomes unsupported.
- The template path tries to escape the configured templates root.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST evaluate manifest-defined debug profiles against the active model, target, and component using the same condition-expression semantics used for manifest `when` rules.
- **FR-002**: The system MUST treat the active build context as startable for debugging only when exactly one manifest-defined debug profile can be resolved after applying priority rules.
- **FR-003**: When multiple matching debug profiles exist, the system MUST prefer the profile with the highest `priority`.
- **FR-004**: When multiple matching debug profiles remain tied at the highest priority, the system MUST treat the result as ambiguous and MUST NOT start debugging automatically.
- **FR-005**: The system MUST load the selected debug template from `tfTools.debug.templatesPath` each time the user invokes `Trezor: Start Debugging`.
- **FR-005A**: The default value of `tfTools.debug.templatesPath` MUST be `${workspaceFolder}/core/embed/.tf-tools`.
- **FR-006**: The system MUST reject template-path traversal outside the configured debug templates root.
- **FR-007**: The system MUST treat the selected template as a single debug-configuration source input and MUST NOT persist the resolved launch configuration into workspace files.
- **FR-008**: The system MUST parse the selected template as a single debug configuration and block launch if the template content is invalid.
- **FR-009**: The system MUST build a substitution map from the active model, target, component, resolved artifact folder, resolved executable values, and any additional variables declared by the selected debug profile.
- **FR-010**: The system MUST replace supported tf-tools substitution tokens in every string field of the parsed template, including nested objects and arrays.
- **FR-011**: The system MUST leave non-string template values unchanged during substitution.
- **FR-012**: The system MUST replace every occurrence of a supported tf-tools token found inside a string value, including embedded occurrences inside larger strings.
- **FR-013**: The system MUST perform tf-tools substitution as a single pass and MUST NOT re-expand replacement results for additional tf-tools substitutions.
- **FR-014**: The system MUST leave non-tf-tools variable syntax unchanged for downstream resolution by VS Code or the selected debugger.
- **FR-015**: The system MUST block debug launch when a required tf-tools substitution variable is unknown, invalid, cyclic, or otherwise cannot be resolved for the active build context.
- **FR-016**: The system MUST resolve `${tfTools.executablePath}` from the selected debug profile's `executable` value, treating relative values as relative to the active model artifact folder and absolute values as already resolved.
- **FR-017**: The `Build Artifacts` section MUST always include an `Executable` row for the active build context.
- **FR-018**: The `Executable` row MUST display `valid` when the resolved executable exists and `missing` when it does not.
- **FR-019**: The `Executable` row tooltip MUST show the expected executable path for the active build context.
- **FR-020**: When the executable is missing, the `Executable` row tooltip MUST also explain why the artifact is unavailable.
- **FR-021**: The `Executable` row MUST expose an icon-only `Start Debugging` action backed by `Trezor: Start Debugging`.
- **FR-022**: The Configuration view MUST expose `Trezor: Start Debugging` as a visible header action and as an overflow action.
- **FR-023**: The visible Start Debugging actions MUST remain shown but disabled when no unique valid debug profile can be resolved for the active build context.
- **FR-024**: The visible Start Debugging actions MUST remain shown but disabled when the resolved executable artifact is missing.
- **FR-025**: Invoking any enabled Start Debugging action for the active build context MUST launch the resolved configuration through the VS Code debug API.
- **FR-026**: If no debug profile matches, if multiple highest-priority matches remain, if the template cannot be loaded, if the template content is invalid, if required variables cannot be resolved, if the executable artifact is missing, or if the workspace is unsupported, the system MUST block launch and show an explicit error instead of starting debugging.
- **FR-027**: Debug-launch failures MUST create persistent log entries that identify the resolution, template, variable, or artifact problem that blocked launch.
- **FR-028**: The system MUST write debug-template load failures, debug-template parse failures, unresolved tf-tools variable failures, and debug-profile resolution failures to the `Trezor Firmware Tools` output channel.
- **FR-029**: Changes to the active model, target, component, manifest content, artifacts path, or debug templates path MUST update executable resolution and Debug action enablement without requiring a restart.
- **FR-030**: This feature MUST NOT add Flash or Upload execution, `Binary` or `Map File` action behavior, build-task behaviors, compile-commands integration, or excluded-file visibility behavior.

### Key Entities *(include if feature involves data)*

- **Debug Profile Match Set**: The set of manifest-defined debug profiles that match the active model, target, and component before and after priority-based selection.
- **Executable Artifact State**: The resolved executable path for the selected debug profile, including presence state, missing reason, and whether Start Debugging actions are enabled.
- **Resolved Debug Template**: The in-memory debug configuration produced by loading the selected template and applying tf-tools substitutions for the active build context.
- **Debug Variable Map**: The collection of built-in and profile-defined tf-tools substitution values used to resolve template strings and the executable path.

## Operational Constraints *(mandatory)*

- Supported host/version: VS Code 1.110+.
- Source of truth inputs: The active model, target, and component selection; the manifest `debug` array; `tfTools.artifactsPath`; `tfTools.debug.templatesPath` with default `${workspaceFolder}/core/embed/.tf-tools`; the selected model's `artifactFolder`; the selected debug profile's `template`, `when`, `priority`, `executable`, and optional `vars`; manifest validity; workspace support state; and the presence of the resolved executable on disk.
- Workspace assumptions: Single-root workspace only.
- Compatibility exclusions: Multi-root workspaces, launch.json generation or persistence, Flash and Upload actions, `Binary` and `Map File` ownership, Build Workflow task behaviors, compile-commands provider behavior, and excluded-file surfaces are out of scope.

## Failure Modes & Diagnostics *(mandatory)*

- **Trigger**: No debug profile matches the active build context.
  - **User-visible response**: The visible Start Debugging actions remain disabled, and an explicit error is shown if the user attempts to start debugging.
  - **Persistent signal**: Output-channel log entry describing the resolution failure.
- **Trigger**: Multiple debug profiles remain tied at the highest priority for the active build context.
  - **User-visible response**: The visible Start Debugging actions remain disabled, and an explicit error is shown if the user attempts to start debugging.
  - **Persistent signal**: Output-channel log entry describing the ambiguous profile match.
- **Trigger**: The selected template cannot be found, escapes the configured templates root, or contains invalid content.
  - **User-visible response**: The extension blocks launch and shows an explicit error.
  - **Persistent signal**: Output-channel log entry including the template path and failure detail.
- **Trigger**: A required tf-tools substitution variable is unknown, invalid, unresolved, or cyclic.
  - **User-visible response**: The extension blocks launch and shows an explicit error.
  - **Persistent signal**: Output-channel log entry identifying the unresolved variable problem.
- **Trigger**: The resolved executable artifact is missing.
  - **User-visible response**: The `Executable` row reports `missing`, the visible Start Debugging actions remain shown but disabled, and an explicit error is shown if the user attempts to start debugging.
  - **Persistent signal**: Output-channel log entry for the blocked launch attempt; no separate manifest diagnostic is required for a missing runtime artifact.
- **Trigger**: The workspace is unsupported or the manifest is invalid at launch time.
  - **User-visible response**: The extension blocks launch and shows an explicit error.
  - **Persistent signal**: Output-channel log entry; manifest-backed diagnostics continue to cover invalid debug-profile definitions when applicable.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In validation testing across representative active build contexts, 100% of debug-launch attempts with exactly one valid highest-priority profile and a present executable start the intended debug session from every visible Start Debugging entry point.
- **SC-002**: In validation testing across unmatched, ambiguous, missing-template, invalid-template, unresolved-variable, and missing-executable cases, 100% of blocked debug attempts fail before launch with a specific user-visible error.
- **SC-003**: In failure-path testing, 100% of blocked debug attempts caused by profile resolution, template loading, variable substitution, or missing executable state create a persistent log record that identifies the blocking reason.
- **SC-004**: In usability testing, at least 90% of users can determine within 30 seconds from the Configuration view alone whether the active build context is ready for debugging and, when it is ready, start the session without editing workspace debug files.

## Assumptions

- Earlier slices already provide the Configuration view shell, manifest loading and validation, active build-context selection, artifact-row rendering, and the `Trezor Firmware Tools` output channel.
- Manifest validation already rejects malformed `debug.when` expressions and other invalid debug-profile definitions before this slice attempts to launch debugging.
- The active model artifact folder remains the base location for resolving relative executable paths.
- The `Trezor: Start Debugging` command remains user-visible through the Configuration view surfaces described in the informal spec, without requiring additional new surfaces in this slice.
- Debug-template files are maintained by workspace authors under the configured templates path, which defaults to `${workspaceFolder}/core/embed/.tf-tools`, and are treated as source inputs rather than generated artifacts.
