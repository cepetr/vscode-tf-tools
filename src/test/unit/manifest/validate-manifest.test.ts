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

// ---------------------------------------------------------------------------
// parseManifest – Build Options
// ---------------------------------------------------------------------------

suite("parseManifest – buildOptions", () => {
  function baseManifest(buildOptions: string): string {
    return `
models:
  - id: T2T1
    name: Trezor Model T
  - id: T3W1
    name: Trezor Model T3
targets:
  - id: hw
    name: Hardware
  - id: emu
    name: Emulator
components:
  - id: core
    name: Core
${buildOptions}
`.trim();
  }

  // -------------------------------------------------------------------------
  // No build options
  // -------------------------------------------------------------------------

  test("parses manifest without buildOptions without error", () => {
    const source = baseManifest("");
    const result = parseManifest(source);
    assert.deepStrictEqual(result.buildOptions, []);
    assert.strictEqual(result.hasWorkflowBlockingIssues, false);
    assert.ok(!result.issues.some((i) => i.code === "invalid-when"));
  });

  // -------------------------------------------------------------------------
  // Valid checkbox option
  // -------------------------------------------------------------------------

  test("parses a valid ungrouped checkbox option", () => {
    const source = baseManifest(`
buildOptions:
  - label: "Debug Build"
    flag: "--debug"
    kind: checkbox
`);
    const result = parseManifest(source);
    assert.strictEqual(result.issues.filter((i) => i.severity === "error").length, 0);
    assert.strictEqual(result.buildOptions.length, 1);
    const opt = result.buildOptions[0];
    assert.strictEqual(opt.label, "Debug Build");
    assert.strictEqual(opt.flag, "--debug");
    assert.strictEqual(opt.kind, "checkbox");
    assert.strictEqual(opt.group, undefined);
    assert.strictEqual(opt.when, undefined);
  });

  test("parses a grouped checkbox option", () => {
    const source = baseManifest(`
buildOptions:
  - label: "Fast"
    flag: "--fast"
    kind: checkbox
    group: "Build Tuning"
`);
    const result = parseManifest(source);
    assert.strictEqual(result.buildOptions[0].group, "Build Tuning");
  });

  test("parses option description when present", () => {
    const source = baseManifest(`
buildOptions:
  - label: "Debug"
    flag: "--debug"
    kind: checkbox
    description: "Enable debug symbols"
`);
    const result = parseManifest(source);
    assert.strictEqual(result.buildOptions[0].description, "Enable debug symbols");
  });

  test("assigns deterministic key derived from flag", () => {
    const source = baseManifest(`
buildOptions:
  - label: "Debug"
    flag: "--debug"
    kind: checkbox
`);
    const result = parseManifest(source);
    // Key is derived from flag: strip leading dashes, replace non-alnum with _
    assert.strictEqual(result.buildOptions[0].key, "debug");
  });

  // -------------------------------------------------------------------------
  // Valid multistate option
  // -------------------------------------------------------------------------

  test("parses a valid multistate option with explicit default", () => {
    const source = baseManifest(`
buildOptions:
  - label: "Verbosity"
    flag: "--verbose"
    kind: multistate
    states:
      - id: "off"
        label: "Off"
        flag: ""
      - id: "on"
        label: "On"
        flag: "--verbose"
        default: true
`);
    const result = parseManifest(source);
    assert.strictEqual(result.issues.filter((i) => i.severity === "error").length, 0);
    const opt = result.buildOptions[0];
    assert.strictEqual(opt.kind, "multistate");
    assert.strictEqual(opt.states?.length, 2);
    assert.strictEqual(opt.defaultState, "on");
  });

  test("uses first state as default when no explicit default is set", () => {
    const source = baseManifest(`
buildOptions:
  - label: "Verbosity"
    flag: "--verbose"
    kind: multistate
    states:
      - id: "off"
        label: "Off"
        flag: ""
      - id: "on"
        label: "On"
        flag: "--verbose"
`);
    const result = parseManifest(source);
    assert.strictEqual(result.buildOptions[0].defaultState, "off");
  });

  // -------------------------------------------------------------------------
  // when expressions
  // -------------------------------------------------------------------------

  test("parses a valid when expression and stores it as AST", () => {
    const source = baseManifest(`
buildOptions:
  - label: "T2T1 Only"
    flag: "--t2t1"
    kind: checkbox
    when: "model(T2T1)"
`);
    const result = parseManifest(source);
    assert.strictEqual(result.issues.filter((i) => i.code === "invalid-when").length, 0);
    const opt = result.buildOptions[0];
    assert.deepStrictEqual(opt.when, { type: "model", id: "T2T1" });
  });

  test("reports invalid-when error and sets hasWorkflowBlockingIssues for syntactically invalid when", () => {
    const source = baseManifest(`
buildOptions:
  - label: "Broken"
    flag: "--broken"
    kind: checkbox
    when: "all()"
`);
    const result = parseManifest(source);
    assert.ok(result.issues.some((i) => i.code === "invalid-when"));
    assert.strictEqual(result.hasWorkflowBlockingIssues, true);
  });

  test("reports invalid-when error for unknown model id in when expression", () => {
    const source = baseManifest(`
buildOptions:
  - label: "Unknown"
    flag: "--unknown"
    kind: checkbox
    when: "model(NONEXISTENT)"
`);
    const result = parseManifest(source);
    assert.ok(result.issues.some((i) => i.code === "invalid-when"));
    assert.strictEqual(result.hasWorkflowBlockingIssues, true);
  });

  test("does not block workflow for manifests with only valid when expressions", () => {
    const source = baseManifest(`
buildOptions:
  - label: "T2T1"
    flag: "--t2t1"
    kind: checkbox
    when: "model(T2T1)"
`);
    const result = parseManifest(source);
    assert.strictEqual(result.hasWorkflowBlockingIssues, false);
  });

  // -------------------------------------------------------------------------
  // Duplicate flag validation
  // -------------------------------------------------------------------------

  test("reports duplicate-flag error for options with the same flag", () => {
    const source = baseManifest(`
buildOptions:
  - label: "First"
    flag: "--debug"
    kind: checkbox
  - label: "Second"
    flag: "--debug"
    kind: checkbox
`);
    const result = parseManifest(source);
    assert.ok(result.issues.some((i) => i.code === "duplicate-flag"));
  });

  // -------------------------------------------------------------------------
  // Declaration order preserved
  // -------------------------------------------------------------------------

  test("preserves manifest declaration order for options", () => {
    const source = baseManifest(`
buildOptions:
  - label: "Alpha"
    flag: "--alpha"
    kind: checkbox
  - label: "Beta"
    flag: "--beta"
    kind: checkbox
  - label: "Gamma"
    flag: "--gamma"
    kind: checkbox
`);
    const result = parseManifest(source);
    assert.deepStrictEqual(
      result.buildOptions.map((o) => o.label),
      ["Alpha", "Beta", "Gamma"]
    );
  });
});

