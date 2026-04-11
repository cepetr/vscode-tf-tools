/**
 * Debug Launch helpers: profile resolution, executable path derivation,
 * template loading, variable-map construction, and tf-tools substitution.
 *
 * Covers debug launch behavior for the active build context.
 */

import * as fs from "fs";
import * as path from "path";
import * as jsonc from "jsonc-parser";
import * as vscode from "vscode";
import { ManifestComponentDebugProfile, ManifestStateLoaded } from "../manifest/manifest-types";
import { EvalContext, evaluateWhenExpression } from "../manifest/when-expressions";
import { ActiveConfig } from "../configuration/active-config";
import { logDebugLaunchFailure, revealLogs } from "../observability/log-channel";

// ---------------------------------------------------------------------------
// Profile resolution
// ---------------------------------------------------------------------------

export type DebugProfileResolutionState = "selected" | "no-match";

/** Result of matching a component's debug profiles against the active build context. */
export interface DebugProfileResolution {
  readonly resolutionState: DebugProfileResolutionState;
  readonly selectedProfile?: ManifestComponentDebugProfile;
}

/**
 * Resolves component-scoped debug profiles against the active build context
 * using first-match declaration order.
 *
 * - Profiles without a `when` expression match all contexts (match-all).
 * - The first matching profile in declaration order is selected.
 * - No matches → `"no-match"`.
 */
export function resolveDebugProfile(
  profiles: ReadonlyArray<ManifestComponentDebugProfile>,
  evalCtx: EvalContext
): DebugProfileResolution {
  const selectedProfile = profiles.find((profile) =>
    profile.when === undefined ? true : evaluateWhenExpression(profile.when, evalCtx)
  );

  if (selectedProfile === undefined) {
    return { resolutionState: "no-match" };
  }

  return { resolutionState: "selected", selectedProfile };
}

/**
 * Ordered set of component-owned debug profiles whose `when` expressions
 * evaluate to true for the active build context.
 */
export interface MatchingDebugProfileSet {
  /** All matching profiles in manifest declaration order. */
  readonly profiles: ReadonlyArray<ManifestComponentDebugProfile>;
  /** First matching profile in declaration order; undefined when no profile matches. */
  readonly defaultProfile: ManifestComponentDebugProfile | undefined;
}

/**
 * Collects all matching component debug profiles for the active build context
 * in manifest declaration order and identifies the default profile.
 *
 * - Profiles without a `when` expression match all contexts (match-all).
 * - All matching profiles are returned in declaration order.
 * - The first matching profile is the default.
 * - An empty set means debugging is unavailable for the active build context.
 */
export function resolveMatchingDebugProfiles(
  profiles: ReadonlyArray<ManifestComponentDebugProfile>,
  evalCtx: EvalContext
): MatchingDebugProfileSet {
  const matching = profiles.filter((profile) =>
    profile.when === undefined ? true : evaluateWhenExpression(profile.when, evalCtx)
  );
  return {
    profiles: matching,
    defaultProfile: matching[0],
  };
}

// ---------------------------------------------------------------------------
// Executable derivation
// ---------------------------------------------------------------------------

/**
 * Derives the executable file name from artifact fields.
 *
 * Result: `<artifactName><artifactSuffix><executableExtension>`
 * Empty string components are treated as an empty string.
 */
export function deriveExecutableFileName(
  artifactName: string,
  artifactSuffix: string,
  executableExtension: string
): string {
  return `${artifactName}${artifactSuffix}${executableExtension}`;
}

// ---------------------------------------------------------------------------
// Template loading
// ---------------------------------------------------------------------------

export type TemplateParseState = "loaded" | "missing" | "traversal-blocked" | "invalid";

/** Result of loading a JSONC debug configuration template. */
export interface DebugTemplateResult {
  readonly parseState: TemplateParseState;
  readonly templatePath: string;
  readonly configuration?: Record<string, unknown>;
  readonly error?: string;
}

/**
 * Loads and parses a JSONC debug configuration template file.
 *
 * - Rejects paths that escape the `templatesRoot` directory (traversal guard).
 * - Missing files produce `parseState: "missing"`.
 * - JSONC parse errors or non-object root values produce `parseState: "invalid"`.
 * - Templates are read fresh from disk on each call (no caching).
 */
