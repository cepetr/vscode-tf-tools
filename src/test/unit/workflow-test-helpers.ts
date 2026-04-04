/**
 * Shared helpers for Build Workflow unit and integration tests.
 *
 * Provides factory functions for constructing ManifestState objects with
 * build options so individual test files stay concise.
 */

import * as path from "path";
import * as fs from "fs";
import * as vscode from "vscode";
import {
  ManifestStateLoaded,
  ManifestStateMissing,
  ManifestStateInvalid,
  BuildOption,
  WhenExpression,
} from "../../manifest/manifest-types";

// ---------------------------------------------------------------------------
// Manifest URI helpers
// ---------------------------------------------------------------------------

export function fixtureUri(relPath: string): vscode.Uri {
  return vscode.Uri.file(
    path.resolve(__dirname, "../../../../test-fixtures", relPath)
  );
}

export function manifestUri(fixtureName: string): vscode.Uri {
  return fixtureUri(`manifests/${fixtureName}/tf-tools.yaml`);
}

// ---------------------------------------------------------------------------
// Manifest state factories
// ---------------------------------------------------------------------------

export function makeLoadedState(
  overrides: Partial<ManifestStateLoaded> = {}
): ManifestStateLoaded {
  return {
    status: "loaded",
    manifestUri: manifestUri("valid-basic"),
    models: [
      { kind: "model", id: "T2T1", name: "Trezor Model T (v1)" },
      { kind: "model", id: "T3W1", name: "Trezor Model T3 (w1)" },
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
    loadedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

export function makeMissingState(
  over: Partial<ManifestStateMissing> = {}
): ManifestStateMissing {
  return {
    status: "missing",
    manifestUri: manifestUri("missing"),
    ...over,
  };
}

export function makeInvalidState(
  over: Partial<ManifestStateInvalid> = {}
): ManifestStateInvalid {
  return {
    status: "invalid",
    manifestUri: manifestUri("invalid-structure"),
    validationIssues: [
      { severity: "error", code: "empty-collection", message: "manifest must define at least one model" },
    ],
    loadedAt: new Date("2026-01-01T00:00:00Z"),
    ...over,
  };
}

// ---------------------------------------------------------------------------
// Build option factories
// ---------------------------------------------------------------------------

export function makeCheckboxOption(
  overrides: Partial<BuildOption> & { key: string; label: string; flag: string }
): BuildOption {
  return {
    kind: "checkbox",
    group: undefined,
    description: undefined,
    when: undefined,
    ...overrides,
  };
}

export function makeMultistateOption(
  overrides: Partial<BuildOption> & {
    key: string;
    label: string;
    flag: string;
    states: BuildOption["states"];
    defaultState: string;
  }
): BuildOption {
  return {
    kind: "multistate",
    group: undefined,
    description: undefined,
    when: undefined,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// When expression helpers (mirrors WhenExpression type)
// ---------------------------------------------------------------------------

export function whenModel(id: string): WhenExpression {
  return { type: "model", id };
}

export function whenTarget(id: string): WhenExpression {
  return { type: "target", id };
}

export function whenComponent(id: string): WhenExpression {
  return { type: "component", id };
}

export function whenAll(...children: WhenExpression[]): WhenExpression {
  return { type: "all", children };
}

export function whenAny(...children: WhenExpression[]): WhenExpression {
  return { type: "any", children };
}

export function whenNot(child: WhenExpression): WhenExpression {
  return { type: "not", child };
}

// ---------------------------------------------------------------------------
// IntelliSense manifest state factories
//
// These are used by IntelliSense unit tests to create manifest states that
// include the extended artifact-folder / artifact-name / artifact-suffix
// fields required by the IntelliSense slice.
// ---------------------------------------------------------------------------

/** Returns a loaded manifest state fixture with IntelliSense artifact fields. */
export function makeIntelliSenseLoadedState(
  overrides: Partial<ManifestStateLoaded> = {}
): ManifestStateLoaded {
  return {
    status: "loaded",
    manifestUri: manifestUri("intellisense-valid"),
    models: [
      { kind: "model", id: "T2T1", name: "Trezor Model T (v1)", artifactFolder: "model-t" } as ManifestStateLoaded["models"][0],
      { kind: "model", id: "T3W1", name: "Trezor Model T3 (w1)", artifactFolder: "model-t3" } as ManifestStateLoaded["models"][0],
    ],
    targets: [
      { kind: "target", id: "hw", name: "Hardware", shortName: "HW" },
      { kind: "target", id: "emu", name: "Emulator", artifactSuffix: "_emu" } as ManifestStateLoaded["targets"][0],
    ],
    components: [
      { kind: "component", id: "core", name: "Core", artifactName: "compile_commands_core" } as ManifestStateLoaded["components"][0],
      { kind: "component", id: "prodtest", name: "Prodtest", artifactName: "compile_commands_prodtest" } as ManifestStateLoaded["components"][0],
    ],
    buildOptions: [],
    hasWorkflowBlockingIssues: false,
    validationIssues: [],
    loadedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Compile-commands fixture paths
//
// Used by parser and provider unit tests to locate test fixtures on disk.
// ---------------------------------------------------------------------------

/**
 * Returns the absolute path to the compile-commands fixture file for the
 * given model, component, and optional suffix.
 * Mirrors the artifact-path formula used by `deriveArtifactPath`.
 */
export function compileCommandsFixturePath(
  artifactFolder: string,
  artifactName: string,
  artifactSuffix: string = ""
): string {
  return path.resolve(
    __dirname,
    "../../../../test-fixtures/workspaces/intellisense-valid/artifacts",
    artifactFolder,
    `${artifactName}${artifactSuffix}.cc.json`
  );
}

/** Shorthand for the primary T2T1/core/hw compile-commands fixture. */
export function primaryCoreFixturePath(): string {
  return compileCommandsFixturePath("model-t", "compile_commands_core");
}

/** Shorthand for the T2T1/core/emu (suffixed) fixture. */
export function emuCoreFixturePath(): string {
  return compileCommandsFixturePath("model-t", "compile_commands_core", "_emu");
}

/** Shorthand for the T2T1/prodtest/hw compile-commands fixture. */
export function prodtestFixturePath(): string {
  return compileCommandsFixturePath("model-t", "compile_commands_prodtest");
}

// ---------------------------------------------------------------------------
// Compile-commands JSON fixture loader
//
// Reads the raw JSON array from a compile-commands fixture file and returns
// it parsed. Tests can use this to verify parser output against the same data.
// ---------------------------------------------------------------------------

export type RawCompileEntry = {
  directory: string;
  command?: string;
  arguments?: string[];
  file: string;
};

/** Loads and parses a compile-commands JSON file at the given path. */
export function loadCompileCommandsFixture(fixturePath: string): RawCompileEntry[] {
  const raw = fs.readFileSync(fixturePath, "utf-8");
  return JSON.parse(raw) as RawCompileEntry[];
}
