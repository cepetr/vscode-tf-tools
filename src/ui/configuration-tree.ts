import * as vscode from "vscode";
import * as path from "path";
import { ManifestState, ManifestStateLoaded } from "../manifest/manifest-types";
import { ActiveConfig } from "../configuration/active-config";

// ---------------------------------------------------------------------------
// Tree item types
// ---------------------------------------------------------------------------

export type SectionId = "build-context" | "build-options" | "build-artifacts";

export class SectionItem extends vscode.TreeItem {
  constructor(public readonly sectionId: SectionId, label: string) {
    super(label, vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = sectionId;
    if (sectionId !== "build-context") {
      // Non-interactive placeholder sections collapse by default
      this.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
    }
  }
}

export class WarningItem extends vscode.TreeItem {
  constructor(message: string) {
    super(message, vscode.TreeItemCollapsibleState.None);
    this.contextValue = "warning";
    this.iconPath = new vscode.ThemeIcon("warning");
  }
}

export class PlaceholderItem extends vscode.TreeItem {
  constructor(label: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.contextValue = "placeholder";
    this.iconPath = new vscode.ThemeIcon("info");
  }
}

export type SelectorKind = "model" | "target" | "component";

const SELECTOR_ICONS: Readonly<Record<SelectorKind, string>> = {
  model: "circuit-board",
  target: "target",
  component: "extensions",
};

const INACTIVE_CHOICE_ICON = vscode.Uri.file(
  path.resolve(__dirname, "../../images/blank-tree-icon.svg")
);

export class SelectorHeaderItem extends vscode.TreeItem {
  constructor(
    public readonly selectorKind: SelectorKind,
    label: string,
    activeValue: string | undefined
  ) {
    super(label, vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = `selector-${selectorKind}`;
    this.description = activeValue ?? "—";
    this.iconPath = new vscode.ThemeIcon(SELECTOR_ICONS[selectorKind]);
  }
}

// ---------------------------------------------------------------------------
// Command identifiers for build-context selection (registered in T026)
// ---------------------------------------------------------------------------

export const SELECT_COMMANDS: Readonly<Record<SelectorKind, string>> = {
  model: "tfTools.selectModel",
  target: "tfTools.selectTarget",
  component: "tfTools.selectComponent",
};

export class SelectorChoiceItem extends vscode.TreeItem {
  constructor(
    public readonly selectorKind: SelectorKind,
    public readonly entryId: string,
    label: string,
    isActive: boolean
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.contextValue = `choice-${selectorKind}`;
    this.description = isActive ? "active" : undefined;
    this.iconPath = isActive ? new vscode.ThemeIcon("check") : INACTIVE_CHOICE_ICON;
    this.command = {
      title: `Select ${label}`,
      command: SELECT_COMMANDS[selectorKind],
      arguments: [entryId],
    };
  }
}

// ---------------------------------------------------------------------------
// Tree data provider
// ---------------------------------------------------------------------------

export class ConfigurationTreeProvider
  implements vscode.TreeDataProvider<vscode.TreeItem>
{
  private _state: ManifestState | undefined;
  private _activeConfig: ActiveConfig | undefined;

  private readonly _onDidChangeTreeData = new vscode.EventEmitter<
    vscode.TreeItem | undefined
  >();
  readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined> =
    this._onDidChangeTreeData.event;

  /** Updates the displayed manifest state and refreshes the view. */
  update(state: ManifestState, activeConfig?: ActiveConfig): void {
    this._state = state;
    this._activeConfig = activeConfig;
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
    if (!element) {
      return [
        new SectionItem("build-context", "Build Context"),
        new SectionItem("build-options", "Build Options"),
        new SectionItem("build-artifacts", "Build Artifacts"),
      ];
    }

    if (element instanceof SectionItem) {
      switch (element.sectionId) {
        case "build-context":
          return this._buildContextChildren();
        case "build-options":
        case "build-artifacts":
          return [new PlaceholderItem("Available in a future release")];
      }
    }

    if (element instanceof SelectorHeaderItem) {
      return this._selectorChoices(element.selectorKind);
    }

    return [];
  }

  // -------------------------------------------------------------------------
  // Build Context section children
  // -------------------------------------------------------------------------

  private _buildContextChildren(): vscode.TreeItem[] {
    const state = this._state;

    if (!state) {
      return [new PlaceholderItem("Loading…")];
    }

    if (state.status === "missing") {
      return [
        new WarningItem("Manifest file not found"),
        new PlaceholderItem(
          `Expected: ${state.manifestUri.fsPath}`
        ),
      ];
    }

    if (state.status === "invalid") {
      const issues = state.validationIssues;
      const items: vscode.TreeItem[] = [
        new WarningItem(
          issues.length === 1
            ? "Manifest has 1 validation error"
            : `Manifest has ${issues.length} validation error(s)`
        ),
        new PlaceholderItem("Check the Problems view for details"),
      ];
      return items;
    }

    const loaded = state as ManifestStateLoaded;

    // Loaded state: show model, target, component selector headers
    return [
      new SelectorHeaderItem("model", "Model", this._selectedDisplayValue(loaded, "model")),
      new SelectorHeaderItem("target", "Target", this._selectedDisplayValue(loaded, "target")),
      new SelectorHeaderItem("component", "Component", this._selectedDisplayValue(loaded, "component")),
    ];
  }

  // -------------------------------------------------------------------------
  // Selector choice rows (expanded under SelectorHeaderItem)
  // -------------------------------------------------------------------------

  private _selectorChoices(kind: SelectorKind): vscode.TreeItem[] {
    if (!this._state || this._state.status !== "loaded") {
      return [];
    }
    const loaded = this._state as ManifestStateLoaded;
    const activeId = this._activeConfig
      ? kind === "model"
        ? this._activeConfig.modelId
        : kind === "target"
        ? this._activeConfig.targetId
        : this._activeConfig.componentId
      : undefined;

    const entries =
      kind === "model"
        ? loaded.models
        : kind === "target"
        ? loaded.targets
        : loaded.components;

    return entries.map(
      (e) => new SelectorChoiceItem(kind, e.id, e.name, e.id === activeId)
    );
  }

  private _selectedDisplayValue(
    state: ManifestStateLoaded,
    kind: SelectorKind
  ): string | undefined {
    if (!this._activeConfig) {
      return undefined;
    }

    if (kind === "model") {
      return state.models.find((entry) => entry.id === this._activeConfig?.modelId)?.name;
    }

    if (kind === "target") {
      const target = state.targets.find((entry) => entry.id === this._activeConfig?.targetId);
      return target ? (target.shortName ?? target.name) : undefined;
    }

    return state.components.find((entry) => entry.id === this._activeConfig?.componentId)?.name;
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
  }
}
