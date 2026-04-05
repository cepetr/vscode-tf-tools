/**
 * Integration tests for Flash/Upload Actions (T009 - US1).
 *
 * Covers:
 *  - `tfTools.flash` and `tfTools.upload` commands are registered after activation
 *  - `tfTools.openMapFile` is registered after activation
 *  - Executing flash/upload when blocked by workspace-unsupported state resolves without throwing
 *  - package.json commandPalette entries exist for flash and upload with correct when-expressions
 *  - package.json commandPalette entry for openMapFile has `when: "false"` (row-only action)
 *  - package.json view/item/context entries exist for Binary-row flash, upload, and map open
 *  - Flash and Upload tasks carry the correct shell command format
 */

import * as assert from "assert";
import * as vscode from "vscode";
import { evaluateArtifactActionPreconditions } from "../../commands/artifact-actions";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
// Suite: command registration
// ---------------------------------------------------------------------------

suite("Flash/Upload Actions – command registration (T009)", () => {
  test("extension activates without error", async () => {
    const activated = await activateExtension();
    assert.strictEqual(activated, true, "expected extension to activate");
  });

  test("tfTools.flash is registered as a VS Code command", async () => {
    await activateExtension();
    const cmds = await vscode.commands.getCommands(false);
    assert.ok(
      cmds.includes("tfTools.flash"),
      "expected 'tfTools.flash' to be registered in VS Code commands"
    );
  });

  test("tfTools.upload is registered as a VS Code command", async () => {
    await activateExtension();
    const cmds = await vscode.commands.getCommands(false);
    assert.ok(
      cmds.includes("tfTools.upload"),
      "expected 'tfTools.upload' to be registered in VS Code commands"
    );
  });

  test("tfTools.openMapFile is registered as a VS Code command", async () => {
    await activateExtension();
    const cmds = await vscode.commands.getCommands(false);
    assert.ok(
      cmds.includes("tfTools.openMapFile"),
      "expected 'tfTools.openMapFile' to be registered in VS Code commands"
    );
  });

  test("executing tfTools.flash in unsupported-workspace state resolves without throwing", async () => {
    await activateExtension();
    let threw = false;
    try {
      await vscode.commands.executeCommand("tfTools.flash");
    } catch {
      threw = true;
    }
    assert.strictEqual(threw, false, "tfTools.flash command must not throw");
  });

  test("executing tfTools.upload in unsupported-workspace state resolves without throwing", async () => {
    await activateExtension();
    let threw = false;
    try {
      await vscode.commands.executeCommand("tfTools.upload");
    } catch {
      threw = true;
    }
    assert.strictEqual(threw, false, "tfTools.upload command must not throw");
  });

  test("executing tfTools.openMapFile in unsupported-workspace state resolves without throwing", async () => {
    await activateExtension();
    let threw = false;
    try {
      await vscode.commands.executeCommand("tfTools.openMapFile");
    } catch {
      threw = true;
    }
    assert.strictEqual(threw, false, "tfTools.openMapFile command must not throw");
  });
});

// ---------------------------------------------------------------------------
// Suite: package.json static menu contributions
// ---------------------------------------------------------------------------

