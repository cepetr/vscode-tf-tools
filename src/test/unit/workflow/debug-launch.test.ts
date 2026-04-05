/**
 * Unit tests for Debug Launch core helpers.
 *
 * Covers:
 *  - resolveDebugProfile: no-when matches all, conditional when, priority wins,
 *    equal-priority ambiguity, no-match result
 *  - deriveExecutablePath: relative resolved against artifactsRoot/artifactFolder,
 *    absolute paths returned unchanged
 *  - loadDebugTemplate: valid JSONC loads, traversal blocked, missing file,
 *    malformed JSONC invalid, per-invocation fresh read
 *  - buildDebugVariableMap: built-in variables, profile vars referencing builtIns
 *    and each other, cyclic vars produce resolutionErrors, unknown tf-tools vars
 *    produce resolutionErrors
 *  - applyTfToolsSubstitution: single-pass replacement, nested objects and arrays,
 *    non-tf-tools variables left unchanged, unknown tf-tools tokens collected,
 *    non-string values pass through unchanged
 */

import * as assert from "assert";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import {
  resolveDebugProfile,
  deriveExecutablePath,
  loadDebugTemplate,
  buildDebugVariableMap,
  applyTfToolsSubstitution,
  TFTOOLS_VAR_MODEL,
  TFTOOLS_VAR_TARGET,
  TFTOOLS_VAR_COMPONENT,
  TFTOOLS_VAR_ARTIFACT_FOLDER,
  TFTOOLS_VAR_EXECUTABLE_PATH,
  TFTOOLS_VAR_EXECUTABLE_BASENAME,
} from "../../../commands/debug-launch";
import { makeDebugProfile, debugLaunchValidTemplatesRoot, debugLaunchFailuresWorkspaceRoot } from "../workflow-test-helpers";

/**
 * Returns a debug profile with required fields defaulted for tests that
 * only care about when/priority/id, not template/executable.
 */
