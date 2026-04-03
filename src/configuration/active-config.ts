import * as vscode from "vscode";
import { ManifestStateLoaded } from "../manifest/manifest-types";
import { normalizeActiveConfig } from "./normalize-config";

// Active configuration storage key in workspace state
export const ACTIVE_CONFIG_KEY = "tfTools.activeConfig";

export interface ActiveConfig {
  readonly modelId: string;
  readonly targetId: string;
  readonly componentId: string;
  readonly persistedAt: string; // ISO timestamp
}

/**
 * Reads the saved active configuration from workspace state.
 * Returns undefined when no configuration has been saved yet.
 */
export function readActiveConfig(
  context: vscode.ExtensionContext
): ActiveConfig | undefined {
  return context.workspaceState.get<ActiveConfig>(ACTIVE_CONFIG_KEY);
}

/**
 * Persists the active configuration to workspace state.
 */
export async function writeActiveConfig(
  context: vscode.ExtensionContext,
  config: Omit<ActiveConfig, "persistedAt">
): Promise<ActiveConfig> {
  const saved: ActiveConfig = { ...config, persistedAt: new Date().toISOString() };
  await context.workspaceState.update(ACTIVE_CONFIG_KEY, saved);
  return saved;
}

/**
 * Validates that all ids in `candidate` resolve to entries in `manifest`.
 * Returns false when any id is absent from its collection.
 */
export function isConfigValid(
  candidate: ActiveConfig,
  manifest: ManifestStateLoaded
): boolean {
  return (
    manifest.models.some((m) => m.id === candidate.modelId) &&
    manifest.targets.some((t) => t.id === candidate.targetId) &&
    manifest.components.some((c) => c.id === candidate.componentId)
  );
}

// ---------------------------------------------------------------------------
// Selector mutation helpers
// ---------------------------------------------------------------------------

/**
 * Selects a new model, preserving existing target and component when valid.
 * Normalizes the complete configuration before writing.
 */
export async function selectModel(
  context: vscode.ExtensionContext,
  modelId: string,
  manifest: ManifestStateLoaded
): Promise<ActiveConfig> {
  const base = normalizeActiveConfig(manifest, readActiveConfig(context));
  return writeActiveConfig(context, { ...base, modelId });
}

/**
 * Selects a new target, preserving existing model and component when valid.
 * Normalizes the complete configuration before writing.
 */
export async function selectTarget(
  context: vscode.ExtensionContext,
  targetId: string,
  manifest: ManifestStateLoaded
): Promise<ActiveConfig> {
  const base = normalizeActiveConfig(manifest, readActiveConfig(context));
  return writeActiveConfig(context, { ...base, targetId });
}

/**
 * Selects a new component, preserving existing model and target when valid.
 * Normalizes the complete configuration before writing.
 */
export async function selectComponent(
  context: vscode.ExtensionContext,
  componentId: string,
  manifest: ManifestStateLoaded
): Promise<ActiveConfig> {
  const base = normalizeActiveConfig(manifest, readActiveConfig(context));
  return writeActiveConfig(context, { ...base, componentId });
}

// ---------------------------------------------------------------------------
// Restore helper
// ---------------------------------------------------------------------------

/**
 * Reads the persisted active configuration, normalizes it against `manifest`,
 * writes back if any id was stale, and returns the resulting valid config.
 *
 * Use this at activation time and on every manifest state change to keep the
 * workspace-state selection in sync with the manifest.
 */
export async function restoreActiveConfig(
  context: vscode.ExtensionContext,
  manifest: ManifestStateLoaded
): Promise<ActiveConfig> {
  const saved = readActiveConfig(context);
  const normalized = normalizeActiveConfig(manifest, saved);
  if (
    !saved ||
    saved.modelId !== normalized.modelId ||
    saved.targetId !== normalized.targetId ||
    saved.componentId !== normalized.componentId
  ) {
    return writeActiveConfig(context, normalized);
  }
  return saved;
}
