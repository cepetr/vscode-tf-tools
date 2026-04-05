# Research: IntelliSense Integration

## Decision 1: Resolve compile-commands paths strictly from settings plus manifest artifact metadata

- **Decision**: Derive the active compile-commands artifact path from `tfTools.artifactsPath`, the selected model's required `artifactFolder`, the selected component's required `artifactName`, and the selected target's optional `artifactSuffix`, producing `<artifacts-root>/<artifactFolder>/<artifactName><artifactSuffix>.cc.json`.
- **Rationale**: The corrected informal specification now makes artifact layout fully manifest-driven. Encoding that rule once in a dedicated resolver prevents drift between the tree view, IntelliSense provider integration, and future artifact consumers.
- **Alternatives considered**:
  - Continue deriving paths from model id and component id: rejected because that no longer matches the agreed manifest schema.
  - Add heuristic fallback search under the artifacts root: rejected because the constitution and spec forbid silent fallback to alternate artifacts.

## Decision 2: Add a focused IntelliSense service with a thin cpptools adapter

- **Decision**: Introduce a small IntelliSense service that owns refresh triggers, artifact resolution, provider readiness checks, and state clearing, with a separate thin adapter that speaks to Microsoft C/C++ as the custom configuration provider boundary.
- **Rationale**: `src/extension.ts` already coordinates activation and existing services. A focused service keeps activation manageable while isolating the provider-specific behavior from tree and manifest logic. A thin adapter also makes provider readiness easier to test and mock.
- **Alternatives considered**:
  - Put all IntelliSense logic directly in `src/extension.ts`: rejected because refresh coordination, provider checks, and artifact status updates would make activation too dense.
  - Merge provider logic into the tree provider: rejected because UI state and editor-integration responsibilities would become tightly coupled.

## Decision 3: Clear previously applied IntelliSense configuration when the active artifact is missing

- **Decision**: When refresh determines that the expected active compile-commands artifact is missing, clear any previously applied compile-commands configuration instead of leaving stale configuration active.
- **Rationale**: This was explicitly clarified in the feature spec. Clearing state preserves trust: users should never receive editor assistance that still reflects a different build context while the UI reports the active artifact as missing.
- **Alternatives considered**:
  - Keep the last known compile database active and warn it is stale: rejected because it violates the no-fallback requirement and creates misleading editor behavior.
  - Delay clearing until the next activation: rejected because stale state would persist through the current session.

## Decision 4: Use existing notifications and output-channel logging surfaces for failure visibility

- **Decision**: Reuse the current `Trezor Firmware Tools` output channel plus VS Code warning notifications for provider-readiness failures, while treating missing compile-commands artifacts as row-level state plus log entry rather than popup notifications.
- **Rationale**: The current extension already has dedicated logging and visible notification helpers. The informal spec distinguishes between provider prerequisites, which deserve explicit warnings, and missing artifacts, which should remain visible in the `Build Artifacts` section without additional popups.
- **Alternatives considered**:
  - Create a separate IntelliSense output channel: rejected because it fragments troubleshooting.
  - Show popup notifications for every missing compile-commands artifact: rejected because the user spec explicitly says missing artifact state should be communicated in the tree section instead.

## Decision 5: Expose manual refresh as one command contributed to both required surfaces

- **Decision**: Contribute one `tfTools.refreshIntelliSense` command and surface it in both the Configuration view title/overflow and the Command Palette.
- **Rationale**: The clarification requires both surfaces, and one command id keeps telemetry, tests, and implementation behavior aligned. The command can simply delegate into the same refresh path used by activation and state changes.
- **Alternatives considered**:
  - Separate view-only and palette-only commands: rejected because it duplicates logic and increases drift risk.
  - View action only: rejected by clarification.

## Decision 6: Treat refresh work as serialized state recomputation triggered from existing extension events

- **Decision**: Funnel activation, active-context changes, successful builds, provider-availability changes, manifest-path changes, manifest-content changes, and relevant settings changes into one serialized refresh path that recomputes artifact status and provider readiness before touching the tree or provider state.
- **Rationale**: The extension already coordinates state changes centrally. Serializing refresh prevents races where a build completion, settings change, and active-context change could otherwise reapply stale compile-database state out of order.
- **Alternatives considered**:
  - Let each trigger update IntelliSense independently: rejected because concurrent refreshes would make stale-state clearing and final-state correctness hard to reason about.
  - Poll the filesystem for compile-commands changes: rejected because it is unnecessary for the specified trigger set and adds background complexity.

## Decision 7: Translate the active compile database eagerly into cpptools file and browse configurations

- **Decision**: Eagerly parse the active `.cc.json` file during refresh, index entries by normalized absolute source-file path, translate each entry into a cpptools `SourceFileConfiguration`, and build a browse snapshot whose `browsePath` is the de-duplicated union of include paths across the active database.
- **Rationale**: The cpptools custom configuration provider API consumes per-file configurations, not a compile-database path. Eager parsing keeps refresh behavior deterministic and ensures `.c` and `.cpp` files can each retain their own inferred language mode and standards.
- **Alternatives considered**:
  - Pass only the compile-database path to cpptools: rejected because the custom provider API does not consume a raw compile-database path and would leave IntelliSense effectively unconfigured.
  - Parse entries lazily on file request: rejected because the product already centers refresh around active-context changes and because eager parsing simplifies tree-state synchronization and browse-configuration generation.
  - Merge duplicate entries for the same file: rejected because the compile database should not contain duplicates and merging would create non-obvious precedence rules; first-entry-wins is deterministic and simple.

## Decision 8: Require tf-tools to be the explicit active configuration provider and offer a workspace fix when it is not

- **Decision**: Treat `C_Cpp.default.configurationProvider` as a strict prerequisite: when cpptools is installed, readiness is `ready` only if the workspace provider is set to the tf-tools provider id, and the wrong-provider warning offers a one-step workspace fix that writes that setting.
- **Rationale**: The informal spec requires an inactive tf-tools provider configuration to fail visibly rather than silently proceeding. Treating an empty or unrelated provider value as acceptable would leave cpptools free to use stale or competing configuration sources while the extension claims IntelliSense is aligned.
- **Alternatives considered**:
  - Treat an empty provider setting as implicitly acceptable: rejected because cpptools would not be instructed to use tf-tools and the extension could not guarantee that its per-file configurations are authoritative.
  - Only warn without offering a fix: rejected because the user spec explicitly calls for a corrective workspace-setting path, and the setting can be changed safely and explicitly.