# Trezor Firmware Tools Specification

## Project Summary

Trezor Firmware Tools is a Visual Studio Code extension for working with the `trezor-firmware` repository. Its core purpose is to keep the active firmware build context visible inside the editor and make that context actionable. The extension reads build metadata from a project-local `tf-tools-manifest.yaml`, lets the user select the active model, target, component, and build options from a dedicated sidebar, runs `cargo xtask` clean, build, clippy, and check commands for that selection, applies IntelliSense state from generated compile-commands artifacts, and marks files that are outside the active build configuration.

The primary interaction surface is a dedicated activity-bar container with a tree view for selecting build context, inspecting build artifact availability, and launching the most common actions.

In the UI, the tree-view section labeled `Build Selection` is the surface for choosing the active build context: `Model`, `Target`, and `Component`.

Where the extension needs a short internal identifier, abbreviation, or compact label, this specification uses `tf-tools`.

## Goals

- Provide a single in-editor control surface for the active Trezor firmware build configuration.
- Keep build metadata driven by the firmware repository rather than hardcoded in the extension.
- Let users run common build actions without leaving VS Code.
- Keep editor assistance aligned with the selected build context.
- Make files that are outside the active configuration clearly visible.
- Persist workspace-specific selections and restore them reliably after restart.
- Refresh derived state automatically when configuration, manifest content, or build outputs change.

## General Behavior Of The Extension

- The extension activates on startup and assumes a single-root workspace.
- The extension resolves a cargo workspace directory from `tfTools.cargoWorkspacePath` and resolves the manifest file path from `tfTools.manifestPath`.
- The YAML manifest is the runtime source of truth for available models, targets, components, and build options.
- The manifest is watched for create, change, and delete events. When it changes, the tree view updates and the active configuration is re-normalized against the new manifest.
- The active configuration is stored in workspace state and restored on the next session.
- When a saved configuration is missing values or contains values no longer present in the loaded manifest, the extension falls back to the first available model, target, and component from the manifest and drops invalid build-option values.
- Build options support two behaviors: checkbox options act as presence flags, and multistate options expose a fixed list of named values with a default state.
- Options may define manifest-driven availability conditions. An option is available only when its `when` expression evaluates to `true` for the active model, target, and component.
- An option whose `when` expression evaluates to `false` is unavailable. Unavailable options shall not be shown, shall not be user-selectable, and shall have no effect on the effective build configuration until they become available again.
- Options that are unavailable for the active build context shall not appear in the Build Options UI and shall not contribute command-line flags.
- Persisted values for temporarily unavailable options shall be retained and shall become active again if the option becomes available for a later build context.
- The initial task set starts with `Build`, `Clippy`, `Check`, and `Clean`, all executed as VS Code tasks in the configured cargo workspace directory.
- `Build`, `Clippy`, `Check`, and `Clean` shall be exposed as VS Code build tasks and shall appear in standard build-task entry points such as `Terminal -> Run Build Task`.
- The `Build` task shall use a dynamic label constructed as `Build {model-name} | {target-display} | {component-name}`, for example `Build T3W1 | EMU | Prodtest`.
- The `Clippy` task shall use a dynamic label constructed as `Clippy {model-name} | {target-display} | {component-name}`.
- The `Check` task shall use a dynamic label constructed as `Check {model-name} | {target-display} | {component-name}`.
- The command family shall also include `Flash`, `Upload`, and `Debug` actions for the active build context.
- `Flash` and `Upload` shall run through VS Code task execution rather than direct ad hoc process execution.
- Build arguments are derived from the active configuration and the manifest. Target-specific flags and enabled build-option flags are appended automatically. Build-option flags come from the manifest's explicit `flag` fields.
- The `Clippy` task shall invoke `xtask clippy` with the same active-configuration-derived arguments as the `Build` task.
- The `Check` task shall invoke `xtask check` with the same active-configuration-derived arguments as the `Build` task.
- The `Flash` command shall use a dynamic title in the form `Trezor: Flash {model-name} | {target-display} | {component-name}` and shall invoke `xtask flash <component-id> -m <model-id>`.
- The `Upload` command shall use a dynamic title in the form `Trezor: Upload {model-name} | {target-display} | {component-name}` and shall invoke `xtask upload <component-id> -m <model-id>`.
- Successful `Flash` and `Upload` completion shall not trigger an automatic extension refresh.
- The `Debug` command shall use the title `Trezor: Debug` and shall launch the selected debug configuration for the active build context through the VS Code debug API.
- IntelliSense state is derived from compile-commands artifacts in `tfTools.artifactsPath` and is refreshed on activation, on configuration changes, after successful builds, on manual refresh, and when relevant extension state changes.
- Build artifacts shall be resolved from the artifact base path `<tfTools.artifactsPath>/<artifactFolder>/`, where `<artifactFolder>` comes from the selected model's required `artifactFolder` manifest field and is interpreted relative to `tfTools.artifactsPath`, and an artifact basename constructed as `<artifactName><artifactSuffix>`, where `<artifactName>` comes from the selected component's required `artifactName` manifest field and `<artifactSuffix>` comes from the selected target's optional `artifactSuffix` manifest field and defaults to an empty string when omitted.
- Debug configuration selection is driven by manifest-defined debug profiles together with debugger template files loaded from a configurable template path.
- The extension integrates with Microsoft C/C++ (`ms-vscode.cpptools`) through a custom configuration provider.
- When the active compile-commands artifact exists, the provider eagerly parses the `.cc.json` file, indexes entries by normalized absolute source-file path, and serves cpptools per-file `SourceFileConfiguration` objects derived from the indexed entries rather than passing only the compile-database path.
- C versus C++ language mode is inferred per compile entry from `-std=` flags first, then from the source-file extension, then from the compiler frontend name when the standard flag is absent or ambiguous.
- All compile flags from the selected compile-database entry are preserved for cpptools translation after the compiler executable token; relative paths are resolved against the entry `directory` field, and duplicate compile-database entries for the same file use the first entry only.
- The provider browse configuration uses the de-duplicated union of include paths from the active compile database, plus representative compiler metadata from the first indexed entry.
- Files not present in the active compile database can be visually marked in the explorer and in editors when they also match the configured file-pattern and folder-scope rules.
- The extension warns when the manifest is missing or invalid, when no supported IntelliSense provider is installed, when cpptools is installed but not configured to use Trezor Firmware Tools, and when build commands cannot start because the workspace shape is unsupported.
- The extension shall surface actionable file-backed validation problems through VS Code diagnostics so they can be inspected from the Problems view and editors.
- The extension shall maintain a dedicated log output channel for runtime warnings, errors, and diagnostic detail that does not fit in transient notifications.