export function loadDebugTemplate(
  templateRelativePath: string,
  templatesRoot: string
): DebugTemplateResult {
  const normalizedRoot = path.resolve(templatesRoot);
  const candidatePath = path.resolve(templatesRoot, templateRelativePath);

  // Traversal guard: resolved candidate must be inside the templates root
  if (
    candidatePath !== normalizedRoot &&
    !candidatePath.startsWith(normalizedRoot + path.sep)
  ) {
    return {
      parseState: "traversal-blocked",
      templatePath: candidatePath,
      error: `Template path escapes the configured templates root: ${templateRelativePath}`,
    };
  }

  let content: string;
  try {
    content = fs.readFileSync(candidatePath, "utf8");
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        parseState: "missing",
        templatePath: candidatePath,
        error: `Template file not found: ${candidatePath}`,
      };
    }
    return {
      parseState: "invalid",
      templatePath: candidatePath,
      error: `Failed to read template file: ${(err as Error).message}`,
    };
  }

  const parseErrors: jsonc.ParseError[] = [];
  const parsed: unknown = jsonc.parse(content, parseErrors, { allowTrailingComma: true });

  if (parseErrors.length > 0) {
    const first = parseErrors[0];
    return {
      parseState: "invalid",
      templatePath: candidatePath,
      error: `Template parse error at offset ${first.offset}: ${jsonc.printParseErrorCode(first.error)}`,
    };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {
      parseState: "invalid",
      templatePath: candidatePath,
      error: "Template must be a single JSON object representing one debug configuration.",
    };
  }

  return {
    parseState: "loaded",
    templatePath: candidatePath,
    configuration: parsed as Record<string, unknown>,
  };
}

// ---------------------------------------------------------------------------
// Variable map
// ---------------------------------------------------------------------------

/** Built-in tf-tools substitution variable qualified names. */
export const TFTOOLS_VAR_ARTIFACT_PATH = "tfTools.artifactPath";
export const TFTOOLS_VAR_MODEL_ID = "tfTools.model.id";
export const TFTOOLS_VAR_MODEL_NAME = "tfTools.model.name";
export const TFTOOLS_VAR_TARGET_ID = "tfTools.target.id";
export const TFTOOLS_VAR_TARGET_NAME = "tfTools.target.name";
export const TFTOOLS_VAR_COMPONENT_ID = "tfTools.component.id";
export const TFTOOLS_VAR_COMPONENT_NAME = "tfTools.component.name";
export const TFTOOLS_VAR_EXECUTABLE_PATH = "tfTools.executablePath";
export const TFTOOLS_VAR_EXECUTABLE = "tfTools.executable";
export const TFTOOLS_VAR_DEBUG_PROFILE_NAME = "tfTools.debugProfileName";
const TFTOOLS_DEBUG_VAR_PREFIX = "tfTools.debug.var:";

/** Matches `${tfTools.varName}` tokens inside template strings. */
const TFTOOLS_TOKEN_RE = /\$\{(tfTools\.[^}]+)\}/g;

/** Resolved tf-tools variable values available for template substitution. */
export interface DebugVariableMap {
  readonly builtIns: Readonly<Record<string, string>>;
  readonly profileVars: Readonly<Record<string, string>>;
  readonly resolvedVars: Readonly<Record<string, string>>;
  readonly resolutionErrors: ReadonlyArray<string>;
}

/**
 * Builds the complete tf-tools variable map for the active debug context.
 *
 * Built-in variables derive from the active model, target, component,
 * derived executable file name and path, and the selected debug profile name.
 * Profile-defined `vars` may reference built-ins and other profile vars; cycles and
 * unknown tf-tools references in profile vars are reported as resolution errors
 * that block launch.
 */
