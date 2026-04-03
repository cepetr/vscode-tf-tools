import * as assert from "assert";
import {
  normalizeBuildOptions,
  deriveOptionFlags,
  BuildContext,
  ResolvedOption,
  BUILD_OPTIONS_KEY,
  BuildOptionsState,
  readBuildOptions,
  writeBuildOption,
} from "../../../configuration/build-options";
import { BuildOption } from "../../../manifest/manifest-types";
import * as vscode from "vscode";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeExtContext(
  initialValues: Record<string, unknown> = {}
): vscode.ExtensionContext {
  const store = new Map<string, unknown>(Object.entries(initialValues));
  return {
    workspaceState: {
      get: <T>(key: string): T | undefined => store.get(key) as T | undefined,
      update: async (key: string, value: unknown): Promise<void> => {
        store.set(key, value);
      },
      keys: (): readonly string[] => [...store.keys()],
    },
  } as unknown as vscode.ExtensionContext;
}

function checkbox(
  key: string,
  flag: string,
  when?: BuildOption["when"]
): BuildOption {
  return { key, label: key, flag, kind: "checkbox", when };
}

function multistate(
  key: string,
  flag: string,
  states: BuildOption["states"],
  defaultState: string
): BuildOption {
  return { key, label: key, flag, kind: "multistate", states, defaultState };
}

const ctx: BuildContext = {
  modelId: "T2T1",
  targetId: "hw",
  componentId: "core",
};

// ---------------------------------------------------------------------------
// readBuildOptions / writeBuildOption
// ---------------------------------------------------------------------------

suite("readBuildOptions / writeBuildOption", () => {
  test("readBuildOptions returns undefined when nothing is stored", () => {
    const extCtx = makeExtContext();
    assert.strictEqual(readBuildOptions(extCtx), undefined);
  });

  test("writeBuildOption persists a checkbox value", async () => {
    const extCtx = makeExtContext();
    await writeBuildOption(extCtx, "debug", true);
    const state = readBuildOptions(extCtx);
    assert.ok(state !== undefined);
    assert.strictEqual(state!.values["debug"], true);
  });

  test("writeBuildOption merges with existing values", async () => {
    const initial: BuildOptionsState = {
      values: { debug: true },
      persistedAt: "2026-01-01T00:00:00Z",
    };
    const extCtx = makeExtContext({ [BUILD_OPTIONS_KEY]: initial });
    await writeBuildOption(extCtx, "fast", false);
    const state = readBuildOptions(extCtx);
    assert.strictEqual(state!.values["debug"], true);
    assert.strictEqual(state!.values["fast"], false);
  });

  test("writeBuildOption updates an existing key", async () => {
    const initial: BuildOptionsState = {
      values: { debug: true },
      persistedAt: "2026-01-01T00:00:00Z",
    };
    const extCtx = makeExtContext({ [BUILD_OPTIONS_KEY]: initial });
    await writeBuildOption(extCtx, "debug", false);
    const state = readBuildOptions(extCtx);
    assert.strictEqual(state!.values["debug"], false);
  });

  test("writeBuildOption sets persistedAt timestamp", async () => {
    const before = new Date().toISOString();
    const extCtx = makeExtContext();
    await writeBuildOption(extCtx, "debug", true);
    const state = readBuildOptions(extCtx);
    assert.ok(state!.persistedAt >= before);
  });
});

// ---------------------------------------------------------------------------
// normalizeBuildOptions
// ---------------------------------------------------------------------------

