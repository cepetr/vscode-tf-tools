# Feature Specification: Run And Debug Integration

**Feature Branch**: `[007-run-debug-integration]`
**Created**: 2026-04-11
**Status**: Draft
**Input**: User description: "Integrate Start Debugging with VS Code Run and Debug so it can be invoked through F5, and expose multiple configurations within the current build context while keeping the first matching debug profile as the default."

**File Reference Rule**: Use workspace-relative paths for any repository file references written into this specification.

## Product Documentation Alignment *(mandatory)*

- **Source Documents**: `specs/product-spec.md`, `specs/glossary.md`
- **Affected Product Areas**: `Workflow Actions`, `Build Artifacts`, `Start Debugging`, `command surface`, `debug profile`, `debug profile resolution`, and `declaration order`
- **Scope Guard**: This feature adds Run and Debug integration and multiple debug choices for the active build context while preserving the existing manifest-driven debug model, executable artifact derivation, template resolution rules, and direct `Start Debugging` entry points. It does not add multi-root support, change artifact derivation rules, redesign the Configuration view, or introduce user-managed workspace debug files as a required part of the workflow.
- **Terminology Guard**: The spec MUST keep using `Start Debugging`, `debug profile`, `active build context`, `Configuration view`, `executable artifact`, `debug template`, `debug variable`, and `command surface` consistently. `specs/glossary.md` requires updates so `debug profile resolution` describes collecting all matching profiles and determining a default profile by declaration order rather than selecting a single winner.
- **Critical Product Details**:
  - The manifest remains the source of truth for component-owned debug profiles.
  - The active build context remains the selected model, target, and component in a single-root workspace.
  - The executable artifact must still be derived from manifest artifact metadata and must exist before debugging is startable.
  - Debug templates remain launch-time inputs; they are not preloaded, cached, or persisted into workspace debug files.
  - Template, variable, manifest, and artifact failures remain invocation-time failures with user-visible errors and log output.
  - Existing `Start Debugging` surfaces in the `Configuration view` and Command Palette remain available and continue to represent one-click entry into debugging for the active build context.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Start The Default Debug Session With F5 (Priority: P1)

As a user working in a supported workspace, I want Run and Debug to expose a tf-tools configuration for my active build context so I can start debugging with standard VS Code controls such as F5 instead of relying only on a custom command.

**Why this priority**: F5 integration is the primary value of the feature and removes the biggest mismatch between tf-tools debugging and normal VS Code debugging workflows.

**Independent Test**: Can be fully tested by selecting a tf-tools-generated Run and Debug entry for a context with one or more matching debug profiles, then starting debugging through the Run and Debug surface or F5 without creating a workspace debug file.

**Acceptance Scenarios**:

1. **Given** the active build context has at least one matching debug profile and a valid executable artifact, **When** the user opens Run and Debug, **Then** the extension offers a default tf-tools debug configuration for that active build context.
2. **Given** the user has selected the default tf-tools debug configuration in Run and Debug, **When** the user presses F5, **Then** the extension starts the default debug session for the current active build context.
3. **Given** the active build context changes, **When** the user returns to Run and Debug, **Then** the default tf-tools debug configuration reflects the new active build context without requiring manual edits to workspace debug files.

---

### User Story 2 - Choose An Alternate Matching Debug Profile (Priority: P2)

As a user whose selected component has multiple matching debug profiles, I want Run and Debug to expose each matching profile separately so I can choose the right debug flow for the current active build context.

**Why this priority**: Multiple matching profiles are the new functional expansion beyond F5 support and are required to make debugging discoverable without encoding all choice into declaration order.

**Independent Test**: Can be fully tested by preparing a context with multiple matching debug profiles and verifying that Run and Debug exposes the default tf-tools entry plus separate profile-specific entries that each launch the intended debug profile.

**Acceptance Scenarios**:

