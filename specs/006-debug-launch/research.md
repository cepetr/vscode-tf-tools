# Research: Debug Launch

## Decision 1: Parse component-scoped `debug` entries directly on manifest components and reject the legacy debug schema

- **Decision**: Extend manifest parsing so each component may declare an optional ordered `debug[]` array, each target may declare an optional `executableExtension`, and the loader rejects legacy top-level `debug`, `priority`, profile-level `executable`, and `${tfTools.debugConfigName}` usage instead of silently translating them.
- **Rationale**: The revised spec is a hard cutover. Supporting only one schema keeps validation, runtime logic, fixtures, and tests coherent and avoids a dual-path implementation that would otherwise leak into command handling and UI state.
- **Alternatives considered**:
  - Accept both schemas temporarily and normalize them internally: rejected because it increases complexity across validation, selection, and tests for no lasting product benefit.
  - Accept the new schema but warn on legacy token usage instead of failing: rejected because silent compatibility or partial compatibility contradicts the cutover clarification.

## Decision 2: Treat omitted `component.debug[].when` as match-all and otherwise reuse the existing `when` parser

- **Decision**: Keep `component.debug[].when` optional. When absent, the entry matches all active contexts for that component. When present, parse and validate it with the same expression parser, unknown-id checks, and diagnostics used for build-option `when`, `flashWhen`, and `uploadWhen`.
- **Rationale**: This matches the clarified spec, reduces YAML boilerplate for per-component default debug entries, and reuses an existing parser rather than adding a debug-specific rule language.
- **Alternatives considered**:
  - Make `when` mandatory on every debug profile: rejected because it adds noise without improving determinism.
  - Introduce a separate debug-only selector language: rejected because it would duplicate semantics and validation paths.

## Decision 3: Resolve the selected component's debug entries by first-match declaration order

- **Decision**: Build one pure selection helper that evaluates only the selected component's ordered debug entries and returns the first match; no ambiguity state and no priority calculation remain in the design.
- **Rationale**: The revised manifest contract states that declaration order is the only precedence rule. A simple first-match helper keeps UI state, command handling, and tests aligned with that rule.
- **Alternatives considered**:
  - Preserve the old priority model internally while ignoring it in YAML: rejected because it keeps dead semantics alive and confuses the codebase.
  - Continue evaluating all matches for diagnostics before choosing the first: rejected because it adds complexity without changing runtime behavior.

## Decision 4: Derive executable state from component and target fields rather than from debug-entry fields

- **Decision**: Compute `${tfTools.executable}` as `<artifactName><artifactSuffix><executableExtension>` and `${tfTools.executablePath}` as `<tfTools.artifactsPath>/<artifactFolder>/<artifactName><artifactSuffix><executableExtension>`, using the selected component's `artifactName`, the selected target's optional `artifactSuffix`, the selected target's optional `executableExtension`, and the selected model's `artifactFolder`.
- **Rationale**: The new spec removes profile-level executable ownership. Keeping executable derivation in one helper shared by runtime launch and the `Executable` row preserves one source of truth for status, tooltips, and launch readiness.
- **Alternatives considered**:
  - Derive the path independently in the tree provider and again in the command handler: rejected because duplicated path rules would drift.
  - Put executable path fragments back into debug entries: rejected because it contradicts the revised manifest contract.

## Decision 5: Keep template loading invocation-time and expose `${tfTools.debugProfileName}` through the resolved variable map

- **Decision**: Continue loading JSONC templates from `tfTools.debug.templatesPath` on each Start Debugging invocation, rejecting template-root traversal, and extend the built-in tf-tools substitution map with `${tfTools.debugProfileName}` while removing `${tfTools.debugConfigName}`.
- **Rationale**: Invocation-time loading preserves the required enablement boundary, and the new name variable is a straightforward addition to the existing substitution walk.
- **Alternatives considered**:
  - Preload templates during refresh so UI can validate them early: rejected because template readability must not pre-disable visible actions.
  - Support both `${tfTools.debugProfileName}` and `${tfTools.debugConfigName}`: rejected because the clarified spec requires a hard cutover.

## Decision 6: Keep one startability context key and visible-but-disabled Configuration view actions

- **Decision**: Continue deriving one authoritative boolean such as `tfTools.startDebuggingEnabled` from workspace support, manifest validity, first-match resolution, and executable existence. Use it for Command Palette visibility and for header, overflow, and row-action enablement while keeping the visible Configuration view surfaces contributed unconditionally.
- **Rationale**: The revised selection rule changes the data source but not the UI pattern. One shared startability snapshot remains the smallest way to keep Command Palette visibility and Configuration view enablement in sync.
- **Alternatives considered**:
  - Hide visible actions when the context is not startable: rejected because discoverable disabled actions remain a requirement.
  - Compute separate booleans per surface: rejected because the surfaces would be more likely to disagree.

## Decision 7: Update fixtures and tests as a full cutover rather than layering compatibility cases

- **Decision**: Replace old debug fixtures and tests with component-scoped debug entries, declaration-order selection, optional `when`, and derived executable path coverage, while adding explicit negative coverage for unsupported legacy schema elements where helpful.
- **Rationale**: The old tests are centered on `priority` and profile-level `executable`, so incremental patching would leave a lot of low-signal churn. A full cutover makes the test suite reflect the actual contract.
- **Alternatives considered**:
  - Keep old fixtures and add new ones side-by-side: rejected because they would encode incompatible product contracts at the same time.
  - Skip legacy rejection tests entirely: rejected because the hard-cutover rule is now part of the spec and should be enforced deliberately.
