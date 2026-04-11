# Trezor Firmware Tools

> Warning: This extension is still experimental and intended for evaluation only. It currently targets the newer `trezor-firmware` build workflow that is still evolving, and it is not expected to work with older repository layouts or legacy build tooling.

Trezor Firmware Tools helps you work with `trezor-firmware` more comfortably inside VS Code.

It adds a dedicated Configuration view where you can choose the active build context, adjust build options, run common firmware tasks, and work with the build artifacts used by IntelliSense and debugging.

## What It Does

- Lets you choose the active `model`, `target`, and `component` in one place.
- Remembers build options for the active configuration.
- Gives you quick access to common workflows such as `Build`, `Clippy`, `Check`, and `Clean`.
- Exposes device actions such as `Flash to Device` and `Upload to Device` when they are available.
- Starts a debug session for the active configuration when debugging is supported.
- Shows build artifacts such as compile commands, binary, map file, and executable.
- Refreshes C/C++ IntelliSense from the active compile database.
- Marks files that are outside the active build configuration.

## How To Use

Open the `Trezor` activity-bar view and use the `Configuration` tree:

- Choose the active build context in `Build Selection`.
- Enable or adjust build options in `Build Options`.
- Start with `Build` to produce the artifacts for the active configuration.
- Check `Build Artifacts` to confirm that the expected outputs were created.
- After a successful build, use `Flash to Device` or `Upload to Device` to send the firmware to hardware when needed.
- Use `Start Debugging` when the active configuration provides a valid executable and debug support.

The extension can also show the current build context in the status bar and makes key actions available from the Command Palette.

## Run and Debug Integration

When the active build context has a valid executable artifact and at least one matching debug profile, tf-tools generates VS Code Run and Debug entries automatically. No `.vscode/launch.json` is needed.

**Generated entries:**

- One **default entry** named after the active build context (for example `Trezor: Trezor Model T (v1) | HW | Core`). Selecting it and pressing **F5** launches the first matching debug profile in declaration order.
- When the active component has **more than one** matching debug profile, one additional **profile-specific entry** is generated per profile. Each entry name includes the profile name so that they are distinguishable after a context change.

**Launching:**

- Press **F5** or click **Start Debugging** in the Run and Debug view while a tf-tools entry is selected to start the session.
- The extension resolves the executable path, loads the debug template, applies variable substitution, and passes the resulting configuration to VS Code — all at launch time. If any step fails, the session is cancelled with a user-visible error and an entry in the output channel.

**Direct `Start Debugging` command:**

- The `Start Debugging` action available from the Configuration view header, overflow menu, and executable rows always launches the **default profile** directly, independent of the Run and Debug view selection.

**Context changes and stale entries:**

- If the active build context changes after entries were generated, launching a stale entry is rejected with an error. Refresh the Run and Debug view to pick up updated entries.

## Workspace Requirements

The extension is designed for the `trezor-firmware` repository opened as a single-root VS Code workspace.

It expects:

- the `xtask` build tool to be present in the repository
- a tf-tools manifest file
- a cargo workspace
- a build artifacts directory
- optional debug templates for debug launch support

It does not support the legacy SCons-based firmware build scripts used in older repository layouts.

## Configuration

These workspace settings tell the extension where to find its inputs:

- `tfTools.manifestPath`
- `tfTools.cargoWorkspacePath`
- `tfTools.artifactsPath`
- `tfTools.debug.templatesPath`

You can adjust optional UI behavior with:

- `tfTools.showConfigurationInStatusBar`
- `tfTools.excludedFiles.grayInTree`
- `tfTools.excludedFiles.showEditorOverlay`
- `tfTools.excludedFiles.fileNamePatterns`
- `tfTools.excludedFiles.folderGlobs`

## Notes

The extension does not manage the firmware build system itself. It relies on repository-specific manifest data, paths, and generated artifacts that are already present in the workspace.