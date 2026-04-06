# Data Model: Debug Launch

## Manifest Target Debug Inputs

- **Purpose**: Provide target-scoped values that influence executable derivation and user-facing target labels.
- **Fields**:
  - `id`: target identifier
  - `name`: user-facing target label
  - `shortName`: optional compact target label
  - `artifactSuffix`: optional suffix appended to the selected component `artifactName`
  - `executableExtension`: optional suffix appended after `<artifactName><artifactSuffix>` for debug executable resolution
- **Validation rules**:
  - `id` and `name` are required non-empty strings
  - `artifactSuffix` and `executableExtension` are optional strings and default to empty when omitted

## Component Debug Entry

- **Purpose**: Represent one ordered debug entry declared under the selected component.
- **Fields**:
  - `id`: stable internal identifier derived from component id plus declaration index for logging and tests
  - `componentId`: owning component id
  - `name`: manifest-defined debug profile name exposed as `${tfTools.debugProfileName}`
  - `template`: relative path under `tfTools.debug.templatesPath`
  - `when`: optional parsed `WhenExpression`; omitted means match-all for the owning component
  - `vars`: optional map of additional tf-tools variable names to raw string templates
  - `declarationIndex`: zero-based position inside the owning component's `debug` array
- **Validation rules**:
  - `name` and `template` are required non-empty strings
  - `when` uses the same parser and unknown-id validation as the rest of the manifest condition language
  - `vars` values must be strings and may reference built-in tf-tools variables and sibling `vars` keys only when they resolve without cycles
  - legacy top-level `debug`, `priority`, profile-level `executable`, and `${tfTools.debugConfigName}` are unsupported

## Debug Entry Match Result

- **Purpose**: Capture the result of evaluating the selected component's ordered debug entries against the active build context.
- **Fields**:
  - `contextKey`: stable active model/target/component key
  - `candidateEntries`: ordered debug entries declared on the selected component
  - `matchingEntries`: ordered subset whose `when` matches the active build context, with omitted `when` treated as match-all
  - `resolutionState`: `selected` or `no-match`
  - `selectedEntry`: first matching entry when `resolutionState = selected`
  - `blockedReason`: `no-match`, `manifest-invalid`, or `workspace-unsupported`
- **Validation rules**:
  - `selectedEntry` exists only when at least one matching entry is present
  - `matchingEntries[0]` and `selectedEntry` refer to the same entry when `resolutionState = selected`

## Executable Artifact State

- **Purpose**: Represent the user-visible `Executable` row state for the active build context.
- **Fields**:
  - `contextKey`: active build-context key
  - `matchState`: link to the current debug-entry match result
  - `expectedFileName`: derived executable file name `<artifactName><artifactSuffix><executableExtension>`
  - `expectedPath`: absolute executable path `<tfTools.artifactsPath>/<artifactFolder>/<expectedFileName>` when derivation succeeds
  - `exists`: boolean
  - `status`: `valid` or `missing`
  - `missingReason`: user-facing explanation when the executable cannot be derived or does not exist
  - `tooltip`: expected-path and missing-reason text shown on the tree row
- **Validation rules**:
  - `status = valid` only when a matching debug entry exists and the derived file exists on disk
  - `missingReason` is required whenever `status = missing`
  - `expectedPath` is empty only when manifest-invalid, workspace-unsupported, or derivation prerequisites are missing

## Debug Variable Map

- **Purpose**: Represent the built-in and debug-entry-defined tf-tools values used to resolve template strings.
- **Fields**:
  - `builtIns`: resolved values for artifact path, model, target, component, debug profile name, executable name, and executable path
  - `entryVars`: raw `debug.vars` values from the selected entry
  - `resolvedVars`: final resolved values after dependency resolution
  - `resolutionErrors`: list of unknown, unresolved, or cyclic variable failures
- **Validation rules**:
  - built-in variables are concrete strings whenever the active context and executable derivation inputs exist
  - `${tfTools.debugProfileName}` resolves from the selected debug entry `name`
  - `${tfTools.executable}` and `${tfTools.executablePath}` are derived values, not manifest-authored path fragments
  - cycles and unknown tf-tools variables are invalid and block launch
  - replacement results are not re-expanded after a variable resolves

## Resolved Debug Template

- **Purpose**: Represent the in-memory debug configuration built from the selected template file and the resolved variable map.
- **Fields**:
  - `templateRoot`: resolved absolute `tfTools.debug.templatesPath`
  - `templatePath`: resolved absolute path to the selected template file
  - `templateRelativePath`: manifest-provided template path
  - `parsedTemplate`: JSONC object before substitution
  - `resolvedConfiguration`: final debug configuration object after tf-tools substitution
  - `parseState`: `loaded`, `missing`, `traversal-blocked`, or `invalid`
- **Validation rules**:
  - `templatePath` must stay within `templateRoot` after normalization
  - `parsedTemplate` must be one JSON object representing a single VS Code debug configuration
  - every string field in nested arrays and objects is eligible for tf-tools substitution
  - non-string values remain unchanged

## Start Debugging Availability

- **Purpose**: Represent whether visible Start Debugging surfaces should be enabled and whether the Command Palette entry should be shown.
- **Fields**:
  - `visibleInConfigurationView`: always `true` for header, overflow, and `Executable` row surfaces
  - `commandPaletteVisible`: boolean
  - `enabled`: boolean
  - `blockedReason`: `none`, `workspace-unsupported`, `manifest-invalid`, `no-match`, or `missing-executable`
- **Validation rules**:
  - `commandPaletteVisible` is true only when `enabled` is true
  - `enabled` ignores template readability and template parse state before invocation
  - visible Configuration view surfaces remain shown when `enabled` is false

## Debug Launch Request

- **Purpose**: Represent one user-initiated attempt to start debugging from a supported surface.
- **Fields**:
  - `sourceSurface`: `header`, `overflow`, `executable-row`, or `command-palette`
  - `contextKey`: active build-context key
  - `selectedEntryId`: selected debug-entry identifier when available
  - `resolvedConfigurationName`: final debug configuration name passed to VS Code
  - `requestedAt`: timestamp
- **Validation rules**:
  - the request proceeds only when Start Debugging availability is enabled
  - template loading, substitution, and debug API launch happen after the request is created

## Debug Launch Outcome

- **Purpose**: Capture the visible and persistent result of a debug launch attempt.
- **Fields**:
  - `startState`: `started` or `blocked`
  - `finishState`: `succeeded`, `failed`, or `not-started`
  - `userMessage`: explicit error text for blocked or failed outcomes
  - `logMessage`: output-channel entry containing entry, template, variable, or executable detail
  - `failureKind`: `resolution`, `template-missing`, `template-invalid`, `variable-error`, `missing-executable`, `workspace-unsupported`, or `debug-api-failed`
- **Validation rules**:
  - blocked outcomes always produce `startState = blocked` and a user-visible error
  - resolution, template, variable, and missing-executable failures always produce a persistent log entry
  - successful launches do not generate a failure log entry
