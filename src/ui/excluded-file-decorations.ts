/**
 * Explorer file-decoration provider for the Excluded-File Visibility feature.
 *
 * Implements `vscode.FileDecorationProvider` and consumes `ExcludedFilesSnapshot`
 * snapshots emitted by `ExcludedFilesService`.  For each excluded file it
 * returns a `FileDecoration` with:
 *   - badge  : "✗"
 *   - tooltip : "Not included in the active build configuration"
 *   - color   : optional gray theme color when `grayInTree` is enabled
 *
 * Implementation notes:
 *  - The provider fires `onDidChangeFileDecorations` whenever the snapshot
 *    changes so VS Code refreshes Explorer rows for affected URIs.
 *  - Decoration is suppressed for included and out-of-scope files by returning
 *    `undefined` from `provideFileDecoration`.
 *  - Full implementation of `provideFileDecoration` is delivered in T011.
 */

import * as vscode from "vscode";
import { ExcludedFilesSnapshot } from "../intellisense/excluded-files-service";
import { normalizeToForwardSlashes } from "../intellisense/excluded-files-service";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Fixed Explorer badge for excluded files. */
export const EXCLUDED_BADGE = "✗";

/** Human-readable tooltip / overlay explanation text (FR-008). */
export const EXCLUDED_TOOLTIP = "Not included in the active build configuration";

/** VS Code theme color id for the optional gray Explorer coloring. */
const GRAY_THEME_COLOR_ID = "disabledForeground";

// ---------------------------------------------------------------------------
// ExcludedFileDecorationsProvider
// ---------------------------------------------------------------------------

/**
 * Provides Explorer `FileDecoration` entries for excluded files.
 *
 * Register with `vscode.window.registerFileDecorationProvider(provider)`.
 * Subscribe to `ExcludedFilesService.onDidUpdateSnapshot` and call
 * `handleSnapshot()` on each emission.
 */
export class ExcludedFileDecorationsProvider implements vscode.FileDecorationProvider {
  private _snapshot: ExcludedFilesSnapshot | undefined;

  private readonly _onDidChangeFileDecorations = new vscode.EventEmitter<
    vscode.Uri | vscode.Uri[] | undefined
  >();

  /** Required by `FileDecorationProvider` interface. */
  readonly onDidChangeFileDecorations: vscode.Event<vscode.Uri | vscode.Uri[] | undefined> =
    this._onDidChangeFileDecorations.event;

  dispose(): void {
    this._onDidChangeFileDecorations.dispose();
  }

  /**
   * Called by the extension wiring whenever `ExcludedFilesService` emits a
   * new snapshot.  Stores the snapshot and fires a decoration refresh for all
   * affected URIs so VS Code re-queries `provideFileDecoration`.
   */
  handleSnapshot(snapshot: ExcludedFilesSnapshot): void {
    const previous = this._snapshot;
    this._snapshot = snapshot;

    // Collect URIs that changed decoration state (added, removed, or changed settings).
    const affected = computeAffectedUris(previous, snapshot);
    if (affected.length > 0) {
      this._onDidChangeFileDecorations.fire(affected);
    } else if (settingsChanged(previous, snapshot)) {
      // Settings (e.g. grayInTree) changed without file membership changing —
      // fire undefined to request a full re-query.
      this._onDidChangeFileDecorations.fire(undefined);
    }
  }

  /**
   * Returns the `FileDecoration` for the given URI, or `undefined` when the
   * file is not excluded.  Implementation delivered in T011 — stub returns
   * `undefined` so no decorations are shown until the implementation lands.
   */
  provideFileDecoration(
    uri: vscode.Uri,
    _token: vscode.CancellationToken
  ): vscode.FileDecoration | undefined {
    const snapshot = this._snapshot;
    if (!snapshot) {
      return undefined;
    }

    const normalized = normalizeToForwardSlashes(uri.fsPath);
    if (!snapshot.excludedFiles.has(normalized)) {
      return undefined;
    }

    const color = snapshot.settings.grayInTree
      ? new vscode.ThemeColor(GRAY_THEME_COLOR_ID)
      : undefined;

    return new vscode.FileDecoration(EXCLUDED_BADGE, EXCLUDED_TOOLTIP, color);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeAffectedUris(
  previous: ExcludedFilesSnapshot | undefined,
  next: ExcludedFilesSnapshot
): vscode.Uri[] {
  const uris: vscode.Uri[] = [];

  // Files newly excluded.
  for (const p of next.excludedFiles) {
    if (!previous?.excludedFiles.has(p)) {
      uris.push(vscode.Uri.file(p));
    }
  }

  // Files no longer excluded.
  if (previous) {
    for (const p of previous.excludedFiles) {
      if (!next.excludedFiles.has(p)) {
        uris.push(vscode.Uri.file(p));
      }
    }
  }

  return uris;
}

function settingsChanged(
  previous: ExcludedFilesSnapshot | undefined,
  next: ExcludedFilesSnapshot
): boolean {
  if (!previous) {
    return false;
  }
  return previous.settings.grayInTree !== next.settings.grayInTree;
}
