# Feature Specification: Flash/Upload Actions

**Feature Branch**: `005-flash-upload-actions`
**Created**: 2026-04-05
**Status**: Draft
**Input**: User description: "Now create specifiction for fifth feature (Flash/Upload Actions)"

**File Reference Rule**: Use workspace-relative paths for any repository file references written into this specification.

## Informal Spec Alignment *(mandatory)*

- **Source Documents**: `informal_spec/user-spec.md`, `informal_spec/tech-spec.md`, `informal_spec/feature-split.md`
- **Selected Slice**: `5. Flash/Upload Actions`
- **Scope Guard**: This feature includes the `Binary` and `Map File` operational behavior in the `Build Artifacts` section, action applicability from component `flashWhen` and `uploadWhen` rules, disabled-state handling when artifacts are missing, task-backed Flash and Upload execution, map-file opening behavior, and visible failure reporting. This feature excludes compile-commands status behavior, cpptools integration, excluded-file visibility, build/clippy/check/clean behavior, debug-profile resolution and launch, and any automatic post-action refresh beyond the existing static artifact rows.
- **Critical Informal Details**: The `Binary` row must expose Flash and Upload icon actions only when the selected component's action rules evaluate to `true` for the active model, target, and component; omitted or false action rules make the corresponding action unavailable; both actions may appear at the same time; applicable Flash and Upload actions remain visible but disabled when the binary artifact is missing; the `Map File` row must expose an icon-only action that opens the resolved map file in the current editor and is disabled when the map artifact is missing; Flash and Upload execute as task-backed workflows for the active configuration; successful Flash and Upload completion does not trigger an automatic extension refresh; blocked starts and post-start failures must fail visibly.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Run Device Actions From The Active Artifact (Priority: P1)

As a firmware developer, I want to start Flash or Upload directly from the active binary artifact so I can move the selected build output onto a device without reconstructing the command outside the editor.

**Why this priority**: Starting the operational workflow is the primary user outcome of the slice. If users cannot launch the correct action for the active build context, the feature does not deliver its core value.

**Independent Test**: Load a manifest and active configuration where the selected component makes Flash, Upload, or both applicable, ensure the binary artifact exists, and verify that invoking the visible action starts the matching workflow for the active configuration.

**Acceptance Scenarios**:

1. **Given** the selected component makes `Flash` applicable for the active build context and the binary artifact is present, **When** the user invokes the Flash action from the `Binary` row, **Then** the extension starts the Flash workflow for the active model and component.
2. **Given** the selected component makes `Upload` applicable for the active build context and the binary artifact is present, **When** the user invokes the Upload action from the `Binary` row, **Then** the extension starts the Upload workflow for the active component.
3. **Given** the selected component makes both `Flash` and `Upload` applicable for the active build context, **When** the user views the `Binary` row, **Then** both actions are available from that row.

---

### User Story 2 - Understand Why Actions Are Or Are Not Available (Priority: P2)

As a firmware developer, I want the `Build Artifacts` section to show whether the active binary and map outputs exist and whether Flash or Upload is currently allowed so I can understand availability before I try to run an action.

**Why this priority**: Correct enablement and blocked-state feedback are necessary for trust. Users need to know whether an action is absent because it is not allowed for the selected component or disabled because the required artifact is missing.

**Independent Test**: Vary the active component rules and artifact presence so that actions are applicable, inapplicable, and blocked by missing artifacts, then verify the row state, disabled state, and user-visible messages.

**Acceptance Scenarios**:

1. **Given** the selected component omits `flashWhen` or `uploadWhen`, or the corresponding rule evaluates to `false` for the active build context, **When** the user views the `Binary` row, **Then** that action is not shown.
2. **Given** the selected component makes Flash or Upload applicable but the binary artifact is missing, **When** the user views the `Binary` row, **Then** the applicable action remains visible but disabled and the row reports the binary as missing.
3. **Given** the manifest is missing, invalid, or the workspace is unsupported, **When** the user attempts to start Flash or Upload, **Then** the extension blocks the start and shows an explicit error instead of starting the workflow.
4. **Given** the binary or map artifact is missing, **When** the user inspects the corresponding artifact row, **Then** the row shows `missing` and explains the expected artifact path and why the artifact is unavailable.

---

### User Story 3 - Open The Active Map File (Priority: P3)