## High-Level User Requirements

### HR-01 Workspace And Manifest Discovery

The extension shall work against one opened firmware workspace. It shall resolve the cargo workspace path and manifest path from settings, load `tf-tools-manifest.yaml` from the configured manifest path, validate its structure, and treat the manifest as the live source of available build choices.

### HR-02 Active Build Context Selection

The user shall be able to select the active model, target, and component from inside VS Code. The extension shall keep the current selection available from the configuration view and, when enabled, in the status bar. The extension shall persist the selection per workspace.

### HR-03 Active Configuration Status Bar

The user shall be able to see the active build configuration in the VS Code status bar. The status-bar text shall use the format `{model-name} | {target-display} | {component-name}`, for example `Trezor Model T | Hardware | Prodtest`. Selecting the status-bar item shall reveal the extension's configuration view so the user can change the active model, target, or component.

### HR-04 Manifest-Driven Build Options

The user shall be able to configure build options exposed by the manifest. Checkbox-style options shall be toggleable on and off. Multistate options shall expose their available states and allow one selected value at a time, including a default state when no explicit value is stored. Options may be conditionally available for the active build context through manifest-defined `when` expressions that evaluate against the selected model, target, and component.

### HR-05 Reliable Persistence And Normalization

The extension shall restore the last active configuration on restart. If saved values are stale or invalid for the loaded manifest, the extension shall normalize the configuration to valid manifest values instead of leaving the workspace in a broken or incomplete state.

### HR-06 In-Editor Command Execution

The user shall be able to run command workflows directly from VS Code. The initial task set shall support clean, build, clippy, and check actions. `Build`, `Clippy`, `Check`, and `Clean` shall be exposed as VS Code build tasks, not only as commands. The `Build`, `Clippy`, and `Check` task labels shall include the active build context in the form `{Task} {model-name} | {target-display} | {component-name}` so the task picker shows what will be run. `Clean` shall use the label `Clean`. If a target defines a short name, that short name shall be used as `target-display`; otherwise the full target name shall be used. `Clippy` and `Check` shall use the same active-configuration-derived arguments as `Build`, with `xtask clippy` and `xtask check` used in place of `xtask build`. `Clean` shall invoke `xtask clean` without active-build-context-derived arguments when it is allowed to start. If the manifest is missing, invalid, or contains invalid build-option `when` logic, `Build`, `Clippy`, `Check`, and `Clean` shall all be blocked and shall show an error instead of starting a task. User-facing command titles shall use the `Trezor:` prefix. The command model shall also support `Flash` and `Upload` actions from the Build Artifacts section when the selected component's `flashWhen` or `uploadWhen` expression evaluates to `true`. `Flash` and `Upload` shall also be available from the Command Palette when applicable for the active build context. `Flash` and `Upload` shall be launched as VS Code tasks. `Flash` shall use the dynamic title `Trezor: Flash {model-name} | {target-display} | {component-name}` and shall invoke `xtask flash <component-id> -m <model-id>`. `Upload` shall use the dynamic title `Trezor: Upload {model-name} | {target-display} | {component-name}` and shall invoke `xtask upload <component-id> -m <model-id>`. Successful `Flash` and `Upload` completion shall not trigger an automatic extension refresh. The internal command that backs the `Map File` row action shall not be shown in the Command Palette. The command model shall also support a `Trezor: Debug` action that resolves the active build context to exactly one manifest-defined debug profile, loads the referenced debugger template, applies tf-tools substitution variables, and launches the resulting VS Code debug configuration. If no debug profile matches, if more than one matching profile remains after priority-based tie-breaking, or if the referenced template cannot be loaded, the extension shall show an error instead of starting the debugger.

### HR-07 IntelliSense Aligned With Active Configuration

