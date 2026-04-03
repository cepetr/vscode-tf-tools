/**
 * Integration tests asserting no Build or Debug title-bar actions and no
 * cross-slice commands are contributed by this extension. These tests run
 * inside the VS Code extension host via @vscode/test-electron.
 *
 * FR-016 / FR-017 negative-scope tests.
 */
import * as assert from "assert";
import * as vscode from "vscode";

/** Commands that must never be registered by this feature slice. */
const BANNED_COMMAND_PATTERNS = [
  /^tfTools\.build\b/i,
  /^tfTools\.debug\b/i,
  /^tfTools\.flash\b/i,
  /^tfTools\.upload\b/i,
  /^tfTools\.clippy\b/i,
  /^tfTools\.check\b/i,
  /^tfTools\.clean\b/i,
  /^tfTools\.intellisense\b/i,
];

suite("Scope guard — no cross-slice commands (FR-016/FR-017)", () => {
  test("no Build-action commands are registered", async () => {
    const allCommands = await vscode.commands.getCommands(true);
    const offenders = allCommands.filter((cmd) =>
      BANNED_COMMAND_PATTERNS.some((re) => re.test(cmd))
    );
    assert.deepStrictEqual(
      offenders,
      [],
      `Cross-slice commands must not be registered by Feature 1: ${offenders.join(", ")}`
    );
  });

  test("only expected tfTools commands are registered", async () => {
    const allCommands = await vscode.commands.getCommands(true);
    const tfCommands = allCommands.filter((cmd) => cmd.startsWith("tfTools."));

    // Allowed commands in this feature slice
    const ALLOWED = new Set(["tfTools.showLogs", "tfTools.revealConfiguration"]);

    const unexpected = tfCommands.filter((cmd) => !ALLOWED.has(cmd));
    assert.deepStrictEqual(
      unexpected,
      [],
      `Unexpected tfTools commands found: ${unexpected.join(", ")}`
    );
  });

  test("configuration view contributes no Build or Debug title-bar menus", async () => {
    // There is no direct VS Code API to inspect menus at test time.
    // We validate this by checking the package.json contributions at runtime
    // to ensure no menus/view/title entries reference build or debug actions.
    const ext = vscode.extensions.getExtension("trezor.tf-tools");
    if (!ext) {
      // Extension may not be installed in test host — skip gracefully
      return;
    }
    const menus: Record<string, unknown[]> =
      ext.packageJSON?.contributes?.menus ?? {};
    const viewTitleMenus: unknown[] = (menus["view/title"] as unknown[]) ?? [];

    const BANNED_VIEW_TITLE_COMMANDS = ["tfTools.build", "tfTools.debug"];
    const offenders = viewTitleMenus.filter((entry) => {
      const e = entry as { command?: string };
      return BANNED_VIEW_TITLE_COMMANDS.some((banned) => e.command === banned);
    });
    assert.deepStrictEqual(
      offenders,
      [],
      "No Build or Debug actions should appear in view/title menus"
    );
  });

  test("extension does not expose VS Code build tasks for this slice", async () => {
    // Build tasks (via vscode.tasks) are deferred to Feature 2 (Build Workflow).
    const tasks = await vscode.tasks.fetchTasks({ type: "shell" });
    const tfTasks = tasks.filter(
      (t) => t.source === "tf-tools" || t.source === "Trezor"
    );
    assert.deepStrictEqual(
      tfTasks,
      [],
      `No tf-tools build tasks should be registered in Feature 1: ${tfTasks.map((t) => t.name).join(", ")}`
    );
  });
});
