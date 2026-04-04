/**
 * Unit tests for excluded-files-service.ts:
 *   isFileExcluded(), ExcludedFilesService.recompute(), and
 *   ExcludedFilesService.clear().
 *
 * Covers (per T008 specification):
 *  - Basename-only filename matching (subpath globs never match basenames)
 *  - Case-sensitive evaluation (*.c does NOT match MAIN.C)
 *  - Forward-slash separator normalization for Windows-style paths
 *  - Absolute and workspace-relative folder glob matching
 *  - Empty fileNamePatterns disables all marking
 *  - Empty folderGlobs disables all marking
 *  - Combined match rule: all three conditions required
 *  - ExcludedFilesService.recompute() emits a correct snapshot
 *  - ExcludedFilesService.clear() empties both sets and fires the event
 */

import * as assert from "assert";
import * as path from "path";
import * as vscode from "vscode";
import {
  isFileExcluded,
  normalizeToForwardSlashes,
  extractBasename,
  ExcludedFilesService,
  ExcludedFilesSnapshot,
} from "../../../intellisense/excluded-files-service";
import {
  excludedFilesScopeWorkspaceRoot,
  makeExcludedFilesSettings,
} from "../workflow-test-helpers";

// ---------------------------------------------------------------------------
// Test-local helpers
// ---------------------------------------------------------------------------

/** Workspace root for the excluded-files-scope fixture (forward-slash form). */
const WORKSPACE_ROOT = normalizeToForwardSlashes(excludedFilesScopeWorkspaceRoot());

/** Normalizes a fixture-relative path to an absolute forward-slash form. */
function absPath(...parts: string[]): string {
  return normalizeToForwardSlashes(path.join(excludedFilesScopeWorkspaceRoot(), ...parts));
}

// ---------------------------------------------------------------------------
// normalizeToForwardSlashes
// ---------------------------------------------------------------------------

suite("normalizeToForwardSlashes", () => {
  test("leaves forward-slash paths unchanged", () => {
    assert.strictEqual(
      normalizeToForwardSlashes("/workspace/core/embed/main.c"),
      "/workspace/core/embed/main.c"
    );
  });

  test("replaces backslashes with forward slashes", () => {
    assert.strictEqual(
      normalizeToForwardSlashes("C:\\project\\core\\embed\\main.c"),
      "C:/project/core/embed/main.c"
    );
  });

  test("replaces mixed separators", () => {
    assert.strictEqual(
      normalizeToForwardSlashes("/workspace\\core/embed\\main.c"),
      "/workspace/core/embed/main.c"
    );
  });
});

// ---------------------------------------------------------------------------
// extractBasename
// ---------------------------------------------------------------------------

suite("extractBasename", () => {
  test("returns the filename portion of a normalized path", () => {
    assert.strictEqual(extractBasename("/workspace/core/embed/main.c"), "main.c");
  });

  test("returns the name when path has no directory component", () => {
    assert.strictEqual(extractBasename("main.c"), "main.c");
  });
});

// ---------------------------------------------------------------------------
// isFileExcluded — empty scope lists disable marking entirely (FR-002A)
// ---------------------------------------------------------------------------

suite("isFileExcluded — empty scope disabling", () => {
  const settled: ReadonlySet<string> = new Set();
  const candidatePath = absPath("core/embed/other.c");

  test("empty fileNamePatterns ⇒ never excluded", () => {
    const settings = makeExcludedFilesSettings({ fileNamePatterns: [] });
    assert.strictEqual(
      isFileExcluded(candidatePath, settled, settings, WORKSPACE_ROOT),
      false
    );
  });

  test("empty folderGlobs ⇒ never excluded", () => {
    const settings = makeExcludedFilesSettings({ folderGlobs: [] });
    assert.strictEqual(
      isFileExcluded(candidatePath, settled, settings, WORKSPACE_ROOT),
      false
    );
  });

  test("both empty ⇒ never excluded", () => {
    const settings = makeExcludedFilesSettings({ fileNamePatterns: [], folderGlobs: [] });
    assert.strictEqual(
      isFileExcluded(candidatePath, settled, settings, WORKSPACE_ROOT),
      false
    );
  });
});

// ---------------------------------------------------------------------------
// isFileExcluded — file is in the compile-database inclusion set (FR-001)
// ---------------------------------------------------------------------------

suite("isFileExcluded — included files are never marked", () => {
  const settings = makeExcludedFilesSettings();

  test("file in includedFiles ⇒ not excluded", () => {
    const inDB = new Set<string>([absPath("core/embed/main.c")]);
    assert.strictEqual(
      isFileExcluded(absPath("core/embed/main.c"), inDB, settings, WORKSPACE_ROOT),
      false
    );
  });
});