1. **Given** the active build context has multiple matching debug profiles for the selected component, **When** the user opens the Run and Debug configuration picker, **Then** the extension offers one default tf-tools entry plus one entry for each matching debug profile.
2. **Given** multiple matching debug profiles exist, **When** the user selects a profile-specific tf-tools entry and starts debugging, **Then** the extension launches that selected profile rather than the default profile.
3. **Given** multiple matching debug profiles exist, **When** the user invokes the existing `Start Debugging` action from the `Configuration view` or Command Palette, **Then** the extension launches the default profile, defined as the first matching profile in declaration order.

---

### User Story 3 - Keep Availability And Failures Predictable Across Surfaces (Priority: P3)

As a user, I want the `Configuration view`, Command Palette, and Run and Debug surfaces to stay aligned on what is startable so I can understand whether debugging is unavailable, blocked, or failing at launch time.

**Why this priority**: This preserves the product's existing discoverability and diagnostic model while extending debugging to additional VS Code surfaces.

**Independent Test**: Can be fully tested by varying manifest validity, matching profiles, executable artifact presence, and template validity, then confirming that each surface either offers a launchable option, disables the direct action, or reports a launch-time failure in a consistent way.

**Acceptance Scenarios**:

1. **Given** no debug profile matches the active build context or the executable artifact is missing, **When** the user checks the `Configuration view` and Run and Debug, **Then** direct `Start Debugging` remains visible but unavailable where applicable and no launchable tf-tools Run and Debug entry is offered for that context.
2. **Given** a tf-tools Run and Debug entry is offered but its debug template or debug variables are invalid, **When** the user starts debugging, **Then** the launch is rejected with a user-visible error and a log entry while the configuration remains discoverable.

### Edge Cases

- The selected component has multiple matching debug profiles, but the default profile fails at launch while a profile-specific alternate remains valid.
- The user has previously selected a tf-tools Run and Debug entry, then changes the active build context so that the prior profile is no longer applicable.
- The active build context has a valid executable artifact but zero matching debug profiles.
- The active build context has matching profiles, but the executable artifact path resolves to a missing file.
- A matching profile exists and remains discoverable, but its template file, template content, or tf-tools debug variables are invalid only at launch time.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST expose tf-tools-generated Run and Debug configurations for the active build context so users can start debugging through standard VS Code Run and Debug workflows, including F5 after selecting a tf-tools configuration.
- **FR-002**: The system MUST expose a default tf-tools Run and Debug configuration whenever the active build context has at least one matching debug profile and the executable artifact is available.
- **FR-003**: The default tf-tools configuration MUST use the first matching debug profile in declaration order for the selected component.
- **FR-004**: When more than one debug profile matches the active build context, the system MUST expose one additional Run and Debug configuration for each matching debug profile.
- **FR-005**: The label of each tf-tools-generated Run and Debug configuration MUST make it clear whether it is the default entry or a profile-specific entry and MUST identify the active build context it targets.
- **FR-006**: The existing `Start Debugging` command surfaces in the `Configuration view` header, `Configuration view` overflow menu, `Executable` artifact row, and Command Palette MUST remain part of the product.
- **FR-007**: Invoking `Start Debugging` through existing tf-tools command surfaces MUST launch the default debug profile for the active build context without first requiring the user to choose from multiple profiles.
- **FR-008**: Run and Debug availability MUST be derived from the same source-of-truth inputs as existing debug launch behavior: the active build context, the selected component's matching debug profiles, the derived executable artifact, the configured debug templates path, and the selected debug template's tf-tools substitutions.
- **FR-009**: The system MUST continue to treat manifest debug profiles as component-owned entries and MUST NOT introduce a separate priority field or other precedence mechanism beyond declaration order for choosing the default profile.
- **FR-010**: When the active build context changes, the system MUST refresh the tf-tools-generated Run and Debug configurations so only entries valid for the current active build context remain launchable.
- **FR-011**: The system MUST allow a user to start a profile-specific debug session from Run and Debug even when that profile is not the default profile for the active build context.
- **FR-012**: If no debug profile matches the active build context, the system MUST treat tf-tools debugging as unavailable for that context and MUST NOT offer a launchable tf-tools Run and Debug configuration.
- **FR-013**: If the executable artifact required for a matching profile is missing, the system MUST treat tf-tools debugging as unavailable for that context and MUST NOT offer a launchable tf-tools Run and Debug configuration.
- **FR-014**: Template-file problems, invalid template content, unresolved debug variables, and comparable launch-time resolution failures MUST remain invocation-time failures rather than hiding otherwise discoverable tf-tools debugging choices.
- **FR-015**: Launch-time failures for default and profile-specific tf-tools debugging entries MUST continue to produce a user-visible error and persistent log output.
- **FR-016**: The feature MUST preserve the current product rule that tf-tools debugging does not require users to create or manually maintain workspace debug configuration files.

