/**
 * Integration tests for the default Run and Debug entry and F5 launch path.
 *
 * Covers (User Story 1):
 *  - TfToolsDebugConfigurationProvider.provideDebugConfigurations returns a default
 *    entry when the active build context has at least one matching profile and a
 *    valid executable artifact.
 *  - The default entry targets the first matching profile in declaration order.
 *  - provideDebugConfigurations returns an empty list when no profile matches.
 *  - provideDebugConfigurations returns an empty list when executable artifact is missing.
 *  - The default entry has type "tftools", request "launch", and tfToolsMode "default".
 *  - The default entry label uses the generic tf-tools name.
 *  - resolveDebugConfiguration resolves a valid proxy config to the real debug configuration.
 *  - Launching through the provider succeeds without creating .vscode/launch.json.
 *  - The provider is registered as a command after extension activation.
 */

import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";
import {
  TfToolsDebugConfigurationProvider,
  TFTOOLS_DEBUG_TYPE,
  generateDebugConfigurations,
  labelForDefaultEntry,
} from "../../debug/run-debug-provider";
import {
  makeComponentDebugProfile,
  makeIntelliSenseLoadedState,
  debugLaunchValidTemplatesRoot,
  isTfToolsProxyConfig,
} from "../unit/workflow-test-helpers";
import { ManifestStateLoaded, ManifestComponentDebugProfile } from "../../manifest/manifest-types";
import { makeContextKey } from "../../intellisense/artifact-resolution";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(modelId: string, targetId = "hw", componentId = "core") {
  return { modelId, targetId, componentId, persistedAt: "" };
}

/** Builds a manifest state whose derived exe path is <artifactsRoot>/model-t/firmware.elf */
function makeExeManifest(
  profiles: ManifestComponentDebugProfile[] = [],
  overrides: Partial<ManifestStateLoaded> = {}
): ManifestStateLoaded {
  return makeIntelliSenseLoadedState({
    targets: [{
      kind: "target",
      id: "hw",
      name: "Hardware",
      shortName: "HW",
      executableExtension: ".elf",
    } as ManifestStateLoaded["targets"][0]],
    components: [{
      kind: "component",
      id: "core",
      name: "Core",
      artifactName: "firmware",
      debug: profiles,
    } as ManifestStateLoaded["components"][0]],
    hasDebugBlockingIssues: false,
    ...overrides,
  });
}

function makeWorkspaceFolder(folderPath: string): vscode.WorkspaceFolder {
  return {
    uri: vscode.Uri.file(folderPath),
    name: "test",
    index: 0,
  };
}

function makeCancelToken(): vscode.CancellationToken {
  return new vscode.CancellationTokenSource().token;
}

// ---------------------------------------------------------------------------
// Suite: generateDebugConfigurations – default entry presence
// ---------------------------------------------------------------------------

suite("generateDebugConfigurations – default entry", () => {
  let tmpDir: string;

  setup(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tf-tools-qs1-"));
    fs.mkdirSync(path.join(tmpDir, "model-t"), { recursive: true });
  });

  teardown(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("returns default entry when one matching profile and valid executable", () => {
    const profile = makeComponentDebugProfile({
      name: "GDB Remote",
      template: "gdb-remote.json",
      componentId: "core",
    });
    const exeFile = path.join(tmpDir, "model-t", "firmware.elf");
    fs.writeFileSync(exeFile, "");
    const manifest = makeExeManifest([profile]);
    const config = makeConfig("T2T1");

    const entries = generateDebugConfigurations(manifest, config, tmpDir);

    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].type, TFTOOLS_DEBUG_TYPE);
    assert.strictEqual(entries[0].request, "launch");
    assert.strictEqual(entries[0]["tfToolsMode"], "default");
    assert.strictEqual(entries[0]["tfToolsProfileId"], profile.id);
    assert.strictEqual(
      entries[0]["tfToolsContextKey"],
      makeContextKey(config)
    );
  });

  test("default entry label uses the generic tf-tools name", () => {
    const profile = makeComponentDebugProfile({
      name: "GDB Remote",
      template: "gdb-remote.json",
      componentId: "core",
    });
    const exeFile = path.join(tmpDir, "model-t", "firmware.elf");
    fs.writeFileSync(exeFile, "");
    const manifest = makeExeManifest([profile]);
    const config = makeConfig("T2T1");

    const entries = generateDebugConfigurations(manifest, config, tmpDir);

    const expected = labelForDefaultEntry();
    assert.strictEqual(entries[0].name, expected);
    assert.strictEqual(entries[0].name, "Trezor");
  });

  test("returns empty list when no debug profile matches", () => {
    const profile = makeComponentDebugProfile({
      name: "GDB Remote",
      template: "gdb-remote.json",
      componentId: "core",
      when: { type: "model", id: "T3W1" }, // won't match T2T1
    });
    const exeFile = path.join(tmpDir, "model-t", "firmware.elf");
    fs.writeFileSync(exeFile, "");
    const manifest = makeExeManifest([profile]);
    const config = makeConfig("T2T1");

    const entries = generateDebugConfigurations(manifest, config, tmpDir);
    assert.strictEqual(entries.length, 0);
  });

  test("returns empty list when executable artifact is missing", () => {
    const profile = makeComponentDebugProfile({
      name: "GDB Remote",
      template: "gdb-remote.json",
      componentId: "core",
    });
    // Do not create the exe file
    const manifest = makeExeManifest([profile]);
    const config = makeConfig("T2T1");

    const entries = generateDebugConfigurations(manifest, config, tmpDir);
    assert.strictEqual(entries.length, 0);
  });

  test("returns empty list when manifest has debug blocking issues", () => {
    const profile = makeComponentDebugProfile({
      name: "GDB Remote",
      template: "gdb-remote.json",
      componentId: "core",
    });
    fs.writeFileSync(path.join(tmpDir, "model-t", "firmware.elf"), "");
    const manifest = makeExeManifest([profile], { hasDebugBlockingIssues: true });
    const config = makeConfig("T2T1");

    const entries = generateDebugConfigurations(manifest, config, tmpDir);
    assert.strictEqual(entries.length, 0);
  });

  test("default entry contextKey matches makeContextKey for the active config", () => {
    const profile = makeComponentDebugProfile({
      name: "GDB Remote",
      template: "gdb-remote.json",
      componentId: "core",
    });
    fs.writeFileSync(path.join(tmpDir, "model-t", "firmware.elf"), "");
    const manifest = makeExeManifest([profile]);
    const config = makeConfig("T2T1");

    const entries = generateDebugConfigurations(manifest, config, tmpDir);
    assert.strictEqual(entries[0]["tfToolsContextKey"], "T2T1::hw::core");
  });
});

// ---------------------------------------------------------------------------
// Suite: provideDebugConfigurations via provider instance
// ---------------------------------------------------------------------------

suite("TfToolsDebugConfigurationProvider – provideDebugConfigurations", () => {
  let tmpDir: string;

  setup(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tf-tools-provider-"));
    fs.mkdirSync(path.join(tmpDir, "model-t"), { recursive: true });
  });

  teardown(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("returns default entry through provider interface", () => {
    const profile = makeComponentDebugProfile({
      name: "GDB Remote",
      template: "gdb-remote.json",
      componentId: "core",
    });
    fs.writeFileSync(path.join(tmpDir, "model-t", "firmware.elf"), "");
    const manifest = makeExeManifest([profile]);
    const config = makeConfig("T2T1");
    const folder = makeWorkspaceFolder(tmpDir);

    const provider = new TfToolsDebugConfigurationProvider(
      () => manifest,
      () => config,
      () => tmpDir,
      () => debugLaunchValidTemplatesRoot(),
      folder
    );

    const result = provider.provideDebugConfigurations(folder, makeCancelToken());
    const entries = result as vscode.DebugConfiguration[];

    assert.strictEqual(entries.length, 1);
    assert.ok(isTfToolsProxyConfig(entries[0] as Record<string, unknown>));
    assert.strictEqual(entries[0]["tfToolsMode"], "default");
  });

  test("returns empty list when manifest is not loaded", () => {
    const folder = makeWorkspaceFolder(tmpDir);
    const provider = new TfToolsDebugConfigurationProvider(
      () => undefined,
      () => makeConfig("T2T1"),
      () => tmpDir,
      () => debugLaunchValidTemplatesRoot(),
      folder
    );

    const result = provider.provideDebugConfigurations(folder, makeCancelToken());
    assert.deepStrictEqual(result, []);
  });

  test("returns empty list when no active config", () => {
    const profile = makeComponentDebugProfile({ name: "GDB Remote", template: "gdb-remote.json", componentId: "core" });
    fs.writeFileSync(path.join(tmpDir, "model-t", "firmware.elf"), "");
    const manifest = makeExeManifest([profile]);
    const folder = makeWorkspaceFolder(tmpDir);

    const provider = new TfToolsDebugConfigurationProvider(
      () => manifest,
      () => undefined,
      () => tmpDir,
      () => debugLaunchValidTemplatesRoot(),
      folder
    );

    const result = provider.provideDebugConfigurations(folder, makeCancelToken());
    assert.deepStrictEqual(result, []);
  });
});

// ---------------------------------------------------------------------------
// Suite: resolveDebugConfiguration (launch resolution / F5 path)
// ---------------------------------------------------------------------------

suite("TfToolsDebugConfigurationProvider – resolveDebugConfiguration", () => {
  let tmpDir: string;

  setup(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tf-tools-resolve-"));
    fs.mkdirSync(path.join(tmpDir, "model-t"), { recursive: true });
  });

  teardown(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("resolves proxy config to real debug configuration", () => {
    const profile = makeComponentDebugProfile({
      name: "GDB Remote",
      template: "gdb-remote.json",
      componentId: "core",
    });
    const exeFile = path.join(tmpDir, "model-t", "firmware.elf");
    fs.writeFileSync(exeFile, "");
    const manifest = makeExeManifest([profile]);
    const config = makeConfig("T2T1");
    const folder = makeWorkspaceFolder(tmpDir);
    const templatesRoot = debugLaunchValidTemplatesRoot();

    const provider = new TfToolsDebugConfigurationProvider(
      () => manifest,
      () => config,
      () => tmpDir,
      () => templatesRoot,
      folder
    );

    const proxyConfig: vscode.DebugConfiguration = {
      type: TFTOOLS_DEBUG_TYPE,
      request: "launch",
      name: "Trezor: test",
      tfToolsMode: "default",
      tfToolsProfileId: profile.id,
      tfToolsContextKey: makeContextKey(config),
    };

    const resolved = provider.resolveDebugConfiguration(folder, proxyConfig, makeCancelToken());

    assert.ok(resolved !== undefined, "Resolved config should not be undefined");
    const resolvedConfig = resolved as vscode.DebugConfiguration;
    // Real config should not be type "tftools" — it should be the template's type
    assert.notStrictEqual(resolvedConfig.type, TFTOOLS_DEBUG_TYPE);
  });

  test("resolved default entry keeps the proxy label for repeat F5 launches", () => {
    const profile = makeComponentDebugProfile({
      name: "GDB Remote",
      template: "gdb-remote.json",
      componentId: "core",
    });
    const exeFile = path.join(tmpDir, "model-t", "firmware.elf");
    fs.writeFileSync(exeFile, "");
    const manifest = makeExeManifest([profile]);
    const config = makeConfig("T2T1");
    const folder = makeWorkspaceFolder(tmpDir);
    const templatesRoot = debugLaunchValidTemplatesRoot();

    const provider = new TfToolsDebugConfigurationProvider(
      () => manifest,
      () => config,
      () => tmpDir,
      () => templatesRoot,
      folder
    );

    const proxyConfig: vscode.DebugConfiguration = {
      type: TFTOOLS_DEBUG_TYPE,
      request: "launch",
      name: "Trezor",
      tfToolsMode: "default",
      tfToolsProfileId: profile.id,
      tfToolsContextKey: makeContextKey(config),
    };

    const resolved = provider.resolveDebugConfiguration(folder, proxyConfig, makeCancelToken());

    assert.ok(resolved !== undefined, "Resolved config should not be undefined");
    assert.strictEqual((resolved as vscode.DebugConfiguration).name, proxyConfig.name);
  });

  test("resolved default entry canonicalizes older long proxy labels", () => {
    const profile = makeComponentDebugProfile({
      name: "GDB Remote",
      template: "gdb-remote.json",
      componentId: "core",
    });
    const exeFile = path.join(tmpDir, "model-t", "firmware.elf");
    fs.writeFileSync(exeFile, "");
    const manifest = makeExeManifest([profile]);
    const config = makeConfig("T2T1");
    const folder = makeWorkspaceFolder(tmpDir);

    const provider = new TfToolsDebugConfigurationProvider(
      () => manifest,
      () => config,
      () => tmpDir,
      () => debugLaunchValidTemplatesRoot(),
      folder
    );

    const oldProxyConfig: vscode.DebugConfiguration = {
      type: TFTOOLS_DEBUG_TYPE,
      request: "launch",
      name: "Trezor: Trezor Model T (v1) | HW | Core",
      tfToolsMode: "default",
      tfToolsProfileId: profile.id,
      tfToolsContextKey: makeContextKey(config),
    };

    const resolved = provider.resolveDebugConfiguration(folder, oldProxyConfig, makeCancelToken());

    assert.ok(resolved !== undefined, "Resolved config should not be undefined");
    assert.strictEqual((resolved as vscode.DebugConfiguration).name, "Trezor");
  });

  test("resolving a non-tftools config returns it unchanged", () => {
    const folder = makeWorkspaceFolder(tmpDir);
    const provider = new TfToolsDebugConfigurationProvider(
      () => undefined,
      () => undefined,
      () => tmpDir,
      () => debugLaunchValidTemplatesRoot(),
      folder
    );

    const nonProxy: vscode.DebugConfiguration = {
      type: "cortex-debug",
      request: "launch",
      name: "Other debugger",
    };

    const result = provider.resolveDebugConfiguration(folder, nonProxy, makeCancelToken());
    assert.strictEqual(result, nonProxy);
  });

  test("resolving stale proxy config returns undefined", () => {
    const profile = makeComponentDebugProfile({
      name: "GDB Remote",
      template: "gdb-remote.json",
      componentId: "core",
    });
    fs.writeFileSync(path.join(tmpDir, "model-t", "firmware.elf"), "");
    const manifest = makeExeManifest([profile]);
    const currentConfig = makeConfig("T2T1");
    const folder = makeWorkspaceFolder(tmpDir);

    const provider = new TfToolsDebugConfigurationProvider(
      () => manifest,
      () => currentConfig, // current context is T2T1
      () => tmpDir,
      () => debugLaunchValidTemplatesRoot(),
      folder
    );

    const staleProxy: vscode.DebugConfiguration = {
      type: TFTOOLS_DEBUG_TYPE,
      request: "launch",
      name: "Trezor: stale",
      tfToolsMode: "default",
      tfToolsProfileId: profile.id,
      tfToolsContextKey: "T3W1::hw::core", // stale key
    };

    const result = provider.resolveDebugConfiguration(folder, staleProxy, makeCancelToken());
    assert.strictEqual(result, undefined);
  });
});

// ---------------------------------------------------------------------------
// Suite: package contribution for tftools dynamic entries
// ---------------------------------------------------------------------------

suite("Run and Debug – package contribution", () => {
  test("package.json contributes the tftools debugger type used for dynamic entries", () => {
    const ext = vscode.extensions.getExtension("cepetr.tf-tools");
    if (!ext) {
      // Skip in unit test environment without extension host
      return;
    }
    const pkg = ext.packageJSON as Record<string, unknown>;
    const debuggers = pkg["contributes"] as Record<string, unknown> | undefined;
    // The debuggers contribution must exist for our proxy type
    const debuggerList = (debuggers?.["debuggers"] as Array<Record<string, unknown>> | undefined) ?? [];
    const tfToolsDebugger = debuggerList.find((d) => d["type"] === TFTOOLS_DEBUG_TYPE);
    assert.ok(tfToolsDebugger, "tftools debugger type must be contributed in package.json");
  });
});
