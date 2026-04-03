import * as vscode from "vscode";
import * as path from "path";
import { ManifestState, ManifestStateLoaded } from "../manifest/manifest-types";
import { ActiveConfig } from "../configuration/active-config";
import { ResolvedOption } from "../configuration/build-options";

// ---------------------------------------------------------------------------
// Tree item types
// ---------------------------------------------------------------------------

export type SectionId = "build-context" | "build-options" | "build-artifacts";

export class SectionItem extends vscode.TreeItem {
  constructor(public readonly sectionId: SectionId, label: string) {
    super(label, vscode.TreeItemCollapsibleState.Expanded);
    this.id = `section:${sectionId}`;
    this.contextValue = sectionId;
    this.tooltip = "";
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
    activeValue: string | undefined,
    expanded: boolean
  ) {
    super(
      label,
      expanded
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed
    );
    this.id = `selector:${selectorKind}:${expanded ? "expanded" : "collapsed"}`;
    this.contextValue = `selector-${selectorKind}`;
    this.description = activeValue ?? "—";
    this.iconPath = new vscode.ThemeIcon(SELECTOR_ICONS[selectorKind]);
    this.tooltip = "";
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

// ---------------------------------------------------------------------------
// Command identifiers for build-option interaction (registered in T027)
// ---------------------------------------------------------------------------

export const TOGGLE_BUILD_OPTION_COMMAND = "tfTools.toggleBuildOption";
export const SELECT_BUILD_OPTION_STATE_COMMAND = "tfTools.selectBuildOptionState";

// ---------------------------------------------------------------------------
// Build Option tree items
// ---------------------------------------------------------------------------

/** Group header for a named option group; its children are pre-built. */
export class BuildOptionGroupItem extends vscode.TreeItem {
  constructor(
    public readonly groupLabel: string,
    public readonly groupChildren: vscode.TreeItem[],
    collapsed: boolean = false,
    hasNonDefault: boolean = false
  ) {
    const showBold = collapsed && hasNonDefault;
    super(
      showBold ? { label: groupLabel, highlights: [[0, groupLabel.length]] } : groupLabel,
      collapsed
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.Expanded
    );
    this.id = `build-option-group:${groupLabel}:${collapsed ? "collapsed" : "expanded"}`;
    this.contextValue = "build-option-group";
    this.tooltip = "";
  }
}

/** A single checkbox-style build option row. */
export class BuildOptionCheckboxItem extends vscode.TreeItem {
  constructor(
    public readonly optionKey: string,
    label: string,
    checked: boolean,
    description?: string
  ) {
    super(
      checked ? { label, highlights: [[0, label.length]] } : label,
      vscode.TreeItemCollapsibleState.None
    );
    this.id = `build-option:${optionKey}`;
    this.contextValue = "build-option-checkbox";
    this.checkboxState = checked
      ? vscode.TreeItemCheckboxState.Checked
      : vscode.TreeItemCheckboxState.Unchecked;
    if (description) {
      this.tooltip = description;
    }
  }
}

/** Expandable header for a multistate build option; shows active state inline. */
export class BuildOptionMultistateHeaderItem extends vscode.TreeItem {
  constructor(
    public readonly optionKey: string,
    label: string,
    activeStateLabel: string,
    public readonly stateChildren: BuildOptionStateItem[],
    expanded: boolean,
    isNonDefault: boolean = false,
    description?: string
  ) {
    super(
      isNonDefault ? { label, highlights: [[0, label.length]] } : label,
      expanded
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed
    );
    this.id = `build-option-multistate:${optionKey}:${expanded ? "expanded" : "collapsed"}`;
    this.contextValue = "build-option-multistate";
    this.description = activeStateLabel;
    this.iconPath = new vscode.ThemeIcon("list-selection");
    if (description) {
      this.tooltip = description;
    }
  }
}

/** A selectable state choice under a multistate build option header. */
export class BuildOptionStateItem extends vscode.TreeItem {
  constructor(
    public readonly optionKey: string,
    public readonly stateId: string,
    label: string,
    isActive: boolean
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.id = `build-option-state:${optionKey}:${stateId}`;
    this.contextValue = "build-option-state";
    this.iconPath = isActive ? new vscode.ThemeIcon("check") : INACTIVE_CHOICE_ICON;
    this.command = {
      title: `Select ${label}`,
      command: SELECT_BUILD_OPTION_STATE_COMMAND,
      arguments: [optionKey, stateId],
    };
  }
}

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
  private _expandedSelector: SelectorKind | undefined;
  private _expandedMultistateKey: string | undefined;
  private _collapsedGroups = new Set<string>();
  private _resolvedOptions: ReadonlyArray<ResolvedOption> = [];

  private readonly _onDidChangeTreeData = new vscode.EventEmitter<
    vscode.TreeItem | undefined
  >();
  readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined> =
    this._onDidChangeTreeData.event;

  /** Updates the displayed manifest state and refreshes the view. */
  update(
    state: ManifestState,
    activeConfig?: ActiveConfig,
    resolvedOptions?: ReadonlyArray<ResolvedOption>
  ): void {
    this._state = state;
    this._activeConfig = activeConfig;
    this._resolvedOptions = resolvedOptions ?? [];
    if (state.status !== "loaded") {
      this._expandedSelector = undefined;
      this._expandedMultistateKey = undefined;
      this._collapsedGroups.clear();
    }
    this._onDidChangeTreeData.fire(undefined);
  }

  setExpandedSelector(selectorKind: SelectorKind | undefined): void {
    if (this._expandedSelector === selectorKind) {
      return;
    }
    this._expandedSelector = selectorKind;
    this._onDidChangeTreeData.fire(undefined);
  }

  getExpandedSelector(): SelectorKind | undefined {
    return this._expandedSelector;
  }

  setExpandedMultistateKey(key: string | undefined): void {
    if (this._expandedMultistateKey === key) {
      return;
    }
    this._expandedMultistateKey = key;
    this._onDidChangeTreeData.fire(undefined);
  }

  getExpandedMultistateKey(): string | undefined {
    return this._expandedMultistateKey;
  }

  setGroupCollapsed(group: string, collapsed: boolean): void {
    const changed = collapsed
      ? !this._collapsedGroups.has(group)
      : this._collapsedGroups.has(group);
    if (!changed) {
      return;
    }
    if (collapsed) {
      this._collapsedGroups.add(group);
    } else {
      this._collapsedGroups.delete(group);
    }
    this._onDidChangeTreeData.fire(undefined);
  }

  isGroupCollapsed(group: string): boolean {
    return this._collapsedGroups.has(group);
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
          return this._buildOptionsChildren();
        case "build-artifacts":
          return [new PlaceholderItem("Available in a future release")];
      }
    }

    if (element instanceof BuildOptionGroupItem) {
      return element.groupChildren;
    }

    if (element instanceof BuildOptionMultistateHeaderItem) {
      return element.stateChildren;
    }

    if (element instanceof SelectorHeaderItem) {
      if (this._expandedSelector !== element.selectorKind) {
        return [];
      }
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
      new SelectorHeaderItem(
        "model",
        "Model",
        this._selectedDisplayValue(loaded, "model"),
        this._expandedSelector === "model"
      ),
      new SelectorHeaderItem(
        "target",
        "Target",
        this._selectedDisplayValue(loaded, "target"),
        this._expandedSelector === "target"
      ),
      new SelectorHeaderItem(
        "component",
        "Component",
        this._selectedDisplayValue(loaded, "component"),
        this._expandedSelector === "component"
      ),
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

  // -------------------------------------------------------------------------
  // Build Options section children
  // -------------------------------------------------------------------------

  private _buildOptionsChildren(): vscode.TreeItem[] {
    const state = this._state;

    if (!state) {
      return [new PlaceholderItem("Loading…")];
    }

    if (state.status === "missing") {
      return [new PlaceholderItem("No manifest — Build Options unavailable")];
    }

    if (state.status === "invalid") {
      return [new PlaceholderItem("Manifest is invalid — Build Options unavailable")];
    }

    const loaded = state as ManifestStateLoaded;

    if (loaded.hasWorkflowBlockingIssues) {
      return [
        new WarningItem("Build workflow blocked: invalid availability rules"),
        new PlaceholderItem("Check the Problems view for details"),
      ];
    }

    const available = this._resolvedOptions.filter((r) => r.available);

    if (available.length === 0) {
      if (this._resolvedOptions.length === 0) {
        return [new PlaceholderItem("No build options defined")];
      }
      return [new PlaceholderItem("No options available for the active build context")];
    }

    // Render in declaration order, grouping items under first-seen group headers.
    const items: vscode.TreeItem[] = [];
    const seenGroups = new Set<string>();

    for (const resolved of available) {
      const { group } = resolved.option;
      if (group) {
        if (!seenGroups.has(group)) {
          seenGroups.add(group);
          const groupMembers = available.filter((r) => r.option.group === group);
          const groupChildren = groupMembers.map((r) => this._buildOptionItem(r));
          const collapsed = this._collapsedGroups.has(group);
          const hasNonDefault = groupMembers.some((r) => this._isNonDefault(r));
          items.push(new BuildOptionGroupItem(group, groupChildren, collapsed, hasNonDefault));
        }
        // else: already included under the group header
      } else {
        items.push(this._buildOptionItem(resolved));
      }
    }

    return items;
  }

  private _isNonDefault(resolved: ResolvedOption): boolean {
    const { option, value } = resolved;
    if (option.kind === "checkbox") {
      return value === true;
    }
    const defaultStateId = option.defaultState ?? option.states?.[0]?.id ?? "";
    const activeStateId = typeof value === "string" ? value : defaultStateId;
    return activeStateId !== defaultStateId;
  }

  private _buildOptionItem(
    resolved: ResolvedOption
  ): BuildOptionCheckboxItem | BuildOptionMultistateHeaderItem {
    const { option, value } = resolved;

    if (option.kind === "checkbox") {
      return new BuildOptionCheckboxItem(option.key, option.label, value === true, option.description);
    }

    // multistate
    const activeStateId =
      typeof value === "string" ? value : option.defaultState ?? option.states?.[0]?.id ?? "";
    const activeStateLabel =
      option.states?.find((s) => s.id === activeStateId)?.label ?? activeStateId;
    const stateChildren = (option.states ?? []).map(
      (s) => new BuildOptionStateItem(option.key, s.id, s.label, s.id === activeStateId)
    );
    const expanded = this._expandedMultistateKey === option.key;
    const defaultStateId = option.defaultState ?? option.states?.[0]?.id ?? "";
    const isNonDefault = activeStateId !== defaultStateId;
    return new BuildOptionMultistateHeaderItem(
      option.key,
      option.label,
      activeStateLabel,
      stateChildren,
      expanded,
      isNonDefault,
      option.description
    );
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
  }
}
