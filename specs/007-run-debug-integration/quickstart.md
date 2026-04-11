# Quickstart: Run And Debug Integration

## Goal

Validate that tf-tools-generated Run and Debug entries integrate with standard VS Code debugging while preserving direct `Start Debugging` behavior and launch-time failure handling.

## Prerequisites

- Open the repository on branch `007-run-debug-integration`.
- Use a supported single-root workspace.
- Ensure the extension builds and the test host can activate it.

## Validation Flow

1. Start the extension development host.
2. Open a workspace fixture or repository state where the selected component has at least one matching debug profile and a valid executable artifact.
3. Confirm that Run and Debug shows a tf-tools default entry for the current active build context.
4. Select the default entry and press F5. Confirm that debugging starts without creating or editing `.vscode/launch.json`.
5. Prepare a context with multiple matching debug profiles. Confirm that Run and Debug shows one default entry plus one profile-specific entry per matching profile.
6. Start a profile-specific entry and confirm that the selected alternate profile launches instead of the default profile.
7. Invoke `Start Debugging` from the `Configuration view` header, overflow menu, or executable row and confirm that it still launches the default profile immediately.
8. Change the active build context and confirm that Run and Debug entries refresh to the new context and do not launch stale prior-context profiles.
9. Break a template file or tf-tools debug variable in a matching profile and confirm that the entry remains discoverable but the launch fails with a user-visible error and output-channel log entry.

## Automated Validation Targets

- Unit tests for matching-set derivation, default-profile selection, generated entry labeling, and stale-context rejection.
- Integration tests for Run and Debug entry generation, direct command behavior, F5 launch path, no-`launch.json` behavior, and launch-time template failure handling.
- Repository validation via `npm test && npm run lint`.