As a firmware developer, I want to open the resolved map file directly from the active artifact row so I can inspect linker output for the same build context without manually browsing the artifacts directory.

**Why this priority**: Map-file access is secondary to Flash and Upload execution, but it completes the operational artifact experience assigned to this slice.

**Independent Test**: Use active configurations with present and missing map artifacts, then verify that the row action opens the resolved file in the current editor only when that artifact exists.

**Acceptance Scenarios**:

1. **Given** the map artifact exists for the active build context, **When** the user invokes the `Map File` row action, **Then** the resolved map file opens in the current editor as a normal editable file.
2. **Given** the map artifact is missing for the active build context, **When** the user views the `Map File` row, **Then** its action is disabled and the row reports the map file as missing.

### Edge Cases

- The selected component exposes `Flash` but not `Upload`.
- The selected component exposes `Upload` but not `Flash`.
- The selected component exposes both actions at once.
- The selected component omits both `flashWhen` and `uploadWhen`.
- A previously applicable action becomes unavailable after the user changes model, target, or component.
- The binary artifact is missing even though the action rule evaluates to `true`.
- The map artifact is missing while the binary artifact is present.
- The manifest becomes invalid because of an invalid `flashWhen` or `uploadWhen` expression after the view was already visible.
- The user invokes Flash or Upload from a secondary surface after the action became inapplicable.
- Flash or Upload starts successfully but the underlying workflow later fails.
- The active configuration changes between one context with both actions and another with neither.
- The artifacts path changes so the expected binary and map paths move even though model, target, and component stay the same.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST resolve the expected `Binary` and `Map File` artifact paths for the active build context from `tfTools.artifactsPath`, the selected model's required `artifact-folder`, the selected component's required `artifact-name`, and the selected target's optional `artifact-suffix` with an empty-string default when the suffix is omitted.
- **FR-002**: The `Build Artifacts` section MUST show a `Binary` row and a `Map File` row for the active build context.
- **FR-003**: The `Binary` and `Map File` rows MUST each display `valid` when their expected artifact exists and `missing` when it does not.
- **FR-004**: The tooltip for the `Binary` and `Map File` rows MUST show the expected artifact path for the active build context.
- **FR-005**: When the binary or map artifact is missing, the corresponding row tooltip MUST also explain why the artifact is unavailable.
- **FR-006**: The system MUST expose a Flash action on the `Binary` row only when the selected component's `flashWhen` rule evaluates to `true` for the active model, target, and component.
- **FR-007**: The system MUST expose an Upload action on the `Binary` row only when the selected component's `uploadWhen` rule evaluates to `true` for the active model, target, and component.
- **FR-008**: If `flashWhen` or `uploadWhen` is omitted for the selected component, the corresponding action MUST be unavailable for that component.
- **FR-009**: If `flashWhen` or `uploadWhen` evaluates to `false` for the active build context, the corresponding action MUST be unavailable for that context.
- **FR-010**: The system MUST allow Flash and Upload to be available on the same `Binary` row at the same time when both action rules evaluate to `true`.
- **FR-011**: When Flash or Upload is applicable but the binary artifact is missing, the corresponding action MUST remain visible but disabled.
- **FR-012**: Invoking Flash or Upload from an applicable state MUST start the corresponding task-backed workflow for the active configuration.
- **FR-013**: Flash MUST use the user-facing title `Trezor: Flash {model-id}-{component-name}`.
- **FR-014**: Upload MUST use the user-facing title `Trezor: Upload {model-id}-{component-name}`.
- **FR-015**: The system MUST block Flash or Upload from starting and show an explicit error when the manifest is missing, the manifest is invalid, the workspace is unsupported, the action is not applicable for the active context, or the binary artifact is missing.
- **FR-016**: If Flash or Upload fails after starting, the system MUST show an explicit error and create a persistent log record for the failure.
- **FR-017**: Successful Flash or Upload completion MUST NOT trigger an automatic extension refresh.
- **FR-018**: The `Map File` row MUST expose an icon-only action that opens the resolved map file in the current editor.
- **FR-019**: When the map artifact is missing, the `Map File` action MUST remain visible but disabled.
- **FR-020**: Invoking the `Map File` action when the map artifact exists MUST open the resolved file as a normal editable file in the current editor.
- **FR-021**: Invalid `flashWhen` and `uploadWhen` expressions MUST continue to surface as manifest validation problems that prevent Flash and Upload from becoming startable.
- **FR-022**: This feature MUST NOT add compile-commands status behavior, cpptools behavior, excluded-file surfaces, build/clippy/check/clean behavior, or debug-profile resolution and launch behavior.

