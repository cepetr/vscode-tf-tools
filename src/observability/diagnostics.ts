import * as vscode from "vscode";
import { ValidationIssue, ManifestState } from "../manifest/manifest-types";

// ---------------------------------------------------------------------------
// Diagnostic collection
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Manifest state → diagnostics
// ---------------------------------------------------------------------------

/**
 * Translates a `ManifestState` to VS Code diagnostics.
 *
 * - `loaded`: publishes any warning-level validation issues and clears errors.
 * - `invalid`: publishes all validation issues as diagnostics.
 * - `missing`: clears all diagnostics for the manifest URI (the missing state
 *   is communicated through notifications and log output, not diagnostics).
 */
export function handleManifestStateDiagnostics(state: ManifestState): void {
  switch (state.status) {
    case "loaded":
      // Only publish warnings present on a successfully loaded manifest
      if (state.validationIssues.length > 0) {
        publishDiagnostics(state.manifestUri, state.validationIssues);
      } else {
        clearDiagnostics(state.manifestUri);
      }
      break;
    case "invalid":
      publishDiagnostics(state.manifestUri, state.validationIssues);
      break;
    case "missing":
      clearDiagnostics(state.manifestUri);
      break;
  }
}