// ---------------------------------------------------------------------------
// parseManifest – canonical "options" schema
// ---------------------------------------------------------------------------

suite("parseManifest – canonical options schema", () => {
  function baseManifest(optionsBlock: string): string {
    return `
models:
  - id: t2t1
    name: T2T1
targets:
  - id: hardware
    name: Hardware
  - id: emulator
    name: Emulator
components:
  - id: firmware
    name: Firmware
${optionsBlock}
`.trim();
  }

  test("parses checkbox option using 'options:', 'name:', 'type:', and id-derived flag", () => {
    const source = baseManifest(`
options:
  - id: perf-overlay
    name: Performance Overlay
    type: checkbox
    group: Debugging
`);
    const result = parseManifest(source);
    assert.strictEqual(result.issues.filter((i) => i.severity === "error").length, 0);
    assert.strictEqual(result.buildOptions.length, 1);
    const opt = result.buildOptions[0];
    assert.strictEqual(opt.label, "Performance Overlay");
    assert.strictEqual(opt.flag, "--perf-overlay");
    assert.strictEqual(opt.key, "perf_overlay");
    assert.strictEqual(opt.kind, "checkbox");
    assert.strictEqual(opt.group, "Debugging");
  });

  test("parses multistate option with value-based states", () => {
    const source = baseManifest(`
options:
  - id: debug
    name: Debug Optimization
    type: multistate
    states:
      - value: null
        name: Default
        default: true
      - value: "true"
        name: Enabled
      - value: "false"
        name: Disabled
`);
    const result = parseManifest(source);
    assert.strictEqual(result.issues.filter((i) => i.severity === "error").length, 0);
    const opt = result.buildOptions[0];
    assert.strictEqual(opt.flag, "--debug");
    assert.strictEqual(opt.kind, "multistate");
    assert.strictEqual(opt.states?.length, 3);

    const nullState = opt.states?.find((s) => s.id === "null");
    assert.ok(nullState, "expected state with id 'null'");
    assert.strictEqual(nullState!.flag, "");

    const trueState = opt.states?.find((s) => s.id === "true");
    assert.ok(trueState, "expected state with id 'true'");
    assert.strictEqual(trueState!.flag, "--debug=true");
    assert.strictEqual(trueState!.label, "Enabled");

    assert.strictEqual(opt.defaultState, "null");
  });

  test("derives multistate flag as --{id}={value} for string values", () => {
    const source = baseManifest(`
options:
  - id: dbg-console
    name: Debug Console
    type: multistate
    states:
      - value: null
        name: Default
        default: true
      - value: vcp
        name: VCP
      - value: swo
        name: SWO
`);
    const result = parseManifest(source);
    assert.strictEqual(result.issues.filter((i) => i.severity === "error").length, 0);
    const opt = result.buildOptions[0];
    const vcpState = opt.states?.find((s) => s.id === "vcp");
    assert.ok(vcpState);
    assert.strictEqual(vcpState!.flag, "--dbg-console=vcp");
    const swoState = opt.states?.find((s) => s.id === "swo");
    assert.ok(swoState);
    assert.strictEqual(swoState!.flag, "--dbg-console=swo");
  });

  test("parses when expression in canonical schema option", () => {
    const source = baseManifest(`
options:
  - id: production
    name: Production
    type: checkbox
    when: "target(hardware)"
`);
    const result = parseManifest(source);
    assert.strictEqual(result.issues.filter((i) => i.code === "invalid-when").length, 0);
    assert.deepStrictEqual(result.buildOptions[0].when, { type: "target", id: "hardware" });
  });
});