export function buildDebugVariableMap(
  modelId: string,
  modelName: string,
  targetId: string,
  targetName: string,
  componentId: string,
  componentName: string,
  artifactPath: string,
  executableFileName: string,
  executablePath: string,
  debugProfileName: string,
  profileVars: Readonly<Record<string, string>> | undefined
): DebugVariableMap {
  const builtIns: Readonly<Record<string, string>> = {
    [TFTOOLS_VAR_ARTIFACT_PATH]: artifactPath,
    [TFTOOLS_VAR_MODEL_ID]: modelId,
    [TFTOOLS_VAR_MODEL_NAME]: modelName,
    [TFTOOLS_VAR_TARGET_ID]: targetId,
    [TFTOOLS_VAR_TARGET_NAME]: targetName,
    [TFTOOLS_VAR_COMPONENT_ID]: componentId,
    [TFTOOLS_VAR_COMPONENT_NAME]: componentName,
    [TFTOOLS_VAR_EXECUTABLE]: executableFileName,
    [TFTOOLS_VAR_EXECUTABLE_PATH]: executablePath,
    [TFTOOLS_VAR_DEBUG_PROFILE_NAME]: debugProfileName,
  };

  const rawVars = profileVars ?? {};
  const rawVarNames = Object.keys(rawVars);

  if (rawVarNames.length === 0) {
    return {
      builtIns,
      profileVars: rawVars,
      resolvedVars: { ...builtIns },
      resolutionErrors: [],
    };
  }

  // Work map starts with all built-ins; resolved profile vars are added as
  // we process them ("tfTools.shortName" → resolved string).
  const resolvedVars: Record<string, string> = { ...builtIns };
  const cycleErrors = new Set<string>();
  const unknownErrors = new Set<string>();

  // DFS state per profile var short name
  const varState = new Map<string, "unvisited" | "visiting" | "visited">();
  for (const name of rawVarNames) {
    varState.set(name, "unvisited");
  }

  function resolveProfileVar(shortName: string): string | undefined {
    const qualifiedName = `${TFTOOLS_DEBUG_VAR_PREFIX}${shortName}`;

    // Already resolved (built-in or previously computed profile var)
    if (Object.prototype.hasOwnProperty.call(resolvedVars, qualifiedName)) {
      return resolvedVars[qualifiedName];
    }

    const st = varState.get(shortName);
    if (st === "visited") {
      // Was visited but not placed in resolvedVars → had resolution error
      return undefined;
    }
    if (st === "visiting") {
      // Cycle — detected while resolving a dependency chain
      cycleErrors.add(qualifiedName);
      return undefined;
    }
    if (st !== "unvisited") {
      return undefined;
    }

    varState.set(shortName, "visiting");
    const rawValue = rawVars[shortName];
    let hadError = false;

    const resolvedValue = rawValue.replace(TFTOOLS_TOKEN_RE, (original, tokenName: string) => {
      // Already resolved (built-in or previously computed profile var)
      if (Object.prototype.hasOwnProperty.call(resolvedVars, tokenName)) {
        return resolvedVars[tokenName];
      }

      // Unresolved tf-tools.* token — check if it is a profile var
      if (tokenName.startsWith(TFTOOLS_DEBUG_VAR_PREFIX)) {
        const depShort = tokenName.slice(TFTOOLS_DEBUG_VAR_PREFIX.length);
        if (varState.has(depShort)) {
          const dep = resolveProfileVar(depShort);
          if (dep !== undefined) {
            return dep;
          }
          hadError = true;
          return original;
        }
      }

      // Unknown tf-tools variable
      unknownErrors.add(tokenName);
      hadError = true;
      return original;
    });

    varState.set(shortName, "visited");

    if (!hadError) {
      resolvedVars[qualifiedName] = resolvedValue;
      return resolvedValue;
    }
    return undefined;
  }

  for (const name of rawVarNames) {
    resolveProfileVar(name);
  }

  const resolutionErrors: string[] = [];
  for (const v of cycleErrors) {
    resolutionErrors.push(`Cyclic dependency detected for debug variable: \${${v}}`);
  }
  for (const v of unknownErrors) {
    resolutionErrors.push(`Unknown tf-tools variable referenced in debug vars: \${${v}}`);
  }

  return {
    builtIns,
    profileVars: rawVars,
    resolvedVars,
    resolutionErrors,
  };
}

