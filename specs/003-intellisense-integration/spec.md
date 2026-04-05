# Feature Specification: IntelliSense Integration

**Feature Branch**: `003-intellisense-integration`
**Created**: 2026-04-03
**Status**: Draft
**Input**: User description: "Specify the third feature (IntelliSense Integration) from feature-split.md document. Don't forget to read informal specification carefully."

## Informal Spec Alignment *(mandatory)*

- **Source Documents**: `informal_spec/user-spec.md`, `informal_spec/tech-spec.md`, `informal_spec/feature-split.md`
- **Selected Slice**: `3. IntelliSense Integration`
- **Scope Guard**: This feature includes resolving the active compile-commands artifact, showing compile-commands artifact presence and expected-path tooltip in the `Build Artifacts` section, registering and updating the cpptools custom configuration provider, warning when IntelliSense prerequisites are unavailable or misconfigured, and refreshing IntelliSense state when the active context or relevant workspace state changes. This feature excludes excluded-file explorer badges, optional tree graying, editor overlays, file-scope and pattern rules, Binary and Map File artifact behavior, Flash/Upload actions, and Debug launch.
- **Critical Informal Details**: IntelliSense must always follow the active model, target, and component rather than silently reusing another compile database; the expected compile-commands artifact path is derived from the artifact base path `<tfTools.artifactsPath>/<artifactFolder>/`, where `<artifactFolder>` comes from the selected model's required manifest field and is interpreted relative to `tfTools.artifactsPath`, and an artifact basename constructed as `<artifactName><artifactSuffix>`, where `<artifactName>` comes from the selected component's required manifest field and the selected target's optional `artifactSuffix` defaults to an empty string when omitted; the provider must eagerly parse the active `.cc.json` database on refresh and translate entries into cpptools per-file configurations rather than only recording the database path; the user must be able to see whether the active compile-commands artifact is present and where it is expected; IntelliSense refresh runs on activation, configuration changes, successful builds, explicit refresh, provider-availability changes, manifest-path changes, manifest-content changes, and other relevant workspace/settings changes; cpptools is the only supported IntelliSense provider and tf-tools requires the cpptools custom-configuration API v7; missing provider support or an inactive tf-tools provider configuration must produce both a visible user message and a persistent log entry; when cpptools is installed but another configuration provider is active, the warning must offer a workspace-setting fix that switches the provider to Trezor Firmware Tools.

## Clarifications

### Session 2026-04-03

- Q: Where should the manual `Refresh IntelliSense` action be exposed? → A: Expose `Refresh IntelliSense` in both the Configuration view title/overflow and the Command Palette.
- Q: What should happen to IntelliSense when the active compile-commands artifact is missing? → A: Clear the previously applied compile-commands configuration so the editor does not keep using a stale artifact.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See Correct IntelliSense For The Active Context (Priority: P1)

As a firmware developer, I want C/C++ editor assistance to track my currently selected model, target, and component so that code completion, include paths, and related editor help reflect the build context I am actively working in.

**Why this priority**: This is the core user outcome of the slice. If the editor stays on stale or mismatched compile data, the feature fails even if artifact status and warnings are present.

**Independent Test**: Activate the extension with a valid compile-commands artifact for the selected model, target, and component, switch active build context values including model changes that alter `artifactFolder`, component changes that alter `artifactName`, and target changes that alter `artifactSuffix`, and verify that IntelliSense updates to the newly selected context without using another artifact as fallback.

**Acceptance Scenarios**:

1. **Given** a valid active configuration whose expected compile-commands artifact exists, **When** the extension activates or the active model, target, or component changes, **Then** IntelliSense updates using the compile database for that exact active configuration.
2. **Given** the expected compile-commands artifact for the active configuration is missing, **When** IntelliSense refresh runs, **Then** the extension clears any previously applied compile-commands configuration for another context and does not apply a compile database from a different model, component, or stale location.
3. **Given** the active configuration changes twice in sequence, **When** refresh completes, **Then** the final IntelliSense state matches the most recently selected active configuration.
4. **Given** the active compile database contains `.c` files and `.cpp`-family files, **When** the provider serves configurations to cpptools, **Then** each file uses the language mode inferred from its own compile entry instead of one global language mode for the whole database.