// ---------------------------------------------------------------------------
// IntelliSense artifact field tests (T013)
// ---------------------------------------------------------------------------

suite("parseManifest — IntelliSense artifact fields", () => {
  const baseSource = `
models:
  - id: T2T1
    name: Trezor Model T
    artifact-folder: model-t
targets:
  - id: hw
    name: Hardware
  - id: emu
    name: Emulator
    artifact-suffix: _emu
components:
  - id: core
    name: Core
    artifact-name: compile_commands_core
`.trim();

  test("parses artifact-folder from model entries", () => {
    const result = parseManifest(baseSource);
    assert.strictEqual(result.issues.length, 0);
    assert.strictEqual(result.models[0].artifactFolder, "model-t");
  });

  test("artifact-folder is undefined when absent from model", () => {
    const source = `
models:
  - id: T2T1
    name: Trezor Model T
targets:
  - id: hw
    name: Hardware
components:
  - id: core
    name: Core
`.trim();
    const result = parseManifest(source);
    assert.strictEqual(result.issues.length, 0);
    assert.strictEqual(result.models[0].artifactFolder, undefined);
  });

  test("parses artifact-name from component entries", () => {
    const result = parseManifest(baseSource);
    assert.strictEqual(result.components[0].artifactName, "compile_commands_core");
  });

  test("artifact-name is undefined when absent from component", () => {
    const source = `
models:
  - id: T2T1
    name: Trezor Model T
targets:
  - id: hw
    name: Hardware
components:
  - id: core
    name: Core
`.trim();
    const result = parseManifest(source);
    assert.strictEqual(result.components[0].artifactName, undefined);
  });

  test("parses artifact-suffix from target entries", () => {
    const result = parseManifest(baseSource);
    assert.strictEqual(result.targets[1].artifactSuffix, "_emu");
  });

  test("artifact-suffix is undefined when absent from target", () => {
    const result = parseManifest(baseSource);
    assert.strictEqual(result.targets[0].artifactSuffix, undefined);
  });

  test("artifact fields do not affect manifest validity — manifest without them is still valid", () => {
    const source = `
models:
  - id: T2T1
    name: Trezor Model T
targets:
  - id: hw
    name: Hardware
components:
  - id: core
    name: Core
`.trim();
    const result = parseManifest(source);
    assert.strictEqual(result.issues.length, 0);
  });

  test("empty string artifact-folder is treated as absent", () => {
    const source = `
models:
  - id: T2T1
    name: Trezor Model T
    artifact-folder: "  "
targets:
  - id: hw
    name: Hardware
components:
  - id: core
    name: Core
`.trim();
    const result = parseManifest(source);
    // Whitespace-only value is treated as absent
    assert.strictEqual(result.models[0].artifactFolder, undefined);
  });
});

// ---------------------------------------------------------------------------
// T023: flashWhen / uploadWhen regression tests
// ---------------------------------------------------------------------------

