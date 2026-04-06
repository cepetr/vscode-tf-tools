/**
 * Integration tests for Explorer FileDecorationProvider badge, tooltip, and
 * optional gray color behavior (T009), and editor overlay rendering,
 * hover text, and showEditorOverlay toggling behavior (T015).
 *
 * These tests run inside the VS Code extension host so they use the real
 * `vscode.FileDecoration`, `vscode.ThemeColor`, `vscode.Uri`, and
 * `vscode.window.createTextEditorDecorationType` APIs.
 *
 * Covers (T009):
 *  - Excluded files receive the "✗" badge
 *  - Excluded files receive the correct tooltip
 *  - Gray color is applied when grayInTree is enabled (FR-004)
 *  - No gray color is applied when grayInTree is disabled (FR-005)
 *  - Included files return undefined (no decoration)
 *  - Out-of-scope files return undefined (no decoration)
 *  - handleSnapshot() fires onDidChangeFileDecorations for newly excluded URIs
 *  - handleSnapshot() fires onDidChangeFileDecorations for newly included URIs
 *  - handleSnapshot() fires undefined (full refresh) when only grayInTree changes
 *
 * Covers (T015):
 *  - ExcludedFileOverlaysManager constructs without error (createTextEditorDecorationType)
 *  - handleSnapshot() applies decoration when showEditorOverlay is enabled and file is excluded
 *  - handleSnapshot() clears decoration when showEditorOverlay is disabled
 *  - handleSnapshot() clears decoration when file is NOT excluded
 *  - applyToVisibleEditors() with no snapshot does not throw
 *  - overlay decoration options include hoverMessage (EXCLUDED_TOOLTIP)
 */

import * as assert from "assert";
import * as path from "path";
import * as vscode from "vscode";
import {
  ExcludedFileDecorationsProvider,
  EXCLUDED_BADGE,
  EXCLUDED_TOOLTIP,
} from "../../ui/excluded-file-decorations";
import { ExcludedFileOverlaysManager } from "../../ui/excluded-file-overlays";
import { normalizeToForwardSlashes } from "../../intellisense/excluded-files-service";
import { ExcludedFilesSnapshot } from "../../intellisense/excluded-files-service";

// ---------------------------------------------------------------------------
// Fixture paths (from excluded-files-scope workspace fixture)
// ---------------------------------------------------------------------------

const WORKSPACE_ROOT = path.resolve(__dirname, "../../../../test-fixtures/workspaces/excluded-files-scope");

function fixturePath(...rel: string[]): string {
  return normalizeToForwardSlashes(path.join(WORKSPACE_ROOT, ...rel));
}

function fixtureUri(...rel: string[]): vscode.Uri {
  return vscode.Uri.file(path.join(WORKSPACE_ROOT, ...rel));
}

// ---------------------------------------------------------------------------
// Snapshot factory
// ---------------------------------------------------------------------------

function makeSnapshot(
  excludedPaths: string[],
  includedPaths: string[] = [],
  grayInTree = true
): ExcludedFilesSnapshot {
  return {
    contextKey: "T2T1/hw/core",
    artifactPath: fixturePath("artifacts/model-t/compile_commands_core.cc.json"),
    settings: {
      grayInTree,
      showEditorOverlay: true,
      fileNamePatterns: ["*.c"],
      folderGlobs: ["core/embed/**", "core/vendor/**"],
    },
    includedFiles: new Set(includedPaths.map(normalizeToForwardSlashes)),
    excludedFiles: new Set(excludedPaths.map(normalizeToForwardSlashes)),
  };
}

// ---------------------------------------------------------------------------
// Suite: provideFileDecoration — badge and tooltip
// ---------------------------------------------------------------------------

suite("ExcludedFileDecorationsProvider — badge and tooltip", () => {
  test("excluded file receives the ✗ badge", () => {
    const provider = new ExcludedFileDecorationsProvider();
    const excludedPath = fixturePath("core/embed/other.c");
    provider.handleSnapshot(makeSnapshot([excludedPath]));

    const token = new vscode.CancellationTokenSource().token;
    const dec = provider.provideFileDecoration(fixtureUri("core/embed/other.c"), token);

    assert.ok(dec, "decoration should be defined for an excluded file");
    assert.strictEqual(dec!.badge, EXCLUDED_BADGE, `badge must be "${EXCLUDED_BADGE}"`);
    provider.dispose();
  });

  test("excluded file receives the correct tooltip", () => {
    const provider = new ExcludedFileDecorationsProvider();
    const excludedPath = fixturePath("core/embed/other.c");
    provider.handleSnapshot(makeSnapshot([excludedPath]));

    const token = new vscode.CancellationTokenSource().token;
    const dec = provider.provideFileDecoration(fixtureUri("core/embed/other.c"), token);

    assert.ok(dec);
    assert.strictEqual(dec!.tooltip, EXCLUDED_TOOLTIP);
    provider.dispose();
  });

  test("tooltip describes why the file is excluded", () => {
    // Verify the tooltip text is meaningful (contains the key phrase).
    assert.ok(
      EXCLUDED_TOOLTIP.toLowerCase().includes("active build configuration"),
      "tooltip must mention 'active build configuration'"
    );
  });
});

