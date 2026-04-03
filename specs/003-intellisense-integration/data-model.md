# Data Model: IntelliSense Integration

## Artifact Resolution Inputs

- **Purpose**: Represents the manifest and settings inputs required to compute the expected artifact path for the active configuration.
- **Fields**:
  - `artifactsRoot`: resolved absolute path from `tfTools.artifactsPath`
  - `modelId`: active model id
  - `artifactFolder`: selected model's required `artifact-folder`
  - `componentId`: active component id
  - `artifactName`: selected component's required `artifact-name`
  - `targetId`: active target id
  - `artifactSuffix`: selected target's optional `artifact-suffix` or empty string
  - `artifactType`: currently `compile-commands`
- **Validation rules**:
  - `artifactFolder` and `artifactName` must be non-empty because they come from required manifest fields
  - `artifactSuffix` defaults to the empty string when omitted
  - the full compile-commands path is always computed as `<artifactsRoot>/<artifactFolder>/<artifactName><artifactSuffix>.cc.json`

## Active Compile-Commands Artifact

- **Purpose**: Represents the exact compile database that should back IntelliSense for the active configuration.
- **Fields**:
  - `path`: resolved absolute compile-commands path
  - `exists`: boolean filesystem result
  - `status`: `valid` or `missing`
  - `missingReason`: optional user-facing explanation when absent
  - `contextKey`: stable summary of the active model, target, and component that produced the path
- **Relationships**:
  - derived from `Artifact Resolution Inputs`
  - exposed in the tree view as the `Compile Commands` artifact row
  - used by the IntelliSense service to decide whether provider state should be applied or cleared
- **Validation rules**:
  - `status = valid` only when the exact expected path exists
  - a different compile database elsewhere under the artifacts root does not affect this entity

## IntelliSense Provider Readiness

- **Purpose**: Represents whether the extension can currently provide IntelliSense through cpptools.
- **Fields**:
  - `providerInstalled`: whether Microsoft C/C++ is available
  - `providerConfigured`: whether the workspace is configured to use Trezor Firmware Tools as the active provider
  - `warningState`: `none`, `missing-provider`, or `wrong-provider`
  - `lastWarningMessage`: optional visible/logged warning text
- **Relationships**:
  - combined with `Active Compile-Commands Artifact` during refresh to produce final IntelliSense state
- **Validation rules**:
  - `warningState = missing-provider` when cpptools is unavailable
  - `warningState = wrong-provider` when cpptools exists but the active provider setting is not tf-tools
  - `warningState = none` only when both prerequisites are satisfied

## IntelliSense Runtime State

- **Purpose**: Represents what the extension has currently applied to the provider and what the UI should reflect.
- **Fields**:
  - `appliedArtifactPath`: last compile-commands path successfully applied to provider, or `null`
  - `appliedContextKey`: last active-configuration key successfully applied, or `null`
  - `clearedAt`: timestamp of the last explicit stale-state clearing action, or `null`
  - `providerState`: `inactive`, `applied`, or `cleared`
- **State transitions**:
  1. `inactive` on activation before first successful refresh
  2. `applied` when the expected artifact exists and provider prerequisites are satisfied
  3. `cleared` when the expected artifact is missing after prior application
  4. `applied` again when a later refresh finds a valid active artifact and ready provider
- **Validation rules**:
  - `providerState = applied` requires both `exists = true` and `warningState = none`
  - `providerState = cleared` is preferred over retaining a stale `appliedArtifactPath` when the active artifact is missing

## IntelliSense Refresh Request

- **Purpose**: Represents one event that requires IntelliSense recomputation.
- **Fields**:
  - `trigger`: `activation`, `active-config-change`, `successful-build`, `manual-refresh`, `workspace-change`, `provider-change`, `manifest-change`, or `artifacts-path-change`
  - `requestedAt`: timestamp of the trigger
  - `targetContextKey`: active configuration key at scheduling time
- **Relationships**:
  - processed by the serialized refresh coordinator/service
  - refresh recomputes both `Active Compile-Commands Artifact` and `IntelliSense Provider Readiness`
- **Validation rules**:
  - concurrent requests collapse to the latest effective active configuration
  - completion must leave runtime state aligned with the most recent request, not an earlier one

## Provider Warning Record

- **Purpose**: Represents the visible and persistent signal emitted for provider readiness failures.
- **Fields**:
  - `kind`: `missing-provider` or `wrong-provider`
  - `message`: warning text shown to the user
  - `loggedAt`: timestamp of the persistent log write
  - `resolved`: whether a later refresh cleared the condition
- **Validation rules**:
  - each warning record must be both visible to the user and written to the output channel
  - when readiness becomes valid again, the stale warning state is marked resolved on the next refresh