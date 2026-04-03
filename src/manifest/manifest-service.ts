import * as vscode from "vscode";
import * as fs from "fs/promises";
import { ManifestState } from "./manifest-types";
import { validateManifest } from "./validate-manifest";

const DEBOUNCE_MS = 300;

export class ManifestService implements vscode.Disposable {
  private _state: ManifestState | undefined;
  private readonly _onDidChangeState =
    new vscode.EventEmitter<ManifestState>();
  private _watcher: vscode.FileSystemWatcher | undefined;
  private _debounceTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly _disposables: vscode.Disposable[] = [];

  /** Fires whenever the manifest state changes. */
  readonly onDidChangeState: vscode.Event<ManifestState> =
    this._onDidChangeState.event;

  constructor(private readonly manifestUri: vscode.Uri) {}

  /**
   * Returns the current manifest state, or undefined before the first load.
   */
  get state(): ManifestState | undefined {
    return this._state;
  }

  /**
   * Loads the manifest from disk, validates it, publishes the new state,
   * and starts watching for changes. Safe to call multiple times.
   */
  async start(): Promise<ManifestState> {
    this._startWatcher();
    return this._load();
  }

  /**
   * Forces an immediate reload from disk.
   */
  async reload(): Promise<ManifestState> {
    return this._load();
  }

  dispose(): void {
    if (this._debounceTimer !== undefined) {
      clearTimeout(this._debounceTimer);
    }
    this._watcher?.dispose();
    this._onDidChangeState.dispose();
    for (const d of this._disposables) {
      d.dispose();
    }
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  private async _load(): Promise<ManifestState> {
    let newState: ManifestState;

    try {
      const raw = await fs.readFile(this.manifestUri.fsPath, "utf-8");
      newState = validateManifest(raw, this.manifestUri);
    } catch (err: unknown) {
      const notFound =
        err instanceof Error &&
        (err as NodeJS.ErrnoException).code === "ENOENT";
      if (notFound) {
        newState = { status: "missing", manifestUri: this.manifestUri };
      } else {
        // Unreadable file — treat as invalid so diagnostics fire
        const message =
          err instanceof Error ? err.message : "Could not read manifest file";
        newState = {
          status: "invalid",
          manifestUri: this.manifestUri,
          validationIssues: [
            {
              severity: "error",
              code: "yaml-parse",
              message: `Could not read manifest: ${message}`,
            },
          ],
          loadedAt: new Date(),
        };
      }
    }

    this._setState(newState);
    return newState;
  }

  private _setState(state: ManifestState): void {
    this._state = state;
    this._onDidChangeState.fire(state);
  }

  private _startWatcher(): void {
    if (this._watcher) {
      return;
    }
    // Watch the exact manifest file for create, change, and delete events
    const pattern = new vscode.RelativePattern(
      vscode.Uri.file(
        this.manifestUri.fsPath.substring(
          0,
          this.manifestUri.fsPath.lastIndexOf("/")
        )
      ),
      this.manifestUri.fsPath.substring(
        this.manifestUri.fsPath.lastIndexOf("/") + 1
      )
    );

    this._watcher = vscode.workspace.createFileSystemWatcher(pattern);
    this._disposables.push(this._watcher);

    const reload = () => this._scheduleReload();
    this._disposables.push(this._watcher.onDidCreate(reload));
    this._disposables.push(this._watcher.onDidChange(reload));
    this._disposables.push(this._watcher.onDidDelete(reload));
  }

  private _scheduleReload(): void {
    if (this._debounceTimer !== undefined) {
      clearTimeout(this._debounceTimer);
    }
    this._debounceTimer = setTimeout(() => {
      this._debounceTimer = undefined;
      this._load().catch(() => {
        // errors are captured inside _load and translated to invalid state
      });
    }, DEBOUNCE_MS);
  }
}
