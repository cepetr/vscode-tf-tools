# Trezor Firmware Tools Technical Specification

## Purpose

This document captures the technical architecture of the extension at a high level. It complements the product specification and is intended as guidance for future implementation rather than a file-by-file description.

Unless noted otherwise, product-facing names in this document follow the naming from the specification:

- product name: `Trezor Firmware Tools`
- settings namespace: `tfTools`
- manifest filename: `tf-tools-manifest.yaml`

## Architecture Overview

The extension is organized around a single activation flow that wires together six main subsystems:

1. workspace resolution and command gating
2. manifest loading and normalization
3. tree view state and interaction handling
4. task-based command execution
5. IntelliSense integration
6. excluded-file detection and UI markers

The activation layer acts as the composition root. It constructs services, registers commands and providers, subscribes to VS Code events, and coordinates refresh flows.

For the Configuration Experience slice, activation must be early enough that the extension can render a visible missing-manifest or unsupported-workspace state. The extension therefore cannot rely only on manifest-presence activation events because the user still needs the tree view, log command, and warning-state UI when `tf-tools-manifest.yaml` is absent.

## Core Modules

- activation root: command registration, service wiring, event subscriptions
- manifest service: YAML parsing, validation, file watching, manifest status management
- diagnostics service: VS Code diagnostics production for actionable file-backed validation issues
- log service: output-channel logging for runtime warnings, errors, and debug detail
- tree view provider: section layout, selection state, grouped option rendering, status rows
- shared model layer: active configuration, build artifact status, IntelliSense state, excluded-file state
- persistence layer: workspace-state persistence and manifest-aware normalization
- task provider: VS Code build-task exposure for build, clippy, check, and clean
- status-bar integration: active configuration presentation and navigation into the configuration view
- command invocation layer: command-line argument derivation for `cargo xtask`
- IntelliSense service: active artifact resolution, provider lifecycle, warnings, refresh behavior
- provider adapter: compile-database parsing and editor integration
- excluded-files service: inclusion checks, scope evaluation, excluded-file state
- explorer decoration layer: badge and optional graying
- editor overlay layer: first-line warning banner
- refresh coordinator: serialized refresh orchestration
- workspace guard: single-root enforcement and command start errors

## Runtime Data Model

### Active Build Configuration

The active configuration contains:

- `model`
- `target`
- `component`
- `buildOptions`
- `persistedAt`

`buildOptions` is a map keyed by an internal option key, with values of `boolean | string | null`.

### Manifest Model

The manifest model contains:

- `models[]`: `id`, `name`, required `artifact-folder`
- `targets[]`: `id`, `name`, optional `shortName`, optional `artifact-suffix`, `flag`
- `components[]`: `id`, `name`, required `artifact-name`, optional `flashWhen`, optional `uploadWhen`
- `options[]`: option metadata with label, command-line flag, type, optional group, optional `when` expression, and optional states

Manifest status has three states:

- `loaded`
- `missing`
- `invalid`

### Build Artifact Model

Build-artifact state tracks:

- expected artifact path
- whether the artifact exists
- why it is missing
- the user-facing `valid` or `missing` status

### Excluded-File Model

Excluded-file state tracks file inclusion, scope rules, marker preferences, and refresh timing.

## Activation And Lifecycle

For the Configuration Experience slice, the extension should activate on startup so the configuration view provider and status-bar surface are registered before the user opens the activity-bar container in any single-folder workspace.

The activation sequence is:

1. Register the configuration tree provider and shared commands.
2. Resolve workspace root and single-root command constraints.
3. Create persistence services and the status-bar surface.
4. Resolve manifest path from settings and load the manifest.
5. Start watching the manifest file.
5. Register the task provider.
6. Create IntelliSense and excluded-file services.
7. Register explorer decorations and editor overlays.
8. Restore persisted configuration and normalize it against the manifest when available.
9. Apply initial IntelliSense state.
10. Compute initial excluded-file state.
11. Register tree-view handlers.
12. Register commands.
13. Register workspace, extension, editor, and configuration change listeners.

