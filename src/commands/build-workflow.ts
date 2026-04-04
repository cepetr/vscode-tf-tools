/**
 * Build Workflow command logic: label formatting, effective argument derivation,
 * and precondition evaluation for Build, Clippy, Check, and Clean actions.
 *
 * FR-014 through FR-025.
 */

import * as vscode from "vscode";
import { ResolvedOption } from "../configuration/build-options";
import { deriveOptionFlags } from "../configuration/build-options";
import { logWorkflowFailure } from "../observability/log-channel";
import { ManifestState } from "../manifest/manifest-types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WorkflowKind = "Build" | "Clippy" | "Check" | "Clean";

/** Reason why a workflow action cannot start. */
export type WorkflowBlockReason =
  | "no-block"
  | "workspace-unsupported"
  | "manifest-missing"
  | "manifest-invalid";

/** Minimal context needed for task label formatting and arg derivation. */
export interface WorkflowContext {
  readonly modelId: string;
  readonly modelName: string;
  readonly targetId: string;
  readonly targetDisplay: string;
  readonly componentId: string;
  readonly componentName: string;
  /** Target-specific CLI flag from the manifest (appended when not null/undefined). */
  readonly targetFlag?: string | null;
}

/** Inputs to the precondition check. */
export interface PreconditionInputs {
  readonly manifestStatus: ManifestState["status"];
  readonly hasWorkflowBlockingIssues: boolean;
  readonly workspaceSupported: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Fixed label for the Clean task (FR-017). */
export const CLEAN_TASK_LABEL = "Clean";

// ---------------------------------------------------------------------------
// Label formatting (FR-014 through FR-018)
// ---------------------------------------------------------------------------

/**
 * Formats the task label for a Build/Clippy/Check/Clean action.
 *
 * - Build/Clippy/Check: `{kind} {model-name} | {target-display} | {component-name}`
 * - Clean:              `"Clean"` (fixed, no context suffix)
 */
export function formatTaskLabel(kind: WorkflowKind, ctx: WorkflowContext): string {
  if (kind === "Clean") {
    return CLEAN_TASK_LABEL;
  }
  return `${kind} ${ctx.modelName} | ${ctx.targetDisplay} | ${ctx.componentName}`;
}

// ---------------------------------------------------------------------------
// Effective argument derivation (FR-019 through FR-021)
// ---------------------------------------------------------------------------

/**
 * Derives the ordered command-line arguments for Build, Clippy, or Check.
 *
 * Argument format: `<component-id> -m <model-id> [target-flag] [option-flags]`
 * (FR-019). The target flag comes from the manifest target `flag` field and is
 * omitted when absent or null.
 */
export function deriveWorkflowArguments(
  kind: Exclude<WorkflowKind, "Clean">,
  ctx: { modelId: string; targetId: string; componentId: string; targetFlag?: string | null },
  resolved: ReadonlyArray<ResolvedOption>
): string[] {
  const base = [ctx.componentId, "-m", ctx.modelId];
  const targetArgs = ctx.targetFlag ? [ctx.targetFlag] : [];
  const flags = deriveOptionFlags(resolved);
  return [...base, ...targetArgs, ...flags];
}

/**
 * Derives the command-line arguments for Clean.
 * Clean runs with no arguments: `cargo xtask clean` (FR-021).
 */
export function deriveCleanArguments(_ctx: {
  modelId: string;
  targetId: string;
  componentId: string;
}): string[] {
  return [];
}

// ---------------------------------------------------------------------------
// Precondition checks (FR-023 through FR-024)
// ---------------------------------------------------------------------------

/**
 * Evaluates whether the workflow action can start.
 * Returns the first blocking reason found, or "no-block" if all clear.
 *
 * Priority order: workspace-unsupported > manifest-missing > manifest-invalid
 */
export function evaluateWorkflowPreconditions(
  inputs: PreconditionInputs
): WorkflowBlockReason {
  if (!inputs.workspaceSupported) {
    return "workspace-unsupported";
  }
  if (inputs.manifestStatus === "missing") {
    return "manifest-missing";
  }
  if (inputs.manifestStatus === "invalid" || inputs.hasWorkflowBlockingIssues) {
    return "manifest-invalid";
  }
  return "no-block";
}

/**
 * Produces the user-facing error message for a given block reason.
 */
export function blockReasonMessage(reason: WorkflowBlockReason): string {
  switch (reason) {
    case "workspace-unsupported":
      return "Build Workflow requires exactly one open workspace folder. Multi-root workspaces and empty windows are not supported.";
    case "manifest-missing":
      return "Build Workflow is blocked: the manifest file (tf-tools.yaml) was not found. Create or restore it to enable build actions.";
    case "manifest-invalid":
      return "Build Workflow is blocked: the manifest has validation errors or invalid availability rules. Check the Problems view and fix all errors to enable build actions.";
    case "no-block":
      return "";
  }
}

// ---------------------------------------------------------------------------
// Workflow execution helpers
// ---------------------------------------------------------------------------

/**
 * Attempts to run a VS Code task with the given label.
 * Shows a VS Code error message and logs to the output channel on failure.
 */
export async function executeWorkflowTask(
  task: vscode.Task,
  kind: WorkflowKind
): Promise<void> {
  try {
    await vscode.tasks.executeTask(task);
  } catch (err) {
    const msg = `Failed to start ${kind} task: ${err instanceof Error ? err.message : String(err)}`;
    vscode.window.showErrorMessage(msg);
    logWorkflowFailure(kind, msg);
  }
}

/**
 * Shows a visible failure message when a workflow action is blocked,
 * and logs to the output channel (FR-023).
 */
export function reportWorkflowBlocked(
  kind: WorkflowKind,
  reason: WorkflowBlockReason
): void {
  const msg = blockReasonMessage(reason);
  vscode.window.showErrorMessage(`${kind}: ${msg}`);
  logWorkflowFailure(kind, msg);
}