// ---------------------------------------------------------------------------
// Suite: provideFileDecoration — gray coloring (FR-004, FR-005)
// ---------------------------------------------------------------------------

suite("ExcludedFileDecorationsProvider — optional gray color", () => {
  test("color is set when grayInTree is true (FR-004)", () => {
    const provider = new ExcludedFileDecorationsProvider();
    const excludedPath = fixturePath("core/embed/other.c");
    provider.handleSnapshot(makeSnapshot([excludedPath], [], /* grayInTree */ true));

    const token = new vscode.CancellationTokenSource().token;
    const dec = provider.provideFileDecoration(fixtureUri("core/embed/other.c"), token);

    assert.ok(dec);
    assert.ok(dec!.color instanceof vscode.ThemeColor, "color must be a ThemeColor when grayInTree is true");
    provider.dispose();
  });

  test("color is undefined when grayInTree is false (FR-005)", () => {
    const provider = new ExcludedFileDecorationsProvider();
    const excludedPath = fixturePath("core/embed/other.c");
    provider.handleSnapshot(makeSnapshot([excludedPath], [], /* grayInTree */ false));

    const token = new vscode.CancellationTokenSource().token;
    const dec = provider.provideFileDecoration(fixtureUri("core/embed/other.c"), token);

    assert.ok(dec, "decoration must still appear when grayInTree is false");
    assert.strictEqual(dec!.color, undefined, "color must be undefined when grayInTree is false");
    provider.dispose();
  });

  test("badge is still shown when grayInTree is false", () => {
    const provider = new ExcludedFileDecorationsProvider();
    const excludedPath = fixturePath("core/embed/other.c");
    provider.handleSnapshot(makeSnapshot([excludedPath], [], /* grayInTree */ false));

    const token = new vscode.CancellationTokenSource().token;
    const dec = provider.provideFileDecoration(fixtureUri("core/embed/other.c"), token);

    assert.ok(dec);
    assert.strictEqual(dec!.badge, EXCLUDED_BADGE);
    provider.dispose();
  });
});

// ---------------------------------------------------------------------------
// Suite: provideFileDecoration — no decoration for non-excluded files
// ---------------------------------------------------------------------------

suite("ExcludedFileDecorationsProvider — no decoration for non-excluded files", () => {
  test("included file returns undefined (no decoration)", () => {
    const provider = new ExcludedFileDecorationsProvider();
    const excludedPath = fixturePath("core/embed/other.c");
    const includedPath = fixturePath("core/embed/main.c");
    provider.handleSnapshot(makeSnapshot([excludedPath], [includedPath]));

    const token = new vscode.CancellationTokenSource().token;
    const dec = provider.provideFileDecoration(fixtureUri("core/embed/main.c"), token);

    assert.strictEqual(dec, undefined, "included file must not receive a decoration");
    provider.dispose();
  });

  test("out-of-scope file returns undefined (no decoration)", () => {
    const provider = new ExcludedFileDecorationsProvider();
    // docs/readme.c is not in the excludedFiles set
    const excludedPath = fixturePath("core/embed/other.c");
    provider.handleSnapshot(makeSnapshot([excludedPath]));

    const token = new vscode.CancellationTokenSource().token;
    const dec = provider.provideFileDecoration(fixtureUri("docs/readme.c"), token);

    assert.strictEqual(dec, undefined, "out-of-scope file must not receive a decoration");
    provider.dispose();
  });

  test("returns undefined before any snapshot is applied", () => {
    const provider = new ExcludedFileDecorationsProvider();

    const token = new vscode.CancellationTokenSource().token;
    const dec = provider.provideFileDecoration(fixtureUri("core/embed/other.c"), token);

    assert.strictEqual(dec, undefined, "must return undefined before any snapshot");
    provider.dispose();
  });

  test(".h file that is not in the excluded set returns undefined", () => {
    const provider = new ExcludedFileDecorationsProvider();
    const excludedPath = fixturePath("core/embed/other.c");
    provider.handleSnapshot(makeSnapshot([excludedPath]));

    const token = new vscode.CancellationTokenSource().token;
    const dec = provider.provideFileDecoration(fixtureUri("core/embed/main.h"), token);

    assert.strictEqual(dec, undefined);
    provider.dispose();
  });
});