Dependencies are passed through constructor arguments and closures. A separate dependency injection framework is not required.

Packaging for distribution should bundle runtime dependencies into the extension entry point so the installed VSIX does not depend on shipping a full `node_modules/` tree. A package smoke check should verify both that the bundled entry point loads with only the `vscode` host API externalized and that the VSIX contains the expected bundle and icon assets.

## Manifest Loading And Normalization

The manifest parser enforces:

- top-level YAML mapping
- non-empty `models`, `targets`, and `components`
- unique ids within those arrays
- non-empty required strings
- optional `options`
- `checkbox` and `multistate` option types only
- unique multistate values inside a single option
- valid `when` expressions when present
- valid `flashWhen` expressions when present
- valid `uploadWhen` expressions when present
- valid references inside `when` to known model, target, and component ids

`flashWhen` and `uploadWhen` use the same expression language, parser, and validation rules as option `when`.

The `when` expression language is intentionally small:

- logical forms: `all(...)`, `any(...)`, `not(...)`
- predicates: `model(id)`, `target(id)`, `component(id)`
- `all(...)` and `any(...)` require at least one child expression
- `not(...)` requires exactly one child expression
- bare identifiers are not supported

Parsing may be implemented as a small recursive-descent parser. The parser should produce an internal expression tree that can be evaluated against an active build context.

Manifest validation should produce structured diagnostics with severity, message, and source location when available. Diagnostics should be attached to the configured manifest file so invalid `tf-tools-manifest.yaml` content appears in the Problems view and editor.

If an option's `when` expression evaluates to `false` for the active build context, that option is unavailable. Unavailable options are excluded from the rendered Build Options tree, are not user-selectable in the current context, and do not participate in effective build-argument derivation until the active build context makes them available again.

The manifest service stores manifest status and manages a watcher bound to the configured manifest file path.

Persisted configuration normalization:

- resets invalid `model`, `target`, and `component` values to the first available manifest entry
- drops persisted build-option entries whose internal keys are no longer valid
- retains persisted values for options that are currently unavailable because their `when` condition evaluates to `false`

Because `tf-tools-manifest.yaml` does not expose user-authored option ids, the implementation requires an internal key-generation strategy for option persistence, selection state, and state lookup.

## Diagnostics And Logging

The extension uses two persistent reporting mechanisms in addition to transient notifications:

- VS Code diagnostics for actionable file-backed problems
- a dedicated VS Code output channel for runtime logs

Diagnostics design:

- diagnostics are produced for manifest parse and validation failures
- diagnostics cover malformed YAML, invalid schema shape, duplicate ids, duplicate option flags, invalid condition expressions, unknown references, and missing required fields
- diagnostics should include precise ranges when the parser can provide them
- when no precise range is available, diagnostics may attach to the manifest file at a fallback location
- diagnostics are cleared and recomputed when the manifest file content or manifest path changes

Log-channel design:

- the extension owns a dedicated output channel named `Trezor Firmware Tools`
- log entries are written with severity and enough context to diagnose failures
- the log channel records manifest-load failures, refresh failures, task-launch failures, provider integration failures, and unexpected exceptions
- user-facing commands may reveal the log channel when needed

## Tree View Architecture

The tree view uses a fixed root layout with three sections:

- `Build Selection`
- `Build Options`
- `Build Artifacts`

Important structural elements:

- top-level section items
- collapsible selector and multistate parent rows
- leaf choice rows
- checkbox option rows
- grouped build-option headings
- status rows
- row-scoped action buttons for artifact operations

The tree view keeps one shared active configuration object and emits change notifications to listeners. Group open state is tracked so selector and multistate rows behave like an accordion.

