import * as vscode from "vscode";
import { ManifestState } from "../manifest/manifest-types";

const CHANNEL_NAME = "Trezor Firmware Tools";
let _channel: vscode.OutputChannel | undefined;

/**
 * Returns the shared output channel, creating it on first call.
 */
export function getLogChannel(): vscode.OutputChannel {
  if (!_channel) {
    _channel = vscode.window.createOutputChannel(CHANNEL_NAME);
  }
  return _channel;
}

/**
 * Appends a timestamped log line to the output channel.
 */
export function log(message: string): void {
  const ts = new Date().toISOString();
  getLogChannel().appendLine(`[${ts}] ${message}`);
}

/**
 * Appends a log line and also shows a VS Code warning notification.
 */
export function logWarning(message: string): void {
  log(`[WARN] ${message}`);
  vscode.window.showWarningMessage(message);
}

/**
 * Appends a log line and also shows a VS Code error notification.
 */
export function logError(message: string): void {
  log(`[ERROR] ${message}`);
  vscode.window.showErrorMessage(message);
}

/**
 * Reveals the output channel in the panel.
 */
export function revealLogs(): void {
  getLogChannel().show(true);
}

/**
 * Disposes the output channel. Call on extension deactivation.
 */
export function disposeLogChannel(): void {
  _channel?.dispose();
  _channel = undefined;
}

// ---------------------------------------------------------------------------
// Manifest state logging
// ---------------------------------------------------------------------------

/**
 * Logs a human-readable description of the new manifest state.
 * Does NOT show user notifications — that is done by the caller.
 */
export function logManifestState(state: ManifestState): void {
  const path = state.manifestUri.fsPath;
  switch (state.status) {
    case "loaded":
      log(
        `Manifest loaded: ${path} — ` +
          `${(state as Extract<ManifestState, { status: "loaded" }>).models.length} model(s), ` +
          `${(state as Extract<ManifestState, { status: "loaded" }>).targets.length} target(s), ` +
          `${(state as Extract<ManifestState, { status: "loaded" }>).components.length} component(s)`
      );
      break;
    case "missing":
      log(`Manifest missing: ${path}`);
      break;
    case "invalid": {
      const issues = (state as Extract<ManifestState, { status: "invalid" }>)
        .validationIssues;
      log(`Manifest invalid: ${path} — ${issues.length} issue(s)`);
      for (const issue of issues) {
        log(`  [${issue.severity}] ${issue.message} (${issue.code})`);
      }
      break;
    }
  }
}