// ---------------------------------------------------------------------------
// isFileExcluded — basename-only filename matching (FR-002B)
// ---------------------------------------------------------------------------

suite("isFileExcluded — basename-only filename matching", () => {
  const settled: ReadonlySet<string> = new Set();
  const settings = makeExcludedFilesSettings({
    fileNamePatterns: ["*.c"],
    folderGlobs: ["core/embed/**"],
  });

  test("single-star pattern matches the correct extension", () => {
    assert.strictEqual(
      isFileExcluded(absPath("core/embed/other.c"), settled, settings, WORKSPACE_ROOT),
      true,
      "*.c should match other.c"
    );
  });

  test("pattern with directory component does NOT match the basename", () => {
    // "src/*.c" is checked against the basename "other.c" — no match
    const subsettings = makeExcludedFilesSettings({
      fileNamePatterns: ["src/*.c"],
      folderGlobs: ["core/embed/**"],
    });
    assert.strictEqual(
      isFileExcluded(absPath("core/embed/other.c"), settled, subsettings, WORKSPACE_ROOT),
      false,
      "Subpath glob src/*.c must not match the basename other.c"
    );
  });

  test(".h file does NOT match *.c", () => {
    assert.strictEqual(
      isFileExcluded(absPath("core/embed/main.h"), settled, settings, WORKSPACE_ROOT),
      false,
      "*.c must not match main.h"
    );
  });
});

// ---------------------------------------------------------------------------
// isFileExcluded — case-sensitive evaluation (FR-002C)
// ---------------------------------------------------------------------------

suite("isFileExcluded — case-sensitive filename matching", () => {
  const settled: ReadonlySet<string> = new Set();

  test("uppercase extension does NOT match lowercase *.c pattern", () => {
    const settings = makeExcludedFilesSettings({
      fileNamePatterns: ["*.c"],
      folderGlobs: ["core/embed/**"],
    });
    // Construct a path whose basename is MAIN.C (uppercase)
    const upperPath = absPath("core/embed/MAIN.C");
    assert.strictEqual(
      isFileExcluded(upperPath, settled, settings, WORKSPACE_ROOT),
      false,
      "*.c must not match MAIN.C (case-sensitive)"
    );
  });

  test("exact-case match succeeds", () => {
    const settings = makeExcludedFilesSettings({
      fileNamePatterns: ["MAIN.C"],
      folderGlobs: ["core/embed/**"],
    });
    const upperPath = absPath("core/embed/MAIN.C");
    assert.strictEqual(
      isFileExcluded(upperPath, settled, settings, WORKSPACE_ROOT),
      true,
      "MAIN.C pattern must match MAIN.C basename"
    );
  });
});

// ---------------------------------------------------------------------------
// isFileExcluded — forward-slash normalization of Windows paths (FR-002, NFR-002)
// ---------------------------------------------------------------------------

suite("isFileExcluded — Windows-path separator normalization", () => {
  const settled: ReadonlySet<string> = new Set();
  const settings = makeExcludedFilesSettings({
    fileNamePatterns: ["*.c"],
    folderGlobs: ["/workspace/core/embed/**"],
  });

  test("backslash-separated path is normalized and matched correctly", () => {
    const windowsPath = "\\workspace\\core\\embed\\other.c";
    const normalized = normalizeToForwardSlashes(windowsPath);
    // normalized = "/workspace/core/embed/other.c"
    assert.strictEqual(
      isFileExcluded(normalized, settled, settings, "/workspace"),
      true,
      "Normalized backslash path should be treated as absolute and matched"
    );
  });
});

// ---------------------------------------------------------------------------
// isFileExcluded — workspace-relative folder glob matching (FR-002D, FR-002E)
// ---------------------------------------------------------------------------

suite("isFileExcluded — workspace-relative folder globs", () => {
  const settled: ReadonlySet<string> = new Set();
  const settings = makeExcludedFilesSettings({
    fileNamePatterns: ["*.c"],
    folderGlobs: ["core/embed/**"],
  });

  test("file inside matched folder is excluded", () => {
    assert.strictEqual(
      isFileExcluded(absPath("core/embed/other.c"), settled, settings, WORKSPACE_ROOT),
      true
    );
  });

  test("file outside all folder globs is not excluded", () => {
    // docs/readme.c matches *.c but NOT core/embed/** or core/vendor/**
    assert.strictEqual(
      isFileExcluded(absPath("docs/readme.c"), settled, settings, WORKSPACE_ROOT),
      false
    );
  });

  test("file in a second folder glob is excluded", () => {
    const twoGlobs = makeExcludedFilesSettings({
      fileNamePatterns: ["*.c"],
      folderGlobs: ["core/embed/**", "core/vendor/**"],
    });
    assert.strictEqual(
      isFileExcluded(absPath("core/vendor/lib.c"), settled, twoGlobs, WORKSPACE_ROOT),
      true
    );
  });
});

