import * as vscode from "vscode";

/**
 * Returns the manifest path setting for the given workspace folder, resolved
 * to an absolute URI. Falls back to `tf-tools.yaml` at the workspace root.
 */
export function resolveManifestUri(
  workspaceFolder: vscode.WorkspaceFolder
): vscode.Uri {
  const cfg = vscode.workspace.getConfiguration("tfTools", workspaceFolder.uri);
  const relative: string = cfg.get<string>("manifestPath") || "tf-tools-manifest.yaml";
  return vscode.Uri.joinPath(workspaceFolder.uri, relative);
}

/**
 * Returns true when status-bar visibility is enabled for the workspace.
 */
export function isStatusBarEnabled(
  workspaceFolder: vscode.WorkspaceFolder
): boolean {
  const cfg = vscode.workspace.getConfiguration("tfTools", workspaceFolder.uri);
  return cfg.get<boolean>("showConfigurationInStatusBar") ?? true;
}

/**
 * Returns the cargo workspace directory for the given workspace folder.
 * Uses `tfTools.cargoWorkspacePath` when set; falls back to the workspace
 * folder root so the extension works without explicit configuration.
 */
export function resolveCargoWorkspacePath(
  workspaceFolder: vscode.WorkspaceFolder
): string {
  const cfg = vscode.workspace.getConfiguration("tfTools", workspaceFolder.uri);
  const relative: string | undefined = cfg.get<string>("cargoWorkspacePath");
  if (relative && relative.trim()) {
    return vscode.Uri.joinPath(workspaceFolder.uri, relative.trim()).fsPath;
  }
  return workspaceFolder.uri.fsPath;
}
