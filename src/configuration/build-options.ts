/**
 * Workspace-scoped persistence and normalization for build-option selections.
 *
 * Build-option selections live separately from the core model/target/component
 * active config (Decision 3 from research.md) so that the Configuration
 * Experience slice remains untouched.
 *
 * Keys in the stored map are `BuildOption.key` values (deterministic, derived
 * from the option flag). Values are:
 *   - `boolean` for checkbox options
 *   - `string` (state id) for multistate options
 *   - `null` when the user has not made an explicit selection
 */

import * as vscode from "vscode";
import { BuildOption } from "../manifest/manifest-types";
import { evaluateWhenExpression } from "../manifest/when-expressions";

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

/** Workspace-state key for persisted build-option selections. */
export const BUILD_OPTIONS_KEY = "tfTools.buildOptions";

export interface BuildOptionsState {
  /** Map of option key → persisted value. */
  readonly values: Readonly<Record<string, boolean | string | null>>;
  /** ISO timestamp of the latest write. */
  readonly persistedAt: string;
}

/**
 * Reads the saved build-option selections from workspace state.
 * Returns undefined when no selections have been saved yet.
 */
export function readBuildOptions(
  context: vscode.ExtensionContext
): BuildOptionsState | undefined {
  return context.workspaceState.get<BuildOptionsState>(BUILD_OPTIONS_KEY);
}

/**
 * Persists the given values map to workspace state, merging with the
 * existing state so that unrelated option values are preserved.
 */
export async function writeBuildOption(
  context: vscode.ExtensionContext,
  key: string,
  value: boolean | string | null
): Promise<BuildOptionsState> {
  const existing = readBuildOptions(context);
  const merged: Record<string, boolean | string | null> = {
    ...(existing?.values ?? {}),
    [key]: value,
  };
  const state: BuildOptionsState = {
    values: merged,
    persistedAt: new Date().toISOString(),
  };
  await context.workspaceState.update(BUILD_OPTIONS_KEY, state);
  return state;
}

// ---------------------------------------------------------------------------
// Context evaluation
// ---------------------------------------------------------------------------

export interface BuildContext {
  readonly modelId: string;
  readonly targetId: string;
  readonly componentId: string;
}

// ---------------------------------------------------------------------------
// Resolved option (option + its current effective value)
// ---------------------------------------------------------------------------

export interface ResolvedOption {
  /** The option definition from the manifest. */
  readonly option: BuildOption;
  /**
   * Whether this option is currently available for the active context.
   * Unavailable options are hidden from the UI and excluded from effective args.
   */
  readonly available: boolean;
  /**
   * The effective value for the current context:
   *   - checkbox: `true` / `false`
   *   - multistate: state id string
   */
  readonly value: boolean | string;
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/**
 * Resolves each build option in `options` against the active `context` and
 * the persisted `saved` selections. Returns a `ResolvedOption` for every
 * option (including unavailable ones, flagged with `available: false`) so
 * that callers can preserve hidden values while hiding them from the UI.
 *
 * Invalid/unknown keys in `saved` are quietly ignored (not written back here).
 */
export function normalizeBuildOptions(
  options: ReadonlyArray<BuildOption>,
  saved: BuildOptionsState | undefined,
  context: BuildContext
): ResolvedOption[] {
  const savedValues = saved?.values ?? {};
  return options.map((option) => {
    // Evaluate availability
    const available = option.when
      ? evaluateWhenExpression(option.when, context)
      : true;

    // Determine the effective value
    let value: boolean | string;
    if (option.kind === "checkbox") {
      const stored = savedValues[option.key];
      value = typeof stored === "boolean" ? stored : false;
    } else {
      // multistate
      const stored = savedValues[option.key];
      if (typeof stored === "string" && option.states?.some((s) => s.id === stored)) {
        value = stored;
      } else {
        value = option.defaultState ?? option.states?.[0]?.id ?? "";
      }
    }

    return { option, available, value };
  });
}

// ---------------------------------------------------------------------------
// Effective flags derivation
// ---------------------------------------------------------------------------

/**
 * Derives the ordered list of command-line flags from the resolved build options.
 * Only available options with active values contribute flags.
 *
 * For checkbox options: flag included only when value is `true` and flag is non-empty.
 * For multistate options: flag of the selected state included when non-empty.
 */
export function deriveOptionFlags(
  resolved: ReadonlyArray<ResolvedOption>
): string[] {
  const flags: string[] = [];
  for (const r of resolved) {
    if (!r.available) {
      continue;
    }
    if (r.option.kind === "checkbox") {
      if (r.value === true && r.option.flag) {
        flags.push(r.option.flag);
      }
    } else {
      // multistate — find the selected state's flag
      const state = r.option.states?.find((s) => s.id === r.value);
      if (state?.flag) {
        flags.push(state.flag);
      }
    }
  }
  return flags;
}