The user shall receive C/C++ IntelliSense based on the selected build context. The extension shall resolve the expected compile-commands artifact from the artifact base path `<tfTools.artifactsPath>/<artifactFolder>/`, where `<artifactFolder>` comes from the selected model's required `artifactFolder` manifest field and is interpreted relative to `tfTools.artifactsPath`, and an artifact basename constructed as `<artifactName><artifactSuffix>`, where `<artifactName>` comes from the selected component's required `artifactName` manifest field and `<artifactSuffix>` comes from the selected target's optional `artifactSuffix` manifest field and defaults to an empty string when omitted. When that artifact exists, the extension shall eagerly parse the compile database, index entries by normalized absolute source-file path, and translate each entry into a cpptools `SourceFileConfiguration` for the corresponding source file. C versus C++ language mode shall be inferred per entry from `-std=` flags first, then from the source-file extension, then from the compiler frontend name. All flags from the selected compile entry shall be preserved for cpptools translation after the compiler executable token, with relative paths resolved against the entry `directory` field by normal compile-commands rules. If the compile database contains duplicate entries for one file, the first entry shall win. The provider browse configuration shall use the de-duplicated union of include paths from the active compile database together with representative compiler metadata from the first indexed entry. If the expected artifact is missing, the extension shall not fall back to a different artifact or a different active configuration.

### HR-08 Manual And Automatic Refresh

The user shall not need to manually resynchronize the extension after every change. Configuration changes, successful builds, manifest changes, workspace changes, and explicit refresh commands shall update the tree view and recompute IntelliSense and excluded-file state.

### HR-09 Visibility Of Files Outside The Active Configuration

The user shall be able to see when a file is not part of the active build configuration. The extension shall determine file inclusion from the active compile database and surface excluded-file markers only for files inside the configured marker scope.

### HR-10 Configurable Scope And Behavior

The user shall be able to configure the cargo workspace path, the manifest path, the artifacts path used for build artifacts and IntelliSense artifact resolution, the visibility of the active-configuration status-bar item, and the excluded-file marker preferences and scope rules. These settings shall be resource-scoped so they can differ by workspace.

### HR-11 Clear Failure Feedback

The extension shall fail visibly and specifically when prerequisites are not met. Missing or invalid manifest data, unsupported workspace layouts, and inactive IntelliSense provider setup shall all produce explicit user-facing messages or status indicators. Missing build artifacts shall be surfaced in the `Build Artifacts` section of the tree view and shall not trigger popup notifications by themselves.

### HR-12 Persistent Diagnostics And Logs

The user shall be able to inspect extension-reported warnings and errors after they occur. Actionable file-backed problems, especially validation errors in `tf-tools-manifest.yaml`, shall be surfaced through VS Code diagnostics. Runtime warnings, non-file-backed failures, and debugging detail shall be written to a dedicated `Trezor Firmware Tools` log output channel.

## UI Requirements

The UI shall use a dedicated activity-bar container and a tree view as the main interaction model. Additional major views or alternate layout models are out of scope.

### UI-01 Activity Bar Surface

- The extension shall contribute an activity-bar container named `Trezor`.
- The extension shall use `images/tf-tools-logo.png` as the extension icon shown in the VS Code extensions view.
- The activity-bar container shall use `images/tf-tools.svg` as its icon.
- The container shall expose a single view named `Configuration`.

### UI-02 Main View Structure

- The `Configuration` view shall be a tree view.
- The root of the tree shall contain exactly three top-level sections: `Build Selection`, `Build Options`, and `Build Artifacts`.
- These sections shall remain expanded by default.

### UI-03 View Title Actions

- The Configuration Experience slice shall not expose `Build`, `Debug`, `Clippy`, `Check`, `Clean`, or `Refresh IntelliSense` actions in the view title bar or its overflow menu.
- These actions are deferred to later feature slices and shall not be contributed until their behavior is implemented.
- The UI model shall still allow future view-title and overflow actions to be added without redesigning the view structure.

### UI-04 Build Selection Section

- The `Build Selection` section is the UI label for the active build context selectors.
- The `Build Selection` section shall show three selector rows: `Model`, `Target`, and `Component`.
- Each selector row shall display the selected value inline.
- The `Model` selector row shall display the selected model `name` inline.
- The `Target` selector row shall display `shortName` when present and otherwise the target `name` inline.
- The `Component` selector row shall display the selected component `name` inline.
- Each selector row shall be collapsible and shall reveal its available choices as child rows when opened.
- Only one selector or multistate choice list shall be open at a time.
- Child choice rows shall use checkbox state to indicate which value is selected.
- Selector rows shall use distinct icons for model, target, and component.
- If the build manifest is missing or invalid, the section shall show a warning-style status row instead of selector content.

### UI-05 Build Options Section

