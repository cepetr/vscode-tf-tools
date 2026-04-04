/**
 * IntelliSense domain types for the Trezor Firmware Tools extension.
 *
 * Covers artifact-resolution inputs, the active compile-commands artifact state,
 * provider readiness, runtime IntelliSense state, and refresh request tracking.
 */

// ---------------------------------------------------------------------------
// Artifact resolution inputs
// ---------------------------------------------------------------------------

/** All manifest and settings inputs needed to compute the expected artifact path. */
export interface ArtifactResolutionInputs {
  /** Resolved absolute path from tfTools.artifactsPath. Empty string when unset. */
  readonly artifactsRoot: string;
  /** Active model id. */
  readonly modelId: string;
  /** Selected model's required artifact-folder manifest field, or undefined. */
  readonly artifactFolder: string | undefined;
  /** Active component id. */
  readonly componentId: string;
  /** Selected component's required artifact-name manifest field, or undefined. */
  readonly artifactName: string | undefined;
  /** Active target id. */
  readonly targetId: string;
  /** Selected target's optional artifact-suffix manifest field. Defaults to "". */
  readonly artifactSuffix: string;
}

// ---------------------------------------------------------------------------
// Active compile-commands artifact
// ---------------------------------------------------------------------------

export type CompileCommandsStatus = "valid" | "missing";

/** The exact compile database that should back IntelliSense for the active config. */
export interface ActiveCompileCommandsArtifact {
  /** Resolved absolute compile-commands path. */
  readonly path: string;
  /** Whether the file exists on disk. */
  readonly exists: boolean;
  /** Artifact presence status. */
  readonly status: CompileCommandsStatus;
  /** User-facing explanation when the artifact is absent. */
  readonly missingReason?: string;
  /**
   * Stable key combining the active model, target, and component that produced
   * this artifact record. Used to detect stale state.
   */
  readonly contextKey: string;
}

// ---------------------------------------------------------------------------
// IntelliSense provider readiness
// ---------------------------------------------------------------------------

export type ProviderWarningState = "none" | "missing-provider" | "wrong-provider";

/** Whether the extension can currently provide IntelliSense through cpptools. */
export interface IntelliSenseProviderReadiness {
  /** Whether Microsoft C/C++ (ms-vscode.cpptools) is installed and enabled. */
  readonly providerInstalled: boolean;
  /** Whether tf-tools is the active configuration provider in the workspace. */
  readonly providerConfigured: boolean;
  /** Current warning condition, if any. */
  readonly warningState: ProviderWarningState;
  /** Warning message text when warningState is not "none". */
  readonly lastWarningMessage?: string;
}

// ---------------------------------------------------------------------------
// IntelliSense runtime state
// ---------------------------------------------------------------------------

export type IntelliSenseProviderStateKind = "inactive" | "applied" | "cleared";

/** What the extension has currently applied to the provider and what the UI reflects. */
export interface IntelliSenseRuntimeState {
  /** Last compile-commands path successfully applied to the provider, or null. */
  readonly appliedArtifactPath: string | null;
  /** Last active-configuration key successfully applied, or null. */
  readonly appliedContextKey: string | null;
  /** Timestamp of the last explicit stale-state clearing action, or null. */
  readonly clearedAt: Date | null;
  /** Current provider state. */
  readonly providerState: IntelliSenseProviderStateKind;
}

// ---------------------------------------------------------------------------
// IntelliSense refresh trigger
// ---------------------------------------------------------------------------

export type RefreshTrigger =
  | "activation"
  | "active-config-change"
  | "successful-build"
  | "manual-refresh"
  | "provider-change"
  | "manifest-change"
  | "artifacts-path-change";

/** One event that requires IntelliSense recomputation. */
export interface IntelliSenseRefreshRequest {
  /** What caused the refresh. */
  readonly trigger: RefreshTrigger;
  /** When the request was created. */
  readonly requestedAt: Date;
  /**
   * Active configuration key at scheduling time.
   * Used to collapse concurrent requests to the latest.
   */
  readonly targetContextKey: string;
}
