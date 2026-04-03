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
import { ManifestState } from "../../manifest/manifest-types";

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