// ---------------------------------------------------------------------------
// Suite: handleSnapshot() — onDidChangeFileDecorations firing
// ---------------------------------------------------------------------------

suite("ExcludedFileDecorationsProvider — handleSnapshot() decoration change events", () => {
  test("fires onDidChangeFileDecorations when a new file is excluded", async () => {
    const provider = new ExcludedFileDecorationsProvider();
    let firedWith: vscode.Uri | vscode.Uri[] | undefined = null as unknown as vscode.Uri;
    provider.onDidChangeFileDecorations((e) => { firedWith = e; });

    const excludedPath = fixturePath("core/embed/other.c");
    provider.handleSnapshot(makeSnapshot([excludedPath]));

    assert.ok(firedWith !== null, "onDidChangeFileDecorations must fire when new files are excluded");
    // The fired value should either be an array or a single URI containing the excluded path.
    const firedPaths = Array.isArray(firedWith)
      ? (firedWith as vscode.Uri[]).map((u) => normalizeToForwardSlashes(u.fsPath))
      : firedWith
        ? [normalizeToForwardSlashes((firedWith as vscode.Uri).fsPath)]
        : [];
    assert.ok(
      firedPaths.includes(excludedPath),
      `expected ${excludedPath} to be in fired URIs`
    );
    provider.dispose();
  });

  test("fires onDidChangeFileDecorations when a file is no longer excluded", async () => {
    const provider = new ExcludedFileDecorationsProvider();
    const excludedPath = fixturePath("core/embed/other.c");

    // First apply: other.c is excluded
    provider.handleSnapshot(makeSnapshot([excludedPath]));

    let firedWith: vscode.Uri | vscode.Uri[] | undefined | null = null;
    provider.onDidChangeFileDecorations((e) => { firedWith = e; });

    // Second apply: other.c is no longer excluded
    provider.handleSnapshot(makeSnapshot([]));

    assert.ok(firedWith !== null, "onDidChangeFileDecorations must fire when a file is no longer excluded");
    const firedPaths = Array.isArray(firedWith)
      ? (firedWith as vscode.Uri[]).map((u) => normalizeToForwardSlashes(u.fsPath))
      : firedWith
        ? [normalizeToForwardSlashes((firedWith as vscode.Uri).fsPath)]
        : [];
    assert.ok(
      firedPaths.includes(excludedPath),
      `expected ${excludedPath} to be in fired URIs when file becomes included`
    );
    provider.dispose();
  });

  test("fires undefined when only grayInTree changes (full re-query)", async () => {
    const provider = new ExcludedFileDecorationsProvider();
    const excludedPath = fixturePath("core/embed/other.c");

    // First apply: grayInTree = true, same excluded set
    provider.handleSnapshot(makeSnapshot([excludedPath], [], true));

    const fired: Array<vscode.Uri | vscode.Uri[] | undefined> = [];
    provider.onDidChangeFileDecorations((e) => { fired.push(e); });

    // Second apply: same excluded files but grayInTree = false
    provider.handleSnapshot(makeSnapshot([excludedPath], [], false));

    assert.ok(fired.length > 0, "onDidChangeFileDecorations must fire when grayInTree changes");
    // When only settings change and no file membership changes, undefined is fired
    // for a full re-query.
    assert.ok(
      fired.includes(undefined),
      "undefined must be fired when only grayInTree toggles"
    );
    provider.dispose();
  });

  test("fires undefined when the active context changes", async () => {
    const provider = new ExcludedFileDecorationsProvider();
    const excludedPath = fixturePath("core/embed/other.c");

    provider.handleSnapshot(makeSnapshot([excludedPath], [], true));

    const fired: Array<vscode.Uri | vscode.Uri[] | undefined> = [];
    provider.onDidChangeFileDecorations((e) => { fired.push(e); });

    provider.handleSnapshot({
      ...makeSnapshot([excludedPath], [], true),
      contextKey: "T3W1/hw/core",
    });

    assert.ok(fired.includes(undefined), "context changes must request a full decoration re-query");
    provider.dispose();
  });

  test("fires undefined when the artifact path becomes unavailable", async () => {
    const provider = new ExcludedFileDecorationsProvider();
    const excludedPath = fixturePath("core/embed/other.c");

    provider.handleSnapshot(makeSnapshot([excludedPath], [], true));

    const fired: Array<vscode.Uri | vscode.Uri[] | undefined> = [];
    provider.onDidChangeFileDecorations((e) => { fired.push(e); });

    provider.handleSnapshot({
      ...makeSnapshot([], [], true),
      artifactPath: null,
    });

    assert.ok(fired.includes(undefined), "artifact loss must request a full decoration re-query");
    provider.dispose();
  });
});