function makeProfile(overrides: Partial<import("../../../manifest/manifest-types").ManifestDebugProfile> = {}) {
  return makeDebugProfile({
    template: "gdb-remote.json",
    executable: "firmware.elf",
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// resolveDebugProfile
// ---------------------------------------------------------------------------

suite("resolveDebugProfile", () => {
  const ctx = { modelId: "T2T1", targetId: "hw", componentId: "core" };

  test("profile without when matches any context", () => {
    const profile = makeProfile({ id: "p1" }); // no when
    const result = resolveDebugProfile([profile], ctx);
    assert.strictEqual(result.resolutionState, "selected");
    assert.strictEqual(result.selectedProfile, profile);
  });

  test("profile with matching when selects that profile", () => {
    const profile = makeProfile({ id: "p1", when: { type: "model", id: "T2T1" } });
    const result = resolveDebugProfile([profile], ctx);
    assert.strictEqual(result.resolutionState, "selected");
  });

  test("profile with non-matching when is excluded", () => {
    const profile = makeProfile({ id: "p1", when: { type: "model", id: "T3W1" } });
    const result = resolveDebugProfile([profile], ctx);
    assert.strictEqual(result.resolutionState, "no-match");
  });

  test("highest priority wins among matching profiles", () => {
    const low = makeProfile({ id: "low", priority: 5 });
    const high = makeProfile({ id: "high", priority: 10 });
    const result = resolveDebugProfile([low, high], ctx);
    assert.strictEqual(result.resolutionState, "selected");
    assert.strictEqual(result.selectedProfile?.id, "high");
    assert.strictEqual(result.highestPriority, 10);
  });

  test("equal highest priority returns ambiguous", () => {
    const a = makeProfile({ id: "a", priority: 10 });
    const b = makeProfile({ id: "b", priority: 10 });
    const result = resolveDebugProfile([a, b], ctx);
    assert.strictEqual(result.resolutionState, "ambiguous");
    assert.strictEqual(result.selectedProfile, undefined);
    assert.strictEqual(result.matchedProfiles.length, 2);
  });

  test("no matching profiles returns no-match", () => {
    const profile = makeProfile({ id: "p1", when: { type: "target", id: "emu" } });
    const result = resolveDebugProfile([profile], ctx);
    assert.strictEqual(result.resolutionState, "no-match");
    assert.strictEqual(result.matchedProfiles.length, 0);
  });

  test("lower-priority profile is excluded when higher-priority match exists", () => {
    const low = makeProfile({ id: "low", priority: 0, when: { type: "model", id: "T2T1" } });
    const high = makeProfile({ id: "high", priority: 20, when: { type: "model", id: "T2T1" } });
    const nonMatch = makeProfile({ id: "none", priority: 50, when: { type: "model", id: "T3W1" } });
    const result = resolveDebugProfile([low, high, nonMatch], ctx);
    assert.strictEqual(result.resolutionState, "selected");
    assert.strictEqual(result.selectedProfile?.id, "high");
    assert.strictEqual(result.matchedProfiles.length, 2); // low + high match, nonMatch does not
  });

  test("empty profiles list returns no-match", () => {
    const result = resolveDebugProfile([], ctx);
    assert.strictEqual(result.resolutionState, "no-match");
  });
});

// ---------------------------------------------------------------------------
// deriveExecutablePath
// ---------------------------------------------------------------------------

suite("deriveExecutablePath", () => {
  test("relative executable resolves to artifactsRoot/artifactFolder/executable", () => {
    const result = deriveExecutablePath("firmware.elf", "model-t", "/build");
    assert.strictEqual(result, path.join("/build", "model-t", "firmware.elf"));
  });

  test("absolute executable path is returned unchanged", () => {
    const abs = "/opt/firmware/firmware.elf";
    const result = deriveExecutablePath(abs, "model-t", "/build");
    assert.strictEqual(result, abs);
  });

  test("relative executable with subdirectory resolves correctly", () => {
    const result = deriveExecutablePath("sub/dir/firmware.elf", "model-t", "/build");
    assert.strictEqual(result, path.join("/build", "model-t", "sub", "dir", "firmware.elf"));
  });
});

// ---------------------------------------------------------------------------
// loadDebugTemplate
// ---------------------------------------------------------------------------

suite("loadDebugTemplate", () => {
  const validTemplatesRoot = debugLaunchValidTemplatesRoot();
  const failuresTemplatesRoot = path.join(debugLaunchFailuresWorkspaceRoot(), "debug-templates");

  test("valid JSONC template loads as an object", () => {
    const result = loadDebugTemplate("gdb-remote.json", validTemplatesRoot);
    assert.strictEqual(result.parseState, "loaded");
    assert.ok(result.configuration, "expected configuration object");
    assert.strictEqual(typeof result.configuration, "object");
    assert.strictEqual(result.configuration?.type, "gdb");
  });

  test("valid template contains expected fields", () => {
    const result = loadDebugTemplate("gdb-remote.json", validTemplatesRoot);
    assert.strictEqual(result.parseState, "loaded");
    const cfg = result.configuration!;
    assert.strictEqual(cfg.request, "launch");
    assert.strictEqual(cfg.program, "${tfTools.executablePath}");
  });

  test("traversal-escaped path returns traversal-blocked", () => {
    const result = loadDebugTemplate("../escaped/template.json", validTemplatesRoot);
    assert.strictEqual(result.parseState, "traversal-blocked");
    assert.ok(result.error?.includes("escapes"), `expected escapes message, got: ${result.error}`);
  });

  test("deeply nested traversal path returns traversal-blocked", () => {
    const result = loadDebugTemplate("sub/../../escaped.json", validTemplatesRoot);
    assert.strictEqual(result.parseState, "traversal-blocked");
  });

  test("missing template file returns missing", () => {
    const result = loadDebugTemplate("does-not-exist.json", validTemplatesRoot);
    assert.strictEqual(result.parseState, "missing");
    assert.ok(result.error?.toLowerCase().includes("not found"));
  });

  test("malformed JSONC returns invalid", () => {
    const result = loadDebugTemplate("malformed-template.json", failuresTemplatesRoot);
    assert.strictEqual(result.parseState, "invalid");
    assert.ok(result.error?.includes("parse error") || result.error?.includes("Parse error"),
      `expected parse error message, got: ${result.error}`);
  });

  test("per-invocation: each call reads from disk independently", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tf-tools-test-"));
    const templatePath = path.join(tmpDir, "test.json");
    try {
      fs.writeFileSync(templatePath, '{"type":"gdb","request":"launch"}');
      const first = loadDebugTemplate("test.json", tmpDir);
      assert.strictEqual(first.parseState, "loaded");
      assert.strictEqual(first.configuration?.type, "gdb");

      // Modify file and reload — should reflect the change
      fs.writeFileSync(templatePath, '{"type":"dap","request":"launch"}');
      const second = loadDebugTemplate("test.json", tmpDir);
      assert.strictEqual(second.parseState, "loaded");
      assert.strictEqual(second.configuration?.type, "dap");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("template that is not a single object returns invalid", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tf-tools-test-"));
    const templatePath = path.join(tmpDir, "array.json");
    try {
      fs.writeFileSync(templatePath, '[{"type":"gdb"}]');
      const result = loadDebugTemplate("array.json", tmpDir);
      assert.strictEqual(result.parseState, "invalid");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// buildDebugVariableMap
// ---------------------------------------------------------------------------

suite("buildDebugVariableMap", () => {
  const modelId = "T2T1";
  const targetId = "hw";
  const componentId = "core";
  const artifactFolder = "model-t";
  const executablePath = "/build/model-t/firmware.elf";

  test("built-in variables are always populated", () => {
    const map = buildDebugVariableMap(modelId, targetId, componentId, artifactFolder, executablePath, undefined);
    assert.strictEqual(map.builtIns[TFTOOLS_VAR_MODEL], "T2T1");
    assert.strictEqual(map.builtIns[TFTOOLS_VAR_TARGET], "hw");
    assert.strictEqual(map.builtIns[TFTOOLS_VAR_COMPONENT], "core");
    assert.strictEqual(map.builtIns[TFTOOLS_VAR_ARTIFACT_FOLDER], "model-t");
    assert.strictEqual(map.builtIns[TFTOOLS_VAR_EXECUTABLE_PATH], executablePath);
    assert.strictEqual(map.builtIns[TFTOOLS_VAR_EXECUTABLE_BASENAME], "firmware.elf");
  });

  test("resolvedVars contains all built-ins when no profile vars", () => {
    const map = buildDebugVariableMap(modelId, targetId, componentId, artifactFolder, executablePath, undefined);
    assert.strictEqual(map.resolvedVars[TFTOOLS_VAR_MODEL], "T2T1");
    assert.strictEqual(map.resolutionErrors.length, 0);
  });

  test("profile vars referencing built-ins are resolved", () => {
    const vars = { debugLabel: "debug-${tfTools.model}-${tfTools.target}" };
    const map = buildDebugVariableMap(modelId, targetId, componentId, artifactFolder, executablePath, vars);
    assert.strictEqual(map.resolvedVars["tfTools.debugLabel"], "debug-T2T1-hw");
    assert.strictEqual(map.resolutionErrors.length, 0);
  });

  test("profile vars referencing other profile vars are resolved", () => {
    const vars = {
      port: "3333",
      serverArg: "--port ${tfTools.port}",
    };
    const map = buildDebugVariableMap(modelId, targetId, componentId, artifactFolder, executablePath, vars);
    assert.strictEqual(map.resolvedVars["tfTools.port"], "3333");
    assert.strictEqual(map.resolvedVars["tfTools.serverArg"], "--port 3333");
    assert.strictEqual(map.resolutionErrors.length, 0);
  });

  test("cyclic profile vars produce a resolution error", () => {
    const vars = {
      a: "${tfTools.b}",
      b: "${tfTools.a}",
    };
    const map = buildDebugVariableMap(modelId, targetId, componentId, artifactFolder, executablePath, vars);
    assert.ok(map.resolutionErrors.length > 0, "expected cycle error");
    assert.ok(
      map.resolutionErrors.some((e) => e.toLowerCase().includes("cyclic")),
      `expected cyclic error, got: ${map.resolutionErrors.join(", ")}`
    );
  });

  test("unknown tf-tools variable in profile var produces a resolution error", () => {
    const vars = { x: "${tfTools.nonExistent}" };
    const map = buildDebugVariableMap(modelId, targetId, componentId, artifactFolder, executablePath, vars);
    assert.ok(map.resolutionErrors.length > 0, "expected unknown var error");
    assert.ok(
      map.resolutionErrors.some((e) => e.includes("nonExistent")),
      `expected nonExistent in error, got: ${map.resolutionErrors.join(", ")}`
    );
  });

  test("executableBasename is derived from executablePath basename", () => {
    const map = buildDebugVariableMap(modelId, targetId, componentId, artifactFolder, "/a/b/c/my-firmware.elf", undefined);
    assert.strictEqual(map.resolvedVars[TFTOOLS_VAR_EXECUTABLE_BASENAME], "my-firmware.elf");
  });
});

// ---------------------------------------------------------------------------
// applyTfToolsSubstitution
// ---------------------------------------------------------------------------

suite("applyTfToolsSubstitution", () => {
  const resolvedVars: Readonly<Record<string, string>> = {
    "tfTools.model": "T2T1",
    "tfTools.executablePath": "/build/firmware.elf",
    "tfTools.executableBasename": "firmware.elf",
  };

  test("replaces a tf-tools token in a plain string", () => {
    const { value, unknownVars } = applyTfToolsSubstitution("${tfTools.model}", resolvedVars);
    assert.strictEqual(value, "T2T1");
    assert.strictEqual(unknownVars.length, 0);
  });

  test("replaces multiple tf-tools tokens in a string", () => {
    const { value } = applyTfToolsSubstitution(
      "Debug ${tfTools.model}: ${tfTools.executablePath}",
      resolvedVars
    );
    assert.strictEqual(value, "Debug T2T1: /build/firmware.elf");
  });

  test("non-tf-tools variable syntax is left unchanged", () => {
    const { value, unknownVars } = applyTfToolsSubstitution(
      "${workspaceFolder}/scripts/${tfTools.model}.sh",
      resolvedVars
    );
    assert.strictEqual(value, "${workspaceFolder}/scripts/T2T1.sh");
    assert.strictEqual(unknownVars.length, 0);
  });

  test("unknown tf-tools token is reported in unknownVars", () => {
    const { value, unknownVars } = applyTfToolsSubstitution(
      "${tfTools.unknownVar}",
      resolvedVars
    );
    assert.ok(unknownVars.includes("tfTools.unknownVar"), "expected unknownVar recorded");
    // Token left in place since it was unknown
    assert.strictEqual(value, "${tfTools.unknownVar}");
  });

  test("nested object string fields are all substituted", () => {
    const template = {
      name: "Debug ${tfTools.model}",
      program: "${tfTools.executablePath}",
      nested: {
        label: "label-${tfTools.model}",
      },
    };
    const { value, unknownVars } = applyTfToolsSubstitution(template, resolvedVars);
    const result = value as typeof template;
    assert.strictEqual(result.name, "Debug T2T1");
    assert.strictEqual(result.program, "/build/firmware.elf");
    assert.strictEqual(result.nested.label, "label-T2T1");
    assert.strictEqual(unknownVars.length, 0);
  });

  test("array string elements are all substituted", () => {
    const template = {
      args: ["--model", "${tfTools.model}", "--exe", "${tfTools.executablePath}"],
    };
    const { value } = applyTfToolsSubstitution(template, resolvedVars);
    const result = value as typeof template;
    assert.deepStrictEqual(result.args, ["--model", "T2T1", "--exe", "/build/firmware.elf"]);
  });

  test("non-string values pass through unchanged", () => {
    const template = {
      enabled: true,
      port: 3333,
      rate: null,
      program: "${tfTools.executablePath}",
    };
    const { value } = applyTfToolsSubstitution(template, resolvedVars);
    const result = value as typeof template;
    assert.strictEqual(result.enabled, true);
    assert.strictEqual(result.port, 3333);
    assert.strictEqual(result.rate, null);
    assert.strictEqual(result.program, "/build/firmware.elf");
  });

  test("single-pass: resolved values are not re-expanded", () => {
    // If ${tfTools.model} → "${tfTools.executablePath}", the result should
    // NOT be further substituted to "/build/firmware.elf"
    const tricky: Readonly<Record<string, string>> = {
      "tfTools.model": "${tfTools.executablePath}",
      "tfTools.executablePath": "/build/firmware.elf",
    };
    const { value } = applyTfToolsSubstitution("${tfTools.model}", tricky);
    // Single-pass: ${tfTools.model} → "${tfTools.executablePath}" (literal, not re-expanded)
    assert.strictEqual(value, "${tfTools.executablePath}");
  });

  test("deeply nested array-of-objects substitution", () => {
    const template = {
      environment: [
        { name: "TARGET", value: "${tfTools.model}" },
        { name: "EXE", value: "${tfTools.executableBasename}" },
      ],
    };
    const { value } = applyTfToolsSubstitution(template, resolvedVars);
    const result = value as typeof template;
    assert.strictEqual(result.environment[0].value, "T2T1");
    assert.strictEqual(result.environment[1].value, "firmware.elf");
  });
});
