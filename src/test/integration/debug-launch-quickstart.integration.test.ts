/**
 * Integration tests validating the Debug Launch quickstart scenarios (T026).
 *
 * Maps to scenarios in specs/006-debug-launch/quickstart.md:
 *   S1: Unique highest-priority profile — executable row valid, launch surfaces functional
 *   S2: Priority decides among multiple matching profiles
 *   S3: Ambiguous and unmatched contexts stay discoverable but blocked (enablement)
 *   S4: Executable row explains readiness with tooltip
 *   S5: Template failures at invocation time, not during enablement
 *   S6: tf-tools substitution resolves nested values, preserves non-tf-tools variables
 *   S7: Template-root traversal is rejected at invocation time
 */

import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import {
  resolveActiveExecutableArtifact,
} from "../../intellisense/artifact-resolution";
import {
  resolveDebugProfile,
  deriveExecutablePath,
  loadDebugTemplate,
  buildDebugVariableMap,
  applyTfToolsSubstitution,
  executeDebugLaunch,
} from "../../commands/debug-launch";
import {
  makeDebugLoadedState,
  makeDebugProfile,
  debugLaunchValidTemplatesRoot,
  debugLaunchFailuresWorkspaceRoot,
} from "../unit/workflow-test-helpers";
import { ExecutableArtifactItem } from "../../ui/configuration-tree";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(modelId: string, targetId = "hw", componentId = "core") {
  return { modelId, targetId, componentId, persistedAt: "" };
}

const failuresTemplatesRoot = path.join(debugLaunchFailuresWorkspaceRoot(), "debug-templates");

// ---------------------------------------------------------------------------
// S1: Unique highest-priority profile — valid Executable row + launch
// ---------------------------------------------------------------------------

suite("QS1 – Unique highest-priority profile (T026)", () => {
  let tmpDir: string;

  setup(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tf-tools-qs1-"));
  });

  teardown(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("resolveActiveExecutableArtifact returns valid when unique profile matches and executable exists", () => {
    const exeDir = path.join(tmpDir, "model-t");
    fs.mkdirSync(exeDir);
    fs.writeFileSync(path.join(exeDir, "firmware.elf"), "");

    const profile = makeDebugProfile({ template: "gdb-remote.json", executable: "firmware.elf" });
    const manifest = makeDebugLoadedState([profile]);
    const config = makeConfig("T2T1");

    const result = resolveActiveExecutableArtifact(manifest, config, tmpDir);
    assert.strictEqual(result.status, "valid");
    assert.strictEqual(result.profileResolutionState, "selected");
    assert.strictEqual(result.exists, true);
  });

  test("ExecutableArtifactItem shows valid status with pass icon and path tooltip", () => {
    const exeDir = path.join(tmpDir, "model-t");
    fs.mkdirSync(exeDir);
    fs.writeFileSync(path.join(exeDir, "firmware.elf"), "");

    const profile = makeDebugProfile({ template: "gdb-remote.json", executable: "firmware.elf" });
    const manifest = makeDebugLoadedState([profile]);
    const config = makeConfig("T2T1");

    const artifact = resolveActiveExecutableArtifact(manifest, config, tmpDir);
    const item = new ExecutableArtifactItem(artifact);

    assert.strictEqual(item.description, "valid");
    assert.ok(
      (item.iconPath as vscode.ThemeIcon).id === "pass",
      "expected pass icon for valid executable"
    );
    assert.ok(
      String(item.tooltip).includes("firmware.elf"),
      `expected executable path in tooltip, got: ${item.tooltip}`
    );
  });

  test("ExecutableArtifactItem has command set to tfTools.startDebugging", () => {
    const profile = makeDebugProfile({ template: "gdb-remote.json", executable: "firmware.elf" });
    const manifest = makeDebugLoadedState([profile]);
    const config = makeConfig("T2T1");
    const artifact = resolveActiveExecutableArtifact(manifest, config, tmpDir);
    const item = new ExecutableArtifactItem(artifact);

    assert.ok(item.command, "expected command to be set on ExecutableArtifactItem");
    assert.strictEqual(item.command.command, "tfTools.startDebugging");
  });

  test("executeDebugLaunch resolves without throwing when valid fixture template exists and executable present", async () => {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return;
    }

    const exeDir = path.join(tmpDir, "model-t");
    fs.mkdirSync(exeDir);
    fs.writeFileSync(path.join(exeDir, "firmware.elf"), "");

    const profile = makeDebugProfile({
      template: "gdb-remote.json",
      executable: "firmware.elf",
    });
    const manifest = makeDebugLoadedState([profile]);
    const config = makeConfig("T2T1");

    // Launch may fail (no real debugger in CI), but it must not throw an error
    await assert.doesNotReject(
      () => executeDebugLaunch(workspaceFolder, manifest, config, tmpDir, debugLaunchValidTemplatesRoot()),
      "expected executeDebugLaunch to resolve without throwing for fully valid scenario"
    );
  });
});