---

### User Story 2 - Inspect Compile Commands Availability (Priority: P2)

As a firmware developer, I want to see whether the active compile-commands artifact is present and where it is expected so that I can quickly diagnose why IntelliSense is or is not available for the current build context.

**Why this priority**: Users need a direct, visible explanation for IntelliSense readiness. Without artifact visibility, provider behavior is opaque and difficult to troubleshoot.

**Independent Test**: Open the Configuration view with different active contexts and artifact states, then verify that the `Compile Commands` row reports `valid` or `missing` and that its tooltip shows the expected artifact path.

**Acceptance Scenarios**:

1. **Given** the expected compile-commands artifact exists for the active configuration, **When** the user views the `Build Artifacts` section, **Then** the `Compile Commands` row shows `valid` and its tooltip shows the expected artifact path.
2. **Given** the expected compile-commands artifact does not exist for the active configuration, **When** the user views the `Build Artifacts` section, **Then** the `Compile Commands` row shows `missing` and its tooltip identifies the expected artifact path and that the artifact was not found.
3. **Given** the selected model changes to one with a different required `artifactFolder`, **When** refresh completes, **Then** the `Compile Commands` row recomputes its state using the new artifact base path under `tfTools.artifactsPath`.
4. **Given** the selected component changes to one with a different required `artifactName`, **When** refresh completes, **Then** the `Compile Commands` row recomputes its state using the new artifact basename stem for the selected component.
5. **Given** the selected target changes from one without `artifactSuffix` to one with `artifactSuffix`, **When** refresh completes, **Then** the `Compile Commands` row recomputes its state using the artifact basename `<artifactName><artifactSuffix>` for the newly selected target.
6. **Given** `tfTools.artifactsPath` changes, **When** refresh completes, **Then** the `Compile Commands` row recomputes its state for the new expected path of the active configuration.

---

### User Story 3 - Receive Explicit Provider Warnings (Priority: P3)

As a firmware developer, I want clear warnings when IntelliSense prerequisites are unavailable or misconfigured so that I can correct the environment instead of assuming the extension is using stale editor state.

**Why this priority**: Visible failure behavior is required for trust, but it depends on the core alignment and artifact-status behavior already being defined.

**Independent Test**: Start the extension with cpptools missing and with cpptools installed but not configured to use Trezor Firmware Tools, then verify that each case shows a user-facing warning and creates a persistent log record, and that the wrong-provider warning offers a workspace-setting fix.

**Acceptance Scenarios**:

1. **Given** no supported C/C++ provider is installed, **When** IntelliSense refresh runs, **Then** the user sees a warning that IntelliSense integration is unavailable and the condition is recorded persistently.
2. **Given** cpptools is installed but Trezor Firmware Tools is not the active configuration provider, **When** IntelliSense refresh runs, **Then** the user sees a warning describing the provider misconfiguration, can choose a workspace-setting fix that switches the provider to Trezor Firmware Tools, and the condition is recorded persistently.
3. **Given** a provider warning condition is corrected, **When** IntelliSense refresh runs again, **Then** the stale warning state is cleared and IntelliSense readiness reflects the current environment.
4. **Given** the user needs to resynchronize IntelliSense on demand, **When** they open either the Configuration view title/overflow or the Command Palette, **Then** `Refresh IntelliSense` is available from both surfaces.

### Edge Cases