Implementation note: accordion-style tree rows must be backed by a real `TreeView` instance and expand/collapse event handling, not only by provider-side child filtering. When one row opens and another closes as part of the same interaction, collapse events may arrive after the new expand event. The implementation therefore keeps one authoritative expanded-group value, ignores stale collapse events for rows that are no longer the active group, and gives open/closed variants distinct tree item identities so the chevron state cannot drift from the rendered children.

Checkbox handling uses the VS Code native `checkboxState` on `TreeItem` and `onDidChangeCheckboxState` on the `TreeView` so selection state stays synchronized with the active configuration without requiring a dedicated toggle command.

Visual emphasis for non-default states uses `TreeItemLabel` with a `highlights` range covering the full label string. A checkbox option is non-default when it is `true` (enabled). A multistate option is non-default when its active state differs from `defaultState` (or the first declared state if `defaultState` is absent). A group heading is non-default when it is collapsed and at least one of its member options is in a non-default state; the bold is removed once the group is expanded because the individual rows then carry their own emphasis.

The Build Options section preserves YAML order while consolidating repeated group labels under a single heading.

Option availability is evaluated against the active build context before rendering. Options whose `when` expression evaluates to `false` are omitted from the visible tree, but their persisted values remain stored in workspace state.

Debug availability is evaluated against the active build context from the manifest-defined `debug` profiles. The view-title `Debug` action is enabled only when exactly one valid debug profile can be resolved for the active build context.

The `Debug` action remains visible even when disabled so the user can discover debugger support from the main configuration view. Disabled-state tooltips explain whether debugging is unavailable because no profile matched, matching profiles were ambiguous, the template could not be loaded, or required substitutions could not be resolved.

The existence of the resolved debug executable path is not part of enablement. Missing executable files may still cause the downstream debugger to fail, but they do not by themselves disable the `Debug` action or block the launch attempt before handing off to VS Code.

## Command And Task Execution

Build, clippy, check, and clean execution is centered on a VS Code task-provider layer.

Debug execution is centered on a separate debug-profile selection and template-resolution layer that launches the final configuration through the VS Code debug API.

Task behavior:

- task type: build-task provider scoped to the extension
- task labels: user-facing labels for build, clippy, check, and clean tasks; Build, Clippy, and Check include the active build context, and Clean uses the plain label `Clean`
- task group: `Build`
- execution model: `cargo xtask ...` in the configured cargo workspace
- terminal presentation: shared build terminal with visible output

Task labels for Build, Clippy, and Check use the active model name, target display name, and component name. Clean uses the fixed label `Clean`. Target display name resolves to `shortName` when present and falls back to `name` otherwise.

Task command mapping:

- `Build {model-name} | {target-display} | {component-name}` executes `cargo xtask build ...`
- `Clippy {model-name} | {target-display} | {component-name}` executes `cargo xtask clippy ...`
- `Check {model-name} | {target-display} | {component-name}` executes `cargo xtask check ...`
- `Clean` executes `cargo xtask clean`

`Build`, `Clippy`, and `Check` share the same active-configuration-derived arguments. Only the xtask subcommand changes.

`Clean` does not use active-configuration-derived arguments.

Command handlers for Build, Clippy, Check, and Clean validate manifest status and workspace constraints before delegating to the task provider. `Clean` still does not use active-configuration-derived arguments, but it is blocked when manifest state is invalid for Build Workflow.

Additional command behavior:

- command titles use the `Trezor:` prefix
- `Flash` uses the user-facing title `Trezor: Flash {model-name} | {target-display} | {component-name}` and executes `xtask flash <component-id> -m <model-id>`
- `Upload` uses the user-facing title `Trezor: Upload {model-name} | {target-display} | {component-name}` and executes `xtask upload <component-id> -m <model-id>`
- `Flash` and `Upload` are launched through VS Code task execution rather than direct process spawning
- `Debug` uses the user-facing title `Trezor: Debug` and launches the resolved debugger template for the active build context
- `Flash` is available only when the selected component's `flashWhen` expression evaluates to `true`
- `Upload` is available only when the selected component's `uploadWhen` expression evaluates to `true`
- `Debug` is available only when exactly one valid debug profile can be resolved for the active build context
- omitted `flashWhen` and `uploadWhen` values make the corresponding action unavailable
- artifact-row actions remain visible whenever their action is applicable
- artifact-row actions that require the binary artifact are disabled when the binary artifact is missing
- the map-file action is disabled when the map artifact is missing
- the internal command backing the map-file row action is not shown in the Command Palette
- successful `Flash` and `Upload` completion does not trigger an automatic extension refresh