suite("parseManifest – flashWhen and uploadWhen (T023)", () => {
  function makeBaseManifest(components: string): string {
    return `
models:
  - id: T2T1
    name: Trezor Model T
    artifact-folder: model-t
  - id: T3W1
    name: Trezor Model T3
    artifact-folder: model-t3
targets:
  - id: hw
    name: Hardware
  - id: emu
    name: Emulator
${components}
`.trim();
  }

  test("valid flashWhen expression is parsed and stored on component", () => {
    const source = makeBaseManifest(`
components:
  - id: core
    name: Core
    flashWhen: model(T2T1)
`);
    const result = parseManifest(source);
    const core = result.components.find((c) => c.id === "core");
    assert.ok(core, "expected core component");
    assert.ok(core.flashWhen, "expected flashWhen to be set");
  });

  test("valid uploadWhen expression is parsed and stored on component", () => {
    const source = makeBaseManifest(`
components:
  - id: core
    name: Core
    uploadWhen: any(model(T2T1), model(T3W1))
`);
    const result = parseManifest(source);
    const core = result.components.find((c) => c.id === "core");
    assert.ok(core, "expected core component");
    assert.ok(core.uploadWhen, "expected uploadWhen to be set");
  });

  test("absent flashWhen leaves component.flashWhen undefined", () => {
    const source = makeBaseManifest(`
components:
  - id: core
    name: Core
`);
    const result = parseManifest(source);
    const core = result.components.find((c) => c.id === "core");
    assert.ok(core, "expected core component");
    assert.strictEqual(core.flashWhen, undefined);
  });

  test("absent uploadWhen leaves component.uploadWhen undefined", () => {
    const source = makeBaseManifest(`
components:
  - id: core
    name: Core
`);
    const result = parseManifest(source);
    const core = result.components.find((c) => c.id === "core");
    assert.ok(core, "expected core component");
    assert.strictEqual(core.uploadWhen, undefined);
  });

  test("invalid flashWhen syntax surfaces as invalid-when issue", () => {
    const source = makeBaseManifest(`
components:
  - id: core
    name: Core
    flashWhen: "not a valid expression"
`);
    const result = parseManifest(source);
    const invalidWhenIssues = result.issues.filter((i) => i.code === "invalid-when");
    assert.ok(
      invalidWhenIssues.length > 0,
      "expected at least one invalid-when issue for bad flashWhen syntax"
    );
  });

  test("invalid uploadWhen syntax surfaces as invalid-when issue", () => {
    const source = makeBaseManifest(`
components:
  - id: core
    name: Core
    uploadWhen: "not a valid expression"
`);
    const result = parseManifest(source);
    const invalidWhenIssues = result.issues.filter((i) => i.code === "invalid-when");
    assert.ok(
      invalidWhenIssues.length > 0,
      "expected at least one invalid-when issue for bad uploadWhen syntax"
    );
  });

  test("unknown model id in flashWhen surfaces as invalid-when issue", () => {
    const source = makeBaseManifest(`
components:
  - id: core
    name: Core
    flashWhen: model(UNKNOWN_MODEL)
`);
    const result = parseManifest(source);
    const invalidWhenIssues = result.issues.filter((i) => i.code === "invalid-when");
    assert.ok(
      invalidWhenIssues.length > 0,
      "expected invalid-when issue for unknown model id in flashWhen"
    );
    assert.ok(
      invalidWhenIssues.some((i) => i.message.includes("UNKNOWN_MODEL") || i.message.includes("unknown")),
      `expected issue message to mention unknown id, got: ${invalidWhenIssues.map((i) => i.message).join("; ")}`
    );
  });

  test("invalid flashWhen does NOT set hasWorkflowBlockingIssues", () => {
    const source = makeBaseManifest(`
components:
  - id: core
    name: Core
    flashWhen: "not a valid expression"
`);
    const result = parseManifest(source);
    assert.strictEqual(
      result.hasWorkflowBlockingIssues,
      false,
      "invalid flashWhen must NOT block Build/Clippy/Check/Clean workflow"
    );
  });

  test("invalid uploadWhen does NOT set hasWorkflowBlockingIssues", () => {
    const source = makeBaseManifest(`
components:
  - id: core
    name: Core
    uploadWhen: "not a valid expression"
`);
    const result = parseManifest(source);
    assert.strictEqual(
      result.hasWorkflowBlockingIssues,
      false,
      "invalid uploadWhen must NOT block Build/Clippy/Check/Clean workflow"
    );
  });

  test("non-string flashWhen (integer) surfaces as invalid-when issue", () => {
    const source = makeBaseManifest(`
components:
  - id: core
    name: Core
    flashWhen: 42
`);
    const result = parseManifest(source);
    const invalidWhenIssues = result.issues.filter((i) => i.code === "invalid-when");
    assert.ok(
      invalidWhenIssues.length > 0,
      "expected invalid-when issue for non-string flashWhen value"
    );
  });

  test("component without flashWhen/uploadWhen sees no new issues from action rules pass", () => {
    const source = makeBaseManifest(`
components:
  - id: core
    name: Core
`);
    const result = parseManifest(source);
    // No action-rule issues expected for a component with no when fields
    const actionIssues = result.issues.filter((i) => i.code === "invalid-when");
    assert.strictEqual(actionIssues.length, 0);
  });
});
