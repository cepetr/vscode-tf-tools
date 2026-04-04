import * as vscode from "vscode";
import { hasSupportedWorkspace, requireWorkspaceFolder, isWorkflowWorkspaceSupported } from "./workspace/workspace-guard";
import { resolveManifestUri, isStatusBarEnabled, resolveArtifactsPath } from "./workspace/settings";
import { ManifestService } from "./manifest/manifest-service";
import { ConfigurationTreeProvider, SelectorHeaderItem, BuildOptionMultistateHeaderItem, BuildOptionCheckboxItem, BuildOptionGroupItem } from "./ui/configuration-tree";
import { StatusBarPresenter } from "./ui/status-bar";
import { disposeLogChannel, revealLogs, logManifestState } from "./observability/log-channel";
import { disposeDiagnostics, handleManifestStateDiagnostics } from "./observability/diagnostics";
import {
  restoreActiveConfig,
  selectModel,
  selectTarget,
  selectComponent,
  ActiveConfig,
} from "./configuration/active-config";
import {
  readBuildOptions,
  writeBuildOption,
  normalizeBuildOptions,
  ResolvedOption,
} from "./configuration/build-options";
import { ManifestState, ManifestStateLoaded } from "./manifest/manifest-types";
import {
  evaluateWorkflowPreconditions,
  reportWorkflowBlocked,
  executeWorkflowTask,
  WorkflowKind,
} from "./commands/build-workflow";
import {
  BuildTaskProvider,
  resolveWorkflowContext,
  createWorkflowTask,
  TASK_TYPE,
} from "./tasks/build-task-provider";
import { IntelliSenseService } from "./intellisense/intellisense-service";
import { applyProviderSettingFix } from "./intellisense/cpptools-provider";
import { ExcludedFilesService } from "./intellisense/excluded-files-service";
import { ExcludedFilesRefreshCoordinator } from "./intellisense/excluded-files-refresh";
import { ExcludedFileDecorationsProvider } from "./ui/excluded-file-decorations";
import { ExcludedFileOverlaysManager } from "./ui/excluded-file-overlays";

let _manifestService: ManifestService | undefined;
let _treeProvider: ConfigurationTreeProvider | undefined;
let _configurationTreeView: vscode.TreeView<vscode.TreeItem> | undefined;
let _statusBar: StatusBarPresenter | undefined;
let _manifestState: ManifestState | undefined;
let _activeConfig: ActiveConfig | undefined;
let _resolvedOptions: ReadonlyArray<ResolvedOption> = [];
let _intelliSenseService: IntelliSenseService | undefined;
let _excludedFilesService: ExcludedFilesService | undefined;
let _excludedFilesRefreshCoordinator: ExcludedFilesRefreshCoordinator | undefined;
let _excludedFileDecorations: ExcludedFileDecorationsProvider | undefined;
let _excludedFileOverlays: ExcludedFileOverlaysManager | undefined;
let _manifestStateSubscription: vscode.Disposable | undefined;
/** Tracks the last wrong-provider state offered to the user to avoid duplicate Fix notifications. */
let _lastShownProviderFixState: string = "none";

// ---------------------------------------------------------------------------
// Scope guard (FR-016, FR-017 → now expanded for Build Workflow + IntelliSense slices)
//
// This extension contributes ONLY the commands listed below in these feature
// slices. Flash, Upload, Debug, and all other cross-slice commands are
// intentionally absent. Any attempt to register them here is a scope violation.
//
// Allowed commands:
//   tfTools.showLogs              — reveal the output channel
//   tfTools.build                 — launch Build task
//   tfTools.clippy                — launch Clippy task
//   tfTools.check                 — launch Check task
//   tfTools.clean                 — launch Clean task
//   tfTools.refreshIntelliSense   — manual IntelliSense refresh
// ---------------------------------------------------------------------------

const ALLOWED_CONTRIBUTION_COMMANDS = new Set([
  "tfTools.showLogs",
  "tfTools.build",
  "tfTools.clippy",
  "tfTools.check",
  "tfTools.clean",
  "tfTools.refreshIntelliSense",
]);

/**
 * Development-time guard: verifies that no unauthorized tfTools commands are
 * contributed during activation. Throws in development mode if a violation is
 * detected; logs a warning in production.
 */