- The active compile-commands artifact is missing for the current model, target, and component even though another compile database exists elsewhere under the artifacts root.
- The selected model changes the required `artifactFolder`, causing the artifact base path to change even though the selected target and component stay the same.
- The selected component changes the required `artifactName`, causing the artifact basename stem to change even though the selected model and target stay the same.
- The selected target changes the optional `artifactSuffix`, causing the artifact basename to change even though the selected component stays the same.
- `tfTools.artifactsPath` changes while the previous compile-commands artifact state was `valid`.
- The user triggers a manual IntelliSense refresh while another refresh-worthy change has just occurred.
- cpptools becomes installed, removed, enabled, or disabled after the extension has already activated.
- cpptools is installed but workspace settings still point to a different active configuration provider.
- A successful build completes but does not produce the expected compile-commands artifact for the active configuration.
- A compile database entry uses relative include paths, forced-include paths, or a relative compiler executable path relative to the entry `directory` field.
- The compile database contains both C and C++ translation units with different `-std=` flags.
- The compile database unexpectedly contains more than one entry for the same source file.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST resolve the expected compile-commands artifact for the active configuration from `tfTools.artifactsPath` (default: `core/build-xtask/artifacts`, resolved relative to the workspace root when not absolute), the selected model's required `artifactFolder` interpreted relative to that setting, and an artifact basename constructed as `<artifactName><artifactSuffix>`, where `artifactName` comes from the selected component's required manifest field and `artifactSuffix` comes from the selected target's optional manifest field and defaults to an empty string when omitted.
- **FR-002**: The system MUST treat the resolved compile-commands artifact for the active configuration as the only valid IntelliSense source for that configuration and MUST NOT fall back to a different artifact path, model, target-derived suffix, component, or previously applied IntelliSense state.
- **FR-002A**: When the expected compile-commands artifact for the active configuration is missing, the system MUST clear any previously applied compile-commands configuration instead of leaving stale IntelliSense data active.
- **FR-003**: The system MUST register and maintain IntelliSense integration through the Microsoft C/C++ custom configuration provider model.
- **FR-003I**: The system MUST require cpptools custom configuration API v7. If the installed Microsoft C/C++ extension does not expose v7, the system MUST treat IntelliSense integration as unavailable and show a user-facing warning explaining that the supported cpptools API is missing.
- **FR-003A**: When the expected compile-commands artifact exists, the system MUST eagerly parse the active compile database during refresh and build an in-memory index keyed by normalized absolute source-file path before notifying cpptools that configurations changed.
- **FR-003B**: The system MUST translate each indexed compile-database entry into a cpptools `SourceFileConfiguration` whose target URI is the entry's source file and whose fields are derived from that entry rather than from global workspace defaults.
- **FR-003C**: For each compile-database entry, the system MUST preserve the full ordered flag set from the compile command after the compiler executable token, except that the source-file token is represented by the configuration target URI instead of remaining in `compilerArgs` or `compilerFragments`.
- **FR-003D**: The system MUST populate `includePath`, `defines`, `forcedInclude`, `compilerPath`, and `standard` from each compile entry and MUST preserve remaining flags in `compilerArgs` or `compilerFragments` so cpptools receives the same semantic compile context as the active `.cc.json` entry.
- **FR-003E**: When a compile-database entry contains relative include paths, forced-include paths, output paths, source paths, or a relative compiler executable path, the system MUST resolve them relative to that entry's `directory` field using normal compile-commands semantics.
- **FR-003F**: The system MUST infer C versus C++ language mode per compile entry. An explicit `-std=` flag with a C-family value (`c*`, `gnu*` without `++`) MUST select C mode; an explicit `-std=` flag with a C++-family value (`c++*`, `gnu++*`) MUST select C++ mode; otherwise the system MUST fall back to the source-file extension and then to the compiler frontend name (`g++`, `clang++`, `c++` imply C++).
- **FR-003G**: If the compile database contains more than one entry for the same normalized absolute source file path, the system MUST use the first entry and ignore later duplicates for IntelliSense purposes.
- **FR-003H**: The system MUST return a cpptools browse configuration built from the eagerly parsed active compile database, with `browsePath` equal to the de-duplicated union of resolved include paths across all indexed entries, `compilerPath` taken from the first indexed entry that provides one, and `compilerArgs` taken from that same entry after normalization.
- **FR-004**: The system MUST update IntelliSense state when refresh is triggered by extension activation, active configuration changes, successful build completion, explicit refresh, provider-availability changes, manifest-path changes, manifest-content changes, and `tfTools.artifactsPath` changes.
- **FR-005**: The system MUST expose a user-invokable `Refresh IntelliSense` action once this slice is implemented.
- **FR-005A**: The `Refresh IntelliSense` action MUST be available from both the Configuration view title or overflow menu and the Command Palette.
- **FR-006**: The `Build Artifacts` section MUST show a `Compile Commands` row for the active configuration.
- **FR-007**: The `Compile Commands` row MUST display `valid` when the expected compile-commands artifact for the active configuration exists.
- **FR-008**: The `Compile Commands` row MUST display `missing` when the expected compile-commands artifact for the active configuration does not exist.
- **FR-009**: The tooltip for the `Compile Commands` row MUST show the expected artifact path for the active configuration.
- **FR-010**: When the expected compile-commands artifact is missing, the tooltip for the `Compile Commands` row MUST explain that the artifact was not found for the active configuration.
- **FR-010B**: The expected compile-commands artifact path MUST use the selected model's required `artifactFolder` as the folder under `tfTools.artifactsPath` rather than the model id.
- **FR-010A**: The expected compile-commands artifact path MUST use the selected component's required `artifactName` as the artifact basename stem rather than the component id.
- **FR-010C**: When the selected target defines `artifactSuffix`, the expected compile-commands artifact path MUST use `<artifactName><artifactSuffix>` as the artifact basename.
- **FR-011**: When `tfTools.artifactsPath` changes, the system MUST clear previously applied IntelliSense artifact state and recompute the active `Compile Commands` row state against the new expected path.
- **FR-012**: If no supported C/C++ provider is installed, the system MUST show a user-facing warning that IntelliSense integration is unavailable.
- **FR-013**: If cpptools is installed but Trezor Firmware Tools is not the active configuration provider, the system MUST show a user-facing warning describing that provider misconfiguration.
- **FR-013A**: The wrong-provider warning MUST offer a workspace-setting fix that sets `C_Cpp.default.configurationProvider` to the Trezor Firmware Tools provider id for the workspace.
- **FR-014**: The system MUST write persistent log entries for missing-provider and wrong-provider warning conditions.
- **FR-015**: When IntelliSense prerequisites become valid again, the system MUST clear stale provider warning state on the next refresh.
- **FR-016**: This feature MUST refresh only IntelliSense state and the compile-commands artifact status required by that state; it MUST NOT implement excluded-file explorer badges, excluded-file tree graying, editor overlays, file-scope rules, folder-pattern rules, Binary artifact behavior, Map File behavior, Flash/Upload actions, or Debug launch.

