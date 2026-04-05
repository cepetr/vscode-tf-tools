import * as vscode from "vscode";
import {
  ActiveCompileCommandsArtifact,
  IntelliSenseProviderReadiness,
  IntelliSenseRuntimeState,
  ProviderPayload,
  RefreshTrigger,
} from "./intellisense-types";
import {
  buildResolutionInputs,
  resolveActiveArtifact,
  makeContextKey,
} from "./artifact-resolution";
import { checkProviderReadiness, CpptoolsProviderAdapter } from "./cpptools-provider";
import { parseCompileCommandsFile } from "./compile-commands-parser";
import { ManifestStateLoaded } from "../manifest/manifest-types";
import { ActiveConfig } from "../configuration/active-config";
import {
  log,
  logMissingArtifact,
  logProviderWarning,
  logProviderRecovery,
} from "../observability/log-channel";

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
 *  - Eagerly parse the active `.cc.json` before applying provider state.
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
  private _lastPayload: ProviderPayload | null = null;

  /**
   * Last warning state emitted to guard against duplicate warning messages.
   * Warnings are logged once per state transition (FR-005B).
   */
  private _lastWarnedState: string = "none";

  /** Pending refresh promise for serialization (latest-refresh-wins). */
  private _pendingRefresh: Promise<void> | null = null;

  private readonly _onDidRefresh = new vscode.EventEmitter<
    [ActiveCompileCommandsArtifact | null, IntelliSenseProviderReadiness]
  >();

  /** Emitted after each refresh completes with the latest artifact and readiness. */
  readonly onDidRefresh: vscode.Event<
    [ActiveCompileCommandsArtifact | null, IntelliSenseProviderReadiness]
  > = this._onDidRefresh.event;

  private readonly _onDidRefreshPayload = new vscode.EventEmitter<ProviderPayload | null>();

  /**
   * Emitted after each refresh with the latest parsed `ProviderPayload`, or
   * `null` when the compile-database payload is unavailable.  Excluded-file
   * consumers subscribe here to receive the `includedFiles` set (the keys of
   * `ProviderPayload.entriesByFile`) without taking an additional compile-DB
   * parsing dependency.
   */
  readonly onDidRefreshPayload: vscode.Event<ProviderPayload | null> =
    this._onDidRefreshPayload.event;

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

  getRuntimeState(): IntelliSenseRuntimeState {
    return this._lastRuntimeState;
  }

  /**
   * Returns the latest parsed `ProviderPayload`, or null when the active
   * compile-database payload is unavailable.  Used by excluded-file consumers
   * to extract the `includedFiles` set without subscribing to the event.
   */
  getLastPayload(): ProviderPayload | null {
    return this._lastPayload;
  }

  // ---------------------------------------------------------------------------
  // Refresh
  // ---------------------------------------------------------------------------

  /**
   * Schedules an IntelliSense refresh. Concurrent calls are serialized;
   * each refresh starts immediately after the previous one completes.
   * This ensures the final state always reflects the latest active
   * configuration (FR-004, latest-refresh-wins).
   */
  scheduleRefresh(trigger: RefreshTrigger): void {
    this._pendingRefresh = (this._pendingRefresh ?? Promise.resolve()).then(
      () => this._doRefresh(trigger)
    );
  }

  private async _doRefresh(trigger: RefreshTrigger): Promise<void> {
    log(`[IntelliSense] Refresh triggered by: ${trigger}`);

    // Ensure the adapter is registered with cpptools. Safe to call multiple times —
    // the adapter guards against double-registration.
    void this._adapter.activate();

    const readiness = checkProviderReadiness();
    this._lastReadiness = readiness;

    // Emit warning once per state transition; log recovery when returning to ready.
    if (readiness.warningState !== "none") {
      if (readiness.warningState !== this._lastWarnedState) {
        const msg =
          readiness.lastWarningMessage ??
          "IntelliSense integration is unavailable: see output channel for details.";
        if (readiness.warningState === "wrong-provider") {
          // Log only — extension.ts surfaces the notification with workspace-setting fix action.
          log(`[IntelliSense] [WARN] ${msg}`);
        } else {
          logProviderWarning(msg);
        }
        this._lastWarnedState = readiness.warningState;
      }
    } else if (this._lastWarnedState !== "none") {
      logProviderRecovery();
      this._lastWarnedState = "none";
    }

    const manifest = this._manifest;
    const config = this._activeConfig;

    if (!manifest || !config) {
      // No active context — clear any previously applied state.
      this._clearProviderState();
      this._lastArtifact = null;
      this._lastPayload = null;
      this._onDidRefresh.fire([null, readiness]);
      this._onDidRefreshPayload.fire(null);
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
      logMissingArtifact(artifact.path || "(unknown)", artifact.contextKey);
      this._clearProviderState();
      this._lastPayload = null;
    } else if (readiness.warningState === "none") {
      this._applyProviderState(artifact.path, artifact.contextKey);
    } else {
      // Provider not ready even though artifact exists — clear stale state.
      this._clearProviderState();
      this._lastPayload = null;
    }

    this._onDidRefresh.fire([artifact, readiness]);
    this._onDidRefreshPayload.fire(this._lastPayload);
  }

  // ---------------------------------------------------------------------------
  // Provider state management
  // ---------------------------------------------------------------------------

  private _applyProviderState(
    artifactPath: string,
    contextKey: string
  ): void {
    // Eagerly parse the active compile database before applying provider state.
    const payload = parseCompileCommandsFile(artifactPath, contextKey);

    if (!payload) {
      log(`[IntelliSense] Failed to parse compile-commands: ${artifactPath}`);
      this._clearProviderState();
      this._lastPayload = null;
      return;
    }

    this._adapter.applyPayload(payload);
    this._lastPayload = payload;
    this._lastRuntimeState = {
      appliedArtifactPath: artifactPath,
      appliedContextKey: contextKey,
      clearedAt: null,
      providerState: "applied",
    };
    log(
      `[IntelliSense] Applied compile-commands: ${artifactPath} ` +
      `(${payload.entriesByFile.size} entries)`
    );
  }

  private _clearProviderState(): void {
    if (
      this._lastRuntimeState.providerState === "inactive" &&
      this._adapter.getLastPayload() === undefined
    ) {
      // Nothing was ever applied — nothing to clear.
      return;
    }
    this._adapter.clearPayload();
    this._lastRuntimeState = {
      appliedArtifactPath: null,
      appliedContextKey: null,
      clearedAt: new Date(),
      providerState: "cleared",
    };
    log("[IntelliSense] Cleared stale compile-commands configuration.");
  }

  dispose(): void {
    this._onDidRefresh.dispose();
    this._onDidRefreshPayload.dispose();
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
  return "Cannot resolve the compile-commands artifact: check manifest artifactFolder and artifactName fields.";
}