// ---------------------------------------------------------------------------
// Substitution
// ---------------------------------------------------------------------------

/** Result of applying tf-tools substitutions to a template value. */
export interface SubstitutionResult {
  readonly value: unknown;
  readonly unknownVars: ReadonlyArray<string>;
}

/**
 * Applies tf-tools substitutions to all string fields in `value` recursively.
 *
 * - `${tfTools.X}` tokens are replaced with `resolvedVars["tfTools.X"]`.
 * - Unknown `${tfTools.X}` tokens are recorded in `unknownVars` and block launch.
 * - Non-tf-tools variable syntax (e.g. `${workspaceFolder}`) is left unchanged.
 * - Replacement results are NOT re-expanded (single pass).
 * - Non-string values pass through unchanged.
 */
export function applyTfToolsSubstitution(
  value: unknown,
  resolvedVars: Readonly<Record<string, string>>
): SubstitutionResult {
  const unknownVars: string[] = [];

  function walk(v: unknown): unknown {
    if (typeof v === "string") {
      return v.replace(TFTOOLS_TOKEN_RE, (original, tokenName: string) => {
        if (Object.prototype.hasOwnProperty.call(resolvedVars, tokenName)) {
          return resolvedVars[tokenName];
        }
        if (!unknownVars.includes(tokenName)) {
          unknownVars.push(tokenName);
        }
        return original;
      });
    }
    if (Array.isArray(v)) {
      return v.map(walk);
    }
    if (v !== null && typeof v === "object") {
      const result: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        result[k] = walk(val);
      }
      return result;
    }
    return v;
  }

  return { value: walk(value), unknownVars };
}

// ---------------------------------------------------------------------------
// Command handler
// ---------------------------------------------------------------------------

/**
 * Executes the Start Debugging flow for the active build context.
 *
 * On each invocation:
 *  1. Validates manifest debug state and resolves the selected debug profile.
 *  2. Derives and verifies the executable artifact path.
 *  3. Loads and parses the JSONC debug template from `templatesRoot`.
 *  4. Builds the tf-tools variable map (built-ins + profile vars).
 *  5. Applies single-pass tf-tools substitution to the template.
 *  6. Starts the resolved configuration via `vscode.debug.startDebugging`.
 *
 * All blocked states (no-match, missing executable, template
 * errors, variable errors) surface an error message and return early.
 * Persistent output-channel logging records blocked and failed debug launches.
 */