// ---------------------------------------------------------------------------
// isFileExcluded — absolute folder glob matching (FR-002F)
// ---------------------------------------------------------------------------

suite("isFileExcluded — absolute folder globs", () => {
  const settled: ReadonlySet<string> = new Set();

  test("absolute folder glob matches file at correct absolute path", () => {
    const absoluteGlob = WORKSPACE_ROOT + "/core/embed/**";
    const settings = makeExcludedFilesSettings({
      fileNamePatterns: ["*.c"],
      folderGlobs: [absoluteGlob],
    });
    assert.strictEqual(
      isFileExcluded(absPath("core/embed/other.c"), settled, settings, WORKSPACE_ROOT),
      true
    );
  });

  test("absolute glob does not match a file in a different folder", () => {
    const absoluteGlob = WORKSPACE_ROOT + "/core/embed/**";
    const settings = makeExcludedFilesSettings({
      fileNamePatterns: ["*.c"],
      folderGlobs: [absoluteGlob],
    });
    assert.strictEqual(
      isFileExcluded(absPath("docs/readme.c"), settled, settings, WORKSPACE_ROOT),
      false
    );
  });
});

// ---------------------------------------------------------------------------
// isFileExcluded — all three conditions are required (FR-001 + FR-002)
// ---------------------------------------------------------------------------

suite("isFileExcluded — combined match rule", () => {
  const settings = makeExcludedFilesSettings({
    fileNamePatterns: ["*.c"],
    folderGlobs: ["core/embed/**"],
  });

  test("file not in DB + basename match + folder match ⇒ excluded", () => {
    assert.strictEqual(
      isFileExcluded(absPath("core/embed/other.c"), new Set(), settings, WORKSPACE_ROOT),
      true
    );
  });

  test("file IN DB + basename match + folder match ⇒ NOT excluded", () => {
    const inDB = new Set<string>([absPath("core/embed/other.c")]);
    assert.strictEqual(
      isFileExcluded(absPath("core/embed/other.c"), inDB, settings, WORKSPACE_ROOT),
      false
    );
  });

  test("file not in DB + NO basename match + folder match ⇒ NOT excluded", () => {
    assert.strictEqual(
      isFileExcluded(absPath("core/embed/main.h"), new Set(), settings, WORKSPACE_ROOT),
      false
    );
  });

  test("file not in DB + basename match + NO folder match ⇒ NOT excluded", () => {
    assert.strictEqual(
      isFileExcluded(absPath("docs/readme.c"), new Set(), settings, WORKSPACE_ROOT),
      false
    );
  });
});

// ---------------------------------------------------------------------------
// ExcludedFilesService.recompute()
// ---------------------------------------------------------------------------

