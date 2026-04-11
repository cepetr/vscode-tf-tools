# Contract: Generated Run And Debug Configurations

## Purpose

Define the contract between tf-tools and VS Code Run and Debug for generated debug entries tied to the active build context.

## Generated Configuration Shape

Each tf-tools-generated Run and Debug entry must provide the following logical fields before launch resolution:

| Field | Required | Description |
| --- | --- | --- |
| `type` | Yes | tf-tools proxy debug type used to route the entry through the tf-tools debug configuration provider |
| `request` | Yes | Launch request kind for the proxy configuration |
| `name` | Yes | User-visible label shown in Run and Debug |
| `tfToolsMode` | Yes | `default` for the default entry or `profile` for a profile-specific entry |
| `tfToolsProfileId` | Yes | Manifest debug profile identifier to materialize at launch time |
| `tfToolsContextKey` | Yes | Active build-context identity used to reject stale launches after context changes |

## Entry Set Rules

1. When the active build context has no matching debug profiles, tf-tools must not offer a launchable Run and Debug entry.
2. When the active build context has one or more matching debug profiles and a valid executable artifact, tf-tools must offer:
   - one default entry bound to the first matching profile in declaration order
   - one profile-specific entry per matching debug profile
3. Direct `Start Debugging` command surfaces do not use this entry set for user choice; they always launch the default profile.

## Label Rules

1. The default entry label must identify itself as the default tf-tools choice for the active build context.
2. Profile-specific labels must include the profile name and enough active build-context detail to remain distinguishable after context changes.
3. Labels must remain stable for the same active build context and profile ordering.

## Resolution Rules

1. Launch resolution must verify that `tfToolsContextKey` still matches the current active build context.
2. Launch resolution must materialize the selected profile by:
   - deriving the executable artifact path
   - loading the selected debug template
   - building tf-tools variables
   - applying tf-tools substitution
   - returning the final debugger configuration to VS Code
3. The final resolved configuration may differ from the proxy configuration and is the object actually started by VS Code.

## Failure Contract

1. If the context key is stale, launch must be rejected with a user-visible error and log output.
2. If the selected template is missing, invalid, or escapes the templates root, launch must be rejected with a user-visible error and log output.
3. If tf-tools debug variables cannot be resolved, launch must be rejected with a user-visible error and log output.
4. These failures must not require or write `.vscode/launch.json`.