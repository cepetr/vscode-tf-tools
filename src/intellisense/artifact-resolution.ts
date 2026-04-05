import * as path from "path";
import * as fs from "fs";
import {
  ArtifactResolutionInputs,
  ActiveCompileCommandsArtifact,
} from "./intellisense-types";
import {
  ManifestStateLoaded,
  ManifestModel,
  ManifestTarget,
  ManifestComponent,
} from "../manifest/manifest-types";
import { ActiveConfig } from "../configuration/active-config";

// ---------------------------------------------------------------------------
// Context key
// ---------------------------------------------------------------------------

/**
 * Produces a stable string key for the given active configuration.
 * Used to detect when stale IntelliSense state must be cleared.
 */
export function makeContextKey(config: ActiveConfig): string {
  return `${config.modelId}::${config.targetId}::${config.componentId}`;
}

// ---------------------------------------------------------------------------
// Artifact resolution inputs
// ---------------------------------------------------------------------------

/**
 * Derives `ArtifactResolutionInputs` from the loaded manifest state,
 * active configuration, and resolved artifacts root path.
 *
 * Returns `undefined` when the manifest does not contain the required
 * `artifactFolder` for the active model or `artifactName` for the active
 * component — in that case IntelliSense resolution is not possible.
 */
export function buildResolutionInputs(
  manifest: ManifestStateLoaded,
  config: ActiveConfig,
  artifactsRoot: string
): ArtifactResolutionInputs | undefined {
  const model: ManifestModel | undefined = manifest.models.find((m) => m.id === config.modelId);
  const target: ManifestTarget | undefined = manifest.targets.find((t) => t.id === config.targetId);
  const component: ManifestComponent | undefined = manifest.components.find((c) => c.id === config.componentId);

  if (!model || !target || !component) {
    return undefined;
  }

  return {
    artifactsRoot,
    modelId: config.modelId,
    artifactFolder: model.artifactFolder,
    componentId: config.componentId,
    artifactName: component.artifactName,
    targetId: config.targetId,
    artifactSuffix: target.artifactSuffix ?? "",
  };
}

// ---------------------------------------------------------------------------
// Path derivation
// ---------------------------------------------------------------------------

/**
 * Computes the expected compile-commands artifact path from the given inputs.
 *
 * Formula: `<artifactsRoot>/<artifactFolder>/<artifactName><artifactSuffix>.cc.json`
 *
 * Returns `undefined` when any of `artifactsRoot`, `artifactFolder`, or
 * `artifactName` is absent/empty — resolution requires all three.
 */
export function deriveArtifactPath(inputs: ArtifactResolutionInputs): string | undefined {
  if (!inputs.artifactsRoot || !inputs.artifactFolder || !inputs.artifactName) {
    return undefined;
  }
  return path.join(
    inputs.artifactsRoot,
    inputs.artifactFolder,
    `${inputs.artifactName}${inputs.artifactSuffix}.cc.json`
  );
}

/**
 * Computes the expected binary artifact path from the given inputs.
 *
 * Formula: `<artifactsRoot>/<artifactFolder>/<artifactName><artifactSuffix>.bin`
 *
 * Returns `undefined` when any of `artifactsRoot`, `artifactFolder`, or
 * `artifactName` is absent/empty.
 */
export function deriveBinaryArtifactPath(inputs: ArtifactResolutionInputs): string | undefined {
  if (!inputs.artifactsRoot || !inputs.artifactFolder || !inputs.artifactName) {
    return undefined;
  }
  return path.join(
    inputs.artifactsRoot,
    inputs.artifactFolder,
    `${inputs.artifactName}${inputs.artifactSuffix}.bin`
  );
}

/**
 * Computes the expected map artifact path from the given inputs.
 *
 * Formula: `<artifactsRoot>/<artifactFolder>/<artifactName><artifactSuffix>.map`
 *
 * Returns `undefined` when any of `artifactsRoot`, `artifactFolder`, or
 * `artifactName` is absent/empty.
 */
export function deriveMapArtifactPath(inputs: ArtifactResolutionInputs): string | undefined {
  if (!inputs.artifactsRoot || !inputs.artifactFolder || !inputs.artifactName) {
    return undefined;
  }
  return path.join(
    inputs.artifactsRoot,
    inputs.artifactFolder,
    `${inputs.artifactName}${inputs.artifactSuffix}.map`
  );
}

// ---------------------------------------------------------------------------
// Binary / Map artifact status resolution
// ---------------------------------------------------------------------------

export type BinaryArtifactStatus = "valid" | "missing";
export type MapArtifactStatus = "valid" | "missing";

export interface ActiveBinaryArtifact {
  readonly path: string;
  readonly exists: boolean;
  readonly status: BinaryArtifactStatus;
  readonly missingReason?: string;
  readonly contextKey: string;
}

export interface ActiveMapArtifact {
  readonly path: string;
  readonly exists: boolean;
  readonly status: MapArtifactStatus;
  readonly missingReason?: string;
  readonly contextKey: string;
}

function checkFileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

/**
 * Resolves the active binary artifact status for the given inputs.
 * Returns `status: "valid"` only when the exact expected `.bin` file exists.
 */
export function resolveActiveBinaryArtifact(
  inputs: ArtifactResolutionInputs,
  config: ActiveConfig
): ActiveBinaryArtifact {
  const contextKey = makeContextKey(config);
  const artifactPath = deriveBinaryArtifactPath(inputs);

  if (!artifactPath) {
    return {
      path: "",
      exists: false,
      status: "missing",
      missingReason: buildBinaryMissingReason(inputs),
      contextKey,
    };
  }

  const exists = checkFileExists(artifactPath);
  if (exists) {
    return { path: artifactPath, exists: true, status: "valid", contextKey };
  }
  return {
    path: artifactPath,
    exists: false,
    status: "missing",
    missingReason: `Binary artifact not found at the expected path: ${artifactPath}`,
    contextKey,
  };
}

/**
 * Resolves the active map artifact status for the given inputs.
 * Returns `status: "valid"` only when the exact expected `.map` file exists.
 */
export function resolveActiveMapArtifact(
  inputs: ArtifactResolutionInputs,
  config: ActiveConfig
): ActiveMapArtifact {
  const contextKey = makeContextKey(config);
  const artifactPath = deriveMapArtifactPath(inputs);

  if (!artifactPath) {
    return {
      path: "",
      exists: false,
      status: "missing",
      missingReason: buildMapMissingReason(inputs),
      contextKey,
    };
  }

  const exists = checkFileExists(artifactPath);
  if (exists) {
    return { path: artifactPath, exists: true, status: "valid", contextKey };
  }
  return {
    path: artifactPath,
    exists: false,
    status: "missing",
    missingReason: `Map artifact not found at the expected path: ${artifactPath}`,
    contextKey,
  };
}

// ---------------------------------------------------------------------------
// Artifact status resolution (no fallback) — compile commands
// ---------------------------------------------------------------------------

/**
 * Resolves the active compile-commands artifact status for the given inputs.
 *
 * - Returns `status: "valid"` only when the exact expected file exists.
 * - Returns `status: "missing"` in all other cases: when the path cannot be
 *   derived (missing fields) or when the file does not exist on disk.
 * - Does NOT fall back to any other artifact path (FR-002).
 */
export function resolveActiveArtifact(
  inputs: ArtifactResolutionInputs,
  config: ActiveConfig
): ActiveCompileCommandsArtifact {
  const contextKey = makeContextKey(config);
  const artifactPath = deriveArtifactPath(inputs);

  if (!artifactPath) {
    return {
      path: "",
      exists: false,
      status: "missing",
      missingReason: buildMissingReasonForUnresolvablePath(inputs),
      contextKey,
    };
  }

  let exists = false;
  try {
    exists = fs.existsSync(artifactPath);
  } catch {
    exists = false;
  }

  if (exists) {
    return {
      path: artifactPath,
      exists: true,
      status: "valid",
      contextKey,
    };
  }

  return {
    path: artifactPath,
    exists: false,
    status: "missing",
    missingReason: `Compile-commands artifact not found at the expected path: ${artifactPath}`,
    contextKey,
  };
}

// ---------------------------------------------------------------------------
// Missing-reason helpers
// ---------------------------------------------------------------------------

function buildMissingReasonForUnresolvablePath(
  inputs: ArtifactResolutionInputs
): string {
  if (!inputs.artifactsRoot) {
    return "tfTools.artifactsPath is not configured; cannot resolve the compile-commands artifact.";
  }
  if (!inputs.artifactFolder) {
    return `The active model does not define an artifact-folder in the manifest; cannot resolve the compile-commands artifact.`;
  }
  if (!inputs.artifactName) {
    return `The active component does not define an artifact-name in the manifest; cannot resolve the compile-commands artifact.`;
  }
  return "Cannot resolve the compile-commands artifact path.";
}

function buildBinaryMissingReason(inputs: ArtifactResolutionInputs): string {
  if (!inputs.artifactsRoot) {
    return "tfTools.artifactsPath is not configured; cannot resolve the binary artifact.";
  }
  if (!inputs.artifactFolder) {
    return "The active model does not define an artifact-folder in the manifest; cannot resolve the binary artifact.";
  }
  if (!inputs.artifactName) {
    return "The active component does not define an artifact-name in the manifest; cannot resolve the binary artifact.";
  }
  return "Cannot resolve the binary artifact path.";
}

function buildMapMissingReason(inputs: ArtifactResolutionInputs): string {
  if (!inputs.artifactsRoot) {
    return "tfTools.artifactsPath is not configured; cannot resolve the map artifact.";
  }
  if (!inputs.artifactFolder) {
    return "The active model does not define an artifact-folder in the manifest; cannot resolve the map artifact.";
  }
  if (!inputs.artifactName) {
    return "The active component does not define an artifact-name in the manifest; cannot resolve the map artifact.";
  }
  return "Cannot resolve the map artifact path.";
}