### Key Entities *(include if feature involves data)*

- **Binary Artifact State**: The current resolved binary artifact for the active model, target, and component, including expected path, presence state, missing reason, and row-level action availability.
- **Map Artifact State**: The current resolved map artifact for the active model, target, and component, including expected path, presence state, missing reason, and whether the open action is enabled.
- **Component Action Applicability**: The current decision about whether Flash and Upload are available for the selected component under the active build context.
- **Artifact Action Request**: A user-initiated request to start Flash, start Upload, or open the active map file from the `Build Artifacts` section.

## Operational Constraints *(mandatory)*

- Supported host/version: VS Code 1.110+.
- Source of truth inputs: The active model/target/component selection, `tfTools.artifactsPath`, the selected model's `artifact-folder`, the selected component's `artifact-name`, the selected target's optional `artifact-suffix`, the selected component's `flashWhen` and `uploadWhen` rules, manifest validity, workspace support state, and the presence of the resolved binary and map artifacts on disk.
- Workspace assumptions: Single-root workspace only.
- Compatibility exclusions: Multi-root behavior, compile-commands status ownership, cpptools integration, excluded-file decorations and overlays, build/clippy/check/clean workflows, debug launch, and automatic post-action refresh are out of scope.

## Failure Modes & Diagnostics *(mandatory)*

- **Trigger**: The selected component's `flashWhen` or `uploadWhen` rule is omitted or evaluates to `false` for the active build context.
  - **User-visible response**: The corresponding action is not shown on the `Binary` row.
  - **Persistent signal**: No additional persistent signal is required.
- **Trigger**: The binary artifact is missing while Flash or Upload would otherwise be applicable.
  - **User-visible response**: The applicable action remains visible but disabled, and the `Binary` row reports `missing` with the expected path and missing reason.
  - **Persistent signal**: No additional persistent signal is required beyond the visible row state.
- **Trigger**: The map artifact is missing.
  - **User-visible response**: The `Map File` row reports `missing`, and the open action is disabled.
  - **Persistent signal**: No additional persistent signal is required beyond the visible row state.
- **Trigger**: Flash or Upload cannot start because the manifest is missing or invalid, the workspace is unsupported, the action is not applicable, or the binary artifact is missing.
  - **User-visible response**: The extension shows an explicit error instead of starting the workflow.
  - **Persistent signal**: Output-channel log entry; manifest-backed diagnostics continue to cover invalid `flashWhen` and `uploadWhen` expressions when applicable.
- **Trigger**: Flash or Upload starts but the underlying workflow fails.
  - **User-visible response**: The extension shows an explicit error after the workflow fails.
  - **Persistent signal**: Output-channel log entry.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In validation testing across representative active configurations, 100% of Flash and Upload actions match the selected component rules for that context: shown only when applicable, hidden when inapplicable, and disabled when the binary artifact is missing.
- **SC-002**: In workflow-launch testing, 100% of valid Flash and Upload attempts start the correct action for the active configuration without requiring the user to construct the command manually.
- **SC-003**: In failure-path testing, 100% of blocked starts and post-start workflow failures produce explicit user-visible errors, and 100% of post-start workflow failures create persistent log records.
- **SC-004**: In usability testing, at least 90% of users can determine within 30 seconds from the `Build Artifacts` section alone whether the active binary or map artifact is available and, when present, open the map file without leaving the editor workflow.

## Assumptions

- Earlier slices already provide the Configuration view, the `Build Artifacts` section container, active build-context persistence, manifest diagnostics, and the `Trezor Firmware Tools` log output channel.
- Manifest validation already treats invalid `flashWhen` and `uploadWhen` expressions as actionable manifest problems before this slice attempts to start Flash or Upload.
- The active binary artifact follows the resolved path pattern `<artifacts-root>/<artifact-folder>/<artifact-name><artifact-suffix>.bin`, and the active map artifact follows the corresponding `.map` path.
- Opening the map file in the current editor without a special preview mode is acceptable for this product.
- No automatic refresh is required after successful Flash or Upload because these actions are operational outputs rather than inputs to IntelliSense or excluded-file recomputation in this slice.
