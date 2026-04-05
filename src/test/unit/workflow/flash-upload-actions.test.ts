/**
 * Unit tests for artifact-action applicability, task-label formatting,
 * precondition evaluation, and no-auto-refresh rule.
 *
 * Covers:
 *  - isFlashApplicable: returns false when flashWhen is absent
 *  - isFlashApplicable: evaluates parsed flashWhen expression correctly
 *  - isUploadApplicable: returns false when uploadWhen is absent
 *  - isUploadApplicable: evaluates parsed uploadWhen expression correctly
 *  - formatArtifactTaskLabel: produces correct dynamic label for Flash
 *  - formatArtifactTaskLabel: produces correct dynamic label for Upload
 *  - evaluateArtifactActionPreconditions: blocks on each reason in priority order
 *  - resolveArtifactActionContext: resolves correctly / returns undefined for unknown ids
 *  - createFlashTask / createUploadTask: correct task label and shell command
 */

import * as assert from "assert";
import {
  isFlashApplicable,
  isUploadApplicable,
  formatArtifactTaskLabel,
  evaluateArtifactActionPreconditions,
  resolveArtifactActionContext,
  createFlashTask,
  createUploadTask,
  ArtifactActionContext,
  ArtifactActionPreconditionInputs,
} from "../../../commands/artifact-actions";
import { ManifestComponent, WhenExpression } from "../../../manifest/manifest-types";
import { makeLoadedState } from "../workflow-test-helpers";
import { ActiveConfig } from "../../../configuration/active-config";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFlashComponent(flashWhen?: WhenExpression, uploadWhen?: WhenExpression): ManifestComponent {
  return {
    kind: "component",
    id: "core",
    name: "Core",
    artifactName: "compile_commands_core",
    flashWhen,
    uploadWhen,
  };
}

function makeEvalCtx(modelId = "T2T1", targetId = "hw", componentId = "core") {
  return { modelId, targetId, componentId };
}

const FLASH_WHEN_T2T1: WhenExpression = { type: "model", id: "T2T1" };
const UPLOAD_WHEN_ANY: WhenExpression = {
  type: "any",
  children: [
    { type: "model", id: "T2T1" },
    { type: "model", id: "T3W1" },
  ],
};

const MOCK_WORKSPACE_FOLDER = {
  uri: { fsPath: "/workspace" },
  name: "workspace",
  index: 0,
} as unknown as import("vscode").WorkspaceFolder;

// ---------------------------------------------------------------------------
// isFlashApplicable
// ---------------------------------------------------------------------------

suite("isFlashApplicable", () => {
  test("returns false when flashWhen is absent", () => {
    const component = makeFlashComponent(undefined);
    assert.strictEqual(isFlashApplicable(component, makeEvalCtx()), false);
  });

  test("returns true when flashWhen matches the active model", () => {
    const component = makeFlashComponent(FLASH_WHEN_T2T1);
    assert.strictEqual(isFlashApplicable(component, makeEvalCtx("T2T1")), true);
  });

  test("returns false when flashWhen does not match the active model", () => {
    const component = makeFlashComponent(FLASH_WHEN_T2T1);
    assert.strictEqual(isFlashApplicable(component, makeEvalCtx("T3W1")), false);
  });
});

// ---------------------------------------------------------------------------
// isUploadApplicable
// ---------------------------------------------------------------------------

suite("isUploadApplicable", () => {
  test("returns false when uploadWhen is absent", () => {
    const component = makeFlashComponent(undefined, undefined);
    assert.strictEqual(isUploadApplicable(component, makeEvalCtx()), false);
  });

  test("returns true for any matching model in an any() expression", () => {
    const component = makeFlashComponent(undefined, UPLOAD_WHEN_ANY);
    assert.strictEqual(isUploadApplicable(component, makeEvalCtx("T2T1")), true);
    assert.strictEqual(isUploadApplicable(component, makeEvalCtx("T3W1")), true);
  });

  test("returns false when the active model is not in the any() expression", () => {
    const component = makeFlashComponent(undefined, UPLOAD_WHEN_ANY);
    assert.strictEqual(isUploadApplicable(component, makeEvalCtx("T3T1")), false);
  });
});

// ---------------------------------------------------------------------------
// formatArtifactTaskLabel
// ---------------------------------------------------------------------------

suite("formatArtifactTaskLabel", () => {
  const ctx: ArtifactActionContext = {
    modelId: "T2T1",
    modelName: "Trezor Model T (v1)",
    targetId: "hw",
    targetDisplay: "HW",
    componentId: "core",
    componentName: "Core",
  };

  test("formats Flash label correctly", () => {
    assert.strictEqual(
      formatArtifactTaskLabel("flash", ctx),
      "Flash Trezor Model T (v1) | HW | Core"
    );
  });

  test("formats Upload label correctly", () => {
    assert.strictEqual(
      formatArtifactTaskLabel("upload", ctx),
      "Upload Trezor Model T (v1) | HW | Core"
    );
  });

  test("uses full target name when shortName is absent", () => {
    const ctxNoShort: ArtifactActionContext = { ...ctx, targetDisplay: "Emulator" };
    assert.strictEqual(
      formatArtifactTaskLabel("flash", ctxNoShort),
      "Flash Trezor Model T (v1) | Emulator | Core"
    );
  });
});

// ---------------------------------------------------------------------------
// evaluateArtifactActionPreconditions
// ---------------------------------------------------------------------------

suite("evaluateArtifactActionPreconditions", () => {
  function makeInputs(
    overrides: Partial<ArtifactActionPreconditionInputs> = {}
  ): ArtifactActionPreconditionInputs {
    return {
      manifestStatus: "loaded",
      workspaceSupported: true,
      actionApplicable: true,
      binaryExists: true,
      ...overrides,
    };
  }

  test("returns no-block when all conditions are satisfied", () => {
    assert.strictEqual(evaluateArtifactActionPreconditions(makeInputs()), "no-block");
  });

  test("blocks with workspace-unsupported first", () => {
    assert.strictEqual(
      evaluateArtifactActionPreconditions(
        makeInputs({ workspaceSupported: false, manifestStatus: "missing" })
      ),
      "workspace-unsupported"
    );
  });

  test("blocks with manifest-missing before manifest-invalid", () => {
    assert.strictEqual(
      evaluateArtifactActionPreconditions(makeInputs({ manifestStatus: "missing" })),
      "manifest-missing"
    );
  });

  test("blocks with manifest-invalid", () => {
    assert.strictEqual(
      evaluateArtifactActionPreconditions(makeInputs({ manifestStatus: "invalid" })),
      "manifest-invalid"
    );
  });

  test("blocks with action-inapplicable before binary-missing", () => {
    assert.strictEqual(
      evaluateArtifactActionPreconditions(
        makeInputs({ actionApplicable: false, binaryExists: false })
      ),
      "action-inapplicable"
    );
  });

  test("blocks with binary-missing when action is applicable but binary absent", () => {
    assert.strictEqual(
      evaluateArtifactActionPreconditions(makeInputs({ binaryExists: false })),
      "binary-missing"
    );
  });
});

// ---------------------------------------------------------------------------
// resolveArtifactActionContext
// ---------------------------------------------------------------------------

suite("resolveArtifactActionContext", () => {
  function makeConfig(overrides: Partial<ActiveConfig> = {}): ActiveConfig {
    return {
      modelId: "T2T1",
      targetId: "hw",
      componentId: "core",
      persistedAt: "2026-01-01T00:00:00Z",
      ...overrides,
    };
  }

  test("resolves all fields correctly from manifest and config", () => {
    const state = makeLoadedState();
    const config = makeConfig();
    const ctx = resolveArtifactActionContext(state, config);
    assert.ok(ctx);
    assert.strictEqual(ctx.modelId, "T2T1");
    assert.strictEqual(ctx.modelName, "Trezor Model T (v1)");
    assert.strictEqual(ctx.targetId, "hw");
    assert.strictEqual(ctx.targetDisplay, "HW");
    assert.strictEqual(ctx.componentId, "core");
    assert.strictEqual(ctx.componentName, "Core");
  });

  test("uses shortName as targetDisplay when defined", () => {
    const state = makeLoadedState();
    const ctx = resolveArtifactActionContext(state, makeConfig({ targetId: "hw" }));
    assert.strictEqual(ctx?.targetDisplay, "HW");
  });

  test("uses full target name as targetDisplay when shortName is absent", () => {
    const state = makeLoadedState();
    const ctx = resolveArtifactActionContext(state, makeConfig({ targetId: "emu" }));
    assert.strictEqual(ctx?.targetDisplay, "Emulator");
  });

  test("returns undefined when model id is unknown", () => {
    const state = makeLoadedState();
    const ctx = resolveArtifactActionContext(state, makeConfig({ modelId: "UNKNOWN" }));
    assert.strictEqual(ctx, undefined);
  });

  test("returns undefined when component id is unknown", () => {
    const state = makeLoadedState();
    const ctx = resolveArtifactActionContext(state, makeConfig({ componentId: "UNKNOWN" }));
    assert.strictEqual(ctx, undefined);
  });
});

// ---------------------------------------------------------------------------
// createFlashTask / createUploadTask
// ---------------------------------------------------------------------------

suite("createFlashTask", () => {
  const ctx: ArtifactActionContext = {
    modelId: "T2T1",
    modelName: "Trezor Model T (v1)",
    targetId: "hw",
    targetDisplay: "HW",
    componentId: "core",
    componentName: "Core",
  };

  test("task name matches dynamic label", () => {
    const task = createFlashTask(ctx, MOCK_WORKSPACE_FOLDER);
    assert.strictEqual(task.name, "Flash Trezor Model T (v1) | HW | Core");
  });

  test("task shell execution includes xtask flash with component-id and model-id", () => {
    const task = createFlashTask(ctx, MOCK_WORKSPACE_FOLDER);
    const exec = task.execution as import("vscode").ShellExecution;
    assert.ok(exec.commandLine?.includes("xtask flash"));
    assert.ok(exec.commandLine?.includes("core"));
    assert.ok(exec.commandLine?.includes("-m T2T1"));
  });

  test("flash task has no group (not a standard build-task entry)", () => {
    const task = createFlashTask(ctx, MOCK_WORKSPACE_FOLDER);
    assert.strictEqual(task.group, undefined);
  });
});

suite("createUploadTask", () => {
  const ctx: ArtifactActionContext = {
    modelId: "T2T1",
    modelName: "Trezor Model T (v1)",
    targetId: "hw",
    targetDisplay: "HW",
    componentId: "core",
    componentName: "Core",
  };

  test("task name matches dynamic label", () => {
    const task = createUploadTask(ctx, MOCK_WORKSPACE_FOLDER);
    assert.strictEqual(task.name, "Upload Trezor Model T (v1) | HW | Core");
  });

  test("task shell execution includes xtask upload with component-id", () => {
    const task = createUploadTask(ctx, MOCK_WORKSPACE_FOLDER);
    const exec = task.execution as import("vscode").ShellExecution;
    assert.ok(exec.commandLine?.includes("xtask upload"));
    assert.ok(exec.commandLine?.includes("core"));
  });

  test("upload task has no group (not a standard build-task entry)", () => {
    const task = createUploadTask(ctx, MOCK_WORKSPACE_FOLDER);
    assert.strictEqual(task.group, undefined);
  });
});