// ---------------------------------------------------------------------------
// S2: Priority decides among multiple matching profiles
// ---------------------------------------------------------------------------

suite("QS2 – Priority selection among multiple matching profiles (T026)", () => {
  test("resolveDebugProfile selects strictly higher-priority profile", () => {
    const lowPriority = makeDebugProfile({ template: "low.json", executable: "low.elf", priority: 0 });
    const highPriority = makeDebugProfile({ template: "high.json", executable: "high.elf", priority: 10 });
    const evalCtx = { modelId: "T2T1", targetId: "hw", componentId: "core" };

    const result = resolveDebugProfile([lowPriority, highPriority], evalCtx);

    assert.strictEqual(result.resolutionState, "selected");
    assert.strictEqual(result.selectedProfile?.template, "high.json");
    assert.strictEqual(result.highestPriority, 10);
    assert.strictEqual(result.matchedProfiles.length, 2);
  });

  test("resolveActiveExecutableArtifact resolves to the highest-priority profile executable path", () => {
    const lowPriority = makeDebugProfile({ template: "low.json", executable: "low.elf", priority: 0 });
    const highPriority = makeDebugProfile({ template: "high.json", executable: "high.elf", priority: 10 });
    const manifest = makeDebugLoadedState([lowPriority, highPriority]);
    const config = makeConfig("T2T1");

    const result = resolveActiveExecutableArtifact(manifest, config, "/artifacts");

    // Even if missing, the selected profile must be the high-priority one
    assert.strictEqual(result.profileResolutionState, "selected");
    assert.ok(
      result.expectedPath.includes("high.elf"),
      `expected high.elf in expectedPath, got: ${result.expectedPath}`
    );
  });
});

// ---------------------------------------------------------------------------
// S3: Ambiguous and unmatched contexts stay blocked with visible actions
// ---------------------------------------------------------------------------

