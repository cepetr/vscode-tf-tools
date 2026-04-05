# Research: Debug Launch

## Decision 1: Parse manifest `debug` entries into a typed profile model using the existing `when` parser

- **Decision**: Extend manifest validation so `debug` entries are parsed and stored on the loaded manifest state with validated `when`, `priority`, `template`, `executable`, and optional `vars` fields, reusing the same `when` expression language, unknown-id validation, and diagnostics path already used for build-option, `flashWhen`, and `uploadWhen` rules.
- **Rationale**: Debug availability is manifest-driven behavior. Parsing once during manifest load keeps the runtime resolution path deterministic, lets invalid profiles fail through existing manifest diagnostics instead of deferred runtime errors, and preserves one source of truth for model, target, and component matching semantics.
- **Alternatives considered**:
  - Evaluate raw debug-profile strings lazily at command invocation: rejected because it would defer structural and expression errors until runtime and fragment failure reporting.
  - Implement a second matching language specific to debug profiles: rejected because it duplicates `when` semantics and risks inconsistent slice behavior.

## Decision 2: Resolve profile matches by highest priority, and treat equal highest-priority matches as a hard ambiguity

- **Decision**: Build one pure resolution step that filters matching profiles for the active model, target, and component, selects the unique highest-priority profile when one exists, and returns an explicit ambiguous outcome when multiple matches share the same highest priority.
- **Rationale**: The spec requires `priority` ordering without silent fallback. Representing unmatched, unique, and ambiguous outcomes explicitly gives the tree row, menu enablement, and command handler one authoritative answer, which keeps visible disabled states and blocked launches consistent.
- **Alternatives considered**:
  - Pick the first declaration-order match after priority sort: rejected because declaration order is not part of the contract and would silently hide ambiguity.
  - Disable debug support whenever more than one profile matches, even with different priorities: rejected because it ignores the required priority rule.

## Decision 3: Load debugger templates from `tfTools.debug.templatesPath` on demand and parse them as JSONC with `jsonc-parser`

- **Decision**: Resolve the configured templates root on each invocation, reject template paths that escape that root after normalization, read the referenced template file from disk at launch time, and parse it with `jsonc-parser` as one debug-configuration object.
- **Rationale**: The selected slice explicitly requires invocation-time template loading and path-traversal rejection. JSONC is the best fit because the technical spec already calls templates JSONC, and `jsonc-parser` avoids brittle handwritten comment stripping while keeping the implementation small.
- **Alternatives considered**:
  - Preload or cache all template files when the manifest changes: rejected because template failures must not pre-disable visible actions and caching adds invalidation complexity.
  - Parse templates with plain `JSON.parse` after ad hoc comment stripping: rejected because JSONC edge cases are easy to mishandle and the repository already favors small focused dependencies over bespoke parsers when behavior is format-sensitive.

## Decision 4: Resolve tf-tools substitutions through a cycle-aware variable map and one recursive string-walk over the parsed template

- **Decision**: Construct a substitution map from built-in active-context variables plus optional profile-defined `vars`, resolve profile-defined variables with cycle detection, then walk the parsed template recursively so every string field in nested objects and arrays receives single-pass tf-tools token replacement while non-string values and non-tf-tools variable syntaxes remain untouched.
- **Rationale**: The spec requires nested replacement, embedded token replacement, non-string preservation, non-tf-tools pass-through, and no re-expansion of replacement results. A single recursive walker over parsed JSONC values with a resolved map satisfies those semantics directly and is easy to unit-test.
- **Alternatives considered**:
  - Perform repeated global substitution passes until strings stop changing: rejected because it violates the no-re-expansion rule and can hide variable cycles.
  - Restrict substitution to a known list of top-level debug fields: rejected because the slice explicitly requires nested objects and arrays.

## Decision 5: Reuse the artifact-resolution seam for `Executable` state, but keep profile resolution separate from compile-commands and Flash/Upload ownership

- **Decision**: Extend the existing artifact-resolution helper layer with executable-artifact derivation and status reporting, while keeping debug-profile resolution, template loading, and substitution in a focused debug-launch helper rather than mixing them into IntelliSense or Flash/Upload modules.
- **Rationale**: The executable row is another Build Artifacts state computation, so path derivation and missing-reason handling belong with the existing artifact helpers. Profile matching and launch preparation are distinct concerns, and keeping them in one focused helper preserves slice boundaries and avoids turning `artifact-resolution.ts` into a general-purpose debug service.
- **Alternatives considered**:
  - Compute executable state directly inside the tree provider: rejected because row rendering should consume prepared state rather than own manifest and filesystem logic.
  - Fold all debug logic into `src/extension.ts`: rejected because command handling, template parsing, and substitution would make the composition root harder to reason about and harder to test.

## Decision 6: Use one startability context key for Command Palette visibility and menu enablement, but keep visible surfaces unconditional in the Configuration view

- **Decision**: Derive one authoritative boolean such as `tfTools.startDebuggingEnabled` from workspace support, manifest validity, unique profile resolution, and executable existence, use it for `menus.commandPalette` visibility and for header, overflow, and row-action `enablement`, and keep the visible Configuration view surfaces contributed unconditionally for their view locations so they remain discoverable even when disabled.
- **Rationale**: The Command Palette must hide the command when the context is not uniquely startable, while the visible Configuration view surfaces must stay present but disabled. Splitting contribution visibility from enablement through one shared state snapshot is the smallest way to keep those surfaces synchronized.
- **Alternatives considered**:
  - Always show the command in the Command Palette and block only at runtime: rejected because the slice explicitly requires hiding it there.
  - Hide header, overflow, or row actions when debugging is unavailable: rejected because the slice explicitly requires discoverable disabled actions.

## Decision 7: Launch via `vscode.debug.startDebugging` with explicit logging around all blocked or failed resolution stages

- **Decision**: Keep `tfTools.startDebugging` as a thin command handler that computes the current debug state, loads and resolves the template, then calls `vscode.debug.startDebugging` with the final in-memory configuration. All blocked states and runtime failures log to the `Trezor Firmware Tools` output channel with enough profile, template, variable, or executable detail to diagnose the cause.
- **Rationale**: The feature spec forbids launch.json persistence and requires VS Code debug API launch plus persistent logs. Wrapping the full resolution chain in one command path ensures user-facing errors and output-channel entries stay aligned.
- **Alternatives considered**:
  - Generate a temporary `launch.json` entry and delegate to the built-in debugger: rejected because the slice forbids persistence and treats the template as input, not generated workspace configuration.
  - Log only unexpected exceptions and skip expected blocked-launch reasons: rejected because the slice explicitly requires persistent logs for profile, template, variable, and executable failures.