- The `Build Options` section shall render from the manifest-defined options list.
- Options with a `group` value in the manifest shall appear under a named group heading.
- Ungrouped options shall appear at the same hierarchy level as group headings, interleaved according to YAML declaration order.
- Group headings shall remain expanded and act as visual organization rather than interactive selectors.
- Group order shall follow the first occurrence of each group in the manifest.
- Option order inside each group shall follow manifest order.
- Checkbox options shall render as single checkbox rows.
- Multistate options shall render as selector-style parent rows that open to show their available states.
- Multistate rows shall display the active state inline.
- When a multistate value is not the default presentation value, the active value shall remain visually emphasized in the row label.
- When a checkbox option is enabled (non-default), its label shall be visually emphasized.
- When a group heading is collapsed and contains at least one option that is in a non-default state, the group heading label shall be visually emphasized so users can see that something changed inside without expanding it.
- When a build option defines a `description` field, that description shall be shown as the tooltip for the option row.
- Build option rows without a `description` field shall have no tooltip.
- Group headings and Model, Target, and Component selector rows shall have no tooltip.
- Only options whose `when` expression evaluates to `true`, or that omit `when`, shall be shown.
- If the build manifest is missing or invalid, the section shall show a warning-style status row instead of option content.

### UI-06 Build Artifacts Section

- The `Build Artifacts` section shall show artifact status rows.
- It shall always include a row labeled `Compile Commands`.
- It shall include rows labeled `Binary` and `Map File`, in that order after `Compile Commands`, only when the selected component's `flashWhen` or `uploadWhen` expression evaluates to `true` for the active build context.
- If both `flashWhen` and `uploadWhen` are omitted or evaluate to `false` for the active build context, the `Binary` and `Map File` rows shall be hidden.
- The artifact base path shall be constructed as `<artifacts-root>/<artifactFolder>/`, where `<artifactFolder>` comes from the selected model's required `artifactFolder` manifest field and is interpreted relative to `tfTools.artifactsPath`.
- The artifact basename shall be constructed as `<artifactName><artifactSuffix>`, where `<artifactName>` comes from the selected component's required `artifactName` manifest field and `<artifactSuffix>` comes from the selected target's optional `artifactSuffix` manifest field and defaults to an empty string when omitted.
- `Compile Commands` shall resolve its expected path from `<artifacts-root>/<artifactFolder>/<artifactName><artifactSuffix>.cc.json`.
- `Binary` shall resolve its expected path from `<artifacts-root>/<artifactFolder>/<artifactName><artifactSuffix>.bin`.
- `Map File` shall resolve its expected path from `<artifacts-root>/<artifactFolder>/<artifactName><artifactSuffix>.map`.
- Each row shall display the text `valid` or `missing`.
- Each row tooltip shall show the expected artifact path.
- When an artifact is missing, its tooltip shall also explain why the artifact is missing.
- Missing artifact state shall be communicated in this section only and shall not require separate popup notifications.
- The `Map File` row shall expose an icon-only action button that opens the map file in the current editor and keeps it editable.
- If VS Code requires the row action to be command-backed, that command may remain internal and shall not be exposed as a standalone Command Palette entry.
- The `Binary` row shall expose an icon-only action button backed by the `Trezor: Flash {model-name} | {target-display} | {component-name}` command when the selected component's `flashWhen` expression evaluates to `true`.
- The `Binary` row shall expose an icon-only action button backed by the `Trezor: Upload {model-name} | {target-display} | {component-name}` command when the selected component's `uploadWhen` expression evaluates to `true`.
- A component may expose both `Flash` and `Upload` action buttons at the same time.
- The `Binary` row and its `Flash` and `Upload` action buttons belong to the Flash/Upload Actions slice.
- The `Map File` row action belongs to the Flash/Upload Actions slice.
- Artifact-row action buttons shall remain visible whenever their action is applicable.
- If the binary artifact is missing, the `Flash` and `Upload` action buttons shall be disabled.
- If the map artifact is missing, the `Map File` action button shall be disabled.
- If no unique valid debug profile can be resolved for the active build context, the `Debug` action shall be disabled.

### UI-07 Tree View Icons

- The `Build Selection`, `Build Options`, and `Build Artifacts` top-level sections shall render as plain text group headers without dedicated icons.
- The `Model` selector row shall use the VS Code `circuit-board` theme icon.
- The `Target` selector row shall use the VS Code `target` theme icon.
- The `Component` selector row shall use the VS Code `extensions` theme icon.
- Build-option group headings shall use the VS Code `symbol-namespace` theme icon.
- Multistate build-option parent rows shall use the VS Code `list-selection` theme icon.
- Artifact status rows in the `Build Artifacts` section shall use the VS Code `check` theme icon when the status text is `valid`.
- Artifact status rows in the `Build Artifacts` section shall use the VS Code `warning` theme icon when the status text is `missing`.
- The `Map File` row action shall use the VS Code `go-to-file` theme icon.
- The `Trezor: Flash {model-name} | {target-display} | {component-name}` action shall use the VS Code `zap` theme icon.
- The `Trezor: Upload {model-name} | {target-display} | {component-name}` action shall use the VS Code `arrow-up` theme icon.
- Active choice rows may use the VS Code `check` theme icon.
- Inactive choice rows shall use an empty spacer icon so choice labels remain aligned without presenting an additional semantic icon.
- Checkbox option rows shall rely on checkbox state and shall not require additional dedicated icons.

### UI-08 Notifications And Status Feedback

