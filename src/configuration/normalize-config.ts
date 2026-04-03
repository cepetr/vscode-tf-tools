import { ManifestStateLoaded } from "../manifest/manifest-types";
import { ActiveConfig } from "./active-config";

/**
 * Returns a valid active configuration for `manifest`.
 *
 * When `saved` is provided, each id is preserved if it still resolves to an
 * entry in the manifest; otherwise it is replaced with the first entry of that
 * kind.  When `saved` is absent every slot defaults to the first manifest
 * entry for that kind.
 *
 * The returned object contains only the id fields — callers are responsible
 * for writing the result to workspace state via `writeActiveConfig`.
 */
export function normalizeActiveConfig(
  manifest: ManifestStateLoaded,
  saved?: ActiveConfig
): Pick<ActiveConfig, "modelId" | "targetId" | "componentId"> {
  const modelId =
    saved && manifest.models.some((m) => m.id === saved.modelId)
      ? saved.modelId
      : manifest.models[0].id;

  const targetId =
    saved && manifest.targets.some((t) => t.id === saved.targetId)
      ? saved.targetId
      : manifest.targets[0].id;

  const componentId =
    saved && manifest.components.some((c) => c.id === saved.componentId)
      ? saved.componentId
      : manifest.components[0].id;

  return { modelId, targetId, componentId };
}
