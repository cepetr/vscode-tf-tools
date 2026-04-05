# Data Model: Flash/Upload Actions

## Component Action Rules

- **Purpose**: Represents the selected component's manifest-driven Flash and Upload applicability rules for the active build context.
- **Fields**:
  - `componentId`: selected component identifier
  - `flashWhen`: parsed expression or `null` when omitted
  - `uploadWhen`: parsed expression or `null` when omitted
  - `validationState`: `valid` or `invalid`
- **Validation rules**:
  - `flashWhen` and `uploadWhen` use the same expression language and unknown-id validation as option `when`
  - omitted rules make the corresponding action unavailable
  - invalid rules surface as manifest validation issues and prevent the action from becoming startable

## Artifact Row State

- **Purpose**: Represents the user-visible state for one Build Artifacts row in the active configuration.
- **Fields**:
  - `rowKind`: `binary` or `map`
  - `contextKey`: stable active model/target/component key
  - `expectedPath`: resolved absolute artifact path
  - `status`: `valid` or `missing`
  - `exists`: boolean
  - `missingReason`: user-facing explanation when `status` is `missing`
  - `tooltip`: expected-path plus missing-reason text
- **Validation rules**:
  - `expectedPath` must derive from `<tfTools.artifactsPath>/<artifactFolder>/<artifactName><artifactSuffix>` with the correct extension for the row kind
  - `tooltip` always includes the expected path
  - `missingReason` is present whenever `status` is `missing`

## Artifact Action Availability

- **Purpose**: Represents whether Flash, Upload, or Map File open should be shown and whether the shown action is enabled.
- **Fields**:
  - `actionKind`: `flash`, `upload`, or `open-map`
  - `visible`: boolean
  - `enabled`: boolean
  - `applicable`: boolean
  - `blockedReason`: `none`, `missing-artifact`, `manifest-invalid`, `workspace-unsupported`, or `inapplicable`
  - `commandPaletteVisible`: boolean for public Flash/Upload actions only
- **Validation rules**:
  - Flash or Upload is visible on the Binary row only when its action rule is applicable
  - Flash or Upload remains visible but disabled when applicable and the binary artifact is missing
  - Map File open remains visible but disabled when the map artifact is missing
  - Command Palette visibility is true only for applicable Flash and Upload actions

## Artifact Action Request

- **Purpose**: Represents one user-initiated request to run Flash or Upload.
- **Fields**:
  - `actionKind`: `flash` or `upload`
  - `sourceSurface`: `binary-row` or `command-palette`
  - `modelId`: active model id
  - `componentId`: active component id
  - `componentName`: active component name
  - `targetId`: active target id
  - `taskTitle`: user-facing task or execution title
  - `commandLine`: xtask subcommand and derived arguments
  - `requestedAt`: timestamp
- **Validation rules**:
  - request creation is allowed only when the action is applicable and the binary artifact exists
  - Flash command line is `xtask flash <component-id> -m <model-id>`
  - Upload command line is `xtask upload <component-id> -m <model-id>`

## Map File Open Request

- **Purpose**: Represents one request to open the resolved map file in the current editor.
- **Fields**:
  - `contextKey`: active model/target/component key
  - `path`: resolved map-file path
  - `exists`: boolean
  - `requestedAt`: timestamp
- **Validation rules**:
  - the request opens the file only when `exists` is true
  - missing map files do not trigger file open and leave the action disabled

## Artifact Action Outcome

- **Purpose**: Represents the visible and persistent outcome of an attempted Flash or Upload action.
- **Fields**:
  - `actionKind`: `flash` or `upload`
  - `startState`: `started` or `blocked`
  - `finishState`: `succeeded`, `failed`, or `not-started`
  - `userMessage`: visible error text for blocked or failed outcomes
  - `logMessage`: output-channel entry when runtime failure occurs
  - `triggersRefresh`: boolean
- **Validation rules**:
  - blocked starts always produce `startState = blocked` and a visible error
  - post-start failures always produce `finishState = failed`, a visible error, and a log message
  - successful outcomes always set `triggersRefresh` to `false`