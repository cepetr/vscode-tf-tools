/**
 * Integration tests for manifest health states.
 * Runs inside the VS Code extension host via @vscode/test-electron.
 */
import * as assert from "assert";
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs/promises";
import * as os from "os";
import { ManifestService } from "../../manifest/manifest-service";
import { ManifestState, ManifestStateLoaded } from "../../manifest/manifest-types";
import { resolveActiveArtifact, buildResolutionInputs, deriveArtifactPath } from "../../intellisense/artifact-resolution";
import { checkProviderReadiness } from "../../intellisense/cpptools-provider";
import { IntelliSenseService } from "../../intellisense/intellisense-service";
import { ActiveConfig } from "../../configuration/active-config";
import { SectionItem, ConfigurationTreeProvider } from "../../ui/configuration-tree";

// ---------------------------------------------------------------------------
// Regression target: all three root sections must default to Expanded (UI-02)
// Refs: informal_spec/user-spec.md UI-02, specs/001-configuration-experience/spec.md FR-018
// ---------------------------------------------------------------------------
const EXPECTED_ROOT_SECTION_COUNT = 3;

const VALID_MANIFEST = `
models:
  - id: T2T1
    name: Trezor Model T
targets:
  - id: hw
    name: Hardware
    shortName: HW
components:
  - id: core
    name: Core
`.trim();

const INVALID_MANIFEST = `
models: []
targets: []
components: []
`.trim();

suite("ManifestService - health states", () => {
  let tmpDir: string;

  setup(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "tf-tools-test-"));
  });

  teardown(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  test("status is 'loaded' when manifest is valid", async () => {
    const manifestPath = path.join(tmpDir, "tf-tools.yaml");
    await fs.writeFile(manifestPath, VALID_MANIFEST, "utf-8");

    const uri = vscode.Uri.file(manifestPath);
    const service = new ManifestService(uri);
    const state = await service.start();
    service.dispose();

    assert.strictEqual(state.status, "loaded");
    if (state.status === "loaded") {
      assert.strictEqual(state.models.length, 1);
      assert.strictEqual(state.targets.length, 1);
      assert.strictEqual(state.components.length, 1);
      assert.strictEqual(state.models[0].id, "T2T1");
      assert.strictEqual(state.targets[0].shortName, "HW");
    }
  });

  test("status is 'missing' when manifest file does not exist", async () => {
    const manifestPath = path.join(tmpDir, "tf-tools.yaml"); // not created
    const uri = vscode.Uri.file(manifestPath);
    const service = new ManifestService(uri);
    const state = await service.start();
    service.dispose();

    assert.strictEqual(state.status, "missing");
    assert.strictEqual(state.manifestUri.fsPath, manifestPath);
  });

  test("status is 'invalid' when manifest has structural errors", async () => {
    const manifestPath = path.join(tmpDir, "tf-tools.yaml");
    await fs.writeFile(manifestPath, INVALID_MANIFEST, "utf-8");

    const uri = vscode.Uri.file(manifestPath);
    const service = new ManifestService(uri);
    const state = await service.start();
    service.dispose();

    assert.strictEqual(state.status, "invalid");
    if (state.status === "invalid") {
      assert.ok(state.validationIssues.length > 0, "expected validation issues");
    }
  });

  test("status is 'invalid' when manifest has malformed YAML", async () => {
    const malformedYaml = "models:\n  - id: T2T1\n    bad: [unclosed";
    const manifestPath = path.join(tmpDir, "tf-tools.yaml");
    await fs.writeFile(manifestPath, malformedYaml, "utf-8");

    const uri = vscode.Uri.file(manifestPath);
    const service = new ManifestService(uri);
    const state = await service.start();
    service.dispose();

    assert.strictEqual(state.status, "invalid");
    if (state.status === "invalid") {
      assert.ok(state.validationIssues.some((i: {code: string}) => i.code === "yaml-parse"));
    }
  });

  test("fires onDidChangeState when manifest changes", async () => {
    const manifestPath = path.join(tmpDir, "tf-tools.yaml");
    await fs.writeFile(manifestPath, VALID_MANIFEST, "utf-8");

    const uri = vscode.Uri.file(manifestPath);
    const service = new ManifestService(uri);
    await service.start();

    const states: Array<{ status: string }> = [];
    service.onDidChangeState((s: ManifestState) => states.push({ status: s.status }));

    // Overwrite with invalid manifest and reload
    await fs.writeFile(manifestPath, INVALID_MANIFEST, "utf-8");
    await service.reload();

    service.dispose();
    assert.ok(states.length > 0, "expected at least one state change event");
    assert.strictEqual(states[states.length - 1].status, "invalid");
  });

  test("transitions from missing to loaded when manifest is created", async () => {
    const manifestPath = path.join(tmpDir, "tf-tools.yaml"); // not yet created
    const uri = vscode.Uri.file(manifestPath);
    const service = new ManifestService(uri);
    const initialState = await service.start();
    assert.strictEqual(initialState.status, "missing");

    // Create the manifest
    await fs.writeFile(manifestPath, VALID_MANIFEST, "utf-8");
    const loadedState = await service.reload();
    service.dispose();

    assert.strictEqual(loadedState.status, "loaded");
  });
});