### Key Entities *(include if feature involves data)*

- **Active Compile-Commands Artifact**: The expected compile database for the currently selected model, target, and component, including the model-derived artifact folder, the component-derived artifact basename stem, the target-derived suffix, its resolved path, and whether it is present.
- **Parsed Compile-Commands Entry**: One eagerly parsed source-file record from the active compile database, including normalized file path, entry directory, compiler executable, ordered argument list, resolved include paths, defines, forced-include paths, inferred language family, and inferred standard.
- **IntelliSense Provider Readiness**: The current ability of the extension to supply editor assistance for the active configuration, including provider availability, provider selection state, and warning state.
- **Browse Configuration Snapshot**: The workspace-level cpptools browse configuration derived from the active compile database, including de-duplicated browse paths and representative compiler metadata from the first indexed entry.
- **IntelliSense Refresh Trigger**: A user or workspace event that requires the extension to recompute the active compile-commands artifact status and reapply IntelliSense state.

## Operational Constraints *(mandatory)*

- Supported host/version: VS Code 1.110+.
- Source of truth inputs: `tfTools.artifactsPath`, the active model/target/component selection already managed by earlier slices, the selected model's required `artifactFolder` manifest field, the selected component's required `artifactName` manifest field, the selected target's optional `artifactSuffix` manifest field, the manifest path and content when they affect active configuration normalization, workspace folder state, extension/provider availability, the active compile-commands artifact on disk, and each compile-database entry's `directory`, source file, compiler executable, and ordered arguments.
- Workspace assumptions: Single-root workspace only.
- Compatibility exclusions: Alternate C/C++ providers, multi-root-specific behavior, excluded-file visibility, Binary and Map File artifact behavior, Flash/Upload actions, and Debug launch are out of scope.