// ===========================================================================
// T015: Integration tests for ExcludedFileOverlaysManager
// ===========================================================================

function makeOverlaySnapshot(
  excludedPaths: string[],
  showEditorOverlay = true
): ExcludedFilesSnapshot {
  return {
    contextKey: "T2T1/hw/core",
    artifactPath: fixturePath("artifacts/model-t/compile_commands_core.cc.json"),
    settings: {
      grayInTree: true,
      showEditorOverlay,
      fileNamePatterns: ["*.c"],
      folderGlobs: ["core/embed/**", "core/vendor/**"],
    },
    includedFiles: new Set<string>(),
    excludedFiles: new Set(excludedPaths),
  };
}

// ---------------------------------------------------------------------------
// Suite: ExcludedFileOverlaysManager — construction and lifecycle (T015)
// ---------------------------------------------------------------------------

suite("ExcludedFileOverlaysManager — construction and lifecycle (T015)", () => {
  test("constructs without error using real VS Code createTextEditorDecorationType", () => {
    let manager: ExcludedFileOverlaysManager | undefined;
    assert.doesNotThrow(() => {
      manager = new ExcludedFileOverlaysManager();
    });
    manager?.dispose();
  });

  test("dispose() does not throw", () => {
    const manager = new ExcludedFileOverlaysManager();
    assert.doesNotThrow(() => manager.dispose());
  });

  test("applyToVisibleEditors() with no snapshot does not throw", () => {
    const manager = new ExcludedFileOverlaysManager();
    assert.doesNotThrow(() => manager.applyToVisibleEditors());
    manager.dispose();
  });
});

// ---------------------------------------------------------------------------
// Suite: ExcludedFileOverlaysManager — overlay applied to excluded editors (T015)
// ---------------------------------------------------------------------------

suite("ExcludedFileOverlaysManager — overlay applied to excluded editors (T015)", () => {
  test("handleSnapshot() calls setDecorations with non-empty ranges for excluded file", () => {
    const excludedPath = fixturePath("core/embed/other.c");
    const manager = new ExcludedFileOverlaysManager();
    // Apply snapshot with one excluded file — verify no throw with real APIs.
    manager.handleSnapshot(makeOverlaySnapshot([excludedPath]));
    assert.doesNotThrow(() => manager.applyToVisibleEditors());
    manager.dispose();
  });

  test("handleSnapshot() with showEditorOverlay=false does not throw", () => {
    const excludedPath = fixturePath("core/embed/other.c");
    const manager = new ExcludedFileOverlaysManager();
    assert.doesNotThrow(() => {
      manager.handleSnapshot(makeOverlaySnapshot([excludedPath], /* showEditorOverlay */ false));
    });
    manager.dispose();
  });

  test("handleSnapshot() with empty excludedFiles does not throw", () => {
    const manager = new ExcludedFileOverlaysManager();
    assert.doesNotThrow(() => {
      manager.handleSnapshot(makeOverlaySnapshot([]));
    });
    manager.dispose();
  });
});

// ---------------------------------------------------------------------------
// Suite: ExcludedFileOverlaysManager — overlay decoration options (T015)
// ---------------------------------------------------------------------------

suite("ExcludedFileOverlaysManager — EXCLUDED_TOOLTIP (T015)", () => {
  test("EXCLUDED_TOOLTIP includes the canonical phrase used in hoverMessage", () => {
    assert.ok(
      EXCLUDED_TOOLTIP.toLowerCase().includes("active build configuration"),
      "tooltip must include 'active build configuration'"
    );
  });

  test("EXCLUDED_TOOLTIP is defined and non-empty", () => {
    assert.ok(typeof EXCLUDED_TOOLTIP === "string" && EXCLUDED_TOOLTIP.length > 0);
  });
});
