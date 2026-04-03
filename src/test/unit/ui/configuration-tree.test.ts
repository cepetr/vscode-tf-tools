import * as assert from "assert";
import * as vscode from "vscode";
import {
  SectionItem,
  SelectorChoiceItem,
  SelectorHeaderItem,
  BuildOptionMultistateHeaderItem,
  BuildOptionStateItem,
} from "../../../ui/configuration-tree";

suite("SectionItem icons", () => {
  test("uses no icon for Build Context", () => {
    const item = new SectionItem("build-context", "Build Context");
    assert.strictEqual(item.iconPath, undefined);
  });

  test("uses no icon for Build Options", () => {
    const item = new SectionItem("build-options", "Build Options");
    assert.strictEqual(item.iconPath, undefined);
  });

  test("uses no icon for Build Artifacts", () => {
    const item = new SectionItem("build-artifacts", "Build Artifacts");
    assert.strictEqual(item.iconPath, undefined);
  });
});

suite("SelectorHeaderItem icons", () => {
  test("uses a distinct icon for model", () => {
    const item = new SelectorHeaderItem("model", "Model", "T2T1", false);
    assert.strictEqual((item.iconPath as vscode.ThemeIcon).id, "circuit-board");
  });

  test("uses a distinct icon for target", () => {
    const item = new SelectorHeaderItem("target", "Target", "hw", false);
    assert.strictEqual((item.iconPath as vscode.ThemeIcon).id, "target");
  });

  test("uses a distinct icon for component", () => {
    const item = new SelectorHeaderItem("component", "Component", "core", false);
    assert.strictEqual((item.iconPath as vscode.ThemeIcon).id, "extensions");
  });

  test("uses expanded collapsible state when the selector is open", () => {
    const item = new SelectorHeaderItem("model", "Model", "T2T1", true);
    assert.strictEqual(item.collapsibleState, vscode.TreeItemCollapsibleState.Expanded);
    assert.strictEqual(item.id, "selector:model:expanded");
  });

  test("uses collapsed collapsible state when the selector is closed", () => {
    const item = new SelectorHeaderItem("model", "Model", "T2T1", false);
    assert.strictEqual(item.collapsibleState, vscode.TreeItemCollapsibleState.Collapsed);
    assert.strictEqual(item.id, "selector:model:collapsed");
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

suite("BuildOptionMultistateHeaderItem accordion", () => {
  function makeHeader(expanded: boolean): BuildOptionMultistateHeaderItem {
    const stateChildren: BuildOptionStateItem[] = [];
    return new BuildOptionMultistateHeaderItem("verbose", "Verbosity", "Off", stateChildren, expanded);
  }

  test("uses Expanded collapsible state when expanded = true", () => {
    const item = makeHeader(true);
    assert.strictEqual(item.collapsibleState, vscode.TreeItemCollapsibleState.Expanded);
  });

  test("uses Collapsed collapsible state when expanded = false", () => {
    const item = makeHeader(false);
    assert.strictEqual(item.collapsibleState, vscode.TreeItemCollapsibleState.Collapsed);
  });

  test("id encodes 'expanded' when open", () => {
    const item = makeHeader(true);
    assert.strictEqual(item.id, "build-option-multistate:verbose:expanded");
  });

  test("id encodes 'collapsed' when closed", () => {
    const item = makeHeader(false);
    assert.strictEqual(item.id, "build-option-multistate:verbose:collapsed");
  });

  test("description shows the active state label", () => {
    const item = makeHeader(false);
    assert.strictEqual(item.description, "Off");
  });
});