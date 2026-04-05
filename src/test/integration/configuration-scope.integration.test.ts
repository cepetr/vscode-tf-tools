/**
 * Integration tests asserting no cross-slice commands are contributed
 * beyond what is expected in the current slice (Flash/Upload Actions / Feature 5).
 *
 * FR-026 negative-scope tests: Debug and unrelated slice commands must not
 * be present. Flash, Upload, and openMapFile are now part of the allowed set.
 */
import * as assert from "assert";
import * as vscode from "vscode";

/** Commands that must never be registered in any current slice. */
const BANNED_COMMAND_PATTERNS = [
  /^tfTools\.debug\b/i,
  /^tfTools\.intellisense\b/i,
];

suite("Scope guard — no cross-slice commands (FR-026)", () => {
  async function activateExtension(): Promise<void> {
    const ext = vscode.extensions.getExtension("cepetr.tf-tools");
    assert.ok(ext, "expected cepetr.tf-tools extension to be available in the test host");
    if (!ext.isActive) {
      await ext.activate();
    }
  }

  test("no Debug/IntelliSense commands are registered", async () => {
    await activateExtension();
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
    await activateExtension();
    const allCommands = await vscode.commands.getCommands(true);
    const tfCommands = allCommands
      .filter((cmd) => cmd.startsWith("tfTools."))
      .filter((cmd) => !cmd.startsWith("tfTools.configuration."));

    // Allowed commands through Flash/Upload Actions (Feature 5) and earlier slices
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
      "tfTools.refreshIntelliSense",
      "tfTools.flash",
      "tfTools.upload",
      "tfTools.openMapFile",
    ]);

    const unexpected = tfCommands.filter((cmd) => !ALLOWED.has(cmd));
    assert.deepStrictEqual(
      unexpected,
      [],
      `Unexpected tfTools commands found: ${unexpected.join(", ")}`
    );
  });

  test("configuration view header does not expose Debug actions", async () => {
    const ext = vscode.extensions.getExtension("cepetr.tf-tools");
    if (!ext) {
      return; // Skip gracefully when extension not installed in test host
    }
    const menus: Record<string, unknown[]> =
      ext.packageJSON?.contributes?.menus ?? {};
    const viewTitleMenus: unknown[] = (menus["view/title"] as unknown[]) ?? [];

    const BANNED_VIEW_TITLE_COMMANDS = ["tfTools.debug"];
    const offenders = viewTitleMenus.filter((entry) => {
      const e = entry as { command?: string };
      return BANNED_VIEW_TITLE_COMMANDS.some((banned) => e.command === banned);
    });
    assert.deepStrictEqual(
      offenders,
      [],
      "Debug actions must not appear in view/title menus"
    );
  });
});
