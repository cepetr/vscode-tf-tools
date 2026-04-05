# Data Model: Debug Launch

## Debug Profile

- **Purpose**: Represents one manifest-defined debug entry that may match the active build context.
- **Fields**:
  - `id`: stable internal identifier derived from declaration order or a template-plus-index key for logging and test assertions
  - `when`: parsed `WhenExpression` that determines whether the profile matches the active model, target, and component
  - `priority`: integer priority used for tie-breaking among matching profiles
  - `template`: relative path under `tfTools.debug.templatesPath`
  - `executable`: profile-defined executable path string, relative to the active model artifact folder unless already absolute
  - `vars`: optional map of tf-tools variable names to raw string templates
- **Validation rules**:
  - `template` and `executable` are required non-empty strings
  - `priority` must parse as an integer; omitted priority defaults to `0`
  - `when` uses the same parser and unknown-id validation as the rest of the manifest condition language
  - variable names must use the supported tf-tools variable namespace for profile-defined values

## Debug Profile Resolution

- **Purpose**: Captures the result of matching the active build context against manifest-defined debug profiles.
- **Fields**:
  - `contextKey`: stable active model/target/component key
  - `matchedProfiles`: ordered list of matching profiles before final selection
  - `resolutionState`: `none`, `selected`, or `ambiguous`
  - `selectedProfile`: the single highest-priority profile when `resolutionState = selected`
  - `highestPriority`: highest priority seen among matches
  - `blockedReason`: `no-match`, `ambiguous`, `manifest-invalid`, or `workspace-unsupported`
- **Validation rules**:
  - `selectedProfile` exists only when exactly one highest-priority match remains
  - `ambiguous` requires at least two profiles tied at `highestPriority`
  - `no-match` requires an empty match set

## Executable Artifact State

- **Purpose**: Represents the user-visible `Executable` row state for the active build context.
- **Fields**:
  - `contextKey`: active build-context key
  - `profileResolutionState`: link to the current debug profile resolution
  - `expectedPath`: resolved absolute executable path when a unique profile exists; otherwise empty string
  - `exists`: boolean
  - `status`: `valid` or `missing`
  - `missingReason`: user-facing explanation when the executable cannot be resolved or does not exist
  - `tooltip`: expected-path and missing-reason text shown on the tree row
- **Validation rules**:
  - `expectedPath` uses the selected profile's `executable` value unchanged when absolute
  - relative `executable` values resolve against `<tfTools.artifactsPath>/<artifactFolder>/`
  - `status = valid` only when a unique profile exists and the resolved file exists on disk
  - `missingReason` is required whenever `status = missing`

## Debug Variable Map

- **Purpose**: Represents the built-in and profile-defined tf-tools substitution values used to resolve the executable path and template strings.
- **Fields**:
  - `builtIns`: resolved values for active model, target, component, artifact path, executable path, and executable basename variables
  - `profileVars`: profile-defined raw variable templates
  - `resolvedVars`: final resolved variable values after dependency resolution
  - `resolutionErrors`: list of unknown, unresolved, or cyclic variable failures
- **Validation rules**:
  - built-in variables are always single concrete strings when the required active context exists
  - profile-defined variables may reference built-ins and other profile-defined variables
  - cycles and unknown tf-tools variables are invalid and block launch
  - replacement results are not re-expanded after a variable resolves

## Resolved Debug Template

- **Purpose**: Represents the in-memory debug configuration built from the selected template file and the resolved tf-tools variable map.
- **Fields**:
  - `templateRoot`: resolved absolute `tfTools.debug.templatesPath`
  - `templatePath`: resolved absolute path to the selected template file
  - `templateRelativePath`: manifest-provided template path
  - `parsedTemplate`: JSONC object before substitution
  - `resolvedConfiguration`: final debug configuration object after tf-tools substitution
  - `parseState`: `loaded`, `missing`, `traversal-blocked`, or `invalid`
- **Validation rules**:
  - `templatePath` must stay within `templateRoot` after normalization
  - `parsedTemplate` must be one object representing a single VS Code debug configuration
  - every string field in nested arrays and objects is eligible for tf-tools substitution
  - non-string values remain unchanged

## Start Debugging Availability

- **Purpose**: Represents whether visible Start Debugging surfaces should be enabled and whether the Command Palette entry should be shown.
- **Fields**:
  - `visibleInConfigurationView`: always `true` for header, overflow, and `Executable` row surfaces
  - `commandPaletteVisible`: boolean
  - `enabled`: boolean
  - `blockedReason`: `none`, `workspace-unsupported`, `manifest-invalid`, `no-match`, `ambiguous`, or `missing-executable`
- **Validation rules**:
  - `commandPaletteVisible` is true only when `enabled` is true
  - `enabled` ignores template readability and template parse state before invocation
  - visible Configuration view surfaces remain shown when `enabled` is false

## Debug Launch Request

- **Purpose**: Represents one user-initiated attempt to start debugging from a supported surface.
- **Fields**:
  - `sourceSurface`: `header`, `overflow`, `executable-row`, or `command-palette`
  - `contextKey`: active build-context key
  - `selectedProfileId`: selected profile identifier when available
  - `resolvedConfigurationName`: final debug configuration name passed to VS Code
  - `requestedAt`: timestamp
- **Validation rules**:
  - the request can proceed only when Start Debugging availability is enabled
  - template loading, substitution, and debug API launch happen after the request is created

## Debug Launch Outcome

- **Purpose**: Captures the visible and persistent result of a debug launch attempt.
- **Fields**:
  - `startState`: `started` or `blocked`
  - `finishState`: `succeeded`, `failed`, or `not-started`
  - `userMessage`: explicit error text for blocked or failed outcomes
  - `logMessage`: output-channel entry containing profile, template, variable, or executable detail
  - `failureKind`: `resolution`, `template-missing`, `template-invalid`, `variable-error`, `missing-executable`, `workspace-unsupported`, or `debug-api-failed`
- **Validation rules**:
  - blocked outcomes always produce `startState = blocked` and a user-visible error
  - resolution, template, variable, and missing-executable failures always produce a persistent log entry
  - successful launches do not generate a failure log entry
