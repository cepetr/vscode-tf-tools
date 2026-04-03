import * as vscode from "vscode";

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
