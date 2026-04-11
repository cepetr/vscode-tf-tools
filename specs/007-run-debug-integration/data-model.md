# Data Model: Run And Debug Integration

## Entity: Active Debug Context

Represents the current tf-tools state from which all debug availability and launch behavior is derived.

**Fields**:

- `modelId`: active model identifier
- `targetId`: active target identifier
- `componentId`: active component identifier
- `manifestStatus`: loaded, missing, or invalid
- `hasDebugBlockingIssues`: whether manifest debug validation blocks launch
- `artifactsRoot`: resolved artifacts directory
- `templatesRoot`: resolved debug templates directory

**Validation rules**:

- Must resolve to real manifest model, target, and component entries before debugging is considered available.
- Exists only for a single-root workspace.

## Entity: Matching Debug Profile Set

Represents the ordered set of component-owned debug profiles whose `when` expressions match the active debug context.

**Fields**:

- `componentId`: owning component identifier
- `profiles`: ordered array of matching debug profiles
- `count`: number of matching profiles
- `defaultProfileId`: identifier of the first matching profile, when present

**Validation rules**:

- Order must preserve manifest declaration order.
- Profiles without a `when` condition behave as match-all entries.
- Empty set means tf-tools debugging is unavailable for the active build context.

## Entity: Default Debug Profile

Represents the one profile used by direct `Start Debugging` actions and by the default Run and Debug entry.

**Fields**:

- `profileId`: manifest debug profile identifier
- `name`: user-facing profile name
- `declarationIndex`: original manifest order index
- `componentId`: owning component identifier

**Validation rules**:

- Must always equal the first entry in the matching debug profile set.
- Must not be overridden by any separate priority field or persisted preference.

## Entity: Generated Run And Debug Configuration

Represents one tf-tools-generated entry shown to the user in Run and Debug.

**Fields**:

- `mode`: `default` or `profile`
- `name`: user-visible label
- `profileId`: backing manifest debug profile identifier
- `contextKey`: active build-context identity used to detect stale launches
- `type`: tf-tools proxy debug type
- `request`: launch request kind used by the proxy configuration

**Validation rules**:

- A default entry exists only when the matching debug profile set is non-empty and the executable artifact exists.
- One profile-specific entry exists for each matching profile when availability conditions are met.
- Labels must distinguish the default entry from profile-specific entries.

## Entity: Launch Materialization Result

Represents the resolved launch request that tf-tools hands to VS Code after loading the selected template and applying tf-tools substitution.

**Fields**:

- `profileId`: selected profile identifier
- `debugProfileName`: selected profile display name
- `executablePath`: derived executable artifact path
- `artifactPath`: derived artifact folder path
- `resolvedConfiguration`: final debug configuration object
- `failureReason`: launch-blocking reason when materialization fails

**Validation rules**:

- Requires a valid executable artifact path.
- Requires a loadable template under the configured templates root.
- Requires successful tf-tools variable resolution with no unknown or cyclic tf-tools references.

## Relationships

- One `Active Debug Context` yields zero or one `Matching Debug Profile Set`.
- One non-empty `Matching Debug Profile Set` yields exactly one `Default Debug Profile`.
- One non-empty `Matching Debug Profile Set` and a valid executable artifact yield one default `Generated Run And Debug Configuration` plus zero or more profile-specific generated configurations.
- Each `Generated Run And Debug Configuration` materializes into one `Launch Materialization Result` at launch time.

## State Transitions

1. `Unsupported or invalid context` -> no matching set, no generated Run and Debug entry, direct action blocked.
2. `Loaded context without matching profiles` -> empty matching set, no generated Run and Debug entry, direct action unavailable.
3. `Loaded context with matching profiles but missing executable` -> matching set present, no launchable generated entry, direct action unavailable.
4. `Loaded context with matching profiles and valid executable` -> generated default and profile-specific entries become available.
5. `Launch requested` -> selected generated entry or direct action resolves the selected profile into a materialized debug configuration.
6. `Materialization failure` -> launch blocked with user-visible error and log entry.
7. `Materialization success` -> VS Code starts the debug session and reveals Run and Debug.