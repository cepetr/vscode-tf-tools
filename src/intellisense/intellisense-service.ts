import * as vscode from "vscode";
import {
  ActiveCompileCommandsArtifact,
  IntelliSenseProviderReadiness,
  IntelliSenseRuntimeState,
  RefreshTrigger,
} from "./intellisense-types";
import {
  buildResolutionInputs,
  resolveActiveArtifact,
  makeContextKey,
} from "./artifact-resolution";
import { checkProviderReadiness, CpptoolsProviderAdapter } from "./cpptools-provider";
import { ManifestStateLoaded } from "../manifest/manifest-types";
import { ActiveConfig } from "../configuration/active-config";
import { log, logWarning } from "../observability/log-channel";

// ---------------------------------------------------------------------------
// Callbacks
// ---------------------------------------------------------------------------

/** Called after each completed refresh with the latest artifact and UI state. */
export type IntelliSenseRefreshCallback = (
  artifact: ActiveCompileCommandsArtifact | null,
  readiness: IntelliSenseProviderReadiness
) => void;

// ---------------------------------------------------------------------------
// IntelliSense service
// ---------------------------------------------------------------------------

/**
 * Owns IntelliSense refresh orchestration for the active build context.
 *
 * Responsibilities:
 *  - Serialize refresh requests so concurrent triggers collapse to the latest.
 *  - Resolve the active compile-commands artifact (no fallback).
 *  - Check provider readiness and emit persistent warnings via the log channel.
 *  - Apply or clear IntelliSense configuration through the cpptools adapter.
 *  - Publish updated artifact and readiness state to registered callbacks.
 */
export class IntelliSenseService {
  private _manifest: ManifestStateLoaded | undefined;
  private _activeConfig: ActiveConfig | undefined;
  private _artifactsRoot: string = "";

  private _lastRuntimeState: IntelliSenseRuntimeState = {
    appliedArtifactPath: null,
    appliedContextKey: null,
    clearedAt: null,
    providerState: "inactive",
  };
  private _lastArtifact: ActiveCompileCommandsArtifact | null = null;
  private _lastReadiness: IntelliSenseProviderReadiness | null = null;

  /** Pending refresh promise for serialization. */
  private _pendingRefresh: Promise<void> | null = null;

  private readonly _onDidRefresh = new vscode.EventEmitter<
    [ActiveCompileCommandsArtifact | null, IntelliSenseProviderReadiness]
  >();

  /** Emitted after each refresh completes with the latest artifact and readiness. */
  readonly onDidRefresh: vscode.Event<
    [ActiveCompileCommandsArtifact | null, IntelliSenseProviderReadiness]
  > = this._onDidRefresh.event;

  private readonly _adapter: CpptoolsProviderAdapter;

  constructor(adapter?: CpptoolsProviderAdapter) {
    this._adapter = adapter ?? new CpptoolsProviderAdapter();
  }

  // ---------------------------------------------------------------------------
  // State updates from extension.ts
  // ---------------------------------------------------------------------------

  setManifest(manifest: ManifestStateLoaded | undefined): void {
    this._manifest = manifest;
  }

  setActiveConfig(config: ActiveConfig | undefined): void {
    this._activeConfig = config;
  }

  setArtifactsRoot(root: string): void {
    this._artifactsRoot = root;
  }

  // ---------------------------------------------------------------------------
  // Public state accessors
  // ---------------------------------------------------------------------------

  getLastArtifact(): ActiveCompileCommandsArtifact | null {
    return this._lastArtifact;
  }

  getLastReadiness(): IntelliSenseProviderReadiness | null {
    return this._lastReadiness;
  }

  // ---------------------------------------------------------------------------
  // Refresh
  // ---------------------------------------------------------------------------

