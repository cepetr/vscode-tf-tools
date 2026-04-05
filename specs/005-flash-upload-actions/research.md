# Research: Flash/Upload Actions

## Decision 1: Parse `flashWhen` and `uploadWhen` into the manifest model using the existing condition parser

- **Decision**: Extend component manifest parsing so `flashWhen` and `uploadWhen` are validated and stored as parsed expressions on `ManifestComponent`, reusing the same expression language, unknown-id validation, and diagnostics path already used for build-option `when` expressions.
- **Rationale**: Action applicability is manifest-driven behavior, and the technical spec already states that `flashWhen` and `uploadWhen` share the same parser and validation rules as option availability. Reusing the existing AST and diagnostics machinery preserves consistency and keeps failure visibility explicit.
- **Alternatives considered**:
  - Evaluate raw strings lazily at command-launch time: rejected because it would defer validation until runtime and fragment diagnostics.
  - Hardcode a reduced action-rule parser separate from option `when`: rejected because it duplicates logic and risks divergent semantics.

## Decision 2: Generalize artifact resolution for `.bin` and `.map` instead of creating a second path formula

- **Decision**: Reuse the current artifact-resolution inputs and extend path derivation so the same helper can compute compile-commands, binary, and map-file paths from one model/component/target tuple.
- **Rationale**: The selected slice depends on the same artifact base path and basename contract already implemented for compile commands. One shared artifact resolver prevents drift between rows and keeps missing-reason logic consistent across artifact types.
- **Alternatives considered**:
  - Duplicate the path formula inside the tree provider: rejected because row rendering should consume resolved state, not own artifact derivation.
  - Add a new artifact-resolution service unrelated to the current helper: rejected because the existing helper already owns the authoritative inputs and stale-context key behavior.

## Decision 3: Launch Flash and Upload as on-demand VS Code tasks, not as task-provider entries

- **Decision**: Build Flash and Upload `Task` objects on demand from command handlers and execute them through `vscode.tasks.executeTask`, reusing the existing cargo-workspace resolution and task-execution patterns without exposing Flash or Upload as standard build-task provider entries.
- **Rationale**: The feature spec requires VS Code task execution, but it does not require Flash and Upload to appear in `Terminal -> Run Build Task`. On-demand tasks keep the existing build-task provider scoped to Build/Clippy/Check/Clean while still giving Flash and Upload terminal-backed execution, cancellation, and output.
- **Alternatives considered**:
  - Add Flash and Upload to `BuildTaskProvider.provideTasks()`: rejected because it would widen the standard build-task surface beyond what the slice promises.
  - Spawn processes directly from command handlers: rejected because the clarified scope explicitly chose task-backed execution.

## Decision 4: Gate row actions and Command Palette visibility with derived context keys

- **Decision**: Compute explicit context keys in `src/extension.ts` for Flash applicability, Upload applicability, Binary presence, and Map presence, then use those keys in `menus.commandPalette` and `menus.view/item/context` so only applicable actions appear in the Command Palette while applicable-but-missing Binary or Map actions stay visible yet disabled on the artifact rows.
- **Rationale**: VS Code menu visibility is contribution-driven and `when`/`enablement` clauses are the stable way to express context-sensitive command exposure. This keeps Binary-row behavior and Command Palette visibility synchronized to the same derived state.
- **Alternatives considered**:
  - Always show Flash and Upload in the Command Palette and block at runtime: rejected because the clarified spec requires hiding inapplicable commands from that surface.
  - Hide Binary-row actions when the binary artifact is missing: rejected because the informal spec requires applicable actions to remain visible but disabled.

## Decision 5: Keep contributed Command Palette labels stable and carry active context through row location, task labels, and runtime messaging

- **Decision**: Contribute stable `tfTools.flash` and `tfTools.upload` command labels in `package.json`, while carrying the active model/component context through the Binary-row location, task labels or task execution messages, and failure text.
- **Rationale**: VS Code command contribution titles are manifest-defined and are the labels shown in the Command Palette. Conditional exposure is supported through `menus.commandPalette`, but per-invocation dynamic renaming is not part of the stable contribution model. Preserving one command id per action keeps the design simple and compatible with Command Palette filtering.
- **Alternatives considered**:
  - Generate dynamic command ids or titles per active configuration: rejected because it would require volatile contribution surfaces that VS Code does not support through runtime registration alone.
  - Remove Command Palette exposure to preserve fully dynamic row-only labels: rejected because the clarification explicitly requires Command Palette availability.

## Decision 6: Use one internal command for map-file open and keep it out of the Command Palette

- **Decision**: Implement the `Map File` row action through an internal command id used only by the tree-item action contribution, and do not expose it as a standalone Command Palette entry.
- **Rationale**: The informal spec explicitly allows the map-file action to be command-backed internally while remaining absent from the palette. This keeps the public command surface focused on Flash and Upload while still using stable VS Code row actions.
- **Alternatives considered**:
  - Expose `Open Map File` in the Command Palette as a public command: rejected because it increases discoverability for a secondary action that the spec intentionally binds to the artifact row.
  - Open the map file directly from the tree item without a command contribution: rejected because VS Code row actions are command-backed.

## Decision 7: Do not schedule IntelliSense or excluded-file refresh after successful Flash or Upload completion

- **Decision**: Keep Flash and Upload as operational actions only; success may update the terminal/task state, but it must not schedule `manual-refresh`, `successful-build`, or any other extension refresh trigger.
- **Rationale**: The clarified slice explicitly rejects automatic post-success refresh. Flash and Upload operate on already-built artifacts rather than producing new compile-command or excluded-file inputs.
- **Alternatives considered**:
  - Reuse the successful-build refresh path after each successful Flash or Upload: rejected because it violates the clarified slice boundary and performs unnecessary work.
  - Trigger artifact-row recomputation only: rejected because the user chose no automatic refresh at all.