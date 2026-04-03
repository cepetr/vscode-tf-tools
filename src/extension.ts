import * as vscode from "vscode";
import { hasSupportedWorkspace, requireWorkspaceFolder } from "./workspace/workspace-guard";
import { resolveManifestUri } from "./workspace/settings";
import { ManifestService } from "./manifest/manifest-service";
import { ConfigurationTreeProvider } from "./ui/configuration-tree";
import { disposeLogChannel, revealLogs, logManifestState } from "./observability/log-channel";
import { disposeDiagnostics, handleManifestStateDiagnostics } from "./observability/diagnostics";

let _manifestService: ManifestService | undefined;
let _treeProvider: ConfigurationTreeProvider | undefined;

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

  // --- Manifest service ---
  _manifestService = new ManifestService(manifestUri);
  context.subscriptions.push(_manifestService);

  // Connect manifest state changes to the tree provider, diagnostics and logs (T020)
  context.subscriptions.push(
    _manifestService.onDidChangeState((state) => {
      _treeProvider?.update(state);
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
