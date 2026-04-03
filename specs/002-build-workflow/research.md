# Research: Build Workflow

## Decision 1: Extend the manifest model with explicit Build Option and `when` expression types

- **Decision**: Add explicit manifest types for checkbox and multistate build options plus a dedicated `when` expression AST/evaluator module instead of leaving option shapes loosely typed inside validation code.
- **Rationale**: Build Workflow now depends on three distinct uses of option data: validation, tree rendering, and effective-argument derivation. A typed manifest model avoids duplicating normalization logic across UI and command layers and keeps invalid `when` handling centralized.
- **Alternatives considered**:
  - Keep options as untyped objects from `validate-manifest.ts`: rejected because UI rendering and argument derivation would each need their own defensive parsing.
  - Evaluate `when` expressions ad hoc with string matching: rejected because it is brittle, hard to test, and makes diagnostics vague.

## Decision 2: Treat invalid build-option `when` expressions as manifest-invalid for Build Workflow

- **Decision**: Any invalid build-option `when` expression yields manifest validation issues and blocks `Build`, `Clippy`, and `Check` until the manifest is corrected.
- **Rationale**: The informal spec already treats invalid `when` as a manifest diagnostic problem. The accepted clarification tightens the Build Workflow slice by refusing partial execution on unreliable option availability, which prevents users from launching tasks under a misleading configuration.
- **Alternatives considered**:
  - Disable only the affected option and continue building: rejected because it silently changes effective behavior after a manifest authoring error.
  - Leave the invalid option visible with warnings: rejected because it still leaves task derivation ambiguous.

## Decision 3: Persist build-option selections separately from the core model/target/component selection

- **Decision**: Keep the existing active build context model intact and add a separate persisted map for build-option selections keyed by a deterministic internal option key.
- **Rationale**: The current `ActiveConfig` shape is already stable for Configuration Experience. A separate build-option state layer allows Build Workflow to preserve hidden selections when `when` becomes false without forcing unrelated rewrites to status-bar and selector logic.
- **Alternatives considered**:
  - Replace `ActiveConfig` with one larger object immediately: rejected because it causes unnecessary churn in already-tested context-selection code.
  - Recompute option state from UI only: rejected because hidden-but-preserved values are a core requirement.

## Decision 4: Implement workflow execution with one command/orchestration module plus one task provider

- **Decision**: Register user-facing workflow commands in a focused command module and expose matching VS Code build tasks through a dedicated task-provider module.
- **Rationale**: The repo already centralizes activation in `src/extension.ts`. Splitting orchestration into `src/commands/build-workflow.ts` and `src/tasks/build-task-provider.ts` keeps activation manageable while still satisfying the requirement that these workflows appear in standard build-task entry points.
- **Alternatives considered**:
  - Put all task creation directly in `extension.ts`: rejected because command gating, label derivation, and execution preconditions would make activation too dense.
  - Implement commands without a task provider: rejected because the informal spec requires standard VS Code task entry points.

## Decision 5: Keep blocked header actions visible and drive enablement from the same workflow precondition service used by commands

- **Decision**: Compute workflow enablement from a shared precondition path used by both header actions and command/task launch checks.
- **Rationale**: The accepted clarification requires header actions to remain visible but disabled when blocked. Reusing the same precondition logic avoids drift between what the UI presents and what commands will actually allow.
- **Alternatives considered**:
  - Compute enablement separately in the tree or package contribution layer: rejected because it risks mismatches between displayed and executable state.
  - Hide blocked actions entirely: rejected by clarification.

## Decision 6: Extend existing diagnostics/logging rather than creating workflow-specific reporting surfaces

- **Decision**: Reuse the current manifest diagnostics collection and `Trezor Firmware Tools` output channel for Build Workflow failures.
- **Rationale**: The repository already has manifest diagnostics and log helpers. Build Workflow introduces new failure modes, but they still belong to the same extension operational surface and should remain discoverable in the same places.
- **Alternatives considered**:
  - Create a second output channel for workflow execution: rejected because it fragments troubleshooting.
  - Rely on task terminal output alone: rejected because the constitution requires visible persistent failure reporting.