import * as vscode from "vscode";
import { ManifestState } from "../manifest/manifest-types";

// ---------------------------------------------------------------------------
// Tree item types
// ---------------------------------------------------------------------------

export type SectionId = "build-context" | "build-options" | "build-artifacts";

export class SectionItem extends vscode.TreeItem {
  constructor(public readonly sectionId: SectionId, label: string, state?: ManifestState) {
    super(label, vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = sectionId;
    this._applyState(state);
  }

  private _applyState(state?: ManifestState): void {
    if (this.sectionId !== "build-context") {
      this.description = "Not available in this feature slice";
      this.collapsibleState = vscode.TreeItemCollapsibleState.None;
    } else if (!state || state.status === "missing") {
      this.description = "Manifest missing";
    } else if (state.status === "invalid") {
      this.description = "Manifest invalid";
    }
  }
}

export class PlaceholderItem extends vscode.TreeItem {
  constructor(label: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.contextValue = "placeholder";
  }
}

// ---------------------------------------------------------------------------
// Tree data provider
// ---------------------------------------------------------------------------

export class ConfigurationTreeProvider
  implements vscode.TreeDataProvider<vscode.TreeItem>
{
  private _state: ManifestState | undefined;
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<
    vscode.TreeItem | undefined
  >();
  readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined> =
    this._onDidChangeTreeData.event;

  /** Updates the displayed manifest state and refreshes the view. */
  update(state: ManifestState): void {
    this._state = state;
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
    if (!element) {
      // Top-level sections
      return [
        new SectionItem("build-context", "Build Context", this._state),
        new SectionItem("build-options", "Build Options"),
        new SectionItem("build-artifacts", "Build Artifacts"),
      ];
    }

    if (element instanceof SectionItem) {
      if (element.sectionId === "build-context") {
        return this._buildContextChildren();
      }
      // Build Options and Build Artifacts are placeholders in this slice
      return [new PlaceholderItem("Available in a future release")];
    }

    return [];
  }

  private _buildContextChildren(): vscode.TreeItem[] {
    if (!this._state) {
      return [new PlaceholderItem("Loading…")];
    }
    if (this._state.status === "missing") {
      return [new PlaceholderItem("⚠ Manifest file not found")];
    }
    if (this._state.status === "invalid") {
      return [new PlaceholderItem("⚠ Manifest has validation errors — check Problems view")];
    }
    // Loaded state — children are added in T017 (US1) and T025 (US2)
    return [new PlaceholderItem("Configuration loaded")];
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
  }
}
