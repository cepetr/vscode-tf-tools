/**
 * Integration tests for Debug Launch – User Story 2 (T016).
 *
 * Covers:
 *  - Executable row is rendered for valid, missing, no-match, ambiguous, and manifest-invalid states
 *  - Executable row appears immediately after Compile Commands when no Binary/Map rows are present
 *  - Executable row stays visible (not removed) when executable is missing
 *  - resolveActiveExecutableArtifact reflects correct state when model/target/component changes
 *  - resolveActiveExecutableArtifact reflects correct state when artifactsRoot changes (artifacts-path)
 *  - tfTools.startDebugging Command Palette entry uses tfTools.startDebuggingEnabled when-clause
 *  - package.json header and overflow menu entries have correct enablement
 *  - package.json Executable row context entry targets artifact-executable contextValue
 */

import * as assert from "assert";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import * as vscode from "vscode";
import {
  resolveActiveExecutableArtifact,
  ActiveExecutableArtifact,
} from "../../intellisense/artifact-resolution";
import {
  ConfigurationTreeProvider,
  CompileCommandsArtifactItem,
  ExecutableArtifactItem,
} from "../../ui/configuration-tree";
import {
  makeDebugLoadedState,
  makeDebugProfile,
} from "../unit/workflow-test-helpers";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(modelId: string, targetId = "hw", componentId = "core"): {
  modelId: string;
  targetId: string;
  componentId: string;
  persistedAt: string;
} {
  return { modelId, targetId, componentId, persistedAt: "" };
}

function makeValidArtifact(): import("../../intellisense/intellisense-types").ActiveCompileCommandsArtifact {
  return {
    contextKey: "T2T1::hw::core",
    path: "/build/model-t/compile_commands_core.cc.json",
    exists: true,
    status: "valid",
  };
}