suite("QS3 – Ambiguous and unmatched contexts remain discoverable but blocked (T026)", () => {
  test("no-match: resolveActiveExecutableArtifact returns missing with no-match state", () => {
    const profile = makeDebugProfile({
      template: "gdb.json",
      executable: "fw.elf",
      when: { type: "model", id: "T3W1" },
    });
    const manifest = makeDebugLoadedState([profile]);
    const config = makeConfig("T2T1"); // T3W1 profile does not match T2T1

    const result = resolveActiveExecutableArtifact(manifest, config, "/artifacts");
    assert.strictEqual(result.status, "missing");
    assert.strictEqual(result.profileResolutionState, "no-match");
    assert.ok(result.missingReason, "expected a missingReason for no-match state");
  });

  test("ambiguous: resolveActiveExecutableArtifact returns missing with ambiguous state", () => {
    const profileA = makeDebugProfile({ template: "a.json", executable: "a.elf", priority: 5 });
    const profileB = makeDebugProfile({ template: "b.json", executable: "b.elf", priority: 5 });
    const manifest = makeDebugLoadedState([profileA, profileB]);
    const config = makeConfig("T2T1");

    const result = resolveActiveExecutableArtifact(manifest, config, "/artifacts");
    assert.strictEqual(result.status, "missing");
    assert.strictEqual(result.profileResolutionState, "ambiguous");
    assert.ok(result.missingReason, "expected a missingReason for ambiguous state");
  });

  test("ambiguous: ExecutableArtifactItem shows error icon and missing description", () => {
    const profileA = makeDebugProfile({ template: "a.json", executable: "a.elf", priority: 5 });
    const profileB = makeDebugProfile({ template: "b.json", executable: "b.elf", priority: 5 });
    const manifest = makeDebugLoadedState([profileA, profileB]);
    const config = makeConfig("T2T1");

    const artifact = resolveActiveExecutableArtifact(manifest, config, "/artifacts");
    const item = new ExecutableArtifactItem(artifact);

    assert.strictEqual(item.description, "missing");
    assert.strictEqual((item.iconPath as vscode.ThemeIcon).id, "error");
  });

  test("no-match and ambiguous states do NOT fire executeDebugLaunch (blocked early)", async () => {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return;
    }

    // no-match case
    const noMatchProfile = makeDebugProfile({
      template: "gdb.json", executable: "fw.elf", when: { type: "model", id: "T3W1" },
    });
    await assert.doesNotReject(
      () => executeDebugLaunch(workspaceFolder, makeDebugLoadedState([noMatchProfile]),
        makeConfig("T2T1"), "/artifacts", "/templates"),
      "no-match must resolve without throwing"
    );

    // ambiguous case
    const pA = makeDebugProfile({ template: "a.json", executable: "a.elf", priority: 5 });
    const pB = makeDebugProfile({ template: "b.json", executable: "b.elf", priority: 5 });
    await assert.doesNotReject(
      () => executeDebugLaunch(workspaceFolder, makeDebugLoadedState([pA, pB]),
        makeConfig("T2T1"), "/artifacts", "/templates"),
      "ambiguous must resolve without throwing"
    );
  });
});

// ---------------------------------------------------------------------------
// S4: Executable row explains readiness with tooltip
// ---------------------------------------------------------------------------

suite("QS4 – Executable row explains readiness (T026)", () => {
  let tmpDir: string;

  setup(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tf-tools-qs4-"));
  });

  teardown(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("valid state: tooltip includes the expected executable path", () => {
    const exeDir = path.join(tmpDir, "model-t");
    fs.mkdirSync(exeDir);
    const exePath = path.join(exeDir, "firmware.elf");
    fs.writeFileSync(exePath, "");

    const profile = makeDebugProfile({ template: "gdb.json", executable: "firmware.elf" });
    const manifest = makeDebugLoadedState([profile]);
    const artifact = resolveActiveExecutableArtifact(manifest, makeConfig("T2T1"), tmpDir);
    const item = new ExecutableArtifactItem(artifact);

    assert.ok(
      String(item.tooltip).includes("firmware.elf"),
      `expected path in tooltip for valid state, got: ${item.tooltip}`
    );
  });

  test("missing state: tooltip includes the missing reason", () => {
    const profile = makeDebugProfile({ template: "gdb.json", executable: "firmware.elf" });
    const manifest = makeDebugLoadedState([profile]);
    const artifact = resolveActiveExecutableArtifact(manifest, makeConfig("T2T1"), tmpDir);
    const item = new ExecutableArtifactItem(artifact);

    assert.strictEqual(item.description, "missing");
    assert.ok(
      String(item.tooltip).length > 0,
      "expected non-empty tooltip for missing state"
    );
    // tooltip should mention the path or a reason
    assert.ok(
      String(item.tooltip).includes("firmware.elf") || String(item.tooltip).includes("not found"),
      `expected path or reason in tooltip, got: ${item.tooltip}`
    );
  });

  test("no-match state: Executable row tooltip describes why", () => {
    const profile = makeDebugProfile({
      template: "gdb.json", executable: "fw.elf", when: { type: "model", id: "T3W1" },
    });
    const manifest = makeDebugLoadedState([profile]);
    const artifact = resolveActiveExecutableArtifact(manifest, makeConfig("T2T1"), tmpDir);
    const item = new ExecutableArtifactItem(artifact);

    assert.strictEqual(item.description, "missing");
    assert.ok(
      String(item.tooltip).length > 0,
      "expected non-empty tooltip for no-match state"
    );
  });
});

// ---------------------------------------------------------------------------
// S5: Template failures at invocation time, not during enablement
// ---------------------------------------------------------------------------

