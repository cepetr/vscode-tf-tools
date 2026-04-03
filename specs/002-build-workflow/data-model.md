# Data Model: Build Workflow

## Build Option Definition

- **Purpose**: Represents one manifest-authored build option that can affect UI availability and workflow argument derivation.
- **Fields**:
  - `key`: deterministic internal persistence key (derived from `flag`)
  - `label`: user-visible option name (from `name:` in manifest)
  - `flag`: command-line flag emitted when the option is active (explicit `flag:` field or derived as `--{id}` from the `id:` field)
  - `kind`: `checkbox` or `multistate` (from `type:` or `kind:` in manifest)
  - `group`: optional group heading label
  - `description`: optional tooltip text
  - `when`: optional parsed availability rule
  - `states`: ordered list of multistate values when `kind = multistate`
  - `defaultState`: default multistate value when no explicit selection exists
- **Validation rules**:
  - `flag` must be unique across all options (derived flags must therefore also be unique)
  - `kind` must be one of the supported option kinds
  - multistate values must be unique within the option
  - `when`, when present, must parse successfully and reference only known manifest ids

## Build Option Selection State

- **Purpose**: Represents workspace-scoped user selections for build options independently of the core build context.
- **Fields**:
  - `values`: map of option key to `boolean | string | null`
  - `persistedAt`: ISO timestamp of the latest write
- **Relationships**:
  - keys resolve to `Build Option Definition.key`
  - selections combine with the active build context to form the effective build configuration
- **Validation rules**:
  - checkbox options store `true`, `false`, or `null`
  - multistate options store one declared state value or `null`
  - invalid keys are dropped during normalization
  - currently unavailable options keep their stored value

## `When` Expression

- **Purpose**: Represents the parsed availability rule for a build option.
- **Variants**:
  - predicate: `model(id)`, `target(id)`, `component(id)`
  - logical: `all(children[])`, `any(children[])`, `not(child)`
- **Validation rules**:
  - `all` and `any` require at least one child
  - `not` requires exactly one child
  - referenced ids must exist in the corresponding manifest collections

## Effective Build Configuration

- **Purpose**: Represents the exact context used to compute labels and launch workflow actions.
- **Fields**:
  - `modelId`
  - `targetId`
  - `componentId`
  - `targetDisplay`
  - `enabledOptions`: ordered list of applicable option definitions with normalized selected value
  - `derivedFlags`: ordered command-line flags for target plus applicable options
- **Relationships**:
  - uses the core active configuration from Configuration Experience
  - filters build-option selections through current option availability
- **Validation rules**:
  - unavailable options are excluded from `enabledOptions` and `derivedFlags`
  - invalid manifest state prevents this entity from being constructed for `Build`, `Clippy`, and `Check`

## Workflow Action Descriptor

- **Purpose**: Represents one runnable or blocked workflow action in the UI and task system.
- **Fields**:
  - `action`: `build`, `clippy`, `check`, or `clean`
  - `label`: user-facing task label
  - `commandTitle`: user-facing command title with `Trezor:` prefix
  - `enabled`: whether prerequisites allow execution
  - `disabledReason`: optional explanation for blocked states
  - `subcommand`: xtask subcommand to execute
- **Validation rules**:
  - `Build`, `Clippy`, and `Check` require supported workspace plus manifest-valid effective configuration
  - `Clean` requires supported workspace only

## Validation Issue

- **Purpose**: Represents one actionable manifest or workflow-related failure that can surface through diagnostics or logging.
- **Fields**:
  - `severity`
  - `code`
  - `message`
  - `range`
- **Validation rules**:
  - invalid build-option `when` issues are attached to the manifest and mark Build Workflow as blocked

## State Transitions

### Build option availability lifecycle

1. available and unselected → visible with default checkbox or multistate presentation.
2. available and selected → visible, persisted, and contributes to effective arguments.
3. available → unavailable after active context change → hidden from UI, preserved in storage, removed from effective arguments.
4. unavailable → available again → visible with the previously persisted value restored.

### Workflow action lifecycle

1. blocked by invalid manifest or invalid build-option `when` → visible but disabled, no execution allowed.
2. blocked by unsupported workspace → visible but disabled, no execution allowed.
3. enabled with valid effective configuration → command and task may launch.
4. launched and failed → user gets visible failure plus log entry.