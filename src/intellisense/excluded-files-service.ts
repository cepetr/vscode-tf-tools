/**
 * Excluded-file matching and snapshot service.
 *
 * Consumes the active compile-database inclusion payload from the IntelliSense
 * slice and applies basename-only, case-sensitive, forward-slash-normalized
 * matching rules to determine which workspace files should be marked excluded.
 *
 * Implementation discipline (per plan.md):
 *  - The service evaluates settings and inclusion data only; it does NOT parse
 *    compile-commands files or add new artifact-resolution logic.
 *  - There is no fallback source of inclusion data: if the payload is absent,
 *    the snapshot's excludedFiles set is empty and stale markers must be cleared.
 *  - Matching is basename-only for fileNamePatterns, case-sensitive for all
 *    fields, and uses "/" separators after normalizing candidate paths.
 *  - Both fileNamePatterns and folderGlobs must be non-empty for any file to
 *    be marked excluded.
 */

import * as path from "path";
import { minimatch } from "minimatch";
import * as vscode from "vscode";
import { ExcludedFilesSettings } from "../workspace/settings";

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

/**
 * The latest excluded-file state derived from the active compile-database
 * payload and current scope settings.
 */
export interface ExcludedFilesSnapshot {
  /** Active configuration key that produced this snapshot. */
  readonly contextKey: string;
  /** Absolute path of the compile-commands artifact, or null when unavailable. */
  readonly artifactPath: string | null;
  /** Settings that produced this snapshot. */
  readonly settings: ExcludedFilesSettings;
  /**
   * Normalized absolute paths (forward-slash) of all files included in the
   * active compile-database payload.
   */
  readonly includedFiles: ReadonlySet<string>;
  /**
   * Normalized absolute paths (forward-slash) of all files currently marked
   * excluded — the subset of workspace files that are absent from the compile
   * database AND match both the configured fileNamePatterns and folderGlobs.
   */
  readonly excludedFiles: ReadonlySet<string>;
}

// ---------------------------------------------------------------------------
// Path normalization helpers
// ---------------------------------------------------------------------------

/** Normalizes a filesystem path to forward-slash form for consistent matching. */
export function normalizeToForwardSlashes(p: string): string {
  return p.replace(/\\/g, "/");
}

/** Returns the basename (name + extension) of a normalized path. */
export function extractBasename(normalizedPath: string): string {
  return path.posix.basename(normalizedPath);
}

// ---------------------------------------------------------------------------
// Excluded-file decision
// ---------------------------------------------------------------------------

/**
 * Returns true when the file at `normalizedAbsPath` is in the excluded-file
 * scope given the current `includedFiles` set, scope settings, and optional
 * workspace root for resolving relative folder globs.
 *
 * Rules (all three must be true for a file to be marked excluded):
 *  1. The file is NOT in the active compile-database inclusion set.
 *  2. The file basename matches at least one pattern from `fileNamePatterns`.
 *  3. The absolute path (or workspace-relative path) matches at least one
 *     pattern from `folderGlobs`.
 *
 * If either `fileNamePatterns` or `folderGlobs` is empty, no files are marked.
 */
export function isFileExcluded(
  normalizedAbsPath: string,
  includedFiles: ReadonlySet<string>,
  settings: ExcludedFilesSettings,
  workspaceRoot: string
): boolean {
  // Empty scope lists disable marking entirely.
  if (settings.fileNamePatterns.length === 0 || settings.folderGlobs.length === 0) {
    return false;
  }

  // The file must not be in the active compile database.
  if (includedFiles.has(normalizedAbsPath)) {
    return false;
  }

  // Basename-only, case-sensitive filename matching.
  const basename = extractBasename(normalizedAbsPath);
  const matchesFileName = settings.fileNamePatterns.some((pattern) =>
    minimatch(basename, pattern, { nocase: false, dot: true })
  );
  if (!matchesFileName) {
    return false;
  }

  // Folder glob matching supports absolute and workspace-relative patterns.
  const normalizedWorkspaceRoot = normalizeToForwardSlashes(workspaceRoot);
  const matchesFolder = settings.folderGlobs.some((glob) => {
    const normalizedGlob = normalizeToForwardSlashes(glob);
    // Absolute glob: match directly against the abs path.
    if (path.posix.isAbsolute(normalizedGlob)) {
      return minimatch(normalizedAbsPath, normalizedGlob, { nocase: false, dot: true });
    }
    // Workspace-relative glob: construct an absolute glob and match.
    const absoluteGlob = normalizedWorkspaceRoot.replace(/\/$/, "") + "/" + normalizedGlob;
    return minimatch(normalizedAbsPath, absoluteGlob, { nocase: false, dot: true });
  });

  return matchesFolder;
}

