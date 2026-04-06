/**
 * Unit tests for Debug Launch core helpers.
 *
 * Covers:
 *  - resolveComponentDebugEntry: omitted-when matches all, conditional when,
 *    first-match declaration order wins, no-match result
 *  - deriveExecutableFileName: artifact name + suffix + extension
 *  - loadDebugTemplate: valid JSONC loads, traversal blocked, missing file,
 *    malformed JSONC invalid, per-invocation fresh read
 *  - buildDebugVariableMap: built-in variables, entry vars referencing builtIns
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
  resolveComponentDebugEntry,
  deriveExecutableFileName,
  loadDebugTemplate,
  buildDebugVariableMap,
  applyTfToolsSubstitution,
  TFTOOLS_VAR_MODEL,
  TFTOOLS_VAR_TARGET,
  TFTOOLS_VAR_COMPONENT,
  TFTOOLS_VAR_ARTIFACT_FOLDER,
  TFTOOLS_VAR_EXECUTABLE_PATH,
  TFTOOLS_VAR_EXECUTABLE,
  TFTOOLS_VAR_DEBUG_PROFILE_NAME,
} from "../../../commands/debug-launch";
import { makeComponentDebugEntry, debugLaunchValidTemplatesRoot, debugLaunchFailuresWorkspaceRoot } from "../workflow-test-helpers";

/**
 * Returns a debug entry with required fields defaulted for tests that
 * only care about when/id, not template/name.
 */
function makeEntry(overrides: Parameters<typeof makeComponentDebugEntry>[0] = { name: "gdb", template: "gdb-remote.json" }) {
  return makeComponentDebugEntry(overrides);
}

// ---------------------------------------------------------------------------
// resolveComponentDebugEntry
// ---------------------------------------------------------------------------

suite("resolveComponentDebugEntry", () => {
  const ctx = { modelId: "T2T1", targetId: "hw", componentId: "core" };

  test("entry without when matches any context", () => {
    const entry = makeEntry({ name: "p1", template: "gdb-remote.json" }); // no when
    const result = resolveComponentDebugEntry([entry], ctx);
    assert.strictEqual(result.resolutionState, "selected");
    assert.strictEqual(result.selectedEntry, entry);
  });

  test("entry with matching when selects that entry", () => {
    const entry = makeEntry({ name: "p1", template: "gdb-remote.json", when: { type: "model", id: "T2T1" } });
    const result = resolveComponentDebugEntry([entry], ctx);
    assert.strictEqual(result.resolutionState, "selected");
    assert.strictEqual(result.selectedEntry, entry);
  });

  test("entry with non-matching when is excluded", () => {
    const entry = makeEntry({ name: "p1", template: "gdb-remote.json", when: { type: "model", id: "T3W1" } });
    const result = resolveComponentDebugEntry([entry], ctx);
    assert.strictEqual(result.resolutionState, "no-match");
  });

  test("first matching entry wins (declaration order)", () => {
    const first = makeEntry({ name: "first", template: "a.json", declarationIndex: 0 });
    const second = makeEntry({ name: "second", template: "b.json", declarationIndex: 1 });
    const result = resolveComponentDebugEntry([first, second], ctx);
    assert.strictEqual(result.resolutionState, "selected");
    assert.strictEqual(result.selectedEntry?.name, "first");
  });

  test("first matching conditional entry wins over later unconditional one", () => {
    const nonMatch = makeEntry({ name: "no", template: "a.json", when: { type: "model", id: "T3W1" }, declarationIndex: 0 });
    const match = makeEntry({ name: "yes", template: "b.json", when: { type: "model", id: "T2T1" }, declarationIndex: 1 });
    const result = resolveComponentDebugEntry([nonMatch, match], ctx);
    assert.strictEqual(result.resolutionState, "selected");
    assert.strictEqual(result.selectedEntry?.name, "yes");
  });

  test("no matching entries returns no-match", () => {
    const entry = makeEntry({ name: "p1", template: "gdb-remote.json", when: { type: "target", id: "emu" } });
    const result = resolveComponentDebugEntry([entry], ctx);
    assert.strictEqual(result.resolutionState, "no-match");
  });

  test("empty entry list returns no-match", () => {
    const result = resolveComponentDebugEntry([], ctx);
    assert.strictEqual(result.resolutionState, "no-match");
  });
});

// ---------------------------------------------------------------------------
// deriveExecutableFileName
// ---------------------------------------------------------------------------

