/**
 * Integration tests for Debug Launch – User Story 1 (T011).
 *
 * Covers:
 *  - resolveActiveExecutableArtifact returns "valid" when executable exists on disk
 *  - resolveActiveExecutableArtifact returns "selected" profile state for a unique match
 *  - loadDebugTemplate loads the valid workspace fixture template successfully
 *  - buildDebugVariableMap + applyTfToolsSubstitution produce the expected resolved config
 *  - Non-tf-tools variables in the template pass through unchanged after substitution
 *  - tfTools.startDebugging is registered as a VS Code command after activation
 *  - Executing tfTools.startDebugging in unsupported-workspace state resolves without throwing
 *  - package.json commandPalette entry for tfTools.startDebugging uses tfTools.startDebuggingEnabled
 */

import * as assert from "assert";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import * as vscode from "vscode";
import {
  resolveActiveExecutableArtifact,
} from "../../intellisense/artifact-resolution";
import {
  loadDebugTemplate,
  buildDebugVariableMap,
  applyTfToolsSubstitution,
} from "../../commands/debug-launch";
import {
  makeDebugLoadedState,
  makeDebugProfile,
  debugLaunchValidTemplatesRoot,
} from "../unit/workflow-test-helpers";

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

function getExtPackageJson(): Record<string, unknown> {
  const ext = vscode.extensions.getExtension("cepetr.tf-tools");
  assert.ok(ext, "cepetr.tf-tools extension must be present");
  return ext.packageJSON as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Suite: resolveActiveExecutableArtifact filesystem integration
// ---------------------------------------------------------------------------

suite("Debug Launch – resolveActiveExecutableArtifact filesystem integration (T011)", () => {
  let tmpDir: string;

  setup(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tf-tools-debug-test-"));
  });

  teardown(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("returns status: valid when unique profile resolves and executable exists", () => {
    // Create the expected executable under the artifacts root
    const artifactFolder = "model-t";
    const executableName = "firmware.elf";
    const execDir = path.join(tmpDir, artifactFolder);
    fs.mkdirSync(execDir, { recursive: true });
    fs.writeFileSync(path.join(execDir, executableName), "");

    const profile = makeDebugProfile({
      template: "gdb-remote.json",
      executable: executableName,
      when: { type: "model", id: "T2T1" },
    });
    const manifest = makeDebugLoadedState([profile]);
    const config = { modelId: "T2T1", targetId: "hw", componentId: "core", persistedAt: "" };

    const result = resolveActiveExecutableArtifact(manifest, config, tmpDir);
    assert.strictEqual(result.status, "valid");
    assert.strictEqual(result.profileResolutionState, "selected");
    assert.strictEqual(result.exists, true);
    assert.ok(result.expectedPath.endsWith(executableName));
  });

  test("returns status: missing when executable file does not exist", () => {
    const profile = makeDebugProfile({
      template: "gdb-remote.json",
      executable: "firmware.elf",
      when: { type: "model", id: "T2T1" },
    });
    const manifest = makeDebugLoadedState([profile]);
    const config = { modelId: "T2T1", targetId: "hw", componentId: "core", persistedAt: "" };

    const result = resolveActiveExecutableArtifact(manifest, config, tmpDir);
    assert.strictEqual(result.status, "missing");
    assert.strictEqual(result.profileResolutionState, "selected");
    assert.strictEqual(result.exists, false);
  });

  test("returns status: missing with no-match when no profile matches the active context", () => {
    const profile = makeDebugProfile({
      template: "gdb-remote.json",
      executable: "firmware.elf",
      when: { type: "model", id: "T3W1" }, // different model
    });
    const manifest = makeDebugLoadedState([profile]);
    const config = { modelId: "T2T1", targetId: "hw", componentId: "core", persistedAt: "" };

    const result = resolveActiveExecutableArtifact(manifest, config, tmpDir);
    assert.strictEqual(result.status, "missing");
    assert.strictEqual(result.profileResolutionState, "no-match");
  });

  test("returns status: missing with ambiguous when two profiles tie at highest priority", () => {
    const a = makeDebugProfile({ template: "a.json", executable: "fw_a.elf", priority: 10 });
    const b = makeDebugProfile({ template: "b.json", executable: "fw_b.elf", priority: 10 });
    const manifest = makeDebugLoadedState([a, b]);
    const config = { modelId: "T2T1", targetId: "hw", componentId: "core", persistedAt: "" };

    const result = resolveActiveExecutableArtifact(manifest, config, tmpDir);
    assert.strictEqual(result.status, "missing");
    assert.strictEqual(result.profileResolutionState, "ambiguous");
    assert.ok(result.missingReason?.includes("ambiguous") || result.missingReason?.includes("tied"),
      `expected ambiguous reason, got: ${result.missingReason}`);
  });

  test("returns status: missing with manifest-invalid when hasDebugBlockingIssues is true", () => {
    const manifest = makeDebugLoadedState([], { hasDebugBlockingIssues: true });
    const config = { modelId: "T2T1", targetId: "hw", componentId: "core", persistedAt: "" };

    const result = resolveActiveExecutableArtifact(manifest, config, tmpDir);
    assert.strictEqual(result.status, "missing");
    assert.strictEqual(result.profileResolutionState, "manifest-invalid");
  });

  test("absolute executable path is used unchanged irrespective of artifactsRoot", () => {
    const absoluteExe = path.join(tmpDir, "absolute-firmware.elf");
    fs.writeFileSync(absoluteExe, "");

    const profile = makeDebugProfile({
      template: "gdb-remote.json",
      executable: absoluteExe, // absolute path
    });
    const manifest = makeDebugLoadedState([profile]);
    const config = { modelId: "T2T1", targetId: "hw", componentId: "core", persistedAt: "" };
    // Use a different artifactsRoot — should not affect resolution of absolute path
    const result = resolveActiveExecutableArtifact(manifest, config, "/some/other/path");
    assert.strictEqual(result.status, "valid");
    assert.strictEqual(result.expectedPath, absoluteExe);
  });
});

// ---------------------------------------------------------------------------
// Suite: template loading integration
// ---------------------------------------------------------------------------

suite("Debug Launch – loadDebugTemplate integration (T011)", () => {
  const templatesRoot = debugLaunchValidTemplatesRoot();

  test("gdb-remote.json template loads successfully from the fixture", () => {
    const result = loadDebugTemplate("gdb-remote.json", templatesRoot);
    assert.strictEqual(result.parseState, "loaded", `expected loaded, got: ${result.error}`);
    const cfg = result.configuration!;
    assert.ok(cfg, "expected a configuration object");
    assert.strictEqual(cfg.type, "gdb");
    assert.strictEqual(cfg.request, "launch");
  });

  test("template is read fresh on each call (per-invocation reload)", () => {
    const first = loadDebugTemplate("gdb-remote.json", templatesRoot);
    const second = loadDebugTemplate("gdb-remote.json", templatesRoot);
    assert.strictEqual(first.parseState, "loaded");
    assert.strictEqual(second.parseState, "loaded");
    // Both should produce equivalent content
    assert.deepStrictEqual(first.configuration, second.configuration);
  });
});

// ---------------------------------------------------------------------------
// Suite: end-to-end substitution integration
// ---------------------------------------------------------------------------

suite("Debug Launch – substitution pipeline integration (T011)", () => {
  const templatesRoot = debugLaunchValidTemplatesRoot();

  test("tf-tools variables in gdb-remote.json template are substituted correctly", () => {
    const templateResult = loadDebugTemplate("gdb-remote.json", templatesRoot);
    assert.strictEqual(templateResult.parseState, "loaded");

    const varMap = buildDebugVariableMap(
      "T2T1",
      "hw",
      "core",
      "model-t",
      "/build/model-t/firmware.elf",
      undefined
    );
    assert.strictEqual(varMap.resolutionErrors.length, 0);

    const { value, unknownVars } = applyTfToolsSubstitution(
      templateResult.configuration,
      varMap.resolvedVars
    );
    assert.strictEqual(unknownVars.length, 0, `unexpected unknown vars: ${unknownVars.join(", ")}`);

    const cfg = value as Record<string, unknown>;
    assert.strictEqual(cfg.name, "Debug T2T1 core");
    assert.strictEqual(cfg.program, "/build/model-t/firmware.elf");
  });

  test("non-tf-tools variables in gdb-remote.json are left unchanged", () => {
    const templateResult = loadDebugTemplate("gdb-remote.json", templatesRoot);
    assert.strictEqual(templateResult.parseState, "loaded");

    const varMap = buildDebugVariableMap("T2T1", "hw", "core", "model-t", "/build/firmware.elf", undefined);
    const { value } = applyTfToolsSubstitution(templateResult.configuration, varMap.resolvedVars);
    const cfg = value as Record<string, unknown>;

    // ${workspaceFolder} is a non-tf-tools variable and must pass through unchanged
    assert.strictEqual(cfg.cwd, "${workspaceFolder}");
  });

  test("nested array environment values are substituted correctly", () => {
    const templateResult = loadDebugTemplate("gdb-remote.json", templatesRoot);
    assert.strictEqual(templateResult.parseState, "loaded");

    const varMap = buildDebugVariableMap("T2T1", "hw", "core", "model-t", "/build/firmware.elf", undefined);
    const { value } = applyTfToolsSubstitution(templateResult.configuration, varMap.resolvedVars);
    const cfg = value as { environment: Array<{ name: string; value: string }> };
    const targetEnv = cfg.environment.find((e) => e.name === "TARGET");
    assert.ok(targetEnv, "expected TARGET environment entry");
    assert.strictEqual(targetEnv.value, "hw");
  });

  test("profile vars are resolved and substituted into template strings", () => {
    const templateResult = loadDebugTemplate("gdb-remote.json", templatesRoot);
    assert.strictEqual(templateResult.parseState, "loaded");

    const profile = makeDebugProfile({
      template: "gdb-remote.json",
      executable: "firmware.elf",
      vars: { debugPort: "3333" },
    });
    const varMap = buildDebugVariableMap(
      "T2T1", "hw", "core", "model-t", "/build/firmware.elf", profile.vars
    );
    assert.strictEqual(varMap.resolvedVars["tfTools.debugPort"], "3333");
    assert.strictEqual(varMap.resolutionErrors.length, 0);
  });
});

// ---------------------------------------------------------------------------
// Suite: command registration (requires T014)
// ---------------------------------------------------------------------------

suite("Debug Launch – command registration (T011)", () => {
  test("extension activates without error", async () => {
    const activated = await activateExtension();
    assert.strictEqual(activated, true, "expected extension to activate");
  });

  test("tfTools.startDebugging is registered as a VS Code command", async () => {
    await activateExtension();
    const cmds = await vscode.commands.getCommands(false);
    assert.ok(
      cmds.includes("tfTools.startDebugging"),
      "expected 'tfTools.startDebugging' to be registered in VS Code commands"
    );
  });

  test("executing tfTools.startDebugging in unsupported-workspace state resolves without throwing", async () => {
    await activateExtension();
    let threw = false;
    try {
      await vscode.commands.executeCommand("tfTools.startDebugging");
    } catch {
      threw = true;
    }
    assert.strictEqual(threw, false, "tfTools.startDebugging must not throw");
  });
});

// ---------------------------------------------------------------------------
// Suite: package.json contributions (requires T012)
// ---------------------------------------------------------------------------

suite("Debug Launch – package.json contributions (T011)", () => {
  test("tfTools.startDebugging command is listed in package.json contributions", () => {
    const pkg = getExtPackageJson();
    const commands = (pkg.contributes as { commands: Array<{ command: string }> }).commands;
    const entry = commands.find((c) => c.command === "tfTools.startDebugging");
    assert.ok(entry, "expected tfTools.startDebugging in package.json commands");
  });

  test("commandPalette entry for tfTools.startDebugging uses tfTools.startDebuggingEnabled", () => {
    const pkg = getExtPackageJson();
    const menus = pkg.contributes as { menus: Record<string, unknown[]> };
    const paletteEntries = (menus.menus["commandPalette"] ?? []) as Array<{
      command: string;
      when?: string;
    }>;
    const entry = paletteEntries.find((e) => e.command === "tfTools.startDebugging");
    assert.ok(entry, "expected commandPalette entry for tfTools.startDebugging");
    assert.strictEqual(
      entry.when,
      "tfTools.startDebuggingEnabled",
      "startDebugging palette entry must use when: tfTools.startDebuggingEnabled"
    );
  });

  test("view/title has Start Debugging entry for Configuration view header", () => {
    const pkg = getExtPackageJson();
    const menus = pkg.contributes as { menus: Record<string, unknown[]> };
    const titleEntries = (menus.menus["view/title"] ?? []) as Array<{
      command: string;
      when?: string;
      group?: string;
    }>;
    const entry = titleEntries.find(
      (e) => e.command === "tfTools.startDebugging" && e.when?.includes("activeViewlet")
    );
    assert.ok(entry, "expected view/title entry for tfTools.startDebugging header action");
  });

  test("view/item/context has Start Debugging entry for Executable row", () => {
    const pkg = getExtPackageJson();
    const menus = pkg.contributes as { menus: Record<string, unknown[]> };
    const contextEntries = (menus.menus["view/item/context"] ?? []) as Array<{
      command: string;
      when?: string;
    }>;
    const entry = contextEntries.find(
      (e) => e.command === "tfTools.startDebugging" && e.when?.includes("artifact-executable")
    );
    assert.ok(entry, "expected view/item/context entry for tfTools.startDebugging on Executable row");
  });
});
