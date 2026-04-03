/**
 * Integration tests asserting no cross-slice commands are contributed
 * beyond what is expected in the current slice (Build Workflow / Feature 2).
 *
 * FR-026 negative-scope tests: Debug, Flash, Upload, IntelliSense, artifact
 * refresh, and related post-build behaviors must not be present.
 */
import * as assert from "assert";
import * as vscode from "vscode";

/** Commands that must never be registered in the current or earlier slices. */
const BANNED_COMMAND_PATTERNS = [
  /^tfTools\.debug\b/i,
  /^tfTools\.flash\b/i,
  /^tfTools\.upload\b/i,
  /^tfTools\.intellisense\b/i,
];

suite("Scope guard — no cross-slice commands (FR-026)", () => {
  test("no Flash/Upload/Debug/IntelliSense commands are registered", async () => {
    const allCommands = await vscode.commands.getCommands(true);
    const offenders = allCommands.filter((cmd) =>
      BANNED_COMMAND_PATTERNS.some((re) => re.test(cmd))
    );
    assert.deepStrictEqual(
      offenders,
      [],
      `Cross-slice commands must not be registered: ${offenders.join(", ")}`
    );
  });

  test("only expected tfTools commands are registered", async () => {
    const allCommands = await vscode.commands.getCommands(true);
    const tfCommands = allCommands.filter((cmd) => cmd.startsWith("tfTools."));

    // Allowed commands in Build Workflow (Feature 2) and earlier slices
    const ALLOWED = new Set([
      "tfTools.showLogs",
      "tfTools.selectModel",
      "tfTools.selectTarget",
      "tfTools.selectComponent",
      "tfTools.build",
      "tfTools.clippy",
      "tfTools.check",
      "tfTools.clean",
      "tfTools.toggleBuildOption",
      "tfTools.selectBuildOptionState",
    ]);

    const unexpected = tfCommands.filter((cmd) => !ALLOWED.has(cmd));
    assert.deepStrictEqual(
      unexpected,
      [],
      `Unexpected tfTools commands found: ${unexpected.join(", ")}`
    );
  });

  test("configuration view header does not expose Debug actions", async () => {
    const ext = vscode.extensions.getExtension("trezor.tf-tools");
    if (!ext) {
      return; // Skip gracefully when extension not installed in test host
    }
    const menus: Record<string, unknown[]> =
      ext.packageJSON?.contributes?.menus ?? {};
    const viewTitleMenus: unknown[] = (menus["view/title"] as unknown[]) ?? [];

    const BANNED_VIEW_TITLE_COMMANDS = ["tfTools.debug", "tfTools.flash", "tfTools.upload"];
    const offenders = viewTitleMenus.filter((entry) => {
      const e = entry as { command?: string };
      return BANNED_VIEW_TITLE_COMMANDS.some((banned) => e.command === banned);
    });
    assert.deepStrictEqual(
      offenders,
      [],
      "Debug/Flash/Upload actions must not appear in view/title menus"
    );
  });
});