function getExtPackageJson(): Record<string, unknown> {
  const ext = vscode.extensions.getExtension("cepetr.tf-tools");
  assert.ok(ext, "cepetr.tf-tools extension must be present");
  return ext.packageJSON as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Suite: Executable row rendering under all resolution states (T016)
// ---------------------------------------------------------------------------

suite("Debug Launch – Executable row rendering under resolution states (T016)", () => {
  let tmpDir: string;

  setup(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tf-tools-debug-artifacts-"));
  });

  teardown(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function makeRow(artifact: ActiveExecutableArtifact): ExecutableArtifactItem {
    return new ExecutableArtifactItem(artifact);
  }

  test("Executable row contextValue is 'artifact-executable'", () => {
    const profile = makeDebugProfile({ template: "t.json", executable: "fw.elf" });
    const manifest = makeDebugLoadedState([profile]);
    const artifact = resolveActiveExecutableArtifact(manifest, makeConfig("T2T1"), tmpDir);
    const item = makeRow(artifact);
    assert.strictEqual(item.contextValue, "artifact-executable");
  });

  test("Executable row icon is 'error' when no profile matches (no-match state)", () => {
    const profile = makeDebugProfile({
      template: "t.json",
      executable: "fw.elf",
      when: { type: "model", id: "T3W1" },
    });
    const manifest = makeDebugLoadedState([profile]);
    const artifact = resolveActiveExecutableArtifact(manifest, makeConfig("T2T1"), tmpDir);
    const item = makeRow(artifact);
    assert.strictEqual((item.iconPath as vscode.ThemeIcon).id, "error");
    assert.strictEqual(item.description, "missing");
  });

  test("Executable row icon is 'error' when profiles are ambiguous", () => {
    const a = makeDebugProfile({ template: "a.json", executable: "fw-a.elf", priority: 5 });
    const b = makeDebugProfile({ template: "b.json", executable: "fw-b.elf", priority: 5 });
    const manifest = makeDebugLoadedState([a, b]);
    const artifact = resolveActiveExecutableArtifact(manifest, makeConfig("T2T1"), tmpDir);
    const item = makeRow(artifact);
    assert.strictEqual((item.iconPath as vscode.ThemeIcon).id, "error");
  });

  test("Executable row icon is 'error' when manifest has debug-blocking issues", () => {
    const manifest = makeDebugLoadedState([], { hasDebugBlockingIssues: true });
    const artifact = resolveActiveExecutableArtifact(manifest, makeConfig("T2T1"), tmpDir);
    const item = makeRow(artifact);
    assert.strictEqual((item.iconPath as vscode.ThemeIcon).id, "error");
  });

  test("Executable row icon is 'error' when profile matches but executable is missing", () => {
    const profile = makeDebugProfile({ template: "t.json", executable: "missing.elf" });
    const manifest = makeDebugLoadedState([profile]);
    const artifact = resolveActiveExecutableArtifact(manifest, makeConfig("T2T1"), tmpDir);
    const item = makeRow(artifact);
    assert.strictEqual((item.iconPath as vscode.ThemeIcon).id, "error");
  });

  test("Executable row icon is 'pass' when profile matches and executable exists on disk", () => {
    const exeDir = path.join(tmpDir, "model-t");
    fs.mkdirSync(exeDir);
    fs.writeFileSync(path.join(exeDir, "firmware.elf"), "");

    const profile = makeDebugProfile({ template: "t.json", executable: "firmware.elf" });
    const manifest = makeDebugLoadedState([profile]);
    const artifact = resolveActiveExecutableArtifact(manifest, makeConfig("T2T1"), tmpDir);
    const item = makeRow(artifact);
    assert.strictEqual((item.iconPath as vscode.ThemeIcon).id, "pass");
  });

  test("Executable row remains visible after artifact transitions to missing", () => {
    // First: valid
    const exeDir = path.join(tmpDir, "model-t");
    fs.mkdirSync(exeDir);
    const exePath = path.join(exeDir, "firmware.elf");
    fs.writeFileSync(exePath, "");

    const profile = makeDebugProfile({ template: "t.json", executable: "firmware.elf" });
    const manifest = makeDebugLoadedState([profile]);
    const validArtifact = resolveActiveExecutableArtifact(manifest, makeConfig("T2T1"), tmpDir);
    assert.strictEqual(validArtifact.status, "valid");

    // Delete the file → now missing
    fs.unlinkSync(exePath);
    const missingArtifact = resolveActiveExecutableArtifact(manifest, makeConfig("T2T1"), tmpDir);
    assert.strictEqual(missingArtifact.status, "missing");
    // Row constructed from missing artifact should still be constructible (always rendered)
    const item = makeRow(missingArtifact);
    assert.strictEqual(item.contextValue, "artifact-executable");
    assert.strictEqual(item.description, "missing");
  });
});

// ---------------------------------------------------------------------------
// Suite: Executable row position in Build Artifacts tree (T016)
// ---------------------------------------------------------------------------

suite("Debug Launch – Executable row position in Build Artifacts tree (T016)", () => {
  let provider: ConfigurationTreeProvider;

  setup(() => {
    provider = new ConfigurationTreeProvider();
  });

  function getBuildArtifacts(): vscode.TreeItem[] {
    return provider.getChildren(new (require("../../ui/configuration-tree").SectionItem)(
      "build-artifacts",
      "Build Artifacts"
    ));
  }

  function makeExecArtifact(overrides: Partial<ActiveExecutableArtifact> = {}): ActiveExecutableArtifact {
    return {
      contextKey: "T2T1::hw::core",
      profileResolutionState: "selected",
      expectedPath: "/build/model-t/firmware.elf",
      exists: true,
      status: "valid",
      tooltip: "/build/model-t/firmware.elf",
      ...overrides,
    };
  }

  test("Executable row appears immediately after Compile Commands when no Binary/Map rows", () => {
    provider.updateArtifact(makeValidArtifact());
    provider.updateExecutableArtifact(makeExecArtifact());

    const children = getBuildArtifacts();
    const ccIdx = children.findIndex((c) => c instanceof CompileCommandsArtifactItem);
    const execIdx = children.findIndex((c) => c instanceof ExecutableArtifactItem);
    assert.strictEqual(ccIdx, 0, "CompileCommandsArtifactItem should be first");
    assert.strictEqual(execIdx, 1, "ExecutableArtifactItem should be immediately after CompileCommands");
  });

  test("Executable row is always visible regardless of profile resolution state", () => {
    provider.updateArtifact(makeValidArtifact());
    provider.updateExecutableArtifact(makeExecArtifact({
      status: "missing",
      profileResolutionState: "no-match",
      tooltip: "No debug profile matches.",
    }));

    const children = getBuildArtifacts();
    assert.ok(
      children.some((c) => c instanceof ExecutableArtifactItem),
      "expected Executable row even with no-match state"
    );
  });

  test("clearing Executable artifact removes the row from the tree", () => {
    provider.updateArtifact(makeValidArtifact());
    provider.updateExecutableArtifact(makeExecArtifact());
    provider.updateExecutableArtifact(null);

    const children = getBuildArtifacts();
    assert.ok(
      !children.some((c) => c instanceof ExecutableArtifactItem),
      "expected no Executable row after clearing"
    );
  });
});

// ---------------------------------------------------------------------------
// Suite: Availability refresh after context change (T016)
// ---------------------------------------------------------------------------

suite("Debug Launch – Executable availability refresh after context change (T016)", () => {
  let tmpDir: string;

  setup(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tf-tools-debug-refresh-"));
  });

  teardown(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("status changes from missing to valid when executable is created (artifacts-path change simulation)", () => {
    const profile = makeDebugProfile({ template: "t.json", executable: "firmware.elf" });
    const manifest = makeDebugLoadedState([profile]);
    const config = makeConfig("T2T1");

    const before = resolveActiveExecutableArtifact(manifest, config, tmpDir);
    assert.strictEqual(before.status, "missing");

    // Simulate artifact creation
    const exeDir = path.join(tmpDir, "model-t");
    fs.mkdirSync(exeDir, { recursive: true });
    fs.writeFileSync(path.join(exeDir, "firmware.elf"), "");

    const after = resolveActiveExecutableArtifact(manifest, config, tmpDir);
    assert.strictEqual(after.status, "valid");
  });

  test("status changes when model changes to one with a matching profile", () => {
    // Profile matches T3W1 only
    const profile = makeDebugProfile({
      template: "t.json",
      executable: "firmware.elf",
      when: { type: "model", id: "T3W1" },
    });
    const manifest = makeDebugLoadedState([profile]);

    const forT2T1 = resolveActiveExecutableArtifact(manifest, makeConfig("T2T1"), tmpDir);
    assert.strictEqual(forT2T1.profileResolutionState, "no-match");

    const forT3W1 = resolveActiveExecutableArtifact(manifest, makeConfig("T3W1"), tmpDir);
    // Profile matches but file doesn't exist → selected (missing)
    assert.strictEqual(forT3W1.profileResolutionState, "selected");
  });

  test("status reflects component change when when-expression uses componentId", () => {
    const profile = makeDebugProfile({
      template: "t.json",
      executable: "fw.elf",
      when: { type: "component", id: "core" },
    });
    const manifest = makeDebugLoadedState([profile]);

    const coreResult = resolveActiveExecutableArtifact(manifest, makeConfig("T2T1", "hw", "core"), tmpDir);
    assert.strictEqual(coreResult.profileResolutionState, "selected");

    const prodtestResult = resolveActiveExecutableArtifact(manifest, makeConfig("T2T1", "hw", "prodtest"), tmpDir);
    assert.strictEqual(prodtestResult.profileResolutionState, "no-match");
  });

  test("status changes when artifacts-root path changes to one containing the executable", () => {
    const profile = makeDebugProfile({ template: "t.json", executable: "firmware.elf" });
    const manifest = makeDebugLoadedState([profile]);
    const config = makeConfig("T2T1");

    const emptyRoot = resolveActiveExecutableArtifact(manifest, config, tmpDir);
    assert.strictEqual(emptyRoot.status, "missing");

    // Create a new artifacts root that contains the executable
    const newRoot = fs.mkdtempSync(path.join(os.tmpdir(), "new-artifacts-root-"));
    try {
      const exeDir = path.join(newRoot, "model-t");
      fs.mkdirSync(exeDir);
      fs.writeFileSync(path.join(exeDir, "firmware.elf"), "");

      const withNewRoot = resolveActiveExecutableArtifact(manifest, config, newRoot);
      assert.strictEqual(withNewRoot.status, "valid");
    } finally {
      fs.rmSync(newRoot, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Suite: package.json menu contributions for US2 (T016)
// ---------------------------------------------------------------------------

suite("Debug Launch – package.json US2 menu contributions (T016)", () => {
  test("commandPalette entry for tfTools.startDebugging uses tfTools.startDebuggingEnabled when-clause", () => {
    const pkg = getExtPackageJson();
    const menus = (pkg?.contributes as Record<string, unknown>)?.menus as Record<string, unknown>;
    const commandPalette = menus?.commandPalette as Array<{ command: string; when?: string }>;
    const entry = commandPalette?.find((c) => c.command === "tfTools.startDebugging");
    assert.ok(entry, "expected commandPalette entry for tfTools.startDebugging");
    assert.ok(
      entry.when?.includes("tfTools.startDebuggingEnabled"),
      `expected 'tfTools.startDebuggingEnabled' in when-clause, got: ${entry.when}`
    );
  });

  test("view/title has Start Debugging navigation entry for the configuration view", () => {
    const pkg = getExtPackageJson();
    const menus = (pkg?.contributes as Record<string, unknown>)?.menus as Record<string, unknown>;
    const viewTitle = menus?.["view/title"] as Array<Record<string, unknown>>;
    const navEntry = viewTitle?.find(
      (e) => e.command === "tfTools.startDebugging" && String(e.group ?? "").startsWith("navigation")
    );
    assert.ok(navEntry, "expected view/title navigation entry for tfTools.startDebugging");
    assert.ok(
      String(navEntry.when ?? "").includes("view == tfTools.configuration"),
      `expected view condition, got: ${navEntry.when}`
    );
    assert.ok(
      String(navEntry.enablement ?? "").includes("tfTools.startDebuggingEnabled"),
      `expected enablement via tfTools.startDebuggingEnabled, got: ${navEntry.enablement}`
    );
  });

  test("view/title has Start Debugging overflow entry for the configuration view", () => {
    const pkg = getExtPackageJson();
    const menus = (pkg?.contributes as Record<string, unknown>)?.menus as Record<string, unknown>;
    const viewTitle = menus?.["view/title"] as Array<Record<string, unknown>>;
    const overflowEntry = viewTitle?.find(
      (e) => e.command === "tfTools.startDebugging" && String(e.group ?? "").startsWith("overflow")
    );
    assert.ok(overflowEntry, "expected view/title overflow entry for tfTools.startDebugging");
    assert.ok(
      String(overflowEntry.enablement ?? "").includes("tfTools.startDebuggingEnabled"),
      `expected enablement, got: ${overflowEntry.enablement}`
    );
  });

  test("view/item/context Start Debugging entry targets artifact-executable contextValue", () => {
    const pkg = getExtPackageJson();
    const menus = (pkg?.contributes as Record<string, unknown>)?.menus as Record<string, unknown>;
    const itemContext = menus?.["view/item/context"] as Array<Record<string, unknown>>;
    const entry = itemContext?.find((e) => e.command === "tfTools.startDebugging");
    assert.ok(entry, "expected view/item/context entry for tfTools.startDebugging");
    assert.ok(
      String(entry.when ?? "").includes("viewItem == artifact-executable"),
      `expected 'viewItem == artifact-executable' in when-clause, got: ${entry.when}`
    );
  });
});
