import * as assert from "assert";
import * as vscode from "vscode";
import {
  SectionItem,
  SelectorChoiceItem,
  SelectorHeaderItem,
  BuildOptionGroupItem,
  BuildOptionMultistateHeaderItem,
  BuildOptionCheckboxItem,
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

suite("BuildOptionCheckboxItem bold label", () => {
  test("label has highlights when checked (non-default state)", () => {
    const item = new BuildOptionCheckboxItem("verbose", "Verbose", true);
    assert.deepStrictEqual(item.label, { label: "Verbose", highlights: [[0, 7]] });
  });

  test("label is plain string when unchecked (default state)", () => {
    const item = new BuildOptionCheckboxItem("verbose", "Verbose", false);
    assert.strictEqual(item.label, "Verbose");
  });
});

suite("BuildOptionMultistateHeaderItem bold label", () => {
  test("label has highlights when isNonDefault = true", () => {
    const item = new BuildOptionMultistateHeaderItem("opt", "Verbosity", "High", [], false, true);
    assert.deepStrictEqual(item.label, { label: "Verbosity", highlights: [[0, 9]] });
  });

  test("label is plain string when isNonDefault = false", () => {
    const item = new BuildOptionMultistateHeaderItem("opt", "Verbosity", "Off", [], false, false);
    assert.strictEqual(item.label, "Verbosity");
  });

  test("label is plain string when isNonDefault not provided", () => {
    const item = new BuildOptionMultistateHeaderItem("opt", "Verbosity", "Off", [], false);
    assert.strictEqual(item.label, "Verbosity");
  });
});

suite("BuildOptionGroupItem bold label", () => {
  test("label has highlights when collapsed and hasNonDefault = true", () => {
    const item = new BuildOptionGroupItem("Advanced", [], true, true);
    assert.deepStrictEqual(item.label, { label: "Advanced", highlights: [[0, 8]] });
  });

  test("label is plain string when expanded even if hasNonDefault = true", () => {
    const item = new BuildOptionGroupItem("Advanced", [], false, true);
    assert.strictEqual(item.label, "Advanced");
  });

  test("label is plain string when collapsed but hasNonDefault = false", () => {
    const item = new BuildOptionGroupItem("Advanced", [], true, false);
    assert.strictEqual(item.label, "Advanced");
  });

  test("uses Collapsed state when collapsed = true", () => {
    const item = new BuildOptionGroupItem("Advanced", [], true, false);
    assert.strictEqual(item.collapsibleState, vscode.TreeItemCollapsibleState.Collapsed);
  });

  test("uses Expanded state when collapsed = false", () => {
    const item = new BuildOptionGroupItem("Advanced", [], false, false);
    assert.strictEqual(item.collapsibleState, vscode.TreeItemCollapsibleState.Expanded);
  });

  test("id encodes collapsed state", () => {
    const collapsed = new BuildOptionGroupItem("Adv", [], true, false);
    const expanded = new BuildOptionGroupItem("Adv", [], false, false);
    assert.strictEqual(collapsed.id, "build-option-group:Adv:collapsed");
    assert.strictEqual(expanded.id, "build-option-group:Adv:expanded");
  });

  test("defaults to expanded with no bold when constructed with no extra args", () => {
    const item = new BuildOptionGroupItem("Adv", []);
    assert.strictEqual(item.label, "Adv");
    assert.strictEqual(item.collapsibleState, vscode.TreeItemCollapsibleState.Expanded);
  });
});

suite("BuildOptionCheckboxItem tooltip", () => {
  test("tooltip is set when description is provided", () => {
    const item = new BuildOptionCheckboxItem("opt", "Verbose", false, "Enables verbose output");
    assert.strictEqual(item.tooltip, "Enables verbose output");
  });

  test("tooltip is undefined when description is omitted", () => {
    const item = new BuildOptionCheckboxItem("opt", "Verbose", false);
    assert.strictEqual(item.tooltip, undefined);
  });
});

suite("BuildOptionMultistateHeaderItem tooltip", () => {
  test("tooltip is set when description is provided", () => {
    const item = new BuildOptionMultistateHeaderItem("opt", "Level", "Off", [], false, false, "Sets verbosity level");
    assert.strictEqual(item.tooltip, "Sets verbosity level");
  });

  test("tooltip is undefined when description is omitted", () => {
    const item = new BuildOptionMultistateHeaderItem("opt", "Level", "Off", [], false, false);
    assert.strictEqual(item.tooltip, undefined);
  });
});