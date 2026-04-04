/**
 * Unit tests for artifact-path derivation and no-fallback resolution.
 *
 * Covers:
 *  - deriveArtifactPath: constructs correct path from all inputs
 *  - deriveArtifactPath: returns undefined when any required input is missing
 *  - resolveActiveArtifact: returns "missing" status when file does not exist
 *  - resolveActiveArtifact: no-fallback — uses only the exact expected path
 *  - buildResolutionInputs: correctly extracts artifact fields from manifest
 *  - buildResolutionInputs: returns undefined for unknown model/target/component
 */

import * as assert from "assert";
import * as path from "path";
import {
  deriveArtifactPath,
  resolveActiveArtifact,
  buildResolutionInputs,
  makeContextKey,
} from "../../../intellisense/artifact-resolution";
import { ArtifactResolutionInputs } from "../../../intellisense/intellisense-types";
import { makeIntelliSenseLoadedState } from "../workflow-test-helpers";
import { ActiveConfig } from "../../../configuration/active-config";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ARTIFACTS_ROOT = "/workspace/build";

function makeInputs(overrides: Partial<ArtifactResolutionInputs> = {}): ArtifactResolutionInputs {
  return {
    artifactsRoot: ARTIFACTS_ROOT,
    modelId: "T2T1",
    artifactFolder: "model-t",
    componentId: "core",
    artifactName: "compile_commands_core",
    targetId: "hw",
    artifactSuffix: "",
    ...overrides,
  };
}