- The extension shall continue using VS Code warning, information, and error messages for runtime issues that block or degrade behavior.
- If cpptools is installed but Trezor Firmware Tools is not the active configuration provider, the extension shall warn the user and offer to switch the workspace setting to the Trezor provider.
- If no supported C/C++ provider is installed, the extension shall warn that IntelliSense integration is unavailable.
- If a build fails after starting, the extension shall show an error and shall not run post-build refresh.
- If `Build`, `Clippy`, `Check`, or `Clean` cannot start because the manifest is unavailable or invalid for Build Workflow, the extension shall show an error instead of starting a task.
- If any task cannot start because the workspace is unsupported, the extension shall show an error instead of starting a task.
- If `Flash` or `Upload` cannot start because the manifest is unavailable or invalid, because the workspace is unsupported, because the action is not applicable for the selected component, or because the binary artifact is missing, the extension shall show an error instead of starting the task.
- If `Flash` or `Upload` fails after starting, the extension shall show an error and shall not trigger an automatic refresh.
- If `Debug` cannot start because no unique matching debug profile can be resolved, because the selected debug template is invalid, or because required debug variables cannot be resolved, the extension shall show an error instead of starting the debugger.
- If the selected debug template file is malformed JSON, the extension shall show an error notification when debug launch is attempted.
- If the selected debug template references an unknown or invalid tf-tools substitution variable, the extension shall show an error notification when debug launch is attempted.
- If the resolved `${tfTools.executablePath}` does not exist, that fact alone shall not disable `Trezor: Debug` and shall not block an attempted debug launch.
- Transient notifications shall complement persistent diagnostics and logs rather than replace them.

### UI-09 Diagnostics And Logs

- The extension shall create VS Code diagnostics for actionable file-backed problems.
- Diagnostics for `tf-tools-manifest.yaml` shall appear in the Problems view and in the editor for that file.
- Manifest diagnostics shall cover YAML parse failures, invalid schema structure, invalid `when`, `flashWhen`, and `uploadWhen` expressions, references to unknown model, target, or component ids, duplicate ids, duplicate option flags, and missing required fields.
- Where a precise source range is known, the diagnostic shall be attached to that range.
- Where a precise source range is not known, the diagnostic may be attached to the manifest file without a more specific location.
- The extension shall expose a dedicated output channel named `Trezor Firmware Tools`.
- The extension shall write runtime warnings, runtime errors, manifest-load failures, task-launch failures, refresh failures, and integration failures to that output channel.
- The extension shall write debug-template load failures, debug-template JSON parse failures, invalid debug substitution-variable references, and debug-launch resolution failures to that output channel.
- The extension shall provide a `Trezor: Show Logs` command that reveals the output channel.

### UI-10 Explorer And Editor Excluded-File Surfaces

- Files outside the active configuration but within excluded-file scope shall show an exclusion cross badge in the explorer.
- Explorer graying shall remain optional and controlled by `tfTools.excludedFiles.grayInTree`.
- A first-line warning overlay in open editors shall remain optional and controlled by `tfTools.excludedFiles.showEditorOverlay`.
- The excluded-file overlay and decoration tooltip shall explain that the file is not included in the active build configuration.

### UI-11 Settings Surface

- The extension settings shall expose the following resource-scoped settings:
  - `tfTools.cargoWorkspacePath`
  - `tfTools.manifestPath`
  - `tfTools.artifactsPath`
  - `tfTools.debug.templatesPath`
  - `tfTools.showConfigurationInStatusBar`
  - `tfTools.excludedFiles.grayInTree`
  - `tfTools.excludedFiles.showEditorOverlay`
  - `tfTools.excludedFiles.fileNamePatterns`
  - `tfTools.excludedFiles.folderGlobs`
- Default values shall be:
  - `tfTools.cargoWorkspacePath`: `${workspaceFolder}/core/embed`
  - `tfTools.manifestPath`: `${workspaceFolder}/tf-tools-manifest.yaml`
  - `tfTools.artifactsPath`: `${workspaceFolder}/core/build-xtask/artifacts`
  - `tfTools.debug.templatesPath`: `${workspaceFolder}/.vscode/tf-tools/debug`
  - `tfTools.showConfigurationInStatusBar`: `true`
  - `tfTools.excludedFiles.grayInTree`: `true`
  - `tfTools.excludedFiles.showEditorOverlay`: `true`
  - `tfTools.excludedFiles.fileNamePatterns`: array containing `*.c`
  - `tfTools.excludedFiles.folderGlobs`: array containing `${workspaceFolder}/core/embed/**` and `${workspaceFolder}/core/vendor/**`
- Where internal identifiers, schema names, or compact references are needed beyond these settings keys, the preferred short form shall be `tf-tools`.
- `${workspaceFolder}` substitution shall be supported where applicable.
- Settings changes affecting manifest location, artifact resolution, debug template resolution, status-bar visibility, or excluded-file behavior shall take effect without requiring a restart.
- Changes to `tfTools.artifactsPath` shall reset IntelliSense state and recompute Build Artifacts resolution for the active configuration.

### UI-12 Status Bar Surface

- The extension shall show the active build configuration in the VS Code status bar when `tfTools.showConfigurationInStatusBar` is enabled.
- The status-bar text shall use the format `{model-id} | {target-display} | {component-name}`.
- `target-display` shall use the target `shortName` when provided; otherwise it shall use the target `name`.
- Activating the status-bar item shall reveal the extension's activity-bar container and focus the `Configuration` view.
- The status-bar item shall reflect active configuration changes without requiring a restart.
- Disabling `tfTools.showConfigurationInStatusBar` shall hide the status-bar item.