suite("normalizeBuildOptions", () => {
  test("returns resolved options for all options", () => {
    const opts = [checkbox("debug", "--debug"), checkbox("fast", "--fast")];
    const resolved = normalizeBuildOptions(opts, undefined, ctx);
    assert.strictEqual(resolved.length, 2);
  });

  test("checkbox option defaults to false when no saved value", () => {
    const opts = [checkbox("debug", "--debug")];
    const resolved = normalizeBuildOptions(opts, undefined, ctx);
    assert.strictEqual(resolved[0].value, false);
  });

  test("checkbox option restores saved true value", () => {
    const saved: BuildOptionsState = {
      values: { debug: true },
      persistedAt: "2026-01-01T00:00:00Z",
    };
    const opts = [checkbox("debug", "--debug")];
    const resolved = normalizeBuildOptions(opts, saved, ctx);
    assert.strictEqual(resolved[0].value, true);
  });

  test("multistate option uses defaultState when no saved value", () => {
    const states = [
      { id: "off", label: "Off", flag: "" },
      { id: "on", label: "On", flag: "--fast" },
    ];
    const opts = [multistate("fast", "--fast", states, "off")];
    const resolved = normalizeBuildOptions(opts, undefined, ctx);
    assert.strictEqual(resolved[0].value, "off");
  });

  test("multistate option restores valid saved state", () => {
    const saved: BuildOptionsState = {
      values: { fast: "on" },
      persistedAt: "2026-01-01T00:00:00Z",
    };
    const states = [
      { id: "off", label: "Off", flag: "" },
      { id: "on", label: "On", flag: "--fast" },
    ];
    const opts = [multistate("fast", "--fast", states, "off")];
    const resolved = normalizeBuildOptions(opts, saved, ctx);
    assert.strictEqual(resolved[0].value, "on");
  });

  test("multistate option falls back to default for an invalid saved state", () => {
    const saved: BuildOptionsState = {
      values: { fast: "INVALID_STATE" },
      persistedAt: "2026-01-01T00:00:00Z",
    };
    const states = [
      { id: "off", label: "Off", flag: "" },
      { id: "on", label: "On", flag: "--fast" },
    ];
    const opts = [multistate("fast", "--fast", states, "off")];
    const resolved = normalizeBuildOptions(opts, saved, ctx);
    assert.strictEqual(resolved[0].value, "off");
  });

  // -------------------------------------------------------------------------
  // When expression availability
  // -------------------------------------------------------------------------

  test("option without when is always available", () => {
    const opts = [checkbox("debug", "--debug")];
    const resolved = normalizeBuildOptions(opts, undefined, ctx);
    assert.strictEqual(resolved[0].available, true);
  });

  test("option with matching when is available", () => {
    const opts = [checkbox("t2t1-only", "--t2t1", { type: "model", id: "T2T1" })];
    const resolved = normalizeBuildOptions(opts, undefined, ctx);
    assert.strictEqual(resolved[0].available, true);
  });

  test("option with non-matching when is unavailable", () => {
    const opts = [checkbox("t3w1-only", "--t3w1", { type: "model", id: "T3W1" })];
    const resolved = normalizeBuildOptions(opts, undefined, ctx);
    assert.strictEqual(resolved[0].available, false);
  });

  test("unavailable option retains its persisted value", () => {
    const saved: BuildOptionsState = {
      values: { "t3w1-only": true },
      persistedAt: "2026-01-01T00:00:00Z",
    };
    const opts = [checkbox("t3w1-only", "--t3w1", { type: "model", id: "T3W1" })];
    const resolved = normalizeBuildOptions(opts, saved, ctx);
    // available = false but value is preserved
    assert.strictEqual(resolved[0].available, false);
    assert.strictEqual(resolved[0].value, true);
  });

  test("preserves declaration order", () => {
    const opts = [
      checkbox("alpha", "--alpha"),
      checkbox("beta", "--beta"),
      checkbox("gamma", "--gamma"),
    ];
    const resolved = normalizeBuildOptions(opts, undefined, ctx);
    assert.deepStrictEqual(
      resolved.map((r) => r.option.key),
      ["alpha", "beta", "gamma"]
    );
  });
});

// ---------------------------------------------------------------------------
// deriveOptionFlags
// ---------------------------------------------------------------------------

suite("deriveOptionFlags", () => {
  function resolve(
    opt: BuildOption,
    available: boolean,
    value: boolean | string
  ): ResolvedOption {
    return { option: opt, available, value };
  }

  test("returns empty array when no options are available", () => {
    const opt = checkbox("debug", "--debug");
    const resolved = [resolve(opt, false, true)];
    assert.deepStrictEqual(deriveOptionFlags(resolved), []);
  });

  test("includes flag for available checkbox with true value", () => {
    const opt = checkbox("debug", "--debug");
    const resolved = [resolve(opt, true, true)];
    assert.deepStrictEqual(deriveOptionFlags(resolved), ["--debug"]);
  });

  test("excludes flag for available checkbox with false value", () => {
    const opt = checkbox("debug", "--debug");
    const resolved = [resolve(opt, true, false)];
    assert.deepStrictEqual(deriveOptionFlags(resolved), []);
  });

  test("includes multistate flag for selected state with non-empty flag", () => {
    const states = [
      { id: "off", label: "Off", flag: "" },
      { id: "on", label: "On", flag: "--verbose" },
    ];
    const opt = multistate("verbose", "--verbose", states, "off");
    const resolved = [resolve(opt, true, "on")];
    assert.deepStrictEqual(deriveOptionFlags(resolved), ["--verbose"]);
  });

  test("excludes empty flag for multistate selected state", () => {
    const states = [
      { id: "off", label: "Off", flag: "" },
      { id: "on", label: "On", flag: "--verbose" },
    ];
    const opt = multistate("verbose", "--verbose", states, "off");
    const resolved = [resolve(opt, true, "off")];
    assert.deepStrictEqual(deriveOptionFlags(resolved), []);
  });

  test("preserves order of flags from multiple options", () => {
    const optA = checkbox("alpha", "--alpha");
    const optB = checkbox("beta", "--beta");
    const optC = checkbox("gamma", "--gamma");
    const resolved = [
      resolve(optA, true, true),
      resolve(optB, false, true), // unavailable, excluded
      resolve(optC, true, true),
    ];
    assert.deepStrictEqual(deriveOptionFlags(resolved), ["--alpha", "--gamma"]);
  });
});