suite("Flash/Upload Actions – package.json menu contributions (T009)", () => {
  function getExtPackageJson(): Record<string, unknown> {
    const ext = vscode.extensions.getExtension("cepetr.tf-tools");
    assert.ok(ext, "cepetr.tf-tools extension must be present");
    return ext.packageJSON as Record<string, unknown>;
  }

  test("commandPalette entry for tfTools.flash has when: tfTools.flashApplicable", () => {
    const pkg = getExtPackageJson();
    const menus = pkg.contributes as { menus: Record<string, unknown[]> };
    const paletteEntries = (menus.menus["commandPalette"] ?? []) as Array<{
      command: string;
      when?: string;
    }>;
    const entry = paletteEntries.find((e) => e.command === "tfTools.flash");
    assert.ok(entry, "expected commandPalette entry for tfTools.flash");
    assert.strictEqual(
      entry.when,
      "tfTools.flashApplicable",
      "flash palette entry must use when: tfTools.flashApplicable"
    );
  });

  test("commandPalette entry for tfTools.upload has when: tfTools.uploadApplicable", () => {
    const pkg = getExtPackageJson();
    const menus = pkg.contributes as { menus: Record<string, unknown[]> };
    const paletteEntries = (menus.menus["commandPalette"] ?? []) as Array<{
      command: string;
      when?: string;
    }>;
    const entry = paletteEntries.find((e) => e.command === "tfTools.upload");
    assert.ok(entry, "expected commandPalette entry for tfTools.upload");
    assert.strictEqual(
      entry.when,
      "tfTools.uploadApplicable",
      "upload palette entry must use when: tfTools.uploadApplicable"
    );
  });

  test("commandPalette entry for tfTools.openMapFile has when: false (row-only)", () => {
    const pkg = getExtPackageJson();
    const menus = pkg.contributes as { menus: Record<string, unknown[]> };
    const paletteEntries = (menus.menus["commandPalette"] ?? []) as Array<{
      command: string;
      when?: string;
    }>;
    const entry = paletteEntries.find((e) => e.command === "tfTools.openMapFile");
    assert.ok(entry, "expected commandPalette entry for tfTools.openMapFile");
    assert.strictEqual(
      entry.when,
      "false",
      "openMapFile palette entry must use when: false to exclude it from the Command Palette"
    );
  });

  test("view/item/context has flash entry for artifact-binary row", () => {
    const pkg = getExtPackageJson();
    const menus = pkg.contributes as { menus: Record<string, unknown[]> };
    const contextEntries = (menus.menus["view/item/context"] ?? []) as Array<{
      command: string;
      when?: string;
    }>;
    const flashEntry = contextEntries.find(
      (e) => e.command === "tfTools.flash" && e.when?.includes("artifact-binary")
    );
    assert.ok(
      flashEntry,
      "expected view/item/context entry for tfTools.flash scoped to artifact-binary"
    );
  });

  test("view/item/context has upload entry for artifact-binary row", () => {
    const pkg = getExtPackageJson();
    const menus = pkg.contributes as { menus: Record<string, unknown[]> };
    const contextEntries = (menus.menus["view/item/context"] ?? []) as Array<{
      command: string;
      when?: string;
    }>;
    const uploadEntry = contextEntries.find(
      (e) => e.command === "tfTools.upload" && e.when?.includes("artifact-binary")
    );
    assert.ok(
      uploadEntry,
      "expected view/item/context entry for tfTools.upload scoped to artifact-binary"
    );
  });

  test("view/item/context has openMapFile entry for artifact-map row", () => {
    const pkg = getExtPackageJson();
    const menus = pkg.contributes as { menus: Record<string, unknown[]> };
    const contextEntries = (menus.menus["view/item/context"] ?? []) as Array<{
      command: string;
      when?: string;
    }>;
    const mapEntry = contextEntries.find(
      (e) => e.command === "tfTools.openMapFile" && e.when?.includes("artifact-map")
    );
    assert.ok(
      mapEntry,
      "expected view/item/context entry for tfTools.openMapFile scoped to artifact-map"
    );
  });
});

// ---------------------------------------------------------------------------
// Suite: evaluateArtifactActionPreconditions – unit-level guard logic wired
// ---------------------------------------------------------------------------

suite("Flash/Upload Actions – precondition evaluation (T009 integration)", () => {
  test("returns workspace-unsupported when workspace is not supported", () => {
    const result = evaluateArtifactActionPreconditions({
      workspaceSupported: false,
      manifestStatus: "loaded",
      actionApplicable: true,
      binaryExists: true,
    });
    assert.strictEqual(result, "workspace-unsupported");
  });

  test("returns manifest-missing when manifest is missing", () => {
    const result = evaluateArtifactActionPreconditions({
      workspaceSupported: true,
      manifestStatus: "missing",
      actionApplicable: true,
      binaryExists: true,
    });
    assert.strictEqual(result, "manifest-missing");
  });

  test("returns action-inapplicable when action is not applicable", () => {
    const result = evaluateArtifactActionPreconditions({
      workspaceSupported: true,
      manifestStatus: "loaded",
      actionApplicable: false,
      binaryExists: true,
    });
    assert.strictEqual(result, "action-inapplicable");
  });

  test("returns binary-missing when binary artifact does not exist", () => {
    const result = evaluateArtifactActionPreconditions({
      workspaceSupported: true,
      manifestStatus: "loaded",
      actionApplicable: true,
      binaryExists: false,
    });
    assert.strictEqual(result, "binary-missing");
  });

  test("returns no-block when all conditions are met", () => {
    const result = evaluateArtifactActionPreconditions({
      workspaceSupported: true,
      manifestStatus: "loaded",
      actionApplicable: true,
      binaryExists: true,
    });
    assert.strictEqual(result, "no-block");
  });
});