## Out Of Scope For This Specification

- Introducing additional editor integrations beyond cpptools.
- Supporting multi-root workspaces.
- Changing the UI solely to anticipate future commands.
- Replacing the tree-view layout with a custom webview.


## tf-tools-manifest.yaml Specification

`tf-tools-manifest.yaml` defines the selectable build metadata for the extension. The file shall be loaded from the path referenced by `tfTools.manifestPath`.

The manifest also defines debug-profile selection for the `Trezor: Debug` command. Debugger adapter details remain in external template files loaded from `tfTools.debug.templatesPath`.

### Top-Level Structure

- The file shall be a YAML mapping.
- The top-level keys shall be `models`, `targets`, `components`, optional `options`, and optional `debug`.
- `models`, `targets`, and `components` shall each be non-empty arrays.
- `options` may be omitted. If present, it shall be an array.
- `debug` may be omitted. If present, it shall be an array.
- Unknown top-level properties shall not be used.

### models

Each `models` entry shall be a mapping with:

- `id`: non-empty string; unique within `models`; used in persisted configuration and passed to build commands as the model identifier
- `name`: non-empty string; label shown in the UI
- `artifactFolder`: non-empty string; path segment or relative path under `tfTools.artifactsPath` used as the artifact folder for Build Artifacts, IntelliSense resolution, and `${tfTools.artifactPath}`

### targets

Each `targets` entry shall be a mapping with:

- `id`: non-empty string; unique within `targets`; used in persisted configuration
- `name`: non-empty string; label shown in the UI
- `shortName`: optional non-empty string; compact label used in the status bar and build-task label when provided
- `flag`: string or `null`; when set to a string, it is appended to the build command for that target
- `artifactSuffix`: optional string; when set, it is appended to the selected component's required `artifactName` to derive the artifact basename for Build Artifacts and IntelliSense resolution

### components

Each `components` entry shall be a mapping with:

- `id`: non-empty string; unique within `components`; passed as the positional component argument to the build command
- `name`: non-empty string; label shown in the UI
- `artifactName`: non-empty string; artifact basename stem used for Build Artifacts and IntelliSense resolution before applying the selected target's optional `artifactSuffix`
- `flashWhen`: optional string expression that determines whether the `Flash` action is available for the active build context
- `uploadWhen`: optional string expression that determines whether the `Upload` action is available for the active build context

### debug

Each `debug` entry shall be a mapping with:

- `template`: non-empty string; the relative path to a template file under `tfTools.debug.templatesPath`
- `when`: string expression that determines whether the debug profile applies to the active build context
- `executable`: non-empty string; the primary debug executable filename or relative path under the active model artifact folder selected through that model's `artifactFolder`
- `priority`: optional integer; higher values take precedence when multiple profiles match the active build context
- `vars`: optional mapping of additional debug variable names to string values

`debug` entries are ordered. When multiple matching debug profiles have the same priority, earlier entries take precedence only for deterministic validation and diagnostics; the extension shall still treat the configuration as ambiguous and shall not start debugging automatically.

The `when` expression for `debug` entries shall use the same condition-expression language and validation rules as option `when`.

The `executable` field may reference tf-tools variables that are already known before template expansion.

Values in `vars` may reference tf-tools variables and other keys from the same `vars` mapping only when the references can be resolved without cycles.

### options

Each `options` entry shall be a mapping with:

- `flag`: non-empty string; command-line flag used for this option, for example `-c` or `--ppp`
- `name`: non-empty string; label shown in the UI
- `description`: optional string; shown in tooltips when provided
- `group`: optional string; used only for organizing items in the Build Options section; blank values shall be treated as ungrouped
- `type`: either `checkbox` or `multistate`
- `when`: optional string expression that determines whether the option is available for the active build context

`tf-tools-manifest.yaml` shall not require or expose an option `id`. If the implementation needs internal identifiers for persistence or UI state, those identifiers shall be treated as an internal detail rather than user-authored YAML data.

`flashWhen` and `uploadWhen` expression semantics:

- `flashWhen` and `uploadWhen` shall use the same condition expression language and validation rules as option `when`.
- If `flashWhen` is omitted, the `Flash` action shall be unavailable for that component.
- If `uploadWhen` is omitted, the `Upload` action shall be unavailable for that component.
- If `flashWhen` evaluates to `true` for the active build context, the `Flash` action shall be applicable for that component.
- If `uploadWhen` evaluates to `true` for the active build context, the `Upload` action shall be applicable for that component.
- If `flashWhen` or `uploadWhen` evaluates to `false`, the corresponding action shall be unavailable for the active build context.
- If both `flashWhen` and `uploadWhen` are unavailable for the active build context, the `Binary` and `Map File` rows shall be hidden from the `Build Artifacts` section.

Shared condition expression language:

- `when`, `flashWhen`, `uploadWhen`, and `debug.when` shall use the same function-style condition expression language.
- If a condition expression evaluates to `false` for the active build context, the corresponding option or action shall be unavailable.

`when` expression semantics:

- If `when` is omitted, the option shall be available for all build contexts.
- Supported logical functions shall be `all(...)`, `any(...)`, and `not(...)`.
- Supported predicates shall be `model(<id>)`, `target(<id>)`, and `component(<id>)`.
- `all(...)` shall evaluate to `true` only when all child expressions evaluate to `true`.
- `any(...)` shall evaluate to `true` when at least one child expression evaluates to `true`.
- `not(...)` shall evaluate to the logical negation of its single child expression.
- `model(<id>)` shall evaluate to `true` when `<id>` matches the active model id.
- `target(<id>)` shall evaluate to `true` when `<id>` matches the active target id.
- `component(<id>)` shall evaluate to `true` when `<id>` matches the active component id.
- Whitespace between tokens may be ignored.
- `all(...)` and `any(...)` shall require at least one argument.
- `not(...)` shall require exactly one argument.
- Referenced ids in `model(...)`, `target(...)`, and `component(...)` shall exist in the corresponding manifest section.
- Unknown function names, malformed expressions, wrong argument counts, or references to unknown ids shall make the manifest invalid.
- Bare identifiers such as `hardware` or `prodtest` shall not be supported.

Examples:

```yaml
components:
  - id: firmware
    name: Firmware
    flashWhen: not(target(emulator))
    uploadWhen: not(target(emulator))

options:
  - flag: --production
    name: Production
    type: checkbox
    when: target(hardware)

  - flag: --secure-boot
    name: Secure Boot
    type: checkbox
    when: all(target(hardware), any(model(T3T1), model(T2T1)))

  - flag: --diagnostics
    name: Diagnostics
    type: checkbox
    when: not(any(component(bootloader), component(boardloader)))

debug:
  - template: stm32f4-openocd.json
    when: all(model(T2T1), target(hardware), component(firmware))
    executable: kernel.elf
    vars:
      mainSymbol: firmware.elf

  - template: stm32u5-openocd.json
    when: all(model(T3T1), target(hardware), component(firmware))
    executable: firmware.elf
    vars:
      mainSymbol: kernel.elf

  - template: emulator.json
    when: all(target(emulator), component(firmware))
    executable: firmware-emu
```

Debug profile semantics:

- A debug profile is applicable only when its `when` expression evaluates to `true` for the active build context.
- The selected debug profile shall expose the following built-in substitution variables to the loaded debugger template:
  - `${tfTools.artifactPath}`
  - `${tfTools.component.id}`
  - `${tfTools.component.name}`
  - `${tfTools.model.id}`
  - `${tfTools.model.name}`
  - `${tfTools.target.id}`
  - `${tfTools.target.name}`
  - `${tfTools.executable}`
  - `${tfTools.executablePath}`
- `${tfTools.artifactPath}` shall resolve to the active model artifact folder, using the form `<tfTools.artifactsPath>/<artifactFolder>`, where `<artifactFolder>` comes from the selected model's required `artifactFolder` field.
- `${tfTools.executable}` shall resolve to the selected debug profile's `executable` value after tf-tools variable substitution.
- `${tfTools.executablePath}` shall resolve to the absolute path obtained by combining `${tfTools.artifactPath}` with `${tfTools.executable}` when the executable value is relative, or to the substituted absolute path when the executable value is already absolute.
- Each entry in `debug.vars` shall be exposed to the selected debugger template as `${tfTools.debug.var:<name>}`.
- A debugger template shall be loaded from the path `<tfTools.debug.templatesPath>/<template>`.
- `template` values may include subdirectories under `tfTools.debug.templatesPath`.
- The extension shall start debugging only when exactly one debug profile matches the active build context after applying priority rules.
- If no debug profile matches, the `Trezor: Debug` command shall be unavailable for the active build context.
- If multiple profiles match and the highest `priority` value is shared by more than one profile, the manifest shall be treated as ambiguous for that build context and the debugger shall not start.
- Debugger templates are extension-owned launch configuration templates. They may use tf-tools substitution variables in string-valued fields.

Debugger template processing:

- Debugger templates shall be JSONC files loaded from the directory referenced by `tfTools.debug.templatesPath`.
- The extension shall resolve the selected debug profile's `template` value relative to `tfTools.debug.templatesPath` and shall reject any resolved path that escapes that directory.
- The extension shall read and parse the selected template file on each `Trezor: Debug` invocation.
- The extension shall parse the selected template file as JSONC and shall require the top-level value to be a JSON object representing a single VS Code debug configuration.
- The extension shall apply tf-tools substitution only to string values in the loaded JSON object.
- The extension shall inspect string values throughout the loaded JSON object, including strings inside nested objects and arrays.
- Non-string JSON values shall remain unchanged.
- The extension shall support substitution of `${tfTools.artifactPath}`, `${tfTools.component.id}`, `${tfTools.component.name}`, `${tfTools.model.id}`, `${tfTools.model.name}`, `${tfTools.target.id}`, `${tfTools.target.name}`, `${tfTools.executable}`, `${tfTools.executablePath}`, and `${tfTools.debug.var:<name>}` inside template string values.
- Within a string value, the extension shall replace every occurrence of a supported tf-tools substitution token.
- The extension shall resolve tf-tools substitution variables only. Other variable syntax that remains after tf-tools substitution shall be left unchanged for VS Code or the downstream debug extension to process.
- Tf-tools substitution is single-pass. Replacement text produced by tf-tools substitution shall not be scanned again for additional tf-tools substitutions.
- Unknown tf-tools substitution variables in a selected template shall make the template invalid for launch.
- After template substitution, the extension shall pass the resulting debug configuration object directly to the VS Code debug API without rewriting `launch.json`.
- The extension may add an internal name to the launched configuration when needed for diagnostics or logging, but it shall not require the template file to declare a user-facing configuration name.
- If template parsing or substitution fails, the extension shall not start the debugger and shall surface an error.
- The extension shall not independently validate debug-adapter-specific configuration fields such as `type`, `request`, or other adapter-owned properties before launch.
- If the selected template file is malformed JSON, the extension shall log the template path and parse failure details to the `Trezor Firmware Tools` output channel.
- If a selected template references an unknown or otherwise invalid tf-tools substitution variable, the extension shall log the template path, the unresolved variable reference, and enough context to identify the failing template field.
- If the selected template file is malformed JSON, the extension shall also show an error notification when the user invokes `Trezor: Debug`.
- If a selected template references an unknown or otherwise invalid tf-tools substitution variable, the extension shall also show an error notification when the user invokes `Trezor: Debug`.

Example debugger template:

```jsonc
{
  // Example template for a hardware attach session.
  "name": "Debug ${tfTools.model.id} ${tfTools.executable}",
  "type": "cortex-debug",
  "request": "attach",
  "cwd": "${workspaceFolder}",
  "executable": "${tfTools.executablePath}",
  "servertype": "openocd",
  "configFiles": [
    "interface/stlink.cfg",
    "target/stm32u5x.cfg"
  ],
  "postAttachCommands": [
    "monitor adapter speed 8000",
    "add-symbol-file ${tfTools.artifactPath}/kernel.elf"
  ]
}
```

In this example:

- `${tfTools.executable}` contributes the executable filename to the user-visible debug configuration name.
- `${tfTools.executablePath}` provides the full resolved path to the primary debug executable.
- `${tfTools.artifactPath}` provides the active model artifact folder so additional symbol files can be referenced relative to it.

Checkbox option semantics:

- A checkbox option appends its `flag` value to the build command when enabled.

Multistate option semantics:

- A multistate option shall define a non-empty `states` array.
- Each state shall contain a non-empty `name`.
- Each state may define `value`, `description`, and `default`.
- State values shall be unique within the option after normalization.
- A state with `value: null`, or an omitted `value`, shall suppress the CLI flag for that state.
- A state with a string `value` shall append `<flag> <value>` to the build command, using the option's `flag` field.
- If one state is marked with `default: true`, that state shall be used as the default selection.
- If no state is marked as default, the first state in the list shall be used as the default selection.

### Ordering And Validation Rules

- Array order shall define UI order.
- The first entries in `models`, `targets`, and `components` shall be used as fallbacks when persisted values are missing or invalid.
- Build artifacts shall be addressed under `tfTools.artifactsPath` using the layout `<artifacts-root>/<artifactFolder>/<artifactName><artifactSuffix><extension>`, where `<artifactFolder>` comes from the selected model's required `artifactFolder` field, `<artifactName>` comes from the selected component's required `artifactName` field, and `<artifactSuffix>` comes from the selected target's optional `artifactSuffix` field and defaults to an empty string when omitted.
- Group order in the Build Options UI shall follow the first occurrence of each group label in `options`.
- Duplicate ids within `models`, `targets`, and `components` shall be invalid.
- Duplicate `flag` values within `options` shall be invalid.
- Duplicate multistate values within one option shall be invalid.
- Invalid `when`, `flashWhen`, `uploadWhen`, and `debug.when` expressions and references to unknown model, target, or component ids shall be invalid.
- Missing required fields in `debug` entries shall be invalid.
- A `debug.template` value shall be treated as invalid when it escapes the configured template directory through path traversal.
- Cycles in debug-variable expansion shall be invalid.
- If more than one `debug` entry can match the same active build context at the highest resolved `priority`, the manifest shall be invalid for that build context.
- `debug.template` values are relative paths and may point to files in subdirectories under `tfTools.debug.templatesPath`.
- Required string fields shall not be empty.

### Minimal Example

```yaml
models:
  - id: T3W1
    name: T3W1 (TS7)
    artifactFolder: ts7

targets:
  - id: hardware
    name: Hardware
    flag: null
  - id: emulator
    name: Emulator
    flag: --emulator

components:
  - id: firmware
    name: Firmware
    artifactName: firmware
    flashWhen: not(target(emulator))
    uploadWhen: not(target(emulator))

debug:
  - template: default-hardware.json
    when: all(target(hardware), component(firmware))
    executable: firmware.elf
    vars:
      mainSymbol: kernel.elf

  - template: default-emulator.json
    when: all(target(emulator), component(firmware))
    executable: firmware-emu

options:
  - flag: --production
    name: Production
    type: checkbox
    when: target(hardware)

  - flag: --debug
    name: Debug
    type: multistate
    states:
      - value: null
        name: Default
        default: true
      - value: "true"
        name: Enabled
```