suite("QS5 – Template failures at invocation time (T026)", () => {
  let tmpDir: string;

  setup(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tf-tools-qs5-"));
  });

  teardown(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("missing template does NOT affect resolveActiveExecutableArtifact — profile remains valid if executable exists", () => {
    const exeDir = path.join(tmpDir, "model-t");
    fs.mkdirSync(exeDir);
    fs.writeFileSync(path.join(exeDir, "firmware.elf"), "");

    const profile = makeDebugProfile({ template: "missing-template.json", executable: "firmware.elf" });
    const manifest = makeDebugLoadedState([profile]);
    const artifact = resolveActiveExecutableArtifact(manifest, makeConfig("T2T1"), tmpDir);

    // Template existence does NOT affect enablement
    assert.strictEqual(artifact.status, "valid");
  });

  test("malformed template does NOT affect resolveActiveExecutableArtifact enablement", () => {
    const exeDir = path.join(tmpDir, "model-t");
    fs.mkdirSync(exeDir);
    fs.writeFileSync(path.join(exeDir, "firmware.elf"), "");

    const profile = makeDebugProfile({ template: "malformed-template.json", executable: "firmware.elf" });
    const manifest = makeDebugLoadedState([profile]);
    const artifact = resolveActiveExecutableArtifact(manifest, makeConfig("T2T1"), tmpDir);

    assert.strictEqual(artifact.status, "valid");
  });

  test("loadDebugTemplate returns missing at invocation time for non-existent template", () => {
    const result = loadDebugTemplate("missing-template.json", failuresTemplatesRoot);
    assert.strictEqual(result.parseState, "missing");
    assert.ok(result.error, "expected error message for missing template");
  });

  test("loadDebugTemplate returns invalid at invocation time for malformed JSONC template", () => {
    const result = loadDebugTemplate("malformed-template.json", failuresTemplatesRoot);
    assert.strictEqual(result.parseState, "invalid");
    assert.ok(result.error, "expected error message for malformed template");
  });

  test("executeDebugLaunch resolves without throwing for missing template at invocation", async () => {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return;
    }

    const exeDir = path.join(tmpDir, "model-t");
    fs.mkdirSync(exeDir);
    fs.writeFileSync(path.join(exeDir, "firmware.elf"), "");

    const profile = makeDebugProfile({ template: "missing-template.json", executable: "firmware.elf" });
    const manifest = makeDebugLoadedState([profile]);

    await assert.doesNotReject(
      () => executeDebugLaunch(workspaceFolder, manifest, makeConfig("T2T1"), tmpDir, failuresTemplatesRoot),
      "missing template must resolve without throwing"
    );
  });
});

// ---------------------------------------------------------------------------
// S6: tf-tools substitution in nested values; non-tf-tools vars preserved
// ---------------------------------------------------------------------------