export async function executeDebugLaunch(
  workspaceFolder: vscode.WorkspaceFolder,
  manifest: ManifestStateLoaded,
  config: ActiveConfig,
  artifactsRoot: string,
  templatesRoot: string
): Promise<void> {
  // 1. Validate manifest debug state
  if (manifest.hasDebugBlockingIssues) {
    logDebugLaunchFailure("manifest-invalid", {
      modelId: config.modelId,
      targetId: config.targetId,
      componentId: config.componentId,
      detail: "manifest has debug profile validation errors",
    });
    revealLogs();
    void vscode.window.showErrorMessage(
      "Cannot start debugging: the manifest has debug profile validation errors."
    );
    return;
  }

  // 2. Find selected component and target
  const component = manifest.components.find((c) => c.id === config.componentId);
  const target = manifest.targets.find((t) => t.id === config.targetId);
  const model = manifest.models.find((m) => m.id === config.modelId);

  if (!component || !target || !model) {
    revealLogs();
    void vscode.window.showErrorMessage(
      "Cannot start debugging: active configuration references an unknown component, target, or model."
    );
    return;
  }

  // 3. Resolve component debug profile (first-match declaration order)
  const evalCtx: EvalContext = {
    modelId: config.modelId,
    targetId: config.targetId,
    componentId: config.componentId,
  };
  const profiles = component.debug ?? [];
  const resolution = resolveDebugProfile(profiles, evalCtx);

  if (resolution.resolutionState === "no-match") {
    logDebugLaunchFailure("no-match", {
      modelId: config.modelId,
      targetId: config.targetId,
      componentId: config.componentId,
    });
    revealLogs();
    void vscode.window.showErrorMessage(
      "Cannot start debugging: no debug profile matches the active build context."
    );
    return;
  }

  const profile = resolution.selectedProfile!;

  // 4. Derive executable file name and path
  const artifactFolder = model.artifactFolder ?? "";
  const executableFileName = deriveExecutableFileName(
    component.artifactName ?? "",
    target.artifactSuffix ?? "",
    target.executableExtension ?? ""
  );
  const artifactPath = path.join(artifactsRoot, artifactFolder);
  const executablePath = path.join(artifactsRoot, artifactFolder, executableFileName);

  if (!fs.existsSync(executablePath)) {
    logDebugLaunchFailure("missing-executable", {
      modelId: config.modelId,
      targetId: config.targetId,
      componentId: config.componentId,
      detail: executablePath,
    });
    revealLogs();
    void vscode.window.showErrorMessage(
      `Cannot start debugging: executable not found at ${executablePath}`
    );
    return;
  }

  // 5. Load debug template (per-invocation — no caching)
  const templateResult = loadDebugTemplate(profile.template, templatesRoot);

  if (templateResult.parseState === "traversal-blocked") {
    logDebugLaunchFailure("traversal-blocked", {
      modelId: config.modelId,
      targetId: config.targetId,
      componentId: config.componentId,
      detail: templateResult.error,
    });
    revealLogs();
    void vscode.window.showErrorMessage(
      `Cannot start debugging: ${templateResult.error}`
    );
    return;
  }

  if (templateResult.parseState === "missing") {
    logDebugLaunchFailure("missing-template", {
      modelId: config.modelId,
      targetId: config.targetId,
      componentId: config.componentId,
      detail: templateResult.error,
    });
    revealLogs();
    void vscode.window.showErrorMessage(
      `Cannot start debugging: template file not found — ${templateResult.error}`
    );
    return;
  }

  if (templateResult.parseState === "invalid") {
    logDebugLaunchFailure("invalid-template", {
      modelId: config.modelId,
      targetId: config.targetId,
      componentId: config.componentId,
      detail: templateResult.error,
    });
    revealLogs();
    void vscode.window.showErrorMessage(
      `Cannot start debugging: template is invalid — ${templateResult.error}`
    );
    return;
  }

  const configuration = templateResult.configuration!;

  // 6. Build tf-tools variable map
  const varMap = buildDebugVariableMap(
    config.modelId,
    model.name,
    config.targetId,
    target.name,
    config.componentId,
    component.name,
    artifactPath,
    executableFileName,
    executablePath,
    profile.name,
    profile.vars
  );

  if (varMap.resolutionErrors.length > 0) {
    logDebugLaunchFailure("variable-resolution-error", {
      modelId: config.modelId,
      targetId: config.targetId,
      componentId: config.componentId,
      detail: varMap.resolutionErrors.join("; "),
    });
    revealLogs();
    void vscode.window.showErrorMessage(
      `Cannot start debugging: variable resolution failed — ${varMap.resolutionErrors.join("; ")}`
    );
    return;
  }

  // 6. Apply single-pass tf-tools substitution
  const { value: resolvedConfig, unknownVars } = applyTfToolsSubstitution(
    configuration,
    varMap.resolvedVars
  );

  if (unknownVars.length > 0) {
    logDebugLaunchFailure("unknown-template-variables", {
      modelId: config.modelId,
      targetId: config.targetId,
      componentId: config.componentId,
      detail: unknownVars.map((v) => `\${${v}}`).join(", "),
    });
    revealLogs();
    void vscode.window.showErrorMessage(
      `Cannot start debugging: unknown tf-tools variable(s) in template: ${unknownVars.map((v) => `\${${v}}`).join(", ")}`
    );
    return;
  }

  // 7. Launch via VS Code debug API
  const launched = await vscode.debug.startDebugging(
    workspaceFolder,
    resolvedConfig as vscode.DebugConfiguration
  );

  if (!launched) {
    void vscode.window.showErrorMessage("Debugging failed to start.");
    return;
  }

  await vscode.commands.executeCommand("workbench.view.debug");
}