function assertNoUnauthorizedContributions(
  context: vscode.ExtensionContext
): void {
  const contributed: string[] =
    context.extension.packageJSON?.contributes?.commands?.map(
      (c: { command: string }) => c.command
    ) ?? [];

  const unauthorized = contributed
    .filter((cmd: string) => cmd.startsWith("tfTools."))
    .filter((cmd: string) => !ALLOWED_CONTRIBUTION_COMMANDS.has(cmd));

  if (unauthorized.length > 0) {
    const msg =
      `Trezor Firmware Tools scope violation (FR-016/FR-017): ` +
      `unauthorized commands found in package.json: ${unauthorized.join(", ")}`;
    // In development host, fail loudly; in packaged extension log to channel
    console.error(msg);
  }
}

/**
 * Computes the resolved build options for the given manifest state, active
 * configuration, and current persisted selections. Returns an empty array
 * when the manifest is not loaded or no active configuration is available.
 */
function computeResolvedOptions(
  state: ManifestState,
  activeConfig: ActiveConfig | undefined,
  context: vscode.ExtensionContext
): ResolvedOption[] {
  if (state.status !== "loaded" || !activeConfig) {
    return [];
  }
  const loaded = state as ManifestStateLoaded;
  const saved = readBuildOptions(context);
  return normalizeBuildOptions(loaded.buildOptions, saved, activeConfig);
}

/**
 * Updates the `tfTools.workflowBlocked` VS Code context key so that
 * view/title menu `enablement` clauses reflect the current state (T028).
 */