Debug-template behavior:

- template root: resolved from `tfTools.debug.templatesPath`
- selection source: manifest `debug[]` entries
- matching rules: evaluate `debug.when` expressions against the active build context
- tie-breaking: prefer the highest `priority`; equal highest-priority matches are treated as ambiguous and block launch
- template loading: read the referenced template file from the configured template root and reject path traversal outside that root
- template path semantics: `debug.template` is a relative file path under the configured template root and may include subdirectories
- template reload timing: read the template file fresh on each `Trezor: Debug` invocation rather than preloading or caching the whole template set
- template format: the template file must parse as a JSONC object representing one VS Code debug configuration
- variable expansion: apply built-in tf-tools variables and selected `debug.vars` entries to string-valued template fields before launch
- substitution scope: inspect the full JSON object, including nested objects and arrays, and apply tf-tools substitution only to string values while leaving non-string values unchanged
- token replacement semantics: replace every occurrence of a supported tf-tools substitution token found inside a string value, including tokens embedded within larger strings
- substitution boundary: resolve only tf-tools substitution tokens and leave any remaining VS Code or debug-adapter variable syntax untouched for downstream resolution
- substitution pass count: perform tf-tools substitution as a single pass and do not re-expand replacement results for further tf-tools substitutions
- substitution failures: unknown variables, cyclic `debug.vars` expansion, or unresolved required tf-tools values block launch
- adapter-field validation: do not pre-validate debug-adapter-specific fields such as `type`, `request`, or adapter-owned options before invoking the VS Code debug API
- launch mechanism: call the VS Code debug API with the resolved configuration instead of generating or persisting launch.json entries automatically
- failure behavior: surface user-facing errors for missing templates, invalid template content, ambiguous debug-profile matches, and unresolved debug variables, and write detailed information to the log channel
- logging behavior: include template path, profile identity, parse errors, unresolved variable names, and field-location context when available

The built-in debug variables are:

- `${tfTools.artifactPath}`
- `${tfTools.component.id}`
- `${tfTools.component.name}`
- `${tfTools.model.id}`
- `${tfTools.model.name}`
- `${tfTools.target.id}`
- `${tfTools.target.name}`
- `${tfTools.executable}`
- `${tfTools.executablePath}`

Additional variables from the selected manifest `debug.vars` mapping are exposed as `${tfTools.debug.var:<name>}`.

Debug variable semantics:

- `${tfTools.artifactPath}` resolves to the active model artifact folder `<tfTools.artifactsPath>/<artifact-folder>`, where `artifact-folder` comes from the selected model's required manifest field
- `${tfTools.executable}` resolves to the selected manifest `debug.executable` value after tf-tools substitution
- `${tfTools.executablePath}` resolves to the absolute executable path derived from `${tfTools.artifactPath}` and `${tfTools.executable}` when the executable value is relative, or to the already absolute substituted path otherwise

Debug launch flow:

1. Resolve the active build context from the current tree-view state.
2. Evaluate manifest `debug[]` entries against that context.
3. Select the single matching profile after applying `priority` rules.
4. Resolve and read the referenced template JSON file from `tfTools.debug.templatesPath`.
5. Build the substitution map from active model, target, component, resolved debug executable values, and expanded `debug.vars` values.
6. Recursively substitute string fields in the parsed template JSON object.
7. Optionally inject an internal configuration name for logging and diagnostics.
8. Launch the resolved configuration through the VS Code debug API.

