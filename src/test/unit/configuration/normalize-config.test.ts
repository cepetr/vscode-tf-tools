import * as assert from "assert";
import { normalizeActiveConfig } from "../../../configuration/normalize-config";
import { ManifestStateLoaded } from "../../../manifest/manifest-types";
import { ActiveConfig } from "../../../configuration/active-config";
import * as vscode from "vscode";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeManifest(overrides?: Partial<ManifestStateLoaded>): ManifestStateLoaded {
  return {
    status: "loaded",
    manifestUri: vscode.Uri.file("/workspace/tf-tools.yaml"),
    models: [
      { kind: "model", id: "T2T1", name: "Trezor Model T" },
      { kind: "model", id: "T3W1", name: "Trezor Model T3" },
    ],
    targets: [
      { kind: "target", id: "hw", name: "Hardware", shortName: "HW" },
      { kind: "target", id: "emu", name: "Emulator" },
    ],
    components: [
      { kind: "component", id: "core", name: "Core" },
      { kind: "component", id: "prodtest", name: "Prodtest" },
    ],
    buildOptions: [],
    hasWorkflowBlockingIssues: false,
    validationIssues: [],
    loadedAt: new Date(),
    ...overrides,
  };
}

function makeConfig(overrides?: Partial<ActiveConfig>): ActiveConfig {
  return {
    modelId: "T2T1",
    targetId: "hw",
    componentId: "core",
    persistedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// No saved config — fresh start
// ---------------------------------------------------------------------------

suite("normalizeActiveConfig – no saved config", () => {
  test("returns first model, target, and component when no saved config is provided", () => {
    const result = normalizeActiveConfig(makeManifest());
    assert.strictEqual(result.modelId, "T2T1");
    assert.strictEqual(result.targetId, "hw");
    assert.strictEqual(result.componentId, "core");
  });

  test("handles single-entry collections", () => {
    const manifest = makeManifest({
      models: [{ kind: "model", id: "ONLY", name: "Only Model" }],
      targets: [{ kind: "target", id: "emu", name: "Emulator" }],
      components: [{ kind: "component", id: "core", name: "Core" }],
    });
    const result = normalizeActiveConfig(manifest);
    assert.strictEqual(result.modelId, "ONLY");
    assert.strictEqual(result.targetId, "emu");
    assert.strictEqual(result.componentId, "core");
  });
});

// ---------------------------------------------------------------------------
// Saved config still valid
// ---------------------------------------------------------------------------

suite("normalizeActiveConfig – saved config still valid", () => {
  test("returns saved ids unchanged when all ids are present in the manifest", () => {
    const saved = makeConfig({ modelId: "T3W1", targetId: "emu", componentId: "prodtest" });
    const result = normalizeActiveConfig(makeManifest(), saved);
    assert.strictEqual(result.modelId, "T3W1");
    assert.strictEqual(result.targetId, "emu");
    assert.strictEqual(result.componentId, "prodtest");
  });

  test("preserves all three ids when saved config refers to second entries", () => {
    const saved = makeConfig({ modelId: "T3W1", targetId: "hw", componentId: "prodtest" });
    const result = normalizeActiveConfig(makeManifest(), saved);
    assert.strictEqual(result.modelId, "T3W1");
    assert.strictEqual(result.targetId, "hw");
    assert.strictEqual(result.componentId, "prodtest");
  });
});

// ---------------------------------------------------------------------------
// Saved config partially stale
// ---------------------------------------------------------------------------

suite("normalizeActiveConfig – saved config partially stale", () => {
  test("replaces stale modelId with first model, keeps valid targetId and componentId", () => {
    const saved = makeConfig({ modelId: "DELETED", targetId: "emu", componentId: "prodtest" });
    const result = normalizeActiveConfig(makeManifest(), saved);
    assert.strictEqual(result.modelId, "T2T1");
    assert.strictEqual(result.targetId, "emu");
    assert.strictEqual(result.componentId, "prodtest");
  });

  test("replaces stale targetId with first target, keeps valid modelId and componentId", () => {
    const saved = makeConfig({ modelId: "T3W1", targetId: "DELETED", componentId: "prodtest" });
    const result = normalizeActiveConfig(makeManifest(), saved);
    assert.strictEqual(result.modelId, "T3W1");
    assert.strictEqual(result.targetId, "hw");
    assert.strictEqual(result.componentId, "prodtest");
  });

  test("replaces stale componentId with first component, keeps valid modelId and targetId", () => {
    const saved = makeConfig({ modelId: "T3W1", targetId: "emu", componentId: "DELETED" });
    const result = normalizeActiveConfig(makeManifest(), saved);
    assert.strictEqual(result.modelId, "T3W1");
    assert.strictEqual(result.targetId, "emu");
    assert.strictEqual(result.componentId, "core");
  });
});

// ---------------------------------------------------------------------------
// Saved config fully stale
// ---------------------------------------------------------------------------

suite("normalizeActiveConfig – saved config fully stale", () => {
  test("replaces all three ids with first-entry defaults when all saved ids are stale", () => {
    const saved = makeConfig({ modelId: "OLD_M", targetId: "OLD_T", componentId: "OLD_C" });
    const result = normalizeActiveConfig(makeManifest(), saved);
    assert.strictEqual(result.modelId, "T2T1");
    assert.strictEqual(result.targetId, "hw");
    assert.strictEqual(result.componentId, "core");
  });
});
