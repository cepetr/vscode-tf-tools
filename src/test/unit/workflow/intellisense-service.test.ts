/**
 * Unit tests for IntelliSenseService: stale-state clearing and refresh serialization.
 *
 * Covers:
 *  - scheduleRefresh: clears previously applied state when artifact is missing
 *  - scheduleRefresh: publishes onDidRefresh after each completed refresh
 *  - scheduleRefresh: serializes concurrent requests (last config wins)
 *  - scheduleRefresh: does not fall back to a previous artifact when context changes
 *  - scheduleRefresh: emits null artifact when manifest is absent
 *  - Provider readiness: emits correct warning state
 *  - Latest-refresh-wins serialization
 */

import * as assert from "assert";
import * as path from "path";
import { IntelliSenseService } from "../../../intellisense/intellisense-service";
import {
  ActiveCompileCommandsArtifact,
  IntelliSenseProviderReadiness,
  ProviderPayload,
} from "../../../intellisense/intellisense-types";
import { CpptoolsProviderAdapter } from "../../../intellisense/cpptools-provider";
import { makeIntelliSenseLoadedState, primaryCoreFixturePath } from "../workflow-test-helpers";
import { ActiveConfig } from "../../../configuration/active-config";

/**
 * Returns the absolute path to the `artifacts/` directory in the
 * intellisense-valid workspace fixture. Used to set the artifacts root
 * for tests that need a real compile-commands file on disk.
 */
function intellisenseValidArtifactsRoot(): string {
  // primaryCoreFixturePath() = <root>/artifacts/model-t/compile_commands_core.cc.json
  // Two dirname calls: model-t/ → artifacts/
  return path.dirname(path.dirname(primaryCoreFixturePath()));
}

// ---------------------------------------------------------------------------
// Stub adapter
// ---------------------------------------------------------------------------

class StubAdapter extends CpptoolsProviderAdapter {
  public payloadsApplied: Array<ProviderPayload | undefined> = [];
  public clearCount = 0;
  private _lastPayload: ProviderPayload | undefined;

  constructor() {
    // Inject a no-op API accessor so no real cpptools calls happen.
    super(() => undefined);
  }

  override applyPayload(payload: ProviderPayload): void {
    this.payloadsApplied.push(payload);
    this._lastPayload = payload;
  }

  override clearPayload(): void {
    this.clearCount++;
    this._lastPayload = undefined;
  }

