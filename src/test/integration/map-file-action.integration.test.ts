/**
 * Integration tests for the Map File open action (T019 - US3).
 *
 * Covers:
 *  - tfTools.openMapFile command is registered after activation
 *  - openMapFile is excluded from the Command Palette (when: "false")
 *  - openMapFile view/item/context entry targets artifact-map rows
 *  - openMapFile resolves without throwing when called in an unsupported-workspace state
 *  - Map File row has contextValue 'artifact-map' so the action can be scoped to it
 */

import * as assert from "assert";
import * as vscode from "vscode";
import { MapArtifactItem } from "../../ui/configuration-tree";
import { ActiveMapArtifact } from "../../intellisense/artifact-resolution";
import { openMapFile } from "../../commands/artifact-actions";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function activateExtension(): Promise<boolean> {
  const ext = vscode.extensions.getExtension("cepetr.tf-tools");
  if (!ext) { return false; }
  if (!ext.isActive) { await ext.activate(); }
  return ext.isActive;
}

function getExtPackageJson(): Record<string, unknown> | undefined {
  const ext = vscode.extensions.getExtension("cepetr.tf-tools");
  return ext?.packageJSON as Record<string, unknown> | undefined;
}

// ---------------------------------------------------------------------------
// Suite: openMapFile command registration (US3)
// ---------------------------------------------------------------------------

suite("Map File Action – command registration (T019)", () => {
  test("tfTools.openMapFile is registered as a VS Code command", async () => {
    await activateExtension();
    const cmds = await vscode.commands.getCommands(false);
    assert.ok(
      cmds.includes("tfTools.openMapFile"),
      "expected 'tfTools.openMapFile' to be registered in VS Code commands"
    );
  });

  test("executing tfTools.openMapFile in missing-artifact state resolves without throwing", async () => {
    await activateExtension();
    let threw = false;
    try {
      await vscode.commands.executeCommand("tfTools.openMapFile");
    } catch {
      threw = true;
    }
    assert.strictEqual(threw, false, "tfTools.openMapFile must not throw");
  });
});

// ---------------------------------------------------------------------------
// Suite: Command Palette exclusion (US3, FR)
// ---------------------------------------------------------------------------

suite("Map File Action – Command Palette exclusion (T019)", () => {
  test("commandPalette entry for tfTools.openMapFile has when: false", () => {
    const pkg = getExtPackageJson();
    if (!pkg) { return; }
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
      "openMapFile must be excluded from the Command Palette via when: false"
    );
  });
});

// ---------------------------------------------------------------------------
// Suite: view/item/context row action (US3)
// ---------------------------------------------------------------------------

suite("Map File Action – view/item/context registration (T019)", () => {
  test("view/item/context has openMapFile entry scoped to artifact-map", () => {
    const pkg = getExtPackageJson();
    if (!pkg) { return; }
    const menus = pkg.contributes as { menus: Record<string, unknown[]> };
    const contextEntries = (menus.menus["view/item/context"] ?? []) as Array<{
      command: string;
      when?: string;
    }>;
    const mapEntry = contextEntries.find(
      (e) => e.command === "tfTools.openMapFile" && e.when?.includes("artifact-map")
    );
    assert.ok(mapEntry, "expected openMapFile entry for artifact-map rows");
  });
});

// ---------------------------------------------------------------------------
// Suite: MapArtifactItem contextValue for row-action scoping
// ---------------------------------------------------------------------------

suite("Map File Action – MapArtifactItem row scoping (T019)", () => {
  function makeValidMap(): ActiveMapArtifact {
    return { path: "/build/firmware.map", exists: true, status: "valid", contextKey: "T2T1::hw::core" };
  }

  function makeMissingMap(): ActiveMapArtifact {
    return {
      path: "/build/firmware.map",
      exists: false,
      status: "missing",
      missingReason: "Map not found.",
      contextKey: "T2T1::hw::core",
    };
  }

  test("MapArtifactItem contextValue is always 'artifact-map'", () => {
    assert.strictEqual(new MapArtifactItem(makeValidMap()).contextValue, "artifact-map");
    assert.strictEqual(new MapArtifactItem(makeMissingMap()).contextValue, "artifact-map");
  });

  test("MapArtifactItem label is 'Map File'", () => {
    assert.strictEqual(new MapArtifactItem(makeValidMap()).label, "Map File");
  });
});

// ---------------------------------------------------------------------------
// Suite: openMapFile function (US3 unit-level seam)
// ---------------------------------------------------------------------------

suite("Map File Action – openMapFile function (T019)", () => {
  test("resolves without throwing for empty path", async () => {
    let threw = false;
    try {
      await openMapFile("");
    } catch {
      threw = true;
    }
    assert.strictEqual(threw, false);
  });

  test("resolves without throwing for a non-existent path (error surfaced via notification)", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const origShow = (vscode.window as any).showErrorMessage;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (vscode.window as any).showErrorMessage = () => Promise.resolve(undefined);
    let threw = false;
    try {
      await openMapFile("/definitely/not/a/real/file.map");
    } catch {
      threw = true;
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (vscode.window as any).showErrorMessage = origShow;
    }
    assert.strictEqual(threw, false);
  });
});
