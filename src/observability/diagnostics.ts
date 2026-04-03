import * as vscode from "vscode";
import { ValidationIssue } from "../manifest/manifest-types";

/** Reusable diagnostic collection for manifest validation problems. */
let _collection: vscode.DiagnosticCollection | undefined;

/**
 * Returns the shared manifest diagnostic collection, creating it on first call.
 * The returned collection is registered with the extension context disposables.
 */
export function getDiagnosticCollection(): vscode.DiagnosticCollection {
  if (!_collection) {
    _collection = vscode.languages.createDiagnosticCollection("tf-tools");
  }
  return _collection;
}

/**
 * Publishes `issues` as VS Code diagnostics attached to `uri`.
 * Clears any previous diagnostics on `uri` before publishing.
 */
export function publishDiagnostics(
  uri: vscode.Uri,
  issues: ReadonlyArray<ValidationIssue>
): void {
  const collection = getDiagnosticCollection();
  const diagnostics = issues.map((issue) => {
    const range = issue.range ?? new vscode.Range(0, 0, 0, 0);
    const severity =
      issue.severity === "error"
        ? vscode.DiagnosticSeverity.Error
        : vscode.DiagnosticSeverity.Warning;
    const diagnostic = new vscode.Diagnostic(range, issue.message, severity);
    diagnostic.source = "tf-tools";
    diagnostic.code = issue.code;
    return diagnostic;
  });
  collection.set(uri, diagnostics);
}

/**
 * Clears all diagnostics for `uri`.
 */
export function clearDiagnostics(uri: vscode.Uri): void {
  getDiagnosticCollection().delete(uri);
}

/**
 * Disposes the diagnostic collection. Call on extension deactivation.
 */
export function disposeDiagnostics(): void {
  _collection?.dispose();
  _collection = undefined;
}
