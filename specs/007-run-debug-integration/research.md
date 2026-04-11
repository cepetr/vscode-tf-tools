# Phase 0 Research: Run And Debug Integration

## Decision 1: Use a tf-tools proxy Run and Debug configuration type with a dynamic configuration provider

**Decision**: Generate Run and Debug entries as tf-tools-owned proxy configurations that carry the active build context and selected debug profile identity, then resolve them at launch time into the final template-derived debugger configuration.

**Rationale**:

- The current product requires template loading and tf-tools variable failures to remain invocation-time failures rather than hiding discoverable debug choices.
- VS Code dynamic debug entries are provided through `DebugConfigurationProvider`, which is the native integration point for Run and Debug and F5 workflows.
- A proxy configuration lets tf-tools expose entries without parsing every template up front just to discover the final debugger shape.
- This preserves the existing no-`launch.json` workflow while still allowing Run and Debug selection and F5 reuse.

**Alternatives considered**:

- Register providers per concrete debugger type discovered from templates: rejected because it forces eager template parsing to discover `type`/`request`, which conflicts with the existing invocation-time failure model and couples tf-tools to external debugger types too early.
- Persist generated entries into `.vscode/launch.json`: rejected because the current product explicitly avoids launch.json persistence and this would introduce synchronization problems with active build context changes.

## Decision 2: Refactor debug selection into matching-set and default-profile helpers shared across command, tree readiness, and provider paths

**Decision**: Replace the current single-profile resolver API with shared helpers that return the ordered matching profile set plus the default profile, then have direct launch, executable readiness, and Run and Debug entry generation all consume those helpers.

**Rationale**:

- The current implementation in `src/commands/debug-launch.ts` and `src/intellisense/artifact-resolution.ts` hardcodes a single selected profile.
- The new feature needs both the full matching set for Run and Debug and the default profile for direct `Start Debugging`.
- Centralizing this derivation prevents command-surface drift and keeps declaration-order semantics consistent in one place.

**Alternatives considered**:

- Keep the current single-profile helper and add separate list-building logic for Run and Debug: rejected because it would duplicate matching logic and increase the risk of tree-view readiness and Run and Debug drifting apart.
- Store the default profile in workspace state: rejected because default selection is a pure function of the current manifest and active build context.

## Decision 3: Keep readiness checks limited to manifest validity, matching profiles, and executable artifact presence

**Decision**: Run and Debug availability and tree-view enablement remain based on manifest debug validity, active build context validity, matching-profile existence, and executable artifact presence only. Template file reads and tf-tools substitution validation stay launch-time only.

**Rationale**:

- This matches the current product behavior for direct `Start Debugging`.
- It keeps opening Run and Debug and refreshing the tree cheap and predictable.
- It avoids hiding alternate profiles purely because one template is temporarily malformed.

**Alternatives considered**:

- Eagerly validate templates during refresh: rejected because it changes user-visible behavior, adds I/O to the readiness path, and turns discoverable launch options into hidden failures.
- Cache template parse results across refreshes: rejected because the current product explicitly states that template changes take effect on the next launch attempt and does not preload or cache templates.

## Decision 4: Update consolidated product docs and extend both unit and integration coverage in the same change

**Decision**: Treat glossary and product-spec updates as first-class deliverables and add test coverage across unit and integration layers before implementation tasks are considered complete.

**Rationale**:

- The feature changes core product semantics from single-profile selection to matching-set plus default behavior.
- Constitution rules require documentation and tests whenever behavior changes across VS Code surfaces, manifest interpretation, or persisted selection state.
- Existing debug-launch tests already cover command surfaces, no-launch.json behavior, and failure modes, making extension safer than inventing a parallel harness.

**Alternatives considered**:

- Update only the feature slice spec and leave product docs unchanged until later: rejected by the constitution because this feature changes user-visible product behavior and terminology.
- Rely on integration coverage only: rejected because matching-set/default-profile ordering logic is easier and faster to verify in focused unit tests.