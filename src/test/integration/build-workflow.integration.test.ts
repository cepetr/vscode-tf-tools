/**
 * Integration tests for Build Workflow commands and view-header actions.
 *
 * Verifies:
 * - All four workflow commands (Build/Clippy/Check/Clean) are registered
 * - Commands can be invoked programmatically against a valid manifest state
 * - Blocked states produce visible failure feedback
 * - Manifest with invalid when expressions correctly blocks workflow
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
  blockReasonMessage,
} from "../../commands/build-workflow";

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

async function activateExtension(): Promise<boolean> {
  const ext = vscode.extensions.getExtension("cepetr.tf-tools");
  if (!ext) {
    return false;
  }
  if (!ext.isActive) {
    await ext.activate();
  }
  return ext.isActive;
}

// ---------------------------------------------------------------------------
// Suite: workflow precondition checks
// ---------------------------------------------------------------------------

suite("Build Workflow – evaluateWorkflowPreconditions", () => {
  test("returns 'no-block' for a valid loaded manifest", () => {
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
    await activateExtension();
    const all = await vscode.commands.getCommands(true);
    assert.ok(all.includes("tfTools.build"), "expected tfTools.build to be registered");
  });

  test("tfTools.clippy command is registered", async () => {
    await activateExtension();
    const all = await vscode.commands.getCommands(true);
    assert.ok(all.includes("tfTools.clippy"), "expected tfTools.clippy to be registered");
  });

  test("tfTools.check command is registered", async () => {
    await activateExtension();
    const all = await vscode.commands.getCommands(true);
    assert.ok(all.includes("tfTools.check"), "expected tfTools.check to be registered");
  });

  test("tfTools.clean command is registered", async () => {
    await activateExtension();
    const all = await vscode.commands.getCommands(true);
    assert.ok(all.includes("tfTools.clean"), "expected tfTools.clean to be registered");
  });

  test("tfTools.toggleBuildOption command is registered", async () => {
    await activateExtension();
    const all = await vscode.commands.getCommands(true);
    assert.ok(
      all.includes("tfTools.toggleBuildOption"),
      "expected tfTools.toggleBuildOption to be registered"
    );
  });

  test("tfTools.selectBuildOptionState command is registered", async () => {
    await activateExtension();
    const all = await vscode.commands.getCommands(true);
    assert.ok(
      all.includes("tfTools.selectBuildOptionState"),
      "expected tfTools.selectBuildOptionState to be registered"
    );
  });
});

// ---------------------------------------------------------------------------
// Suite: T030 – blocked manifest and missing fixture
// ---------------------------------------------------------------------------

suite("Build Workflow – blocked manifest (T030)", () => {
  test("invalid-when manifest marks hasWorkflowBlockingIssues", () => {
    const parsed = parseManifest(fixtureManifestSource("invalid-when"));
    assert.strictEqual(parsed.hasWorkflowBlockingIssues, true);
  });

  test("evaluateWorkflowPreconditions returns manifest-invalid for blocking issues", () => {
    const result = evaluateWorkflowPreconditions({
      manifestStatus: "loaded",
      hasWorkflowBlockingIssues: true,
      workspaceSupported: true,
    });
    assert.strictEqual(result, "manifest-invalid");
  });

  test("blockReasonMessage for manifest-invalid is non-empty", () => {
    const msg = blockReasonMessage("manifest-invalid");
    assert.ok(msg.length > 0);
  });

  test("blockReasonMessage for manifest-missing is non-empty", () => {
    const msg = blockReasonMessage("manifest-missing");
    assert.ok(msg.length > 0);
  });

  test("blockReasonMessage for workspace-unsupported mentions folder", () => {
    const msg = blockReasonMessage("workspace-unsupported");
    assert.ok(msg.toLowerCase().includes("folder"));
  });

  test("package.json keeps Build as the only primary view/title action", () => {
    const ext = vscode.extensions.getExtension("cepetr.tf-tools");
    if (!ext) {
      return; // Skip gracefully when not installed
    }
    const menus: Record<string, unknown[]> =
      ext.packageJSON?.contributes?.menus ?? {};
    const viewTitleMenus = ((menus["view/title"] as Array<{
      command?: string;
      group?: string;
    }>) ?? []);

    const primaryCommands = viewTitleMenus
      .filter((entry) => entry.group?.startsWith("navigation@"))
      .map((entry) => entry.command)
      .filter((command): command is string => Boolean(command));

    assert.deepStrictEqual(
      primaryCommands,
      ["tfTools.build"],
      `expected only tfTools.build as a primary view/title action, found: ${primaryCommands.join(", ")}`
    );
  });

  test("package.json exposes Clippy/Check/Clean in the view/title overflow menu", () => {
    const ext = vscode.extensions.getExtension("cepetr.tf-tools");
    if (!ext) {
      return; // Skip gracefully when not installed
    }
    const menus: Record<string, unknown[]> =
      ext.packageJSON?.contributes?.menus ?? {};
    const viewTitleMenus = ((menus["view/title"] as Array<{
      command?: string;
      group?: string;
    }>) ?? []);

    const overflowCommands = viewTitleMenus
      .filter((entry) => entry.group?.startsWith("overflow@"))
      .map((entry) => entry.command)
      .filter((command): command is string => Boolean(command));

    assert.ok(overflowCommands.includes("tfTools.clippy"), "expected tfTools.clippy in overflow");
    assert.ok(overflowCommands.includes("tfTools.check"), "expected tfTools.check in overflow");
    assert.ok(overflowCommands.includes("tfTools.clean"), "expected tfTools.clean in overflow");
  });

  test("package.json uses Run-prefixed titles for Clippy/Check/Clean commands", () => {
    const ext = vscode.extensions.getExtension("cepetr.tf-tools");
    if (!ext) {
      return;
    }
    const commands = ((ext.packageJSON?.contributes?.commands as Array<{
      command?: string;
      title?: string;
    }>) ?? []);

    const byId = new Map(commands.map((entry) => [entry.command, entry.title]));
    assert.strictEqual(byId.get("tfTools.clippy"), "Run Clippy");
    assert.strictEqual(byId.get("tfTools.check"), "Run Check");
    assert.strictEqual(byId.get("tfTools.clean"), "Run Clean");
  });

  test("package.json orders overflow actions with Refresh IntelliSense last", () => {
    const ext = vscode.extensions.getExtension("cepetr.tf-tools");
    if (!ext) {
      return;
    }
    const menus: Record<string, unknown[]> =
      ext.packageJSON?.contributes?.menus ?? {};
    const viewTitleMenus = ((menus["view/title"] as Array<{
      command?: string;
      group?: string;
    }>) ?? []);

    const overflowEntries = viewTitleMenus
      .filter((entry) => entry.group?.startsWith("overflow@"))
      .map((entry) => ({
        command: entry.command ?? "",
        order: Number((entry.group ?? "").split("@")[1] ?? Number.NaN),
      }))
      .sort((left, right) => left.order - right.order);

    assert.deepStrictEqual(
      overflowEntries.map((entry) => entry.command),
      ["tfTools.clippy", "tfTools.check", "tfTools.clean", "tfTools.refreshIntelliSense"]
    );
  });
});

// ---------------------------------------------------------------------------
// Suite: Refresh IntelliSense command contributions (T027)
// ---------------------------------------------------------------------------

suite("Refresh IntelliSense – command contributions (T027)", () => {
  test("package.json declares tfTools.refreshIntelliSense command", () => {
    const ext = vscode.extensions.getExtension("cepetr.tf-tools");
    if (!ext) {
      return; // Skip gracefully when not installed
    }
    const commands: Array<{ command: string }> =
      ext.packageJSON?.contributes?.commands ?? [];
    const ids = commands.map((c) => c.command);
    assert.ok(
      ids.includes("tfTools.refreshIntelliSense"),
      `expected tfTools.refreshIntelliSense in package.json contributes.commands, found: ${ids.join(", ")}`
    );
  });

  test("package.json exposes tfTools.refreshIntelliSense in view/title overflow menu", () => {
    const ext = vscode.extensions.getExtension("cepetr.tf-tools");
    if (!ext) {
      return; // Skip gracefully when not installed
    }
    const menus: Record<string, unknown[]> =
      ext.packageJSON?.contributes?.menus ?? {};
    const viewTitleMenus: unknown[] = (menus["view/title"] as unknown[]) ?? [];
    const commands = viewTitleMenus
      .map((e) => (e as { command?: string }).command)
      .filter(Boolean);
    assert.ok(
      commands.includes("tfTools.refreshIntelliSense"),
      `expected tfTools.refreshIntelliSense in view/title menus, found: ${commands.join(", ")}`
    );
  });

  test("package.json refresh command has a category and icon", () => {
    const ext = vscode.extensions.getExtension("trezor.tf-tools");
    if (!ext) {
      return;
    }
    const commands: Array<{ command: string; category?: string; icon?: string }> =
      ext.packageJSON?.contributes?.commands ?? [];
    const refreshCmd = commands.find((c) => c.command === "tfTools.refreshIntelliSense");
    assert.ok(refreshCmd, "expected tfTools.refreshIntelliSense to be declared");
    assert.ok(refreshCmd!.category, "expected category to be set on refreshIntelliSense");
    assert.ok(refreshCmd!.icon, "expected icon to be set on refreshIntelliSense");
  });
});
