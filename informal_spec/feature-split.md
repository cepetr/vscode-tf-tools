# Trezor Firmware Tools Feature Split

This document defines the recommended feature split for implementing Trezor Firmware Tools with Spec Kit.

The goal is to keep each feature user-visible, independently testable, and narrow enough that specs, plans, and task lists stay coherent. The split below avoids bundling unrelated integrations into one oversized feature while also avoiding infrastructure-only features that do not produce a demonstrable result.

## Recommended Feature Order

### 1. Configuration Experience
Manifest load and validation, configuration tree, persisted active selection, status bar, diagnostics, and log output.

This feature should produce the first usable UI slice. After it is implemented, a user should be able to open the extension, load the manifest, inspect validation problems, select model/target/component, and see the active configuration reflected in the UI and restored across reloads.

### 2. Build Workflow
Build, clippy, check, and clean actions; dynamic task labels; command argument derivation; build-artifact status refresh.

This feature adds in-editor execution of the main xtask workflows and connects the active configuration to task invocation and artifact state.

### 3. IntelliSense Integration
Compile-commands resolution, cpptools configuration provider integration, provider warnings, and IntelliSense refresh behavior.

This feature is focused on keeping editor assistance aligned with the active build context and failing explicitly when the expected compile database or provider setup is unavailable.

### 4. Excluded-File Visibility
Explorer badges, optional graying, editor overlay, and file-scope/pattern rules.

This feature uses compile-database inclusion data to show which files are outside the active build configuration.

### 5. Flash/Upload Actions
Binary artifact action enablement, `flashWhen` and `uploadWhen` handling, command execution, and failure reporting.

This feature is intentionally separate from debug. It is an operational command-execution slice tied to artifact availability and component action rules.

### 6. Debug Launch
Debug profile resolution, priority handling, template loading, substitution variables, debug API launch, and debug-specific errors and logging.

This feature is intentionally separate from flash/upload. It is a debug-configuration resolution and launch slice with distinct validation paths and failure modes.

## Why This Split

- Each feature has a visible user outcome.
- Each feature has a clear integration boundary.
- Each feature can be specified and tested without dragging the whole extension into one plan.
- Debug is separated from flash/upload because their workflows, failure modes, and tests are materially different.
- IntelliSense is separated from excluded-file visibility because excluded-file UX depends on compile-database data, but the user-facing behavior is still different enough to justify distinct features when building the full product.

