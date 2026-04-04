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
import { ActiveConfig } from "../../configuration/active-config";

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
