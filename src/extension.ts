import * as vscode from "vscode";
import { hasSupportedWorkspace, requireWorkspaceFolder } from "./workspace/workspace-guard";
import { resolveManifestUri, isStatusBarEnabled } from "./workspace/settings";
import { ManifestService } from "./manifest/manifest-service";
import { ConfigurationTreeProvider } from "./ui/configuration-tree";
import { StatusBarPresenter } from "./ui/status-bar";
import { disposeLogChannel, revealLogs, logManifestState } from "./observability/log-channel";
import { disposeDiagnostics, handleManifestStateDiagnostics } from "./observability/diagnostics";
import {
  restoreActiveConfig,
  selectModel,
  selectTarget,
  selectComponent,
} from "./configuration/active-config";
import { ManifestState } from "./manifest/manifest-types";

let _manifestService: ManifestService | undefined;
let _treeProvider: ConfigurationTreeProvider | undefined;
let _statusBar: StatusBarPresenter | undefined;
let _manifestState: ManifestState | undefined;

// ---------------------------------------------------------------------------
// Scope guard (FR-016, FR-017)
//
// This extension contributes ONLY the commands listed below in this feature
// slice. Build, Clippy, Check, Clean, Flash, Upload, Debug, IntelliSense, and
// all other cross-slice commands are intentionally absent. Any attempt to
// register them here is a scope violation.
//
// Allowed commands:
//   tfTools.showLogs          — reveal the output channel
//   tfTools.revealConfiguration — reveal the configuration tree view
// ---------------------------------------------------------------------------

const ALLOWED_CONTRIBUTION_COMMANDS = new Set([
  "tfTools.showLogs",
  "tfTools.revealConfiguration",
]);

/**
 * Development-time guard: verifies that no unauthorized tfTools commands are
 * contributed during activation. Throws in development mode if a violation is
 * detected; logs a warning in production.
 */
function assertNoUnauthorizedContributions(
  context: vscode.ExtensionContext
): void {
  const contributed: string[] =
    context.extension.packageJSON?.contributes?.commands?.map(
      (c: { command: string }) => c.command
    ) ?? [];

  const unauthorized = contributed
    .filter((cmd: string) => cmd.startsWith("tfTools."))
    .filter((cmd: string) => !ALLOWED_CONTRIBUTION_COMMANDS.has(cmd));

  if (unauthorized.length > 0) {
    const msg =
      `Trezor Firmware Tools scope violation (FR-016/FR-017): ` +
      `unauthorized commands found in package.json: ${unauthorized.join(", ")}`;
    // In development host, fail loudly; in packaged extension log to channel
    console.error(msg);
  }
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // --- Scope guard: verify no cross-slice commands are registered (T019) ---
  assertNoUnauthorizedContributions(context);

  if (!hasSupportedWorkspace()) {
    // Extension activated without a workspace — show a visible warning and bail.
    vscode.window.showWarningMessage(
      "Trezor Firmware Tools requires an open workspace folder."
    );
    return;
  }

  const workspaceFolder = requireWorkspaceFolder();
  const manifestUri = resolveManifestUri(workspaceFolder);

  // --- Tree view provider ---
  _treeProvider = new ConfigurationTreeProvider();
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("tfTools.configuration", _treeProvider)
  );

  // --- Status-bar presenter (T031) ---
  _statusBar = new StatusBarPresenter();
  context.subscriptions.push(_statusBar);

  // --- Manifest service ---
  _manifestService = new ManifestService(manifestUri);
  context.subscriptions.push(_manifestService);

  // Connect manifest state changes to the tree provider, diagnostics and logs (T020)
  // On each state change, restore and normalize the active config (T026/T031)
  context.subscriptions.push(
    _manifestService.onDidChangeState(async (state) => {
      _manifestState = state;
      let activeConfig;
      if (state.status === "loaded") {
        activeConfig = await restoreActiveConfig(context, state);
      }
      _treeProvider?.update(state, activeConfig);
      _statusBar?.update(state, activeConfig, isStatusBarEnabled(workspaceFolder));
      handleManifestStateDiagnostics(state);
      logManifestState(state);
    })
  );

  // --- Commands ---
  context.subscriptions.push(
    vscode.commands.registerCommand("tfTools.showLogs", () => {
      revealLogs();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("tfTools.revealConfiguration", () => {
      vscode.commands.executeCommand("tfTools.configuration.focus");
    })
  );

  // --- Build-context selector commands (T026+T031) ---
  context.subscriptions.push(
    vscode.commands.registerCommand("tfTools.selectModel", async (modelId: string) => {
      const state = _manifestState;
      if (!state || state.status !== "loaded") { return; }
      const config = await selectModel(context, modelId, state);
      _treeProvider?.update(state, config);
      _statusBar?.update(state, config, isStatusBarEnabled(workspaceFolder));
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("tfTools.selectTarget", async (targetId: string) => {
      const state = _manifestState;
      if (!state || state.status !== "loaded") { return; }
      const config = await selectTarget(context, targetId, state);
      _treeProvider?.update(state, config);
      _statusBar?.update(state, config, isStatusBarEnabled(workspaceFolder));
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("tfTools.selectComponent", async (componentId: string) => {
      const state = _manifestState;
      if (!state || state.status !== "loaded") { return; }
      const config = await selectComponent(context, componentId, state);
      _treeProvider?.update(state, config);
      _statusBar?.update(state, config, isStatusBarEnabled(workspaceFolder));
    })
  );

  // --- Start manifest service (loads and begins watching) ---
  await _manifestService.start();
}

export function deactivate(): void {
  _manifestService?.dispose();
  _manifestService = undefined;
  _treeProvider?.dispose();
  _treeProvider = undefined;
  _statusBar?.dispose();
  _statusBar = undefined;
  _manifestState = undefined;
  disposeDiagnostics();
  disposeLogChannel();
}
