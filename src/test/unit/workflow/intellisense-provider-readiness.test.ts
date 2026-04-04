/**
 * Unit tests for checkProviderReadiness: provider-readiness evaluation and warning transitions.
 *
 * Covers:
 *  - missing-provider warning when cpptools is not installed
 *  - wrong-provider warning when a different provider is configured
 *  - ready (none) state when cpptools is present and provider is unconfigured or set to tf-tools
 *  - lastWarningMessage content for each warning state
 *  - providerInstalled and providerConfigured flags for each state
 */

import * as assert from "assert";
import { checkProviderReadiness } from "../../../intellisense/cpptools-provider";

// ---------------------------------------------------------------------------
// Access the vscode mock so we can control extension and configuration state
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-require-imports
const vscodeMock = require("vscode");

// ---------------------------------------------------------------------------
// Helpers for controlling mock state
// ---------------------------------------------------------------------------

type GetExtensionFn = (id: string) => unknown;
type GetConfigurationFn = (section?: string) => { get: (key: string) => unknown };

let originalGetExtension: GetExtensionFn;
let originalGetConfiguration: GetConfigurationFn;

function stubExtensionMissing(): void {
  vscodeMock.extensions.getExtension = () => undefined;
}

function stubExtensionInstalled(): void {
  vscodeMock.extensions.getExtension = (_id: string) => ({ id: "ms-vscode.cpptools" });
}

function stubConfigurationProvider(value: string | undefined): void {
  vscodeMock.workspace.getConfiguration = () => ({
    get: (key: string) => (key === "default.configurationProvider" ? value : undefined),
  });
}

// ---------------------------------------------------------------------------
// Suite: missing-provider warning state
// ---------------------------------------------------------------------------

suite("checkProviderReadiness – missing-provider", () => {
  suiteSetup(() => {
    originalGetExtension = vscodeMock.extensions.getExtension as GetExtensionFn;
    originalGetConfiguration = vscodeMock.workspace.getConfiguration as GetConfigurationFn;
  });

  suiteTeardown(() => {
    vscodeMock.extensions.getExtension = originalGetExtension;
    vscodeMock.workspace.getConfiguration = originalGetConfiguration;
  });

  setup(() => {
    stubExtensionMissing();
    stubConfigurationProvider(undefined);
  });

  test("warningState is 'missing-provider' when cpptools is not installed", () => {
    const result = checkProviderReadiness();
    assert.strictEqual(result.warningState, "missing-provider");
  });

  test("providerInstalled is false when cpptools is absent", () => {
    const result = checkProviderReadiness();
    assert.strictEqual(result.providerInstalled, false);
  });

  test("providerConfigured is false when cpptools is absent", () => {
    const result = checkProviderReadiness();
    assert.strictEqual(result.providerConfigured, false);
  });

  test("lastWarningMessage is set for missing-provider", () => {
    const result = checkProviderReadiness();
    assert.ok(
      result.lastWarningMessage && result.lastWarningMessage.length > 0,
      "expected lastWarningMessage to be non-empty"
    );
  });

  test("lastWarningMessage mentions ms-vscode.cpptools", () => {
    const result = checkProviderReadiness();
    assert.ok(
      result.lastWarningMessage?.includes("ms-vscode.cpptools"),
      `expected message to mention 'ms-vscode.cpptools', got: ${result.lastWarningMessage}`
    );
  });
});

// ---------------------------------------------------------------------------
// Suite: wrong-provider warning state
// ---------------------------------------------------------------------------

suite("checkProviderReadiness – wrong-provider", () => {
  suiteSetup(() => {
    originalGetExtension = vscodeMock.extensions.getExtension as GetExtensionFn;
    originalGetConfiguration = vscodeMock.workspace.getConfiguration as GetConfigurationFn;
  });

  suiteTeardown(() => {
    vscodeMock.extensions.getExtension = originalGetExtension;
    vscodeMock.workspace.getConfiguration = originalGetConfiguration;
  });

  setup(() => {
    stubExtensionInstalled();
    stubConfigurationProvider("ms-vscode.cmake-tools");
  });

  test("warningState is 'wrong-provider' when another provider is configured", () => {
    const result = checkProviderReadiness();
    assert.strictEqual(result.warningState, "wrong-provider");
  });

  test("providerInstalled is true when cpptools is present", () => {
    const result = checkProviderReadiness();
    assert.strictEqual(result.providerInstalled, true);
  });

  test("providerConfigured is false when a different provider is active", () => {
    const result = checkProviderReadiness();
    assert.strictEqual(result.providerConfigured, false);
  });

  test("lastWarningMessage references the misconfigured provider id", () => {
    const result = checkProviderReadiness();
    assert.ok(
      result.lastWarningMessage?.includes("ms-vscode.cmake-tools"),
      `expected message to include the wrong provider id, got: ${result.lastWarningMessage}`
    );
  });

  test("lastWarningMessage is set for wrong-provider", () => {
    const result = checkProviderReadiness();
    assert.ok(
      result.lastWarningMessage && result.lastWarningMessage.length > 0,
      "expected lastWarningMessage to be non-empty"
    );
  });
});

// ---------------------------------------------------------------------------
// Suite: ready state (warningState: "none")
// ---------------------------------------------------------------------------

suite("checkProviderReadiness – ready (none)", () => {
  suiteSetup(() => {
    originalGetExtension = vscodeMock.extensions.getExtension as GetExtensionFn;
    originalGetConfiguration = vscodeMock.workspace.getConfiguration as GetConfigurationFn;
  });

  suiteTeardown(() => {
    vscodeMock.extensions.getExtension = originalGetExtension;
    vscodeMock.workspace.getConfiguration = originalGetConfiguration;
  });

  test("warningState is 'none' when cpptools is present and provider setting is undefined", () => {
    stubExtensionInstalled();
    stubConfigurationProvider(undefined);
    const result = checkProviderReadiness();
    assert.strictEqual(result.warningState, "none");
  });

  test("warningState is 'none' when cpptools is present and provider setting is empty string", () => {
    stubExtensionInstalled();
    stubConfigurationProvider("");
    const result = checkProviderReadiness();
    assert.strictEqual(result.warningState, "none");
  });

  test("warningState is 'none' when provider is set to cepetr.tf-tools", () => {
    stubExtensionInstalled();
    stubConfigurationProvider("cepetr.tf-tools");
    const result = checkProviderReadiness();
    assert.strictEqual(result.warningState, "none");
  });

  test("warningState is 'none' when provider is set to CEPETR.TF-TOOLS (case-insensitive)", () => {
    stubExtensionInstalled();
    stubConfigurationProvider("CEPETR.TF-TOOLS");
    const result = checkProviderReadiness();
    assert.strictEqual(result.warningState, "none");
  });

  test("providerInstalled is true when cpptools is present", () => {
    stubExtensionInstalled();
    stubConfigurationProvider(undefined);
    const result = checkProviderReadiness();
    assert.strictEqual(result.providerInstalled, true);
  });

  test("providerConfigured is true when prerequisites are satisfied", () => {
    stubExtensionInstalled();
    stubConfigurationProvider(undefined);
    const result = checkProviderReadiness();
    assert.strictEqual(result.providerConfigured, true);
  });

  test("lastWarningMessage is undefined when warningState is 'none'", () => {
    stubExtensionInstalled();
    stubConfigurationProvider(undefined);
    const result = checkProviderReadiness();
    assert.strictEqual(result.lastWarningMessage, undefined);
  });
});