The extension never writes resolved debug configurations back to `launch.json`. Template files are treated as source inputs, and the resolved debug configuration exists only in memory for the launched session.

## Status Bar Integration

The extension exposes a status-bar item that reflects the active build configuration.

Design:

- text format: `{model-id} | {target-display} | {component-name}`
- target display source: target `shortName` when present, otherwise target `name`
- activation behavior: reveals the extension container and focuses the configuration view
- refresh behavior: updates when the active configuration changes or when restored state is normalized

Build-context argument derivation for `Build`, `Clippy`, and `Check` follows this algorithm:

1. start with `<subcommand> <component> -m <model>`
2. append the selected target flag when present
3. append checkbox option flags when enabled
4. append multistate option flag/value pairs when the selected state has a non-null value

Build-option CLI arguments are derived from explicit manifest `flag` values. Checkbox options append the flag directly, and multistate options append the flag followed by the selected non-null value.
Only options whose `when` expression evaluates to `true`, or that omit `when`, participate in CLI argument derivation.

Post-build refresh runs only after a successful build task exit.

## IntelliSense Integration

IntelliSense integration is implemented by an IntelliSense service and a provider adapter.

Design:

- provider type: Microsoft C/C++ custom configuration provider
- provider registration: performed during activation
- active artifact selection: derived from the configured artifacts root, the selected model's required `artifact-folder`, the selected component's required `artifact-name`, the selected target's optional `artifact-suffix`, and the extension associated with the requested artifact type
- artifact base path: `<tfTools.artifactsPath>/<artifact-folder>/`
- artifact basename: `<artifact-name><artifact-suffix>`, where `artifact-name` comes from the selected component and `artifact-suffix` defaults to an empty string when omitted
- artifact layout: `<artifacts-root>/<artifact-folder>/<artifact-name><artifact-suffix><extension>`
- compile-database example: `<artifacts-root>/<artifact-folder>/<artifact-name><artifact-suffix>.cc.json`
- parsing model: eager parse of the active compile database during refresh, before cpptools notification
- entry identity: normalized absolute source-file path; duplicate entries for one file use the first entry and log later duplicates

When refresh runs, the IntelliSense layer:

1. derives the expected artifact path
2. checks whether the artifact exists
3. eagerly parses the compile database into an in-memory index and browse snapshot
4. loads the parsed result into the provider adapter
5. triggers provider update notifications
6. updates tree-view artifact state and shows or clears provider-related warnings

If the expected artifact for the active configuration is missing, the resolution logic must not fall back to a different artifact path, artifact-folder, artifact-name, component, target-derived suffix, model, or target.

The provider adapter parses compile database entries into include paths, defines, forced-include paths, compiler path, compiler arguments, and language standard. File lookup is keyed by normalized resolved file-system paths.

Translation rules:

- the provider accepts compile-database entries using `arguments[]` directly; if `command` is used instead, it is shell-tokenized before further processing
- all paths are preserved as absolute when already absolute
- relative source, include, forced-include, output, and compiler paths are resolved relative to the entry `directory` field
- all flags after the compiler executable token are preserved in order for cpptools translation, except the source-file token, which is represented by the target source URI instead of remaining in compiler arguments
- `includePath` is populated from include-search flags such as `-I`, `-isystem`, `-iquote`, and their joined-token forms
- `defines` is populated from `-D` flags and `forcedInclude` from forced-include flags such as `-include` and `-imacros`
- unclassified flags remain in `compilerArgs` or `compilerFragments` so cpptools receives the full compile context instead of a lossy subset
- language family is inferred per entry from `-std=` first; `c*` and `gnu*` without `++` mean C, while `c++*` and `gnu++*` mean C++
- when no `-std=` flag is present, the provider falls back to the source-file extension and then to the compiler frontend name such as `g++`, `clang++`, or `c++`

Browse configuration rules:

- browse configuration is built eagerly from the active compile-database index
- `browsePath` is the de-duplicated union of resolved include paths across all indexed entries
- `compilerPath` comes from the first indexed entry that provides one
- `compilerArgs` comes from that same representative entry after normalization so cpptools can recover system defaults for browse-time indexing

## Build Artifacts Actions

The Build Artifacts section supports row-scoped actions in addition to artifact status.

Design:

- the Map File row exposes an icon-only action that opens the resolved map file in the current editor
- the Map File row action opens the resolved map file in the current editor with normal editable file behavior
- the Binary row exposes icon-only actions backed by `Trezor: Flash {model-name} | {target-display} | {component-name}` and `Trezor: Upload {model-name} | {target-display} | {component-name}` commands according to the selected component action conditions evaluated against the active build context
- the Binary row actions remain present when applicable but are disabled when the binary artifact is missing
- action icons use VS Code theme icons: `go-to-file` for map reveal, `zap` for flash, and `arrow-up` for upload
- where VS Code requires tree actions to be command-backed, the Map File action may use an internal implementation command and should not be exposed as a standalone Command Palette entry
- the Flash/Upload slice owns the `Binary` row actions and the `Map File` row action, while compile-commands status remains owned by the IntelliSense slice

## Excluded-File Detection And Presentation

Excluded-file behavior is split across three parts:

- inclusion and scope evaluation
- explorer decorations
- editor overlays

The service computes exclusion state from:

- the active configuration key
- the active compile-database path
- parsed included file paths from the compile database
- marker rules from settings
- marker preferences from settings

A file is marked only when:

- it is not included in the active compile database
- it matches at least one configured file-name pattern
- it matches at least one configured folder glob

Explorer presentation uses a file-decoration layer with:

- badge: `✗`
- tooltip: exclusion reason
- optional gray color

Editor presentation uses a whole-line first-line decoration with warning colors and hover text.

Excluded files do not receive active configuration data from the IntelliSense provider.

## Refresh And Event Flow

The refresh coordinator serializes refresh execution and prevents overlapping refresh work.

Important refresh triggers:

- activation
- configuration changes from the tree view
- successful build completion
- manual IntelliSense refresh command
- workspace-folder changes
- extension changes affecting provider availability
- `tfTools.manifestPath` changes
- `tfTools.artifactsPath` changes
- `tfTools.showConfigurationInStatusBar` changes
- excluded-files setting changes
- manifest file changes

A change to `tfTools.artifactsPath` resets the currently applied IntelliSense artifact state and forces Build Artifacts resolution to be recomputed for the active configuration.

Refresh also recomputes manifest diagnostics and related logged state when manifest content or manifest path changes.

The refresh path is layered:

1. refresh the tree view
2. refresh IntelliSense state
3. refresh excluded-file state

Tree updates also occur directly when manifest status changes or when checkbox and choice selections change.

## Persistence And Configuration Storage

Workspace persistence uses VS Code workspace state storage.

Storage details:

- storage key: `tfTools.activeConfiguration`
- scope: workspace state
- stored payload: the entire active build configuration

## Settings And Technical Configuration

The extension reads these configuration areas:

- `tfTools.cargoWorkspacePath`
- `tfTools.manifestPath`
- `tfTools.artifactsPath`
- `tfTools.showConfigurationInStatusBar`
- `tfTools.excludedFiles.grayInTree`
- `tfTools.excludedFiles.showEditorOverlay`
- `tfTools.excludedFiles.fileNamePatterns`
- `tfTools.excludedFiles.folderGlobs`

The manifest file path is resolved from `tfTools.manifestPath`. The default path is `${workspaceFolder}/tf-tools-manifest.yaml`.

## Technical Constraints

- single-root workspace only
- cpptools is the only supported IntelliSense integration
- compile-database existence is required for valid IntelliSense and excluded-file computation
- build, clippy, check, and clean are the implemented task kinds
- the architecture depends on stable internal keys for build options