  /**
   * Schedules an IntelliSense refresh. Concurrent calls are serialized;
   * if a refresh is already in progress, the next one starts immediately
   * after the current one completes. This ensures the final state always
   * reflects the latest active configuration (FR-004).
   */
  scheduleRefresh(trigger: RefreshTrigger): void {
    this._pendingRefresh = (this._pendingRefresh ?? Promise.resolve()).then(
      () => this._doRefresh(trigger)
    );
  }

  private async _doRefresh(trigger: RefreshTrigger): Promise<void> {
    log(`[IntelliSense] Refresh triggered by: ${trigger}`);

    const readiness = checkProviderReadiness();
    this._lastReadiness = readiness;

    if (readiness.warningState !== "none") {
      if (readiness.warningState === "missing-provider") {
        logWarning(
          readiness.lastWarningMessage ??
            "IntelliSense integration is unavailable: Microsoft C/C++ extension (ms-vscode.cpptools) is not installed."
        );
      } else if (readiness.warningState === "wrong-provider") {
        logWarning(
          readiness.lastWarningMessage ??
            "IntelliSense integration unavailable: the workspace is not configured to use Trezor Firmware Tools as the C/C++ configuration provider."
        );
      }
    }

    const manifest = this._manifest;
    const config = this._activeConfig;

    if (!manifest || !config) {
      // No active context — clear any previously applied state.
      await this._clearProviderState();
      this._lastArtifact = null;
      this._onDidRefresh.fire([null, readiness]);
      return;
    }

    const inputs = buildResolutionInputs(manifest, config, this._artifactsRoot);
    const artifact = inputs
      ? resolveActiveArtifact(inputs, config)
      : {
          path: "",
          exists: false,
          status: "missing" as const,
          missingReason: buildMissingReasonNoInputs(this._artifactsRoot),
          contextKey: makeContextKey(config),
        };

    this._lastArtifact = artifact;

    if (artifact.status === "missing") {
      log(`[IntelliSense] Compile-commands artifact missing: ${artifact.missingReason}`);
      await this._clearProviderState();
    } else if (readiness.warningState === "none") {
      await this._applyProviderState(artifact.path, artifact.contextKey);
    } else {
      // Provider not ready even though artifact exists — clear stale state.
      await this._clearProviderState();
    }

    this._onDidRefresh.fire([artifact, readiness]);
  }

  // ---------------------------------------------------------------------------
  // Provider state management
  // ---------------------------------------------------------------------------

  private async _applyProviderState(
    artifactPath: string,
    contextKey: string
  ): Promise<void> {
    try {
      await this._adapter.applyCompileCommands(artifactPath);
      this._lastRuntimeState = {
        appliedArtifactPath: artifactPath,
        appliedContextKey: contextKey,
        clearedAt: null,
        providerState: "applied",
      };
      log(`[IntelliSense] Applied compile-commands: ${artifactPath}`);
    } catch (err) {
      log(`[IntelliSense] Failed to apply compile-commands: ${err}`);
    }
  }

  private async _clearProviderState(): Promise<void> {
    if (
      this._lastRuntimeState.providerState === "inactive" &&
      this._adapter.getLastAppliedPath() === null
    ) {
      // Nothing was ever applied — nothing to clear.
      return;
    }
    try {
      await this._adapter.clearCompileCommands();
      this._lastRuntimeState = {
        appliedArtifactPath: null,
        appliedContextKey: null,
        clearedAt: new Date(),
        providerState: "cleared",
      };
      log("[IntelliSense] Cleared stale compile-commands configuration.");
    } catch (err) {
      log(`[IntelliSense] Failed to clear compile-commands: ${err}`);
    }
  }

  dispose(): void {
    this._onDidRefresh.dispose();
    this._adapter.dispose();
    this._pendingRefresh = null;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildMissingReasonNoInputs(artifactsRoot: string): string {
  if (!artifactsRoot) {
    return "tfTools.artifactsPath is not configured; cannot resolve the compile-commands artifact.";
  }
  return "Cannot resolve the compile-commands artifact: check manifest artifact-folder and artifact-name fields.";
}