function makeActiveConfig(overrides: Partial<ActiveConfig> = {}): ActiveConfig {
  return {
    modelId: "T2T1",
    targetId: "hw",
    componentId: "core",
    persistedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// makeContextKey
// ---------------------------------------------------------------------------

suite("makeContextKey", () => {
  test("produces a stable key from model, target, and component ids", () => {
    const key = makeContextKey(makeActiveConfig());
    assert.strictEqual(key, "T2T1::hw::core");
  });

  test("distinct configs produce distinct keys", () => {
    const keyA = makeContextKey(makeActiveConfig({ modelId: "T2T1" }));
    const keyB = makeContextKey(makeActiveConfig({ modelId: "T3W1" }));
    assert.notStrictEqual(keyA, keyB);
  });
});

// ---------------------------------------------------------------------------
// deriveArtifactPath
// ---------------------------------------------------------------------------

suite("deriveArtifactPath", () => {
  test("constructs the correct .cc.json path with no suffix", () => {
    const result = deriveArtifactPath(makeInputs());
    const expected = path.join(ARTIFACTS_ROOT, "model-t", "compile_commands_core.cc.json");
    assert.strictEqual(result, expected);
  });

  test("appends artifact-suffix to the basename", () => {
    const result = deriveArtifactPath(makeInputs({ artifactSuffix: "_emu" }));
    const expected = path.join(ARTIFACTS_ROOT, "model-t", "compile_commands_core_emu.cc.json");
    assert.strictEqual(result, expected);
  });

  test("returns undefined when artifactsRoot is empty", () => {
    const result = deriveArtifactPath(makeInputs({ artifactsRoot: "" }));
    assert.strictEqual(result, undefined);
  });

  test("returns undefined when artifactFolder is undefined", () => {
    const result = deriveArtifactPath(makeInputs({ artifactFolder: undefined }));
    assert.strictEqual(result, undefined);
  });

  test("returns undefined when artifactName is undefined", () => {
    const result = deriveArtifactPath(makeInputs({ artifactName: undefined }));
    assert.strictEqual(result, undefined);
  });

  test("treats an empty artifactSuffix as no suffix", () => {
    const result = deriveArtifactPath(makeInputs({ artifactSuffix: "" }));
    const expected = path.join(ARTIFACTS_ROOT, "model-t", "compile_commands_core.cc.json");
    assert.strictEqual(result, expected);
  });

  test("uses artifact-folder from model, not model id, as the folder segment", () => {
    const result = deriveArtifactPath(makeInputs({ artifactFolder: "custom-folder", modelId: "SHOULD_NOT_APPEAR" }));
    assert.ok(result?.includes("custom-folder"), `expected 'custom-folder' in path, got: ${result}`);
    assert.ok(!result?.includes("SHOULD_NOT_APPEAR"), `model id should not appear in path: ${result}`);
  });

  test("uses artifact-name from component, not component id, as the basename stem", () => {
    const result = deriveArtifactPath(makeInputs({ artifactName: "cc_override", componentId: "SHOULD_NOT_APPEAR" }));
    assert.ok(result?.includes("cc_override"), `expected 'cc_override' in path, got: ${result}`);
    assert.ok(!result?.includes("SHOULD_NOT_APPEAR"), `component id should not appear in path: ${result}`);
  });
});

// ---------------------------------------------------------------------------
// resolveActiveArtifact — no-fallback (no real files needed for these tests)
// ---------------------------------------------------------------------------

suite("resolveActiveArtifact — status and no-fallback", () => {
  const config = makeActiveConfig();

  test("returns missing status when the expected file does not exist", () => {
    const inputs = makeInputs({ artifactsRoot: "/does/not/exist" });
    const result = resolveActiveArtifact(inputs, config);
    assert.strictEqual(result.status, "missing");
    assert.strictEqual(result.exists, false);
  });

  test("includes the expected path in the result even when missing", () => {
    const inputs = makeInputs({ artifactsRoot: "/does/not/exist" });
    const result = resolveActiveArtifact(inputs, config);
    assert.ok(result.path.endsWith(".cc.json"), `path should end with .cc.json, got: ${result.path}`);
  });

  test("reports missing-reason when artifactsRoot is empty (no-fallback: not searching elsewhere)", () => {
    const inputs = makeInputs({ artifactsRoot: "" });
    const result = resolveActiveArtifact(inputs, config);
    assert.strictEqual(result.status, "missing");
    assert.ok(
      result.missingReason?.includes("artifactsPath"),
      `expected missingReason to mention 'artifactsPath', got: ${result.missingReason}`
    );
  });

  test("reports missing-reason when artifactFolder is missing", () => {
    const inputs = makeInputs({ artifactFolder: undefined });
    const result = resolveActiveArtifact(inputs, config);
    assert.strictEqual(result.status, "missing");
    assert.ok(result.missingReason?.includes("artifact-folder"), `expected 'artifact-folder' in missingReason, got: ${result.missingReason}`);
  });

  test("reports missing-reason when artifactName is missing", () => {
    const inputs = makeInputs({ artifactName: undefined });
    const result = resolveActiveArtifact(inputs, config);
    assert.strictEqual(result.status, "missing");
    assert.ok(result.missingReason?.includes("artifact-name"), `expected 'artifact-name' in missingReason, got: ${result.missingReason}`);
  });

  test("contextKey includes active model, target, and component", () => {
    const inputs = makeInputs({ artifactsRoot: "/does/not/exist" });
    const result = resolveActiveArtifact(inputs, config);
    assert.strictEqual(result.contextKey, "T2T1::hw::core");
  });
});

// ---------------------------------------------------------------------------
// buildResolutionInputs
// ---------------------------------------------------------------------------

suite("buildResolutionInputs", () => {
  const validConfig: ActiveConfig = {
    modelId: "T2T1",
    targetId: "hw",
    componentId: "core",
    persistedAt: "2026-01-01T00:00:00Z",
  };

  test("extracts artifactFolder from the model", () => {
    const manifest = makeIntelliSenseLoadedState();
    const result = buildResolutionInputs(manifest, validConfig, ARTIFACTS_ROOT);
    assert.strictEqual(result?.artifactFolder, "model-t");
  });

  test("extracts artifactName from the component", () => {
    const manifest = makeIntelliSenseLoadedState();
    const result = buildResolutionInputs(manifest, validConfig, ARTIFACTS_ROOT);
    assert.strictEqual(result?.artifactName, "compile_commands_core");
  });

  test("extracts empty artifactSuffix for target without suffix", () => {
    const manifest = makeIntelliSenseLoadedState();
    const result = buildResolutionInputs(manifest, validConfig, ARTIFACTS_ROOT);
    assert.strictEqual(result?.artifactSuffix, "");
  });

  test("extracts non-empty artifactSuffix for target with suffix", () => {
    const manifest = makeIntelliSenseLoadedState();
    const config: ActiveConfig = { ...validConfig, targetId: "emu" };
    const result = buildResolutionInputs(manifest, config, ARTIFACTS_ROOT);
    assert.strictEqual(result?.artifactSuffix, "_emu");
  });

  test("returns undefined for unknown model id", () => {
    const manifest = makeIntelliSenseLoadedState();
    const config: ActiveConfig = { ...validConfig, modelId: "UNKNOWN" };
    const result = buildResolutionInputs(manifest, config, ARTIFACTS_ROOT);
    assert.strictEqual(result, undefined);
  });

  test("returns undefined for unknown component id", () => {
    const manifest = makeIntelliSenseLoadedState();
    const config: ActiveConfig = { ...validConfig, componentId: "UNKNOWN" };
    const result = buildResolutionInputs(manifest, config, ARTIFACTS_ROOT);
    assert.strictEqual(result, undefined);
  });

  test("passes through the artifactsRoot unchanged", () => {
    const manifest = makeIntelliSenseLoadedState();
    const result = buildResolutionInputs(manifest, validConfig, ARTIFACTS_ROOT);
    assert.strictEqual(result?.artifactsRoot, ARTIFACTS_ROOT);
  });
});

// ---------------------------------------------------------------------------
// T033: Regression coverage for artifactsPath changes and suffix transitions
// ---------------------------------------------------------------------------

suite("T033 — artifactsPath change regression", () => {
  test("changing artifactsRoot produces a different path", () => {
    const pathA = deriveArtifactPath(makeInputs({ artifactsRoot: "/build/v1" }));
    const pathB = deriveArtifactPath(makeInputs({ artifactsRoot: "/build/v2" }));
    assert.notStrictEqual(pathA, pathB);
  });

  test("path with new artifactsRoot starts with the new root", () => {
    const newRoot = "/custom/artifacts";
    const result = deriveArtifactPath(makeInputs({ artifactsRoot: newRoot }));
    assert.ok(result?.startsWith(newRoot), `expected path to start with ${newRoot}, got ${result}`);
  });

  test("setting artifactsRoot to empty makes path undefined", () => {
    const result = deriveArtifactPath(makeInputs({ artifactsRoot: "" }));
    assert.strictEqual(result, undefined);
  });

  test("buildResolutionInputs passes the provided artifactsRoot without modification", () => {
    const manifest = makeIntelliSenseLoadedState();
    const config = makeActiveConfig();
    const root = "/new/artifacts/root";
    const inputs = buildResolutionInputs(manifest, config, root);
    assert.strictEqual(inputs?.artifactsRoot, root);
  });

  test("resolveActiveArtifact reflects artifactsRoot in the returned path", () => {
    const inputs = makeInputs({ artifactsRoot: "/custom/root" });
    const result = resolveActiveArtifact(inputs, makeActiveConfig());
    assert.ok(result.path.startsWith("/custom/root"), `expected path to start with /custom/root, got ${result.path}`);
  });
});

suite("T033 — target suffix transition regression", () => {
  test("switching from no-suffix target to suffixed target changes the path", () => {
    const noSuffix = deriveArtifactPath(makeInputs({ artifactSuffix: "" }));
    const withSuffix = deriveArtifactPath(makeInputs({ artifactSuffix: "_emu" }));
    assert.notStrictEqual(noSuffix, withSuffix);
  });

  test("path with suffix includes the suffix before .cc.json", () => {
    const result = deriveArtifactPath(makeInputs({ artifactSuffix: "_emu" }));
    assert.ok(result?.endsWith("_emu.cc.json"), `expected path to end with '_emu.cc.json', got: ${result}`);
  });

  test("path without suffix ends with <artifactName>.cc.json (no extra underscore)", () => {
    const result = deriveArtifactPath(makeInputs({ artifactSuffix: "" }));
    assert.ok(result?.endsWith("compile_commands_core.cc.json"), `expected path to end with 'compile_commands_core.cc.json', got: ${result}`);
  });

  test("buildResolutionInputs picks up artifactSuffix from target", () => {
    const manifest = makeIntelliSenseLoadedState();
    // The intellisense-valid state has an 'emu' target with artifactSuffix
    const config = makeActiveConfig({ targetId: "emu" });
    const inputs = buildResolutionInputs(manifest, config, ARTIFACTS_ROOT);
    assert.ok(inputs, "expected inputs to be defined for emu target");
    assert.strictEqual(inputs!.artifactSuffix, "_emu");
  });

  test("buildResolutionInputs uses empty string artifactSuffix for target without suffix", () => {
    const manifest = makeIntelliSenseLoadedState();
    const config = makeActiveConfig({ targetId: "hw" });
    const inputs = buildResolutionInputs(manifest, config, ARTIFACTS_ROOT);
    assert.ok(inputs, "expected inputs for hw target");
    assert.strictEqual(inputs!.artifactSuffix, "");
  });

  test("contextKey differs between suffixed and non-suffixed target", () => {
    const keyHw = makeContextKey(makeActiveConfig({ targetId: "hw" }));
    const keyEmu = makeContextKey(makeActiveConfig({ targetId: "emu" }));
    assert.notStrictEqual(keyHw, keyEmu);
  });
});