### Key Entities *(include if feature involves data)*

- **Matching Debug Profile Set**: The ordered set of manifest-defined debug profiles owned by the selected component whose availability rules match the active build context.
- **Default Debug Profile**: The first entry in the matching debug profile set, used by direct `Start Debugging` actions and by the default Run and Debug entry.
- **Generated Run And Debug Configuration**: A user-selectable debug choice presented in VS Code Run and Debug for the current active build context. It may represent either the default profile or one specific matching debug profile.

## Operational Constraints *(mandatory)*

- Supported host/version: VS Code 1.110+ desktop extension host only.
- Source of truth inputs: `tfTools.manifestPath`, `tfTools.artifactsPath`, `tfTools.debug.templatesPath`, the manifest-defined debug profiles, and the persisted active build context.
- Workspace assumptions: Single-root `trezor-firmware`-shaped workspace only.
- Compatibility exclusions: Multi-root workspaces, unsupported repository layouts, legacy debug schema variants, and any workflow that depends on users hand-authoring or synchronizing `.vscode/launch.json` are out of scope.

## Failure Modes & Diagnostics *(mandatory)*

- **Trigger**: No debug profile matches the active build context.
  - **User-visible response**: Direct `Start Debugging` remains unavailable where applicable, and no launchable tf-tools Run and Debug configuration is offered for that context.
  - **Persistent signal**: Blocked launch attempts continue to create log output entries.
- **Trigger**: The executable artifact for the active build context is missing.
  - **User-visible response**: Direct `Start Debugging` remains unavailable where applicable, and no launchable tf-tools Run and Debug configuration is offered for that context.
  - **Persistent signal**: Blocked launch attempts continue to create log output entries.
- **Trigger**: A default or profile-specific tf-tools debug entry is selected, but its template file, template content, or debug variables are invalid.
  - **User-visible response**: The launch attempt fails with a clear error message while the debug choice remains discoverable.
  - **Persistent signal**: The failure is written to the log output.
- **Trigger**: The active build context changes after the user last selected a tf-tools Run and Debug entry.
  - **User-visible response**: The next Run and Debug view of tf-tools choices reflects the current active build context, and stale previous-context choices do not remain launchable.
  - **Persistent signal**: No additional diagnostic is required unless the user attempts a blocked launch, in which case normal log output rules apply.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a workspace where exactly one debug profile matches the active build context, a user can start debugging from Run and Debug without creating or editing a workspace debug configuration file.
- **SC-002**: In a workspace where three debug profiles match the active build context, Run and Debug presents four tf-tools choices: one default entry and three profile-specific entries.
- **SC-003**: After changing the active build context, the next debug start attempt uses only choices valid for that new context and does not start a stale prior-context debug session.
- **SC-004**: When multiple profiles match, invoking the existing `Start Debugging` action launches the same default profile that the default Run and Debug entry represents.

## Assumptions

- Users already understand standard VS Code Run and Debug selection behavior, including selecting a configuration before pressing F5.
- The first matching debug profile in declaration order remains the desired default for direct `Start Debugging` and for the default Run and Debug entry.
- The number of matching debug profiles for a single active build context remains small enough to present as a concise selection list in Run and Debug.
- This feature extends the existing tf-tools debug workflow rather than replacing manifest-defined debug templates or current artifact derivation rules.
