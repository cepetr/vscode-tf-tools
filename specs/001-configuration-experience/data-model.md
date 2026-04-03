# Data Model: Configuration Experience

## Manifest State

- **Purpose**: Represents the current load status of the workspace manifest and whether configuration choices can be trusted.
- **Fields**:
  - `status`: one of `loaded`, `missing`, `invalid`
  - `manifestUri`: resolved workspace URI for `tf-tools.yaml`
  - `models`: ordered list of manifest-defined model entries
  - `targets`: ordered list of manifest-defined target entries
  - `components`: ordered list of manifest-defined component entries
  - `validationIssues`: ordered list of file-backed or manifest-level issues
  - `loadedAt`: timestamp of the latest successful parse attempt
- **Validation rules**:
  - `models`, `targets`, and `components` must all be non-empty before `status` can be `loaded`
  - duplicate ids, missing required fields, and structural YAML errors force `status = invalid`
  - missing or unreadable manifest file forces `status = missing`

## Manifest Entry

- **Purpose**: Represents one selectable item from the manifest catalog.
- **Fields**:
  - `id`: stable manifest identifier used for persistence and matching
  - `name`: user-visible label
  - `shortName`: optional user-visible shorthand for targets only
  - `kind`: one of `model`, `target`, `component`
- **Validation rules**:
  - `id` and `name` are required non-empty strings
  - ids must be unique within their own manifest collection

## Active Configuration

- **Purpose**: Represents the workspace-scoped active build context selected by the user.
- **Fields**:
  - `modelId`
  - `targetId`
  - `componentId`
  - `persistedAt`
- **Relationships**:
  - each id must resolve to an entry in the current loaded manifest state
  - the status bar and tree view read from this entity
- **Validation rules**:
  - all three ids must be present when manifest state is `loaded`
  - invalid persisted ids are replaced during normalization with the first valid manifest entry for that selector

## Validation Issue

- **Purpose**: Represents one actionable manifest problem that the user can inspect.
- **Fields**:
  - `severity`: warning or error
  - `message`: user-visible explanation
  - `range`: optional source range in the manifest file
  - `code`: stable internal category such as `yaml-parse`, `duplicate-id`, or `missing-field`
- **Relationships**:
  - validation issues feed both diagnostics and log output
- **Validation rules**:
  - issues attached to a file range must reference the resolved manifest URI

## Configuration View State

- **Purpose**: Represents derived UI state for the `Configuration` tree.
- **Fields**:
  - `topLevelSections`: fixed ordered set of `Build Context`, `Build Options`, `Build Artifacts`
  - `expandedSelector`: optional selector currently expanded in `Build Context`
  - `buildContextRows`: derived selector rows and choice rows
  - `optionsPlaceholder`: placeholder or warning content for `Build Options`
  - `artifactsPlaceholder`: placeholder or warning content for `Build Artifacts`
- **Validation rules**:
  - only `Build Context` may contain interactive rows in this feature slice
  - placeholder sections may not expose build, artifact, or debug actions
  - selector headers display model `name`, target `shortName` when present otherwise target `name`, and component `name`
  - `expandedSelector` is either unset or equal to exactly one of `model`, `target`, or `component`

## Status Bar Presentation

- **Purpose**: Represents the visible status-bar item for the active configuration.
- **Fields**:
  - `visible`: boolean derived from workspace settings and manifest availability
  - `text`: formatted as `{model-name} | {target-display} | {component-name}`
  - `command`: reveal configuration view
- **Validation rules**:
  - `target-display` uses `shortName` when present, otherwise target `name`
  - item is hidden when the corresponding workspace setting disables it

## State Transitions

### Manifest lifecycle

1. `missing` → `loaded` when the manifest becomes available and validates successfully.
2. `loaded` → `invalid` when a file change introduces parse or validation errors.
3. `invalid` → `loaded` when the manifest is corrected and passes validation.
4. any state → `missing` when the manifest path resolves to no readable file.

### Active configuration lifecycle

1. no saved selection → normalized default selection after the first successful manifest load.
2. saved valid selection → restored as-is after manifest load.
3. saved stale selection → normalized to valid manifest entries and re-persisted.
4. user changes any selector → active configuration updates immediately and status-bar text is recomputed.