suite("ExcludedFilesService — recompute()", () => {
  const workspaceRoot = WORKSPACE_ROOT;
  const settings = makeExcludedFilesSettings({
    fileNamePatterns: ["*.c"],
    folderGlobs: ["core/embed/**", "core/vendor/**"],
  });

  const inDB = new Set<string>([
    absPath("core/embed/main.c"),
    absPath("core/embed/util.c"),
  ]);

  const candidates: vscode.Uri[] = [
    vscode.Uri.file(path.join(excludedFilesScopeWorkspaceRoot(), "core/embed/main.c")),
    vscode.Uri.file(path.join(excludedFilesScopeWorkspaceRoot(), "core/embed/util.c")),
    vscode.Uri.file(path.join(excludedFilesScopeWorkspaceRoot(), "core/embed/other.c")),
    vscode.Uri.file(path.join(excludedFilesScopeWorkspaceRoot(), "core/vendor/lib.c")),
    vscode.Uri.file(path.join(excludedFilesScopeWorkspaceRoot(), "docs/readme.c")),
    vscode.Uri.file(path.join(excludedFilesScopeWorkspaceRoot(), "core/embed/main.h")),
  ];

  test("fires onDidUpdateSnapshot after recompute", () => {
    const svc = new ExcludedFilesService();
    let fired = false;
    svc.onDidUpdateSnapshot(() => { fired = true; });

    svc.recompute("T2T1/hw/core", "/path/artifact.json", inDB, settings, workspaceRoot, candidates);

    assert.ok(fired, "onDidUpdateSnapshot must fire after recompute()");
    svc.dispose();
  });

  test("snapshot contains correct contextKey and artifactPath", () => {
    const svc = new ExcludedFilesService();
    let snap: ExcludedFilesSnapshot | undefined;
    svc.onDidUpdateSnapshot((s) => { snap = s; });

    svc.recompute("T2T1/hw/core", "/path/artifact.json", inDB, settings, workspaceRoot, candidates);

    assert.ok(snap);
    assert.strictEqual(snap!.contextKey, "T2T1/hw/core");
    assert.strictEqual(snap!.artifactPath, "/path/artifact.json");
    svc.dispose();
  });

  test("snapshot excludedFiles contains only the correctly matched files", () => {
    const svc = new ExcludedFilesService();
    let snap: ExcludedFilesSnapshot | undefined;
    svc.onDidUpdateSnapshot((s) => { snap = s; });

    svc.recompute("T2T1/hw/core", "/path/artifact.json", inDB, settings, workspaceRoot, candidates);

    assert.ok(snap);
    // In DB ⇒ never excluded
    assert.ok(!snap!.excludedFiles.has(absPath("core/embed/main.c")), "main.c is in DB, must not be excluded");
    assert.ok(!snap!.excludedFiles.has(absPath("core/embed/util.c")), "util.c is in DB, must not be excluded");
    // In scope ⇒ excluded
    assert.ok(snap!.excludedFiles.has(absPath("core/embed/other.c")), "other.c must be excluded");
    assert.ok(snap!.excludedFiles.has(absPath("core/vendor/lib.c")), "lib.c must be excluded");
    // Out of scope ⇒ not excluded
    assert.ok(!snap!.excludedFiles.has(absPath("docs/readme.c")), "readme.c is out of folderGlob scope");
    assert.ok(!snap!.excludedFiles.has(absPath("core/embed/main.h")), "main.h does not match *.c");
    svc.dispose();
  });

  test("null artifactPath produces empty excludedFiles", () => {
    const svc = new ExcludedFilesService();
    let snap: ExcludedFilesSnapshot | undefined;
    svc.onDidUpdateSnapshot((s) => { snap = s; });

    svc.recompute("T2T1/hw/core", null, inDB, settings, workspaceRoot, candidates);

    assert.ok(snap);
    assert.strictEqual(snap!.artifactPath, null);
    assert.strictEqual(snap!.excludedFiles.size, 0, "null artifact ⇒ empty excludedFiles");
    svc.dispose();
  });

  test("empty candidate list produces empty excludedFiles but still fires event", () => {
    const svc = new ExcludedFilesService();
    let fired = false;
    let snap: ExcludedFilesSnapshot | undefined;
    svc.onDidUpdateSnapshot((s) => { fired = true; snap = s; });

    svc.recompute("T2T1/hw/core", "/path/artifact.json", inDB, settings, workspaceRoot, []);

    assert.ok(fired);
    assert.ok(snap);
    assert.strictEqual(snap!.excludedFiles.size, 0);
    svc.dispose();
  });

  test("getSnapshot() returns the latest computed snapshot", () => {
    const svc = new ExcludedFilesService();
    svc.recompute("T2T1/hw/core", "/path/artifact.json", inDB, settings, workspaceRoot, candidates);
    const snap = svc.getSnapshot();
    assert.strictEqual(snap.contextKey, "T2T1/hw/core");
    svc.dispose();
  });
});

// ---------------------------------------------------------------------------
// ExcludedFilesService.clear()
// ---------------------------------------------------------------------------

suite("ExcludedFilesService — clear()", () => {
  test("fires onDidUpdateSnapshot with empty sets", () => {
    const svc = new ExcludedFilesService();
    const settings = makeExcludedFilesSettings();

    // Prepare a snapshot with excluded files first
    svc.recompute(
      "T2T1/hw/core",
      "/path/artifact.json",
      new Set<string>(),
      settings,
      WORKSPACE_ROOT,
      [vscode.Uri.file(path.join(excludedFilesScopeWorkspaceRoot(), "core/embed/other.c"))]
    );
    assert.ok(svc.getSnapshot().excludedFiles.size > 0, "precondition: should have excluded files");

    let cleared: ExcludedFilesSnapshot | undefined;
    svc.onDidUpdateSnapshot((s) => { cleared = s; });

    svc.clear("T2T1/hw/core");

    assert.ok(cleared, "onDidUpdateSnapshot must fire after clear()");
    assert.strictEqual(cleared!.excludedFiles.size, 0, "excludedFiles must be empty after clear()");
    assert.strictEqual(cleared!.includedFiles.size, 0, "includedFiles must be empty after clear()");
    assert.strictEqual(cleared!.artifactPath, null, "artifactPath must be null after clear()");
    svc.dispose();
  });

  test("getSnapshot() reflects cleared state", () => {
    const svc = new ExcludedFilesService();
    svc.clear("T2T1/hw/core");
    const snap = svc.getSnapshot();
    assert.strictEqual(snap.excludedFiles.size, 0);
    assert.strictEqual(snap.artifactPath, null);
    svc.dispose();
  });
});