suite("deriveExecutableFileName", () => {
  test("concatenates artifactName, artifactSuffix, and executableExtension", () => {
    const result = deriveExecutableFileName("firmware", "_hw", ".elf");
    assert.strictEqual(result, "firmware_hw.elf");
  });

  test("empty suffix and extension produces just the artifact name", () => {
    const result = deriveExecutableFileName("firmware", "", "");
    assert.strictEqual(result, "firmware");
  });

  test("empty artifact name with suffix and extension", () => {
    const result = deriveExecutableFileName("", "_emu", ".bin");
    assert.strictEqual(result, "_emu.bin");
  });

  test("all empty strings produces empty string", () => {
    const result = deriveExecutableFileName("", "", "");
    assert.strictEqual(result, "");
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
  const executableFileName = "firmware.elf";
  const executablePath = "/build/model-t/firmware.elf";
  const debugProfileName = "gdb-remote";

  function makeMap(entryVars?: Record<string, string>) {
    return buildDebugVariableMap(modelId, targetId, componentId, artifactFolder, executableFileName, executablePath, debugProfileName, entryVars);
  }

  test("built-in variables are always populated", () => {
    const map = makeMap();
    assert.strictEqual(map.builtIns[TFTOOLS_VAR_MODEL], "T2T1");
    assert.strictEqual(map.builtIns[TFTOOLS_VAR_TARGET], "hw");
    assert.strictEqual(map.builtIns[TFTOOLS_VAR_COMPONENT], "core");
    assert.strictEqual(map.builtIns[TFTOOLS_VAR_ARTIFACT_FOLDER], "model-t");
    assert.strictEqual(map.builtIns[TFTOOLS_VAR_EXECUTABLE], "firmware.elf");
    assert.strictEqual(map.builtIns[TFTOOLS_VAR_EXECUTABLE_PATH], executablePath);
    assert.strictEqual(map.builtIns[TFTOOLS_VAR_DEBUG_PROFILE_NAME], "gdb-remote");
  });

  test("resolvedVars contains all built-ins when no entry vars", () => {
    const map = makeMap();
    assert.strictEqual(map.resolvedVars[TFTOOLS_VAR_MODEL], "T2T1");
    assert.strictEqual(map.resolutionErrors.length, 0);
  });

  test("entry vars referencing built-ins are resolved", () => {
    const vars = { debugLabel: "debug-${tfTools.model}-${tfTools.target}" };
    const map = makeMap(vars);
    assert.strictEqual(map.resolvedVars["tfTools.debugLabel"], "debug-T2T1-hw");
    assert.strictEqual(map.resolutionErrors.length, 0);
  });

  test("entry vars referencing other entry vars are resolved", () => {
    const vars = {
      port: "3333",
      serverArg: "--port ${tfTools.port}",
    };
    const map = makeMap(vars);
    assert.strictEqual(map.resolvedVars["tfTools.port"], "3333");
    assert.strictEqual(map.resolvedVars["tfTools.serverArg"], "--port 3333");
    assert.strictEqual(map.resolutionErrors.length, 0);
  });

  test("cyclic entry vars produce a resolution error", () => {
    const vars = {
      a: "${tfTools.b}",
      b: "${tfTools.a}",
    };
    const map = makeMap(vars);
    assert.ok(map.resolutionErrors.length > 0, "expected cycle error");
    assert.ok(
      map.resolutionErrors.some((e) => e.toLowerCase().includes("cyclic")),
      `expected cyclic error, got: ${map.resolutionErrors.join(", ")}`
    );
  });

  test("unknown tf-tools variable in entry var produces a resolution error", () => {
    const vars = { x: "${tfTools.nonExistent}" };
    const map = makeMap(vars);
    assert.ok(map.resolutionErrors.length > 0, "expected unknown var error");
    assert.ok(
      map.resolutionErrors.some((e) => e.includes("nonExistent")),
      `expected nonExistent in error, got: ${map.resolutionErrors.join(", ")}`
    );
  });

  test("executable variable contains filename (not full path)", () => {
    const map = buildDebugVariableMap(modelId, targetId, componentId, artifactFolder, "my-firmware.elf", "/a/b/c/my-firmware.elf", debugProfileName, undefined);
    assert.strictEqual(map.resolvedVars[TFTOOLS_VAR_EXECUTABLE], "my-firmware.elf");
    assert.strictEqual(map.resolvedVars[TFTOOLS_VAR_EXECUTABLE_PATH], "/a/b/c/my-firmware.elf");
  });

  test("debugProfileName is exposed as tfTools.debugProfileName", () => {
    const map = buildDebugVariableMap(modelId, targetId, componentId, artifactFolder, executableFileName, executablePath, "my-profile", undefined);
    assert.strictEqual(map.resolvedVars[TFTOOLS_VAR_DEBUG_PROFILE_NAME], "my-profile");
  });
});

// ---------------------------------------------------------------------------
// applyTfToolsSubstitution
// ---------------------------------------------------------------------------

suite("applyTfToolsSubstitution", () => {
  const resolvedVars: Readonly<Record<string, string>> = {
    "tfTools.model": "T2T1",
    "tfTools.executablePath": "/build/firmware.elf",
    "tfTools.executable": "firmware.elf",
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
    const tricky: Readonly<Record<string, string>> = {
      "tfTools.model": "${tfTools.executablePath}",
      "tfTools.executablePath": "/build/firmware.elf",
    };
    const { value } = applyTfToolsSubstitution("${tfTools.model}", tricky);
    assert.strictEqual(value, "${tfTools.executablePath}");
  });

  test("deeply nested array-of-objects substitution", () => {
    const template = {
      environment: [
        { name: "TARGET", value: "${tfTools.model}" },
        { name: "EXE", value: "${tfTools.executable}" },
      ],
    };
    const { value } = applyTfToolsSubstitution(template, resolvedVars);
    const result = value as typeof template;
    assert.strictEqual(result.environment[0].value, "T2T1");
    assert.strictEqual(result.environment[1].value, "firmware.elf");
  });
});