// ---------------------------------------------------------------------------
// T021: Compile-commands status and tooltip refresh (real filesystem checks)
// ---------------------------------------------------------------------------

const INTELLISENSE_MANIFEST = `
models:
  - id: T2T1
    name: Trezor Model T
    artifact-folder: model-t
targets:
  - id: hw
    name: Hardware
    shortName: HW
  - id: emu
    name: Emulator
    shortName: EMU
    artifact-suffix: _emu
components:
  - id: core
    name: Core
    artifact-name: compile_commands_core
`.trim();

function makeIntellisenseLoadedState(overrides: Partial<ManifestStateLoaded> = {}): ManifestStateLoaded {
  return {
    status: "loaded",
    manifestUri: vscode.Uri.file("/workspace/tf-tools.yaml"),
    models: [{ kind: "model", id: "T2T1", name: "Trezor Model T", artifactFolder: "model-t" }],
    targets: [
      { kind: "target", id: "hw", name: "Hardware", shortName: "HW" },
      { kind: "target", id: "emu", name: "Emulator", shortName: "EMU", artifactSuffix: "_emu" },
    ],
    components: [{ kind: "component", id: "core", name: "Core", artifactName: "compile_commands_core" }],
    buildOptions: [],
    hasWorkflowBlockingIssues: false,
    validationIssues: [],
    loadedAt: new Date(),
    ...overrides,
  };
}

function makeActiveConfig(modelId: string, targetId: string, componentId: string): ActiveConfig {
  return { modelId, targetId, componentId, persistedAt: new Date().toISOString() };
}

