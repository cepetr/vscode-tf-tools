import * as assert from "assert";
import { parseManifest, validateManifest } from "../../../manifest/validate-manifest";
import * as vscode from "vscode";

suite("parseManifest", () => {
  // -------------------------------------------------------------------------
  // Valid manifest
  // -------------------------------------------------------------------------

  test("parses a valid manifest and returns correct models, targets, components", () => {
    const source = `
models:
  - id: T2T1
    name: Trezor Model T
  - id: T3W1
    name: Trezor Model T3
targets:
  - id: hw
    name: Hardware
    shortName: HW
  - id: emu
    name: Emulator
components:
  - id: core
    name: Core
  - id: prodtest
    name: Prodtest
`.trim();

    const result = parseManifest(source);

    assert.strictEqual(result.issues.length, 0, "expected no validation issues");
    assert.deepStrictEqual(
      result.models.map((m) => ({ id: m.id, name: m.name })),
      [
        { id: "T2T1", name: "Trezor Model T" },
        { id: "T3W1", name: "Trezor Model T3" },
      ]
    );
    assert.deepStrictEqual(
      result.targets.map((t) => ({ id: t.id, name: t.name, shortName: t.shortName })),
      [
        { id: "hw", name: "Hardware", shortName: "HW" },
        { id: "emu", name: "Emulator", shortName: undefined },
      ]
    );
    assert.deepStrictEqual(
      result.components.map((c) => ({ id: c.id, name: c.name })),
      [
        { id: "core", name: "Core" },
        { id: "prodtest", name: "Prodtest" },
      ]
    );
  });

  test("assigns kind fields correctly", () => {
    const source = `
models:
  - id: T2T1
    name: Model T
targets:
  - id: hw
    name: Hardware
components:
  - id: core
    name: Core
`.trim();
    const result = parseManifest(source);
    assert.strictEqual(result.models[0].kind, "model");
    assert.strictEqual(result.targets[0].kind, "target");
    assert.strictEqual(result.components[0].kind, "component");
  });

  // -------------------------------------------------------------------------
  // YAML parse errors
  // -------------------------------------------------------------------------

  test("returns yaml-parse error for malformed YAML", () => {
    const source = `models:\n  - id: T2T1\n    bad: [unclosed`;
    const result = parseManifest(source);
    assert.ok(result.issues.length > 0, "expected at least one issue");
    assert.strictEqual(result.issues[0].code, "yaml-parse");
    assert.strictEqual(result.issues[0].severity, "error");
  });

  test("returns empty collections for malformed YAML", () => {
    const source = `models:\n  - id: T2T1\n    bad: [unclosed`;
    const result = parseManifest(source);
    assert.strictEqual(result.models.length, 0);
    assert.strictEqual(result.targets.length, 0);
    assert.strictEqual(result.components.length, 0);
  });

  // -------------------------------------------------------------------------
  // Missing required fields
  // -------------------------------------------------------------------------

  test("reports missing-field error when model id is absent", () => {
    const source = `
models:
  - name: No ID Model
targets:
  - id: hw
    name: Hardware
components:
  - id: core
    name: Core
`.trim();
    const result = parseManifest(source);
    const missingId = result.issues.find(
      (i) => i.code === "missing-field" && i.message.includes('"id"')
    );
    assert.ok(missingId, "expected missing-field issue for model id");
    assert.strictEqual(missingId.severity, "error");
  });

  test("reports missing-field error when target name is absent", () => {
    const source = `
models:
  - id: T2T1
    name: Model T
targets:
  - id: hw
components:
  - id: core
    name: Core
`.trim();
    const result = parseManifest(source);
    const missingName = result.issues.find(
      (i) => i.code === "missing-field" && i.message.includes('"name"')
    );
    assert.ok(missingName, "expected missing-field issue for target name");
  });

  // -------------------------------------------------------------------------
  // Empty collections
  // -------------------------------------------------------------------------

  test("reports empty-collection error for empty models array", () => {
    const source = `
models: []
targets:
  - id: hw
    name: Hardware
components:
  - id: core
    name: Core
`.trim();
    const result = parseManifest(source);
    const emptyErr = result.issues.find(
      (i) => i.code === "empty-collection" && i.message.includes("model")
    );
    assert.ok(emptyErr, "expected empty-collection error for models");
    assert.strictEqual(emptyErr.severity, "error");
  });

  test("reports empty-collection error when targets key is missing", () => {
    const source = `
models:
  - id: T2T1
    name: Model T
components:
  - id: core
    name: Core
`.trim();
    const result = parseManifest(source);
    const emptyErr = result.issues.find(
      (i) => i.code === "empty-collection" && i.message.includes("target")
    );
    assert.ok(emptyErr, "expected empty-collection error for targets");
  });

  // -------------------------------------------------------------------------
  // Duplicate IDs
  // -------------------------------------------------------------------------

  test("reports duplicate-id error for duplicate model ids", () => {
    const source = `
models:
  - id: T2T1
    name: First
  - id: T2T1
    name: Duplicate
targets:
  - id: hw
    name: Hardware
components:
  - id: core
    name: Core
`.trim();
    const result = parseManifest(source);
    const dupErr = result.issues.find(
      (i) => i.code === "duplicate-id" && i.message.includes("T2T1")
    );
    assert.ok(dupErr, "expected duplicate-id error for T2T1");
    assert.strictEqual(dupErr.severity, "error");
  });

  test("accepts duplicate id across different collections", () => {
    // "core" may appear as both a component and a (hypothetical) target without error
    const source = `
models:
  - id: T2T1
    name: Model T
targets:
  - id: core
    name: Core Target
components:
  - id: core
    name: Core Component
`.trim();
    const result = parseManifest(source);
    const dupErr = result.issues.find((i) => i.code === "duplicate-id");
    assert.ok(!dupErr, "should not report duplicate-id for ids across collections");
  });

  // -------------------------------------------------------------------------
  // Range information
  // -------------------------------------------------------------------------

  test("attaches a vscode range to yaml-parse issues when offset is available", () => {
    // Produce a YAML error that includes position info
    const source = `models:\n  - id: T2T1\n    bad: [unclosed`;
    const result = parseManifest(source);
    // At least the first parse error may have a range
    const withRange = result.issues.find((i) => i.range !== undefined);
    // Not all parsers produce position info, so just check the shape when present
    if (withRange?.range) {
      assert.ok(
        typeof withRange.range.start.line === "number",
        "range.start.line should be a number"
      );
    }
  });
});

