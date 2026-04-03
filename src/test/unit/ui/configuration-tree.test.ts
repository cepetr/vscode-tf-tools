import * as assert from "assert";
import * as vscode from "vscode";
import { SectionItem, SelectorChoiceItem, SelectorHeaderItem } from "../../../ui/configuration-tree";

suite("SectionItem icons", () => {
  test("uses symbol-folder for Build Context", () => {
    const item = new SectionItem("build-context", "Build Context");
    assert.strictEqual((item.iconPath as vscode.ThemeIcon).id, "symbol-folder");
  });

  test("uses symbol-folder for Build Options", () => {
    const item = new SectionItem("build-options", "Build Options");
    assert.strictEqual((item.iconPath as vscode.ThemeIcon).id, "symbol-folder");
  });

  test("uses info for Build Artifacts", () => {
    const item = new SectionItem("build-artifacts", "Build Artifacts");
    assert.strictEqual((item.iconPath as vscode.ThemeIcon).id, "info");
  });
});

suite("SelectorHeaderItem icons", () => {
  test("uses a distinct icon for model", () => {
    const item = new SelectorHeaderItem("model", "Model", "T2T1");
    assert.strictEqual((item.iconPath as vscode.ThemeIcon).id, "circuit-board");
  });

  test("uses a distinct icon for target", () => {
    const item = new SelectorHeaderItem("target", "Target", "hw");
    assert.strictEqual((item.iconPath as vscode.ThemeIcon).id, "target");
  });

  test("uses a distinct icon for component", () => {
    const item = new SelectorHeaderItem("component", "Component", "core");
    assert.strictEqual((item.iconPath as vscode.ThemeIcon).id, "extensions");
  });
});

suite("SelectorChoiceItem icons", () => {
  test("uses a check icon for the active choice", () => {
    const item = new SelectorChoiceItem("model", "T2T1", "Trezor Model T", true);
    assert.strictEqual((item.iconPath as vscode.ThemeIcon).id, "check");
  });

  test("uses a transparent spacer icon for an inactive choice", () => {
    const item = new SelectorChoiceItem("model", "T3W1", "Trezor Model T3", false);
    assert.ok(item.iconPath instanceof vscode.Uri);
    assert.ok((item.iconPath as vscode.Uri).fsPath.endsWith("images/blank-tree-icon.svg"));
  });
});