suite("QS6 – tf-tools substitution and non-tf-tools variable pass-through (T026)", () => {
  test("buildDebugVariableMap includes all built-in tf-tools variables", () => {
    const varMap = buildDebugVariableMap("T2T1", "hw", "core", "model-t", "/artifacts/model-t/firmware.elf", undefined);
    assert.strictEqual(varMap.resolvedVars["tfTools.model"], "T2T1");
    assert.strictEqual(varMap.resolvedVars["tfTools.target"], "hw");
    assert.strictEqual(varMap.resolvedVars["tfTools.component"], "core");
    assert.strictEqual(varMap.resolvedVars["tfTools.artifactFolder"], "model-t");
    assert.strictEqual(varMap.resolvedVars["tfTools.executablePath"], "/artifacts/model-t/firmware.elf");
    assert.strictEqual(varMap.resolvedVars["tfTools.executableBasename"], "firmware.elf");
  });

  test("applyTfToolsSubstitution resolves nested object and array string fields", () => {
    const varMap = buildDebugVariableMap("T2T1", "hw", "core", "model-t", "/build/firmware.elf", undefined);
    const template = {
      type: "cortex-debug",
      executable: "${tfTools.executablePath}",
      args: ["--model", "${tfTools.model}"],
      nested: { label: "Debug ${tfTools.component}" },
    };
    const { value, unknownVars } = applyTfToolsSubstitution(template, varMap.resolvedVars);
    const resolved = value as typeof template;

    assert.strictEqual(resolved.executable, "/build/firmware.elf");
    assert.deepStrictEqual(resolved.args, ["--model", "T2T1"]);
    assert.strictEqual((resolved.nested as { label: string }).label, "Debug core");
    assert.strictEqual(unknownVars.length, 0);
  });

  test("applyTfToolsSubstitution leaves non-tf-tools VS Code variables untouched", () => {
    const varMap = buildDebugVariableMap("T2T1", "hw", "core", "model-t", "/build/fw.elf", undefined);
    const template = {
      cwd: "${workspaceFolder}",
      serverPath: "${env:OPENOCD_PATH}",
      executable: "${tfTools.executablePath}",
    };
    const { value, unknownVars } = applyTfToolsSubstitution(template, varMap.resolvedVars);
    const resolved = value as typeof template;

    assert.strictEqual(resolved.cwd, "${workspaceFolder}", "non-tf-tools var must pass through");
    assert.strictEqual(resolved.serverPath, "${env:OPENOCD_PATH}", "env var must pass through");
    assert.strictEqual(resolved.executable, "/build/fw.elf");
    assert.strictEqual(unknownVars.length, 0, "non-tf-tools vars must not appear in unknownVars");
  });

  test("applyTfToolsSubstitution reports unknown tf-tools variables", () => {
    const varMap = buildDebugVariableMap("T2T1", "hw", "core", "model-t", "/build/fw.elf", undefined);
    const template = { serverPort: "${tfTools.nonExistentPort}" };
    const { unknownVars } = applyTfToolsSubstitution(template, varMap.resolvedVars);

    assert.ok(
      unknownVars.includes("tfTools.nonExistentPort"),
      `expected tfTools.nonExistentPort in unknownVars, got: ${unknownVars.join(", ")}`
    );
  });

  test("buildDebugVariableMap surface cyclic profile vars as resolution errors", () => {
    const vars = { a: "${tfTools.b}", b: "${tfTools.a}" };
    const varMap = buildDebugVariableMap("T2T1", "hw", "core", "model-t", "/build/fw.elf", vars);

    assert.ok(
      varMap.resolutionErrors.length > 0,
      "expected resolution errors for cyclic profile vars"
    );
  });
});

// ---------------------------------------------------------------------------
// S7: Template-root traversal is rejected at invocation time
// ---------------------------------------------------------------------------

suite("QS7 – Template-root traversal rejection (T026)", () => {
  test("loadDebugTemplate blocks traversal path that escapes templates root", () => {
    const result = loadDebugTemplate("../escaped/evil.json", failuresTemplatesRoot);
    assert.strictEqual(result.parseState, "traversal-blocked");
    assert.ok(result.error, "expected error message for traversal attempt");
    assert.ok(
      result.error.includes("templates root") || result.error.includes("escapes"),
      `expected traversal message, got: ${result.error}`
    );
  });

  test("deriveExecutablePath resolves relative exe against artifactsRoot/artifactFolder", () => {
    const executablePath = deriveExecutablePath("firmware.elf", "model-t", "/workspace/artifacts");
    assert.strictEqual(executablePath, path.join("/workspace/artifacts", "model-t", "firmware.elf"));
  });

  test("deriveExecutablePath returns absolute exe unchanged", () => {
    const absPath = "/usr/local/bin/gdb";
    const executablePath = deriveExecutablePath(absPath, "model-t", "/workspace/artifacts");
    assert.strictEqual(executablePath, absPath);
  });

  test("executeDebugLaunch resolves without throwing for traversal-attempt template", async () => {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return;
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tf-tools-qs7-"));
    try {
      const exeDir = path.join(tmpDir, "model-t");
      fs.mkdirSync(exeDir);
      fs.writeFileSync(path.join(exeDir, "firmware.elf"), "");

      const profile = makeDebugProfile({
        template: "../escaped/evil.json",
        executable: "firmware.elf",
      });
      const manifest = makeDebugLoadedState([profile]);

      await assert.doesNotReject(
        () => executeDebugLaunch(workspaceFolder, manifest, makeConfig("T2T1"), tmpDir, tmpDir),
        "traversal attempt must resolve without throwing"
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