// ---------------------------------------------------------------------------
// ExcludedFilesService
// ---------------------------------------------------------------------------

/**
 * Manages the latest excluded-file snapshot and provides an event for
 * consumers (Explorer decoration provider and editor overlay manager) to
 * react to snapshot changes.
 *
 * The snapshot is recomputed on demand via `recompute()`.  The service is
 * intentionally stateless with respect to the VS Code active workspace; all
 * inputs are supplied by callers (extension.ts or IntelliSenseService).
 */
export class ExcludedFilesService {
  private _snapshot: ExcludedFilesSnapshot = {
    contextKey: "",
    artifactPath: null,
    settings: {
      grayInTree: true,
      showEditorOverlay: true,
      fileNamePatterns: [],
      folderGlobs: [],
    },
    includedFiles: new Set(),
    excludedFiles: new Set(),
  };

  private readonly _onDidUpdateSnapshot = new vscode.EventEmitter<ExcludedFilesSnapshot>();

  /** Fired whenever a recomputation produces a new snapshot. */
  readonly onDidUpdateSnapshot: vscode.Event<ExcludedFilesSnapshot> =
    this._onDidUpdateSnapshot.event;

  dispose(): void {
    this._onDidUpdateSnapshot.dispose();
  }

  /** Returns the most recently computed snapshot. */
  getSnapshot(): ExcludedFilesSnapshot {
    return this._snapshot;
  }

  /**
   * Recomputes the excluded-file snapshot from the supplied inputs and fires
   * `onDidUpdateSnapshot` with the new snapshot.
   *
   * Callers provide the `includedFiles` set extracted from the active
   * `ProviderPayload`, or an empty set / null `artifactPath` when the
   * compile-database payload is unavailable.  In that case the resulting
  * `excludedFiles` is empty so stale markers are cleared.
   *
   * @param contextKey  Active configuration key (model/target/component).
   * @param artifactPath  Resolved compile-commands path, or null when absent.
   * @param includedFiles  Files included in the active compile database.
   * @param settings  Current excluded-file scope preferences.
   * @param workspaceRoot  Absolute workspace root path (for relative folder globs).
   * @param candidateUris  URIs of workspace files to evaluate. When empty the
   *                       snapshot's excludedFiles set will be empty but the
   *                       snapshot is still emitted so consumers can clear stale state.
   */
  recompute(
    contextKey: string,
    artifactPath: string | null,
    includedFiles: ReadonlySet<string>,
    settings: ExcludedFilesSettings,
    workspaceRoot: string,
    candidateUris: ReadonlyArray<vscode.Uri>
  ): void {
    // Build the latest exclusion snapshot from inclusion data and settings.
    // Guard: no payload → emit empty snapshot so stale markers are cleared.
    const excludedFiles = new Set<string>();

    if (artifactPath !== null && settings.fileNamePatterns.length > 0 && settings.folderGlobs.length > 0) {
      for (const uri of candidateUris) {
        const normalized = normalizeToForwardSlashes(uri.fsPath);
        if (isFileExcluded(normalized, includedFiles, settings, workspaceRoot)) {
          excludedFiles.add(normalized);
        }
      }
    }

    this._snapshot = {
      contextKey,
      artifactPath,
      settings,
      includedFiles,
      excludedFiles,
    };
    this._onDidUpdateSnapshot.fire(this._snapshot);
  }

  /**
   * Clears the snapshot (empties both sets) and fires the update event so
   * that consumers (Explorer and editor overlays) remove stale markers.
   * Called when the active compile-database payload becomes unavailable.
   */
  clear(contextKey: string): void {
    this._snapshot = {
      ...this._snapshot,
      contextKey,
      artifactPath: null,
      includedFiles: new Set(),
      excludedFiles: new Set(),
    };
    this._onDidUpdateSnapshot.fire(this._snapshot);
  }
}
