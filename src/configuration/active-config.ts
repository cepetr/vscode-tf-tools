import * as vscode from "vscode";
import { ManifestStateLoaded } from "../manifest/manifest-types";

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
