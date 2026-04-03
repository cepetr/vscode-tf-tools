import * as vscode from "vscode";
import { hasSupportedWorkspace, requireWorkspaceFolder } from "./workspace/workspace-guard";
import { resolveManifestUri } from "./workspace/settings";
import { ManifestService } from "./manifest/manifest-service";
import { ConfigurationTreeProvider } from "./ui/configuration-tree";
import { disposeLogChannel, revealLogs } from "./observability/log-channel";
import { disposeDiagnostics } from "./observability/diagnostics";

let _manifestService: ManifestService | undefined;
let _treeProvider: ConfigurationTreeProvider | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // --- Scope guard: cross-slice commands are never registered from this extension ---
  // T019: no Build, Debug, or other cross-slice commands are contributed here.

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

  // --- Manifest service ---
  _manifestService = new ManifestService(manifestUri);
  context.subscriptions.push(_manifestService);

  // Connect manifest state changes to the tree provider (expanded in T020)
  context.subscriptions.push(
    _manifestService.onDidChangeState((state) => {
      _treeProvider?.update(state);
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

  // --- Start manifest service (loads and begins watching) ---
  await _manifestService.start();
}

export function deactivate(): void {
  _manifestService?.dispose();
  _manifestService = undefined;
  _treeProvider?.dispose();
  _treeProvider = undefined;
  disposeDiagnostics();
  disposeLogChannel();
}