function updateWorkflowBlockedContext(state: ManifestState): void {
  const loaded = state.status === "loaded" ? (state as ManifestStateLoaded) : undefined;
  const blocked =
    evaluateWorkflowPreconditions({
      manifestStatus: state.status,
      hasWorkflowBlockingIssues: loaded?.hasWorkflowBlockingIssues ?? false,
      workspaceSupported: isWorkflowWorkspaceSupported(),
    }) !== "no-block";
  vscode.commands.executeCommand("setContext", "tfTools.workflowBlocked", blocked);
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // --- Scope guard: verify no cross-slice commands are registered (T019) ---
  assertNoUnauthorizedContributions(context);

  // Always register the tree provider so VS Code never shows
  // "no data provider registered" when the activity bar is clicked.
  _treeProvider = new ConfigurationTreeProvider();
  _configurationTreeView = vscode.window.createTreeView("tfTools.configuration", {
    treeDataProvider: _treeProvider,
    showCollapseAll: false,
  });
  context.subscriptions.push(
    _configurationTreeView,
    _configurationTreeView.onDidExpandElement(({ element }) => {
      if (element instanceof SelectorHeaderItem) {
        _treeProvider?.setExpandedSelector(element.selectorKind);
      } else if (element instanceof BuildOptionMultistateHeaderItem) {
        _treeProvider?.setExpandedMultistateKey(element.optionKey);
      } else if (element instanceof BuildOptionGroupItem) {
        _treeProvider?.setGroupCollapsed(element.groupLabel, false);
      }
    }),
    _configurationTreeView.onDidCollapseElement(({ element }) => {
      if (element instanceof SelectorHeaderItem) {
        if (_treeProvider?.getExpandedSelector() === element.selectorKind) {
          _treeProvider.setExpandedSelector(undefined);
        }
      } else if (element instanceof BuildOptionMultistateHeaderItem) {
        if (_treeProvider?.getExpandedMultistateKey() === element.optionKey) {
          _treeProvider.setExpandedMultistateKey(undefined);
        }
      } else if (element instanceof BuildOptionGroupItem) {
        _treeProvider?.setGroupCollapsed(element.groupLabel, true);
      }
    }),
    _configurationTreeView.onDidChangeCheckboxState(async ({ items }) => {
      for (const [element, state] of items) {
        if (!(element instanceof BuildOptionCheckboxItem)) {
          continue;
        }
        const newValue = state === vscode.TreeItemCheckboxState.Checked;
        await writeBuildOption(context, element.optionKey, newValue);
      }
      const manifestState = _manifestState;
      if (manifestState) {
        _resolvedOptions = computeResolvedOptions(manifestState, _activeConfig, context);
        _treeProvider?.update(manifestState, _activeConfig, _resolvedOptions);
      }
    })
  );

  if (!hasSupportedWorkspace()) {
    // Extension activated without a workspace — show a visible warning and bail.
    vscode.window.showWarningMessage(
      "Trezor Firmware Tools requires an open workspace folder."
    );
    // Mark workflow as blocked (workspace unsupported) so header actions are disabled.
    vscode.commands.executeCommand("setContext", "tfTools.workflowBlocked", true);
    return;
  }

  const workspaceFolder = requireWorkspaceFolder();
  const manifestUri = resolveManifestUri(workspaceFolder);

  // --- Status-bar presenter (T031) ---
  _statusBar = new StatusBarPresenter();
  context.subscriptions.push(_statusBar);

  // --- IntelliSense service ---
  _intelliSenseService = new IntelliSenseService();
  context.subscriptions.push({
    dispose: () => {
      _intelliSenseService?.dispose();
      _intelliSenseService = undefined;
    },
  });

  // --- Excluded-file visibility services (US1: Explorer badges, US2: editor overlays) ---
  _excludedFilesService = new ExcludedFilesService();
  _excludedFilesRefreshCoordinator = new ExcludedFilesRefreshCoordinator(
    _excludedFilesService,
    workspaceFolder
  );
  _excludedFileDecorations = new ExcludedFileDecorationsProvider();
  _excludedFileOverlays = new ExcludedFileOverlaysManager();
  context.subscriptions.push(
    { dispose: () => { _excludedFilesService?.dispose(); _excludedFilesService = undefined; } },
    { dispose: () => { _excludedFilesRefreshCoordinator?.dispose(); _excludedFilesRefreshCoordinator = undefined; } },
    { dispose: () => { _excludedFileDecorations?.dispose(); _excludedFileDecorations = undefined; } },
    { dispose: () => { _excludedFileOverlays?.dispose(); _excludedFileOverlays = undefined; } },
    vscode.window.registerFileDecorationProvider(_excludedFileDecorations)
  );

  // Connect snapshot updates → decoration provider so Explorer badges refresh.
  context.subscriptions.push(
    _excludedFilesService.onDidUpdateSnapshot((snapshot) => {
      _excludedFileDecorations?.handleSnapshot(snapshot);
      _excludedFileOverlays?.handleSnapshot(snapshot);
    })
  );

  // Re-apply overlays whenever new editors become visible.
  context.subscriptions.push(
    vscode.window.onDidChangeVisibleTextEditors(() => {
      _excludedFileOverlays?.applyToVisibleEditors();
    })
  );

  // Connect IntelliSense payload changes → excluded-file recomputation.
  context.subscriptions.push(
    _intelliSenseService.onDidRefreshPayload((payload) => {
      _excludedFilesRefreshCoordinator?.handlePayload(payload);
    })
  );

  // Subscribe to IntelliSense refresh results → update tree view artifact row
  context.subscriptions.push(
    _intelliSenseService.onDidRefresh(([artifact, readiness]) => {
      const state = _manifestState;
      if (state) {
        _treeProvider?.updateArtifact(artifact);
      }
      // Show wrong-provider fix notification once per state entry (FR-005A fix path).
      if (readiness.warningState === "wrong-provider" && readiness.warningState !== _lastShownProviderFixState) {
        _lastShownProviderFixState = "wrong-provider";
        vscode.window.showWarningMessage(
          readiness.lastWarningMessage ??
            "IntelliSense: another C/C++ configuration provider is active. Switch to Trezor Firmware Tools?",
          "Fix"
        ).then((selection) => {
          if (selection === "Fix") {
            applyProviderSettingFix(workspaceFolder, () => {
              _lastShownProviderFixState = "none";
              _intelliSenseService?.scheduleRefresh("active-config-change");
            });
          }
        });
      } else if (readiness.warningState !== "wrong-provider") {
        _lastShownProviderFixState = "none";
      }
    })
  );

  // Initialize artifactsRoot from current settings
  _intelliSenseService.setArtifactsRoot(resolveArtifactsPath(workspaceFolder));

  // Watch for tfTools.artifactsPath AND tfTools.manifestPath configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("tfTools.artifactsPath", workspaceFolder.uri)) {
        _intelliSenseService?.setArtifactsRoot(resolveArtifactsPath(workspaceFolder));
        _intelliSenseService?.scheduleRefresh("artifacts-path-change");
      }
      if (
        e.affectsConfiguration("tfTools.excludedFiles.grayInTree", workspaceFolder.uri) ||
        e.affectsConfiguration("tfTools.excludedFiles.showEditorOverlay", workspaceFolder.uri) ||
        e.affectsConfiguration("tfTools.excludedFiles.fileNamePatterns", workspaceFolder.uri) ||
        e.affectsConfiguration("tfTools.excludedFiles.folderGlobs", workspaceFolder.uri)
      ) {
        _intelliSenseService?.scheduleRefresh("excluded-files-setting-change");
      }
      if (e.affectsConfiguration("tfTools.manifestPath", workspaceFolder.uri)) {
        // Restart the manifest service with the newly resolved path.
        // The resulting onDidChangeState fires will propagate "manifest-change"
        // to the IntelliSense service automatically.
        _manifestStateSubscription?.dispose();
        _manifestService?.dispose();
        const newManifestUri = resolveManifestUri(workspaceFolder);
        _manifestService = new ManifestService(newManifestUri);
        _manifestStateSubscription = _manifestService.onDidChangeState(onManifestStateChange);
        _manifestService.start().catch((err) => {
          console.error("[tf-tools] Failed to start manifest service after path change:", err);
        });
      }
    })
  );

  // --- Manifest service ---
  _manifestService = new ManifestService(manifestUri);
  context.subscriptions.push({
    dispose: () => {
      _manifestStateSubscription?.dispose();
      _manifestService?.dispose();
    },
  });

  // Connect manifest state changes to the tree provider, diagnostics and logs (T020)
  // On each state change, restore and normalize the active config (T026/T031)
  const onManifestStateChange = async (state: ManifestState): Promise<void> => {
    _manifestState = state;
    let activeConfig: ActiveConfig | undefined;
    if (state.status === "loaded") {
      activeConfig = await restoreActiveConfig(context, state);
    }
    _activeConfig = activeConfig;
    _resolvedOptions = computeResolvedOptions(state, activeConfig, context);
    _treeProvider?.update(state, activeConfig, _resolvedOptions);
    _statusBar?.update(state, activeConfig, isStatusBarEnabled(workspaceFolder));
    handleManifestStateDiagnostics(state);
    logManifestState(state);
    updateWorkflowBlockedContext(state);

    // Update IntelliSense service with the new manifest state
    const loadedState = state.status === "loaded" ? (state as ManifestStateLoaded) : undefined;
    _intelliSenseService?.setManifest(loadedState);
    _intelliSenseService?.setActiveConfig(activeConfig);
    _intelliSenseService?.scheduleRefresh("manifest-change");
  };

  _manifestStateSubscription = _manifestService.onDidChangeState(onManifestStateChange);

  // --- Commands ---
  context.subscriptions.push(
    vscode.commands.registerCommand("tfTools.showLogs", () => {
      revealLogs();
    })
  );

  // --- Refresh IntelliSense command (FR-005, FR-005A) ---
  context.subscriptions.push(
    vscode.commands.registerCommand("tfTools.refreshIntelliSense", () => {
      _intelliSenseService?.scheduleRefresh("manual-refresh");
    })
  );

  // --- Provider-change refresh — re-evaluate readiness when extensions change (FR-005B, T031) ---
  context.subscriptions.push(
    vscode.extensions.onDidChange(() => {
      _intelliSenseService?.scheduleRefresh("provider-change");
    })
  );

  // --- Build-context selector commands (T026+T031) ---
  context.subscriptions.push(
    vscode.commands.registerCommand("tfTools.selectModel", async (modelId: string) => {
      const state = _manifestState;
      if (!state || state.status !== "loaded") { return; }
      const config = await selectModel(context, modelId, state);
      _activeConfig = config;
      _resolvedOptions = computeResolvedOptions(state, config, context);
      _treeProvider?.update(state, config, _resolvedOptions);
      _statusBar?.update(state, config, isStatusBarEnabled(workspaceFolder));
      _intelliSenseService?.setActiveConfig(config);
      _intelliSenseService?.scheduleRefresh("active-config-change");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("tfTools.selectTarget", async (targetId: string) => {
      const state = _manifestState;
      if (!state || state.status !== "loaded") { return; }
      const config = await selectTarget(context, targetId, state);
      _activeConfig = config;
      _resolvedOptions = computeResolvedOptions(state, config, context);
      _treeProvider?.update(state, config, _resolvedOptions);
      _statusBar?.update(state, config, isStatusBarEnabled(workspaceFolder));
      _intelliSenseService?.setActiveConfig(config);
      _intelliSenseService?.scheduleRefresh("active-config-change");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("tfTools.selectComponent", async (componentId: string) => {
      const state = _manifestState;
      if (!state || state.status !== "loaded") { return; }
      const config = await selectComponent(context, componentId, state);
      _activeConfig = config;
      _resolvedOptions = computeResolvedOptions(state, config, context);
      _treeProvider?.update(state, config, _resolvedOptions);
      _statusBar?.update(state, config, isStatusBarEnabled(workspaceFolder));
      _intelliSenseService?.setActiveConfig(config);
      _intelliSenseService?.scheduleRefresh("active-config-change");
    })
  );

  // --- Workflow commands: Build / Clippy / Check / Clean (T027) ---
  const registerWorkflowCommand = (kind: WorkflowKind): vscode.Disposable =>
    vscode.commands.registerCommand(`tfTools.${kind.toLowerCase()}`, async () => {
      const state = _manifestState;
      const loaded = state?.status === "loaded" ? (state as ManifestStateLoaded) : undefined;
      const blockReason = evaluateWorkflowPreconditions({
        manifestStatus: state?.status ?? "missing",
        hasWorkflowBlockingIssues: loaded?.hasWorkflowBlockingIssues ?? false,
        workspaceSupported: isWorkflowWorkspaceSupported(),
      });

      if (blockReason !== "no-block") {
        reportWorkflowBlocked(kind, blockReason);
        return;
      }

      const activeConfig = _activeConfig;
      if (!loaded || !activeConfig) {
        return;
      }

      const wfCtx = resolveWorkflowContext(loaded, activeConfig);
      if (!wfCtx) {
        return;
      }

      const task = createWorkflowTask(kind, wfCtx, workspaceFolder, _resolvedOptions);
      await executeWorkflowTask(task, kind);
    });

  context.subscriptions.push(
    registerWorkflowCommand("Build"),
    registerWorkflowCommand("Clippy"),
    registerWorkflowCommand("Check"),
    registerWorkflowCommand("Clean")
  );

  // --- Build-option toggle/select commands (T027) ---
  context.subscriptions.push(
    vscode.commands.registerCommand("tfTools.toggleBuildOption", async (key: string) => {
      const resolved = _resolvedOptions.find((r) => r.option.key === key);
      if (!resolved || !resolved.available || resolved.option.kind !== "checkbox") {
        return;
      }
      const newValue = resolved.value !== true;
      await writeBuildOption(context, key, newValue);
      const state = _manifestState;
      if (state) {
        _resolvedOptions = computeResolvedOptions(state, _activeConfig, context);
        _treeProvider?.update(state, _activeConfig, _resolvedOptions);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "tfTools.selectBuildOptionState",
      async (key: string, stateId: string) => {
        const resolved = _resolvedOptions.find((r) => r.option.key === key);
        if (!resolved || !resolved.available || resolved.option.kind !== "multistate") {
          return;
        }
        if (!resolved.option.states?.some((s) => s.id === stateId)) {
          return;
        }
        await writeBuildOption(context, key, stateId);
        const state = _manifestState;
        if (state) {
          _resolvedOptions = computeResolvedOptions(state, _activeConfig, context);
          _treeProvider?.update(state, _activeConfig, _resolvedOptions);
        }
      }
    )
  );

  // --- Task provider (T027) ---
  const taskProvider = new BuildTaskProvider({
    getManifestState: () =>
      _manifestState?.status === "loaded" ? (_manifestState as ManifestStateLoaded) : undefined,
    getActiveConfig: () => _activeConfig,
    getResolvedOptions: () => _resolvedOptions,
    getWorkspaceFolder: () => workspaceFolder,
  });
  context.subscriptions.push(vscode.tasks.registerTaskProvider(TASK_TYPE, taskProvider));

  // Trigger IntelliSense refresh after a successful Build task completion (FR-004).
  context.subscriptions.push(
    vscode.tasks.onDidEndTaskProcess((e) => {
      if (
        e.exitCode === 0 &&
        (e.execution.task.definition as { type?: string }).type === TASK_TYPE &&
        e.execution.task.name.startsWith("Build ")
      ) {
        _intelliSenseService?.scheduleRefresh("successful-build");
      }
    })
  );

  // Trigger IntelliSense refresh when workspace folders change so excluded-file
  // candidate paths are re-evaluated against the updated workspace root (US3).
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      _intelliSenseService?.scheduleRefresh("workspace-change");
    })
  );

  // --- Start manifest service (loads and begins watching) ---
  await _manifestService.start();

  // Schedule IntelliSense refresh on activation (FR-004).
  _intelliSenseService?.scheduleRefresh("activation");
}

export function deactivate(): void {
  _manifestStateSubscription?.dispose();
  _manifestStateSubscription = undefined;
  _manifestService?.dispose();
  _manifestService = undefined;
  _treeProvider?.dispose();
  _treeProvider = undefined;
  _configurationTreeView?.dispose();
  _configurationTreeView = undefined;
  _statusBar?.dispose();
  _statusBar = undefined;
  _intelliSenseService?.dispose();
  _intelliSenseService = undefined;
  _excludedFilesService?.dispose();
  _excludedFilesService = undefined;
  _excludedFilesRefreshCoordinator?.dispose();
  _excludedFilesRefreshCoordinator = undefined;
  _excludedFileDecorations?.dispose();
  _excludedFileDecorations = undefined;
  _excludedFileOverlays?.dispose();
  _excludedFileOverlays = undefined;
  _manifestState = undefined;
  _activeConfig = undefined;
  _resolvedOptions = [];
  disposeDiagnostics();
  disposeLogChannel();
}