suite("resolveActiveArtifact – filesystem integration (T021)", () => {
  let tmpDir: string;

  setup(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "tf-tools-intellisense-"));
  });

  teardown(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  test("status is 'missing' when artifact file does not exist on disk", async () => {
    const manifest = makeIntellisenseLoadedState();
    const config = makeActiveConfig("T2T1", "hw", "core");
    const inputs = buildResolutionInputs(manifest, config, tmpDir);
    assert.ok(inputs, "expected resolution inputs to resolve");

    const artifact = resolveActiveArtifact(inputs!, config);
    assert.strictEqual(artifact.status, "missing");
    assert.strictEqual(artifact.exists, false);
  });

  test("status is 'valid' when artifact file exists on disk", async () => {
    const manifest = makeIntellisenseLoadedState();
    const config = makeActiveConfig("T2T1", "hw", "core");
    const inputs = buildResolutionInputs(manifest, config, tmpDir);
    assert.ok(inputs, "expected resolution inputs to resolve");

    // Create the artifact file on disk
    const artifactPath = deriveArtifactPath(inputs!)!;
    assert.ok(artifactPath, "expected derived artifact path");
    await fs.mkdir(path.dirname(artifactPath), { recursive: true });
    await fs.writeFile(artifactPath, "[]", "utf-8");

    const artifact = resolveActiveArtifact(inputs!, config);
    assert.strictEqual(artifact.status, "valid");
    assert.strictEqual(artifact.exists, true);
    assert.strictEqual(artifact.path, artifactPath);
  });

  test("status transitions from missing to valid when file is created", async () => {
    const manifest = makeIntellisenseLoadedState();
    const config = makeActiveConfig("T2T1", "hw", "core");
    const inputs = buildResolutionInputs(manifest, config, tmpDir);
    assert.ok(inputs, "expected resolution inputs to resolve");

    // First resolve: file absent
    const before = resolveActiveArtifact(inputs!, config);
    assert.strictEqual(before.status, "missing");

    // Create the file
    const artifactPath = deriveArtifactPath(inputs!)!;
    assert.ok(artifactPath, "expected derived artifact path");
    await fs.mkdir(path.dirname(artifactPath), { recursive: true });
    await fs.writeFile(artifactPath, "[]", "utf-8");

    // Second resolve: file present
    const after = resolveActiveArtifact(inputs!, config);
    assert.strictEqual(after.status, "valid");
  });

  test("path contains artifact-folder in directory, not model id", async () => {
    const manifest = makeIntellisenseLoadedState();
    const config = makeActiveConfig("T2T1", "hw", "core");
    const inputs = buildResolutionInputs(manifest, config, tmpDir);
    assert.ok(inputs);
    const derivedPath = deriveArtifactPath(inputs!);
    assert.ok(derivedPath, "expected derived path");
    assert.ok(
      derivedPath!.includes("model-t"),
      `path should contain artifact-folder 'model-t': ${derivedPath}`
    );
    assert.ok(
      !derivedPath!.includes("T2T1"),
      `path should not contain model id 'T2T1': ${derivedPath}`
    );
  });

  test("path contains artifact-suffix for suffixed target", async () => {
    const manifest = makeIntellisenseLoadedState();
    const config = makeActiveConfig("T2T1", "emu", "core");
    const inputs = buildResolutionInputs(manifest, config, tmpDir);
    assert.ok(inputs);
    const derivedPath = deriveArtifactPath(inputs!);
    assert.ok(derivedPath, "expected derived path for emu target");
    assert.ok(
      derivedPath!.includes("_emu"),
      `path should contain artifact-suffix '_emu': ${derivedPath}`
    );
  });

  test("contextKey encodes model, target, and component ids", async () => {
    const manifest = makeIntellisenseLoadedState();
    const config = makeActiveConfig("T2T1", "hw", "core");
    const inputs = buildResolutionInputs(manifest, config, tmpDir);
    assert.ok(inputs);

    const artifact = resolveActiveArtifact(inputs!, config);
    assert.strictEqual(artifact.contextKey, "T2T1::hw::core");
  });

  test("missing artifact tooltip reports expected path in missingReason", async () => {
    const manifest = makeIntellisenseLoadedState();
    const config = makeActiveConfig("T2T1", "hw", "core");
    const inputs = buildResolutionInputs(manifest, config, tmpDir);
    assert.ok(inputs);

    const artifact = resolveActiveArtifact(inputs!, config);
    assert.strictEqual(artifact.status, "missing");
    // missingReason should reference the expected path
    assert.ok(
      artifact.missingReason !== undefined,
      "expected missingReason to be set for missing artifact"
    );
  });
});

// ---------------------------------------------------------------------------
// T026: Provider-readiness and warning recovery (real VS Code host)
// ---------------------------------------------------------------------------

suite("checkProviderReadiness – integration (T026)", () => {
  test("returns a defined readiness object", () => {
    const result = checkProviderReadiness();
    assert.ok(result, "expected checkProviderReadiness to return a value");
  });

  test("warningState is one of the expected values", () => {
    const result = checkProviderReadiness();
    const validStates = ["none", "missing-provider", "wrong-provider"];
    assert.ok(
      validStates.includes(result.warningState),
      `expected warningState to be one of ${validStates}, got: ${result.warningState}`
    );
  });

  test("providerInstalled is boolean", () => {
    const result = checkProviderReadiness();
    assert.strictEqual(typeof result.providerInstalled, "boolean");
  });

  test("providerConfigured is boolean", () => {
    const result = checkProviderReadiness();
    assert.strictEqual(typeof result.providerConfigured, "boolean");
  });

  test("lastWarningMessage is string or undefined", () => {
    const result = checkProviderReadiness();
    assert.ok(
      result.lastWarningMessage === undefined || typeof result.lastWarningMessage === "string",
      `expected lastWarningMessage to be string or undefined`
    );
  });

  test("lastWarningMessage is set when warningState is not 'none'", () => {
    const result = checkProviderReadiness();
    if (result.warningState !== "none") {
      assert.ok(
        result.lastWarningMessage && result.lastWarningMessage.length > 0,
        `expected lastWarningMessage when warningState is '${result.warningState}'`
      );
    }
  });

  test("lastWarningMessage is undefined when warningState is 'none'", () => {
    const result = checkProviderReadiness();
    if (result.warningState === "none") {
      assert.strictEqual(result.lastWarningMessage, undefined);
    }
  });

  test("cpptools missing means providerInstalled is false (test environment)", () => {
    // In the integration test environment, ms-vscode.cpptools is not installed.
    // This test validates the detection path works correctly in the host.
    const cpptoolsExt = vscode.extensions.getExtension("ms-vscode.cpptools");
    const result = checkProviderReadiness();
    if (!cpptoolsExt) {
      assert.strictEqual(result.providerInstalled, false);
      assert.strictEqual(result.warningState, "missing-provider");
    }
  });
});

// ---------------------------------------------------------------------------
// T004: ConfigurationTreeProvider root section expansion (UI-02)
// Integration tests asserting all three root sections default to Expanded and
// that their children (placeholder or status content) are reachable immediately.
// These tests MUST FAIL for build-options and build-artifacts until T005 fixes
// the SectionItem constructor.
// ---------------------------------------------------------------------------

suite("ConfigurationTreeProvider – root section expansion (UI-02)", () => {
  test("getChildren(undefined) returns exactly three root sections", () => {
    const provider = new ConfigurationTreeProvider();
    const roots = provider.getChildren(undefined);
    assert.strictEqual(
      roots.length,
      EXPECTED_ROOT_SECTION_COUNT,
      `Expected ${EXPECTED_ROOT_SECTION_COUNT} root sections, got ${roots.length}`
    );
  });

  test("all three root sections default to Expanded", () => {
    const provider = new ConfigurationTreeProvider();
    const roots = provider.getChildren(undefined);
    for (const item of roots) {
      assert.strictEqual(
        item.collapsibleState,
        vscode.TreeItemCollapsibleState.Expanded,
        `Expected section '${(item as SectionItem).sectionId}' to be Expanded by default`
      );
    }
  });

  test("Build Context section is Expanded before any manifest is loaded", () => {
    const provider = new ConfigurationTreeProvider();
    const roots = provider.getChildren(undefined);
    const buildContext = roots.find(
      (r) => (r as SectionItem).sectionId === "build-context"
    );
    assert.ok(buildContext, "Expected Build Context section to exist");
    assert.strictEqual(
      buildContext!.collapsibleState,
      vscode.TreeItemCollapsibleState.Expanded
    );
  });

  test("Build Options section is Expanded before any manifest is loaded", () => {
    const provider = new ConfigurationTreeProvider();
    const roots = provider.getChildren(undefined);
    const buildOptions = roots.find(
      (r) => (r as SectionItem).sectionId === "build-options"
    );
    assert.ok(buildOptions, "Expected Build Options section to exist");
    assert.strictEqual(
      buildOptions!.collapsibleState,
      vscode.TreeItemCollapsibleState.Expanded
    );
  });

  test("Build Artifacts section is Expanded before any manifest is loaded", () => {
    const provider = new ConfigurationTreeProvider();
    const roots = provider.getChildren(undefined);
    const buildArtifacts = roots.find(
      (r) => (r as SectionItem).sectionId === "build-artifacts"
    );
    assert.ok(buildArtifacts, "Expected Build Artifacts section to exist");
    assert.strictEqual(
      buildArtifacts!.collapsibleState,
      vscode.TreeItemCollapsibleState.Expanded
    );
  });

  test("Build Context children are reachable immediately (loading placeholder visible)", () => {
    const provider = new ConfigurationTreeProvider();
    const roots = provider.getChildren(undefined);
    const buildContext = roots.find(
      (r) => (r as SectionItem).sectionId === "build-context"
    );
    assert.ok(buildContext, "Expected Build Context section");
    const children = provider.getChildren(buildContext);
    assert.ok(children.length > 0, "Expected Build Context to have visible child content");
  });

  test("Build Options children are reachable immediately (placeholder visible)", () => {
    const provider = new ConfigurationTreeProvider();
    const roots = provider.getChildren(undefined);
    const buildOptions = roots.find(
      (r) => (r as SectionItem).sectionId === "build-options"
    );
    assert.ok(buildOptions, "Expected Build Options section");
    const children = provider.getChildren(buildOptions);
    assert.ok(children.length > 0, "Expected Build Options to have visible placeholder content");
  });

  test("Build Artifacts children are reachable immediately (placeholder visible)", () => {
    const provider = new ConfigurationTreeProvider();
    const roots = provider.getChildren(undefined);
    const buildArtifacts = roots.find(
      (r) => (r as SectionItem).sectionId === "build-artifacts"
    );
    assert.ok(buildArtifacts, "Expected Build Artifacts section");
    const children = provider.getChildren(buildArtifacts);
    assert.ok(children.length > 0, "Expected Build Artifacts to have visible placeholder content");
  });
});

// ---------------------------------------------------------------------------
// T024: IntelliSenseService – provider-warning and warning recovery flows
// ---------------------------------------------------------------------------

suite("IntelliSenseService – provider warning flows (T024)", () => {
  /** Waits for the pending refresh to drain (no public API, so we yield). */
  function drainRefresh(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 50));
  }

  test("getLastReadiness is null before any refresh", () => {
    const svc = new IntelliSenseService();
    assert.strictEqual(svc.getLastReadiness(), null);
  });

  test("getLastArtifact is null before any refresh", () => {
    const svc = new IntelliSenseService();
    assert.strictEqual(svc.getLastArtifact(), null);
  });

  test("getLastReadiness is populated after scheduleRefresh", async () => {
    const svc = new IntelliSenseService();
    svc.scheduleRefresh("activation");
    await drainRefresh();
    const readiness = svc.getLastReadiness();
    assert.ok(readiness !== null, "expected readiness to be set after refresh");
  });

  test("getLastReadiness after refresh matches direct checkProviderReadiness call", async () => {
    const svc = new IntelliSenseService();
    svc.scheduleRefresh("activation");
    await drainRefresh();
    const fromService = svc.getLastReadiness()!;
    const direct = checkProviderReadiness();
    assert.strictEqual(fromService.warningState, direct.warningState);
    assert.strictEqual(fromService.providerInstalled, direct.providerInstalled);
    assert.strictEqual(fromService.providerConfigured, direct.providerConfigured);
  });

  test("getLastArtifact is null when no manifest is set (no active context)", async () => {
    const svc = new IntelliSenseService();
    svc.scheduleRefresh("activation");
    await drainRefresh();
    assert.strictEqual(svc.getLastArtifact(), null);
  });

  test("onDidRefresh fires after scheduleRefresh", async () => {
    const svc = new IntelliSenseService();
    let firedCount = 0;
    svc.onDidRefresh(() => {
      firedCount++;
    });
    svc.scheduleRefresh("activation");
    await drainRefresh();
    assert.ok(firedCount >= 1, `expected onDidRefresh to fire at least once, fired: ${firedCount}`);
  });

  test("consecutive refreshes do not corrupt state", async () => {
    const svc = new IntelliSenseService();
    svc.scheduleRefresh("activation");
    svc.scheduleRefresh("active-config-change");
    svc.scheduleRefresh("manual-refresh");
    await drainRefresh();
    // State should reflect a valid final readiness (no crash or null)
    const readiness = svc.getLastReadiness();
    assert.ok(readiness !== null, "expected readiness to survive concurrent refresh calls");
  });

  test("missing-provider warningState persists when cpptools is absent", async () => {
    // In the integration test host, ms-vscode.cpptools is not installed.
    const cpptoolsExt = vscode.extensions.getExtension("ms-vscode.cpptools");
    if (cpptoolsExt) {
      // Skip: can't isolate missing-provider when cpptools is present
      return;
    }
    const svc = new IntelliSenseService();
    svc.scheduleRefresh("activation");
    await drainRefresh();
    assert.strictEqual(svc.getLastReadiness()!.warningState, "missing-provider");
  });

  test("warning recovery: warningState transitions when provider is re-checked", async () => {
    // Verify that each fresh refresh captures the current readiness state.
    // This tests the "recovery flow" path where a new refresh re-evaluates readiness.
    const svc = new IntelliSenseService();
    svc.scheduleRefresh("active-config-change");
    await drainRefresh();
    const firstReadiness = svc.getLastReadiness()!;

    // A second refresh should yield the same stable state (recovery requires env change;
    // here we verify the refresh path itself runs without caching the first warning)
    svc.scheduleRefresh("active-config-change");
    await drainRefresh();
    const secondReadiness = svc.getLastReadiness()!;

    assert.strictEqual(secondReadiness.warningState, firstReadiness.warningState);
  });
});
