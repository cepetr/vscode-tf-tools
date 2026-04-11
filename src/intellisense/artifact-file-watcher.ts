import * as path from "path";
import * as vscode from "vscode";
import { ActiveConfig } from "../configuration/active-config";
import { ManifestStateLoaded } from "../manifest/manifest-types";
import {
  buildResolutionInputs,
  deriveArtifactPath,
  deriveBinaryArtifactPath,
  deriveMapArtifactPath,
  resolveActiveExecutableArtifact,
} from "./artifact-resolution";

export interface ArtifactWatchScope {
  readonly folderPath: string;
  readonly fileNames: ReadonlySet<string>;
}

export interface FileSystemWatcherLike extends vscode.Disposable {
  onDidCreate(listener: (uri: vscode.Uri) => void): vscode.Disposable;
  onDidChange(listener: (uri: vscode.Uri) => void): vscode.Disposable;
  onDidDelete(listener: (uri: vscode.Uri) => void): vscode.Disposable;
}

export type FileSystemWatcherFactory = (
  globPattern: vscode.GlobPattern
) => FileSystemWatcherLike;

function addWatchPath(
  scopesByFolder: Map<string, Set<string>>,
  artifactPath: string | undefined
): void {
  if (!artifactPath) {
    return;
  }

  const folderPath = path.dirname(artifactPath);
  const fileName = path.basename(artifactPath);
  if (!folderPath || !fileName) {
    return;
  }

  let fileNames = scopesByFolder.get(folderPath);
  if (!fileNames) {
    fileNames = new Set<string>();
    scopesByFolder.set(folderPath, fileNames);
  }
  fileNames.add(fileName);
}

export function resolveArtifactWatchScopes(
  manifest: ManifestStateLoaded | undefined,
  config: ActiveConfig | undefined,
  artifactsRoot: string
): ArtifactWatchScope[] {
  if (!manifest || !config) {
    return [];
  }

  const scopesByFolder = new Map<string, Set<string>>();
  const inputs = buildResolutionInputs(manifest, config, artifactsRoot);
  if (inputs) {
    addWatchPath(scopesByFolder, deriveArtifactPath(inputs));
    addWatchPath(scopesByFolder, deriveBinaryArtifactPath(inputs));
    addWatchPath(scopesByFolder, deriveMapArtifactPath(inputs));
  }

  const executableArtifact = resolveActiveExecutableArtifact(
    manifest,
    config,
    artifactsRoot
  );
  addWatchPath(scopesByFolder, executableArtifact.expectedPath || undefined);

  return Array.from(scopesByFolder.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([folderPath, fileNames]) => ({ folderPath, fileNames }));
}

function buildScopeSignature(scopes: ReadonlyArray<ArtifactWatchScope>): string {
  return scopes
    .map((scope) => {
      const fileNames = Array.from(scope.fileNames).sort().join(",");
      return `${scope.folderPath}:${fileNames}`;
    })
    .join("|");
}

export class ActiveArtifactFileWatcher implements vscode.Disposable {
  private _scopeSignature = "";
  private _watchers: vscode.Disposable[] = [];
  private _refreshQueued = false;
  private _disposed = false;

  constructor(
    private readonly _onRelevantChange: () => void,
    private readonly _createWatcher: FileSystemWatcherFactory = (globPattern) =>
      vscode.workspace.createFileSystemWatcher(globPattern)
  ) {}

  update(
    manifest: ManifestStateLoaded | undefined,
    config: ActiveConfig | undefined,
    artifactsRoot: string
  ): void {
    if (this._disposed) {
      return;
    }

    const scopes = resolveArtifactWatchScopes(manifest, config, artifactsRoot);
    const nextSignature = buildScopeSignature(scopes);
    if (nextSignature === this._scopeSignature) {
      return;
    }

    this._disposeWatchers();
    this._scopeSignature = nextSignature;

    for (const scope of scopes) {
      const watcher = this._createWatcher(
        new vscode.RelativePattern(vscode.Uri.file(scope.folderPath), "*")
      );
      const handleEvent = (uri: vscode.Uri) => {
        this._handleFileEvent(scope, uri);
      };

      this._watchers.push(
        watcher,
        watcher.onDidCreate(handleEvent),
        watcher.onDidChange(handleEvent),
        watcher.onDidDelete(handleEvent)
      );
    }
  }

  dispose(): void {
    if (this._disposed) {
      return;
    }

    this._disposed = true;
    this._scopeSignature = "";
    this._disposeWatchers();
  }

  private _disposeWatchers(): void {
    for (const disposable of this._watchers) {
      disposable.dispose();
    }
    this._watchers = [];
  }

  private _handleFileEvent(scope: ArtifactWatchScope, uri: vscode.Uri): void {
    if (path.dirname(uri.fsPath) !== scope.folderPath) {
      return;
    }

    if (!scope.fileNames.has(path.basename(uri.fsPath))) {
      return;
    }

    this._queueRefresh();
  }

  private _queueRefresh(): void {
    if (this._refreshQueued || this._disposed) {
      return;
    }

    this._refreshQueued = true;
    queueMicrotask(() => {
      this._refreshQueued = false;
      if (!this._disposed) {
        this._onRelevantChange();
      }
    });
  }
}