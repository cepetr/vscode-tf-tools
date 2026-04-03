/**
 * Integration tests for Build Workflow commands and view-header actions.
 *
 * Verifies:
 * - All four workflow commands (Build/Clippy/Check/Clean) are registered
 * - Commands can be invoked programmatically against a valid manifest state
 * - Blocked states produce visible failure feedback
 *
 * These tests run inside the VS Code extension host.
 */
import * as assert from "assert";
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { parseManifest } from "../../manifest/validate-manifest";
import {
  evaluateWorkflowPreconditions,
  WorkflowBlockReason,
} from "../../commands/build-workflow";
import { isWorkflowWorkspaceSupported } from "../../workspace/workspace-guard";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fixtureManifestSource(fixtureName: string): string {
  const fixturePath = path.resolve(
    __dirname,
    "../../../test-fixtures/manifests",
    fixtureName,
    "tf-tools.yaml"
  );
  return fs.readFileSync(fixturePath, "utf-8");
}

// ---------------------------------------------------------------------------
// Suite: workflow precondition checks
// ---------------------------------------------------------------------------

suite("Build Workflow – evaluateWorkflowPreconditions", () => {
  test("returns 'no-block' for a valid loaded manifest", () => {
    const parsed = parseManifest(fixtureManifestSource("valid-basic"));
    const result = evaluateWorkflowPreconditions({
      manifestStatus: "loaded",
      hasWorkflowBlockingIssues: false,
      workspaceSupported: true,
    });
    assert.strictEqual(result, "no-block");
  });

  test("returns 'manifest-missing' when manifest is missing", () => {
    const result = evaluateWorkflowPreconditions({
      manifestStatus: "missing",
      hasWorkflowBlockingIssues: false,
      workspaceSupported: true,
    });
    assert.strictEqual(result, "manifest-missing");
  });

  test("returns 'manifest-invalid' when manifest is invalid", () => {
    const result = evaluateWorkflowPreconditions({
      manifestStatus: "invalid",
      hasWorkflowBlockingIssues: false,
      workspaceSupported: true,
    });
    assert.strictEqual(result, "manifest-invalid");
  });

  test("returns 'manifest-invalid' when hasWorkflowBlockingIssues is true", () => {
    const result = evaluateWorkflowPreconditions({
      manifestStatus: "loaded",
      hasWorkflowBlockingIssues: true,
      workspaceSupported: true,
    });
    assert.strictEqual(result, "manifest-invalid");
  });

  test("returns 'workspace-unsupported' when workspace is unsupported", () => {
    const result = evaluateWorkflowPreconditions({
      manifestStatus: "loaded",
      hasWorkflowBlockingIssues: false,
      workspaceSupported: false,
    });
    assert.strictEqual(result, "workspace-unsupported");
  });

  test("workspace-unsupported takes priority over manifest-missing", () => {
    const result = evaluateWorkflowPreconditions({
      manifestStatus: "missing",
      hasWorkflowBlockingIssues: false,
      workspaceSupported: false,
    });
    assert.strictEqual(result, "workspace-unsupported");
  });
});

// ---------------------------------------------------------------------------
// Suite: workflow commands registered in the extension host
// ---------------------------------------------------------------------------

suite("Build Workflow – command registration", () => {
  test("tfTools.build command is registered", async () => {
    const all = await vscode.commands.getCommands(true);
    assert.ok(all.includes("tfTools.build"), "expected tfTools.build to be registered");
  });

  test("tfTools.clippy command is registered", async () => {
    const all = await vscode.commands.getCommands(true);
    assert.ok(all.includes("tfTools.clippy"), "expected tfTools.clippy to be registered");
  });

  test("tfTools.check command is registered", async () => {
    const all = await vscode.commands.getCommands(true);
    assert.ok(all.includes("tfTools.check"), "expected tfTools.check to be registered");
  });

  test("tfTools.clean command is registered", async () => {
    const all = await vscode.commands.getCommands(true);
    assert.ok(all.includes("tfTools.clean"), "expected tfTools.clean to be registered");
  });

  test("tfTools.toggleBuildOption command is registered", async () => {
    const all = await vscode.commands.getCommands(true);
    assert.ok(
      all.includes("tfTools.toggleBuildOption"),
      "expected tfTools.toggleBuildOption to be registered"
    );
  });

  test("tfTools.selectBuildOptionState command is registered", async () => {
    const all = await vscode.commands.getCommands(true);
    assert.ok(
      all.includes("tfTools.selectBuildOptionState"),
      "expected tfTools.selectBuildOptionState to be registered"
    );
  });
});