// ---------------------------------------------------------------------------
// T024: Regression — path-separator normalization edge cases
// ---------------------------------------------------------------------------

suite("normalizeToForwardSlashes — regression (T024)", () => {
  test("trailing backslash is normalized to trailing forward slash", () => {
    assert.strictEqual(
      normalizeToForwardSlashes("C:\\project\\core\\"),
      "C:/project/core/"
    );
  });

  test("path with only backslashes normalizes to all forward slashes", () => {
    const result = normalizeToForwardSlashes("a\\b\\c\\d.c");
    assert.strictEqual(result, "a/b/c/d.c");
    assert.ok(!result.includes("\\"), "no backslashes must remain after normalization");
  });

  test("already-normalized path is returned unchanged", () => {
    const p = "/workspace/core/embed/main.c";
    assert.strictEqual(normalizeToForwardSlashes(p), p);
  });
});

// ---------------------------------------------------------------------------
// T024: Regression — case-sensitive folder glob matching
// ---------------------------------------------------------------------------

suite("isFileExcluded — case-sensitive folder glob regression (T024)", () => {
  const emptySet: ReadonlySet<string> = new Set();

  test("uppercase folder glob does NOT match a lowercase folder path", () => {
    const settings = makeExcludedFilesSettings({
      fileNamePatterns: ["*.c"],
      folderGlobs: ["Core/embed/**"],  // wrong case
    });
    const candidatePath = absPath("core/embed/other.c");
    assert.strictEqual(
      isFileExcluded(candidatePath, emptySet, settings, WORKSPACE_ROOT),
      false,
      "uppercase folder glob must not match lowercase folder path"
    );
  });

  test("correct-case folder glob matches while wrong-case does not", () => {
    const candidate = absPath("core/embed/other.c");
    const wrong = makeExcludedFilesSettings({ fileNamePatterns: ["*.c"], folderGlobs: ["CORE/EMBED/**"] });
    const correct = makeExcludedFilesSettings({ fileNamePatterns: ["*.c"], folderGlobs: ["core/embed/**"] });

    assert.strictEqual(isFileExcluded(candidate, emptySet, wrong, WORKSPACE_ROOT), false, "wrong case must not match");
    assert.strictEqual(isFileExcluded(candidate, emptySet, correct, WORKSPACE_ROOT), true, "correct case must match");
  });
});

// ---------------------------------------------------------------------------
// T024: Regression — empty-scope disabling and scope restoration
// ---------------------------------------------------------------------------

suite("isFileExcluded — empty-scope restoration regression (T024)", () => {
  const emptySet: ReadonlySet<string> = new Set();
  const candidate = absPath("core/embed/other.c");

  test("removing and restoring fileNamePatterns restores excluded-file marking", () => {
    const full = makeExcludedFilesSettings({ fileNamePatterns: ["*.c"], folderGlobs: ["core/embed/**"] });
    const empty = makeExcludedFilesSettings({ fileNamePatterns: [] });

    assert.strictEqual(isFileExcluded(candidate, emptySet, full, WORKSPACE_ROOT), true, "file should be excluded with full settings");
    assert.strictEqual(isFileExcluded(candidate, emptySet, empty, WORKSPACE_ROOT), false, "file must not be excluded with empty patterns");
    assert.strictEqual(isFileExcluded(candidate, emptySet, full, WORKSPACE_ROOT), true, "file must be excluded again after restoring patterns");
  });

  test("removing and restoring folderGlobs restores excluded-file marking", () => {
    const full = makeExcludedFilesSettings({ fileNamePatterns: ["*.c"], folderGlobs: ["core/embed/**"] });
    const noGlobs = makeExcludedFilesSettings({ folderGlobs: [] });

    assert.strictEqual(isFileExcluded(candidate, emptySet, full, WORKSPACE_ROOT), true);
    assert.strictEqual(isFileExcluded(candidate, emptySet, noGlobs, WORKSPACE_ROOT), false);
    assert.strictEqual(isFileExcluded(candidate, emptySet, full, WORKSPACE_ROOT), true);
  });
});
