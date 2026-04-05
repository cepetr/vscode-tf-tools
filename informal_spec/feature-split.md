# Trezor Firmware Tools Feature Split

This document defines the recommended feature split for implementing Trezor Firmware Tools with Spec Kit.

The goal is to keep each feature user-visible, independently testable, and narrow enough that specs, plans, and task lists stay coherent. The split below avoids bundling unrelated integrations into one oversized feature while also avoiding infrastructure-only features that do not produce a demonstrable result.

This document is intentionally about slice boundaries and implementation ownership. It says what each feature should implement and what should stay out of scope for that slice. Detailed product behavior, rules, and technical mechanics remain defined in `user-spec.md` and `tech-spec.md`, which the specify workflow should read alongside this split.

## Recommended Feature Order

### 1. Configuration Experience
Manifest load and validation, configuration tree, persisted active selection, status bar, diagnostics, and log output.

This feature should produce the first usable UI slice. After it is implemented, a user should be able to open the extension, load the manifest, inspect validation problems for the configuration context, select model/target/component, and see the active configuration reflected in the UI and restored across reloads. Build Options may be visible only as a placeholder section in this slice; manifest-driven Build Options behavior and `when` handling are deferred.

### 2. Build Workflow
Build Options behavior, `when` parsing/validation/evaluation, build, clippy, check, and clean actions; dynamic task labels; command argument derivation; build-artifact status refresh.

This feature adds the first runtime behaviors driven by the full active configuration. It should implement Build Options rendering and selection in the tree view from the manifest, `when` parsing/validation/evaluation and option gating against the active model/target/component, VS Code tasks and command execution for `Build`, `Clippy`, `Check`, and `Clean`, dynamic task labels, command argument derivation from the effective configuration, and Configuration view title actions with `Build` kept as the primary header action while `Build`, `Clippy`, `Check`, and `Clean` are also available from the view overflow menu.

This feature should not implement Build Artifacts section behavior or artifact-status refresh, Flash/Upload actions, or IntelliSense integration and compile-commands refresh behavior.

### 3. IntelliSense Integration
Compile-commands resolution, cpptools configuration provider integration, provider warnings, and IntelliSense refresh behavior.

This feature is focused on keeping editor assistance aligned with the active build context and failing explicitly when the expected compile database or provider setup is unavailable. It includes showing whether the active compile-commands artifact is present, exposing the expected artifact path in the tooltip, and applying the active compile database through the cpptools configuration provider without falling back to a different artifact.

This feature also includes warning behavior for IntelliSense prerequisites: if cpptools is not installed, or if cpptools is installed but not configured to use Trezor Firmware Tools as the active provider, the extension shall log the problem and show a user-facing message.

### 4. Excluded-File Visibility
Explorer badges, optional graying, editor overlay, and file-scope/pattern rules.

This feature uses compile-database inclusion data to show which files are outside the active build configuration.
It consumes compile-database inclusion data from the IntelliSense slice but does not extend cpptools integration, compile-commands resolution, or artifact-path logic.

### 5. Flash/Upload Actions
Binary artifact row behavior, `flashWhen` and `uploadWhen` handling, Map File action behavior, VS Code task execution, and failure reporting.

This feature is intentionally separate from debug. It is an operational command-execution slice tied to artifact availability and component action rules.

This feature owns the operational behavior in the `Build Artifacts` section other than compile-commands status: the `Binary` row, its `Flash` and `Upload` action buttons, the applicable `Flash` and `Upload` entries in the Configuration view overflow menu, and the `Map File` row action for opening the resolved map file. `Flash` and `Upload` run as VS Code tasks rather than ad hoc process execution. Successful `Flash` and `Upload` completion does not trigger an automatic extension refresh.

### 6. Debug Launch
Debug profile resolution, priority handling, template loading, substitution variables, debug API launch, and debug-specific errors and logging.

This feature is intentionally separate from flash/upload. It is a debug-configuration resolution and launch slice with distinct validation paths and failure modes.

## Why This Split

- Each feature has a visible user outcome.
- Each feature has a clear integration boundary.
- Each feature can be specified and tested without dragging the whole extension into one plan.
- Build Options and `when` handling are grouped with Build Workflow because they first become user-testable when they affect visible option availability and build argument derivation.
- Debug is separated from flash/upload because their workflows, failure modes, and tests are materially different.
- IntelliSense is separated from excluded-file visibility because excluded-file UX depends on compile-database data, but the user-facing behavior is still different enough to justify distinct features when building the full product.