## Failure Modes & Diagnostics *(mandatory)*

- **Trigger**: The expected compile-commands artifact for the active configuration is missing.
  - **User-visible response**: The `Compile Commands` row shows `missing`, its tooltip shows the expected path and that the artifact was not found, and IntelliSense clears any previously applied compile-commands configuration instead of switching to another artifact.
  - **Persistent signal**: Dedicated log entry.
- **Trigger**: No supported C/C++ provider is installed.
  - **User-visible response**: The user sees a warning that IntelliSense integration is unavailable.
  - **Persistent signal**: Dedicated log entry.
- **Trigger**: cpptools is installed but Trezor Firmware Tools is not the active configuration provider.
  - **User-visible response**: The user sees a warning that the workspace is not configured to use the Trezor provider for IntelliSense and can choose a workspace-setting fix that switches `C_Cpp.default.configurationProvider` to the Trezor provider id.
  - **Persistent signal**: Dedicated log entry.
- **Trigger**: A refresh trigger occurs after IntelliSense was previously aligned to another active configuration.
  - **User-visible response**: IntelliSense and the `Compile Commands` row update to the current active configuration instead of remaining on stale state.
  - **Persistent signal**: No additional persistent signal required when refresh succeeds normally.
- **Trigger**: The compile database contains duplicate entries for the same source file.
  - **User-visible response**: IntelliSense uses the first entry for that file and does not merge conflicting entries.
  - **Persistent signal**: No additional persistent signal required.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In validation testing across representative model, target, and component changes, 100% of successful IntelliSense refreshes use the compile-commands artifact expected for the active configuration, including the selected model's `artifactFolder` and the selected component's `artifactName`, rather than a fallback artifact.
- **SC-002**: In usability testing, 90% of users can determine within 30 seconds whether IntelliSense is blocked by a missing compile-commands artifact by using the `Compile Commands` row and its tooltip alone.
- **SC-003**: In prerequisite-failure testing, 100% of missing-provider and wrong-provider conditions produce both a visible warning and a persistent log record.

## Assumptions

- The Configuration Experience slice already provides the Configuration view, Build Artifacts section container, active build-context persistence, and the output channel used for persistent logging.
- The Build Workflow slice already provides successful-build completion events that later slices can react to.
- The active compile-commands artifact uses the path pattern `<artifacts-root>/<artifactFolder>/<artifactName><artifactSuffix>.cc.json`, where `artifactFolder` comes from the selected model, `artifactName` comes from the selected component, and `artifactSuffix` is empty when the selected target omits it.
- The active compile-commands artifact follows normal compile-commands semantics: entries may use either absolute paths or paths relative to the entry `directory`, and the current firmware `.cc.json` files primarily use absolute paths.
- When the active compile-commands artifact is missing, clearing the previously applied compile-commands configuration is acceptable and preferred over retaining stale IntelliSense data.
- Only Microsoft C/C++ (`ms-vscode.cpptools`) is supported for IntelliSense integration in this product.