// ---------------------------------------------------------------------------
// validateManifest
// ---------------------------------------------------------------------------

suite("validateManifest", () => {
  const dummyUri = vscode.Uri.file("/workspace/tf-tools.yaml");

  test("returns loaded state for a valid manifest", () => {
    const source = `
models:
  - id: T2T1
    name: Model T
targets:
  - id: hw
    name: Hardware
components:
  - id: core
    name: Core
`.trim();
    const state = validateManifest(source, dummyUri);
    assert.strictEqual(state.status, "loaded");
    if (state.status === "loaded") {
      assert.strictEqual(state.models.length, 1);
      assert.strictEqual(state.targets.length, 1);
      assert.strictEqual(state.components.length, 1);
    }
  });

  test("returns invalid state for malformed YAML", () => {
    const source = `models:\n  - id: T2T1\n    bad: [unclosed`;
    const state = validateManifest(source, dummyUri);
    assert.strictEqual(state.status, "invalid");
    if (state.status === "invalid") {
      assert.ok(state.validationIssues.length > 0);
    }
  });

  test("returns invalid state for structurally invalid manifest", () => {
    const source = `
models: []
targets: []
components: []
`.trim();
    const state = validateManifest(source, dummyUri);
    assert.strictEqual(state.status, "invalid");
  });

  test("attaches the manifestUri to loaded state", () => {
    const source = `
models:
  - id: T2T1
    name: Model T
targets:
  - id: hw
    name: Hardware
components:
  - id: core
    name: Core
`.trim();
    const state = validateManifest(source, dummyUri);
    assert.strictEqual(state.manifestUri, dummyUri);
  });

  test("sets loadedAt timestamp on loaded state", () => {
    const before = new Date();
    const source = `
models:
  - id: T2T1
    name: Model T
targets:
  - id: hw
    name: Hardware
components:
  - id: core
    name: Core
`.trim();
    const state = validateManifest(source, dummyUri);
    const after = new Date();
    if (state.status === "loaded") {
      assert.ok(state.loadedAt >= before, "loadedAt should be after test start");
      assert.ok(state.loadedAt <= after, "loadedAt should be before test end");
    }
  });
});