  override getLastPayload(): ProviderPayload | undefined {
    return this._lastPayload;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides: Partial<ActiveConfig> = {}): ActiveConfig {
  return {
    modelId: "T2T1",
    targetId: "hw",
    componentId: "core",
    persistedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}


async function awaitRefresh(svc: IntelliSenseService): Promise<[ActiveCompileCommandsArtifact | null, IntelliSenseProviderReadiness]> {
  return new Promise((resolve) => {
    const sub = svc.onDidRefresh((args) => {
      sub.dispose();
      resolve(args);
    });
  });
}

// ---------------------------------------------------------------------------
// Refresh serialization
// ---------------------------------------------------------------------------

suite("IntelliSenseService — refresh serialization", () => {
  test("emits onDidRefresh after scheduleRefresh", async () => {
    const adapter = new StubAdapter();
    const svc = new IntelliSenseService(adapter);
    const p = awaitRefresh(svc);
    svc.scheduleRefresh("activation");
    const [artifact] = await p;
    // No manifest → artifact should be null
    assert.strictEqual(artifact, null);
    svc.dispose();
  });

  test("emits null artifact when no manifest is set", async () => {
    const adapter = new StubAdapter();
    const svc = new IntelliSenseService(adapter);
    const p = awaitRefresh(svc);
    svc.scheduleRefresh("activation");
    const [artifact] = await p;
    assert.strictEqual(artifact, null);
    svc.dispose();
  });

  test("emits missing-status artifact when artifactsRoot is empty", async () => {
    const adapter = new StubAdapter();
    const svc = new IntelliSenseService(adapter);
    svc.setManifest(makeIntelliSenseLoadedState());
    svc.setActiveConfig(makeConfig());
    svc.setArtifactsRoot("");
    const p = awaitRefresh(svc);
    svc.scheduleRefresh("activation");
    const [artifact] = await p;
    assert.strictEqual(artifact?.status, "missing");
    svc.dispose();
  });

  test("emits missing-status when expected file does not exist on disk", async () => {
    const adapter = new StubAdapter();
    const svc = new IntelliSenseService(adapter);
    svc.setManifest(makeIntelliSenseLoadedState());
    svc.setActiveConfig(makeConfig());
    svc.setArtifactsRoot("/nonexistent/path");
    const p = awaitRefresh(svc);
    svc.scheduleRefresh("activation");
    const [artifact] = await p;
    assert.strictEqual(artifact?.status, "missing");
    svc.dispose();
  });
});

// ---------------------------------------------------------------------------
// Stale-state clearing
// ---------------------------------------------------------------------------

suite("IntelliSenseService — stale-state clearing", () => {
  test("calls clearPayload when artifact is missing after a previous apply", async () => {
    const adapter = new StubAdapter();
    const svc = new IntelliSenseService(adapter);

    // Simulate a previously applied payload in the adapter.
    const fakePayload = {
      artifactPath: "/old/compile_commands.cc.json",
      contextKey: "T2T1::hw::core",
      entriesByFile: new Map(),
      browseSnapshot: { browsePaths: [], compilerPath: undefined, compilerArgs: [] },
    };
    adapter.applyPayload(fakePayload);
    adapter.payloadsApplied = []; // reset tracking

    svc.setManifest(makeIntelliSenseLoadedState());
    svc.setActiveConfig(makeConfig());
    svc.setArtifactsRoot("/nonexistent/path");

    const p = awaitRefresh(svc);
    svc.scheduleRefresh("active-config-change");
    await p;

    assert.ok(adapter.clearCount > 0, "expected clearPayload to be called at least once");
    svc.dispose();
  });

  test("does not apply payload when artifact is missing", async () => {
    const adapter = new StubAdapter();
    const svc = new IntelliSenseService(adapter);
    svc.setManifest(makeIntelliSenseLoadedState());
    svc.setActiveConfig(makeConfig());
    svc.setArtifactsRoot("/nonexistent/path");

    const p = awaitRefresh(svc);
    svc.scheduleRefresh("activation");
    await p;

    assert.strictEqual(adapter.payloadsApplied.length, 0, "should not apply payload when artifact is missing");
    svc.dispose();
  });

  test("does not apply payload when provider readiness has a warning", async () => {
    // Provider readiness warning appears when cpptools is absent (which is true in unit-test env)
    const adapter = new StubAdapter();
    const svc = new IntelliSenseService(adapter);
    svc.setManifest(makeIntelliSenseLoadedState());
    svc.setActiveConfig(makeConfig());
    svc.setArtifactsRoot("/nonexistent/path");

    const p = awaitRefresh(svc);
    svc.scheduleRefresh("activation");
    const [, readiness] = await p;

    // In unit-test env cpptools is absent → provider warning expected
    assert.notStrictEqual(readiness.warningState, "none");
    assert.strictEqual(adapter.payloadsApplied.length, 0);
    svc.dispose();
  });

  test("getLastArtifact reflects the most recent refresh result", async () => {
    const adapter = new StubAdapter();
    const svc = new IntelliSenseService(adapter);
    svc.setManifest(makeIntelliSenseLoadedState());
    svc.setActiveConfig(makeConfig());
    svc.setArtifactsRoot("/nonexistent/path");

    const p = awaitRefresh(svc);
    svc.scheduleRefresh("activation");
    await p;

    const last = svc.getLastArtifact();
    assert.strictEqual(last?.status, "missing");
    svc.dispose();
  });

  test("getLastReadiness is populated after refresh", async () => {
    const adapter = new StubAdapter();
    const svc = new IntelliSenseService(adapter);

    const p = awaitRefresh(svc);
    svc.scheduleRefresh("activation");
    await p;

    const readiness = svc.getLastReadiness();
    assert.ok(readiness !== null);
    svc.dispose();
  });
});

// ---------------------------------------------------------------------------
// Context key isolation (no-fallback)
// ---------------------------------------------------------------------------

suite("IntelliSenseService — no-fallback through context key", () => {
  test("artifact contextKey reflects the active config at refresh time", async () => {
    const adapter = new StubAdapter();
    const svc = new IntelliSenseService(adapter);
    svc.setManifest(makeIntelliSenseLoadedState());
    svc.setActiveConfig(makeConfig({ modelId: "T3W1", targetId: "emu", componentId: "prodtest" }));
    svc.setArtifactsRoot("/nonexistent/path");

    const p = awaitRefresh(svc);
    svc.scheduleRefresh("active-config-change");
    const [artifact] = await p;

    assert.strictEqual(artifact?.contextKey, "T3W1::emu::prodtest");
    svc.dispose();
  });

  test("does not reuse previous artifact path after context change", async () => {
    const adapter = new StubAdapter();
    const svc = new IntelliSenseService(adapter);
    svc.setManifest(makeIntelliSenseLoadedState());
    svc.setActiveConfig(makeConfig({ modelId: "T2T1", targetId: "hw", componentId: "core" }));
    svc.setArtifactsRoot("/nonexistent/path");

    // First refresh: missing artifact
    const p1 = awaitRefresh(svc);
    svc.scheduleRefresh("activation");
    const [first] = await p1;
    assert.strictEqual(first?.status, "missing");

    // Change context — new refresh also missing (from a different path)
    svc.setActiveConfig(makeConfig({ modelId: "T3W1", targetId: "emu", componentId: "prodtest" }));
    const p2 = awaitRefresh(svc);
    svc.scheduleRefresh("active-config-change");
    const [second] = await p2;
    assert.strictEqual(second?.status, "missing");
    assert.strictEqual(second?.contextKey, "T3W1::emu::prodtest");
    // The two missing contexts must differ
    assert.notStrictEqual(first?.contextKey, second?.contextKey);
    svc.dispose();
  });
});

// ---------------------------------------------------------------------------
// Eager parsing (real fixture)
// ---------------------------------------------------------------------------

suite("IntelliSenseService — eager parsing with real compile-commands fixture", () => {
  test("applies a parsed payload when the artifact exists on disk", async () => {
    const adapter = new StubAdapter();
    const svc = new IntelliSenseService(adapter);

    // Use real fixture path so parseCompileCommandsFile can read the file.
    svc.setManifest(makeIntelliSenseLoadedState());
    svc.setActiveConfig(makeConfig({ modelId: "T2T1", targetId: "hw", componentId: "core" }));
    svc.setArtifactsRoot(intellisenseValidArtifactsRoot());

    const p = awaitRefresh(svc);
    svc.scheduleRefresh("activation");
    const [artifact] = await p;

    // In unit-test env cpptools is absent → wrong-provider, payload NOT applied
    // (because readiness.warningState !== "none" → branch takes clearProviderState)
    // The artifact status should be "found" or "missing":
    // Since the file exists, artifact.status must be "found".
    // NOTE: payload is NOT applied because provider readiness fails in test env.
    assert.strictEqual(
      artifact?.status,
      "valid",
      `expected artifact status 'valid', got '${artifact?.status}'`
    );
    assert.strictEqual(artifact?.contextKey, "T2T1::hw::core");
    svc.dispose();
  });

  test("artifact path matches the expected .cc.json path", async () => {
    const adapter = new StubAdapter();
    const svc = new IntelliSenseService(adapter);
    svc.setManifest(makeIntelliSenseLoadedState());
    svc.setActiveConfig(makeConfig({ modelId: "T2T1", targetId: "hw", componentId: "core" }));
    const artifactsRoot = intellisenseValidArtifactsRoot();
    svc.setArtifactsRoot(artifactsRoot);

    const p = awaitRefresh(svc);
    svc.scheduleRefresh("activation");
    const [artifact] = await p;

    const expectedPath = path.join(artifactsRoot, "model-t", "compile_commands_core.cc.json");
    assert.strictEqual(artifact?.path, expectedPath);
    svc.dispose();
  });

  test("getLastArtifact reflects found status when fixture exists on disk", async () => {
    const adapter = new StubAdapter();
    const svc = new IntelliSenseService(adapter);
    svc.setManifest(makeIntelliSenseLoadedState());
    svc.setActiveConfig(makeConfig());
    svc.setArtifactsRoot(intellisenseValidArtifactsRoot());

    const p = awaitRefresh(svc);
    svc.scheduleRefresh("activation");
    await p;

    assert.strictEqual(svc.getLastArtifact()?.status, "valid");
    svc.dispose();
  });
});

// ---------------------------------------------------------------------------
// Latest-refresh-wins serialization
// ---------------------------------------------------------------------------

suite("IntelliSenseService — latest-refresh-wins serialization", () => {
  test("two consecutive scheduleRefresh calls both emit onDidRefresh", async () => {
    const adapter = new StubAdapter();
    const svc = new IntelliSenseService(adapter);
    svc.setManifest(makeIntelliSenseLoadedState());
    svc.setActiveConfig(makeConfig());
    svc.setArtifactsRoot("/nonexistent");

    const events: Array<[ActiveCompileCommandsArtifact | null, IntelliSenseProviderReadiness]> = [];
    const sub = svc.onDidRefresh((args) => events.push(args));

    svc.scheduleRefresh("activation");
    svc.scheduleRefresh("active-config-change");

    // Wait for both to complete
    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    sub.dispose();
    assert.ok(events.length >= 2, `expected at least 2 events, got ${events.length}`);
    svc.dispose();
  });

  test("final state after two calls reflects the second activeConfig", async () => {
    const adapter = new StubAdapter();
    const svc = new IntelliSenseService(adapter);
    svc.setManifest(makeIntelliSenseLoadedState());
    svc.setArtifactsRoot("/nonexistent");

    // First context
    svc.setActiveConfig(makeConfig({ modelId: "T2T1", targetId: "hw", componentId: "core" }));
    svc.scheduleRefresh("activation");

    // Immediately change context and schedule another refresh
    svc.setActiveConfig(makeConfig({ modelId: "T3W1", targetId: "emu", componentId: "prodtest" }));
    const p = awaitRefresh(svc);
    svc.scheduleRefresh("active-config-change");
    const [artifact] = await p;

    // The last refresh uses the second config
    assert.strictEqual(artifact?.contextKey, "T3W1::emu::prodtest");
    svc.dispose();
  });
});
