/**
 * Debug Launch helpers: profile resolution, executable path derivation,
 * template loading, variable-map construction, and tf-tools substitution.
 *
 * FR-001 through FR-026 (debug launch slice).
 */

import * as fs from "fs";
import * as path from "path";
import * as jsonc from "jsonc-parser";
import * as vscode from "vscode";
import { ManifestDebugProfile, ManifestStateLoaded } from "../manifest/manifest-types";
import { EvalContext, evaluateWhenExpression } from "../manifest/when-expressions";
import { ActiveConfig } from "../configuration/active-config";

// ---------------------------------------------------------------------------
// Profile resolution
// ---------------------------------------------------------------------------

export type DebugProfileResolutionState = "selected" | "ambiguous" | "no-match";

/** Result of matching manifest debug profiles against the active build context. */
export interface DebugProfileResolution {
  readonly resolutionState: DebugProfileResolutionState;
  readonly selectedProfile?: ManifestDebugProfile;
  readonly matchedProfiles: ReadonlyArray<ManifestDebugProfile>;
  readonly highestPriority: number;
}

/**
 * Resolves manifest debug profiles against the active build context.
 *
 * - Profiles without a `when` expression match all contexts.
 * - Among matching profiles the highest `priority` wins.
 * - Exactly one highest-priority match → `"selected"`.
 * - Two or more tied at the highest priority → `"ambiguous"`.
 * - No matches at all → `"no-match"`.
 */
export function resolveDebugProfile(
  profiles: ReadonlyArray<ManifestDebugProfile>,
  evalCtx: EvalContext
): DebugProfileResolution {
  const matched = profiles.filter((p) =>
    p.when === undefined ? true : evaluateWhenExpression(p.when, evalCtx)
  );

  if (matched.length === 0) {
    return { resolutionState: "no-match", matchedProfiles: [], highestPriority: 0 };
  }

  const highestPriority = Math.max(...matched.map((p) => p.priority));
  const topProfiles = matched.filter((p) => p.priority === highestPriority);

  if (topProfiles.length === 1) {
    return {
      resolutionState: "selected",
      selectedProfile: topProfiles[0],
      matchedProfiles: matched,
      highestPriority,
    };
  }

  return {
    resolutionState: "ambiguous",
    matchedProfiles: matched,
    highestPriority,
  };
}

// ---------------------------------------------------------------------------
// Executable path derivation
// ---------------------------------------------------------------------------

/**
 * Derives the absolute executable path from the selected debug profile.
 *
 * - Absolute `executable` values are returned unchanged.
 * - Relative values are resolved against `<artifactsRoot>/<artifactFolder>/`.
 */
export function deriveExecutablePath(
  executable: string,
  artifactFolder: string,
  artifactsRoot: string
): string {
  if (path.isAbsolute(executable)) {
    return executable;
  }
  return path.join(artifactsRoot, artifactFolder, executable);
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
export const TFTOOLS_VAR_MODEL = "tfTools.model";
export const TFTOOLS_VAR_TARGET = "tfTools.target";
export const TFTOOLS_VAR_COMPONENT = "tfTools.component";
export const TFTOOLS_VAR_ARTIFACT_FOLDER = "tfTools.artifactFolder";
export const TFTOOLS_VAR_EXECUTABLE_PATH = "tfTools.executablePath";
export const TFTOOLS_VAR_EXECUTABLE_BASENAME = "tfTools.executableBasename";

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
 * Built-in variables derive from the active model, target, component, artifact
 * folder, and resolved executable path. Profile-defined `vars` may reference
 * built-ins and other profile vars; cycles and unknown tf-tools references in
 * profile vars are reported as resolution errors that block launch.
 */
export function buildDebugVariableMap(
  modelId: string,
  targetId: string,
  componentId: string,
  artifactFolder: string,
  executablePath: string,
  profileVars: Readonly<Record<string, string>> | undefined
): DebugVariableMap {
  const builtIns: Readonly<Record<string, string>> = {
    [TFTOOLS_VAR_MODEL]: modelId,
    [TFTOOLS_VAR_TARGET]: targetId,
    [TFTOOLS_VAR_COMPONENT]: componentId,
    [TFTOOLS_VAR_ARTIFACT_FOLDER]: artifactFolder,
    [TFTOOLS_VAR_EXECUTABLE_PATH]: executablePath,
    [TFTOOLS_VAR_EXECUTABLE_BASENAME]: path.basename(executablePath),
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
    const qualifiedName = `tfTools.${shortName}`;

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
      if (tokenName.startsWith("tfTools.")) {
        const depShort = tokenName.slice("tfTools.".length);
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
 *  1. Validates manifest debug state and resolves a unique matching profile.
 *  2. Derives and verifies the executable artifact path.
 *  3. Loads and parses the JSONC debug template from `templatesRoot`.
 *  4. Builds the tf-tools variable map (built-ins + profile vars).
 *  5. Applies single-pass tf-tools substitution to the template.
 *  6. Starts the resolved configuration via `vscode.debug.startDebugging`.
 *
 * All blocked states (no-match, ambiguous, missing executable, template
 * errors, variable errors) surface an error message and return early.
 * Persistent output-channel logging is added by T022.
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
    void vscode.window.showErrorMessage(
      "Cannot start debugging: the manifest has debug profile validation errors."
    );
    return;
  }

  // 2. Resolve debug profile
  const evalCtx: EvalContext = {
    modelId: config.modelId,
    targetId: config.targetId,
    componentId: config.componentId,
  };
  const resolution = resolveDebugProfile(manifest.debugProfiles, evalCtx);

  if (resolution.resolutionState === "no-match") {
    void vscode.window.showErrorMessage(
      "Cannot start debugging: no debug profile matches the active build context."
    );
    return;
  }

  if (resolution.resolutionState === "ambiguous") {
    void vscode.window.showErrorMessage(
      `Cannot start debugging: ${resolution.matchedProfiles.length} debug profiles are tied at highest priority ${resolution.highestPriority}. Resolve the ambiguity by assigning distinct priorities.`
    );
    return;
  }

  const profile = resolution.selectedProfile!;

  // 3. Derive executable path and verify existence
  const model = manifest.models.find((m) => m.id === config.modelId);
  const artifactFolder = model?.artifactFolder ?? "";
  const executablePath = deriveExecutablePath(profile.executable, artifactFolder, artifactsRoot);

  if (!fs.existsSync(executablePath)) {
    void vscode.window.showErrorMessage(
      `Cannot start debugging: executable not found at ${executablePath}`
    );
    return;
  }

  // 4. Load debug template (per-invocation — no caching)
  const templateResult = loadDebugTemplate(profile.template, templatesRoot);

  if (templateResult.parseState === "traversal-blocked") {
    void vscode.window.showErrorMessage(
      `Cannot start debugging: ${templateResult.error}`
    );
    return;
  }

  if (templateResult.parseState === "missing") {
    void vscode.window.showErrorMessage(
      `Cannot start debugging: template file not found — ${templateResult.error}`
    );
    return;
  }

  if (templateResult.parseState === "invalid") {
    void vscode.window.showErrorMessage(
      `Cannot start debugging: template is invalid — ${templateResult.error}`
    );
    return;
  }

  const configuration = templateResult.configuration!;

  // 5. Build tf-tools variable map
  const varMap = buildDebugVariableMap(
    config.modelId,
    config.targetId,
    config.componentId,
    artifactFolder,
    executablePath,
    profile.vars
  );

  if (varMap.resolutionErrors.length > 0) {
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
  }
}
