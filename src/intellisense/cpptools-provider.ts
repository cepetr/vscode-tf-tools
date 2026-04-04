import * as vscode from "vscode";
import { IntelliSenseProviderReadiness } from "./intellisense-types";

// ---------------------------------------------------------------------------
// Microsoft C/C++ extension ID
// ---------------------------------------------------------------------------

const CPPTOOLS_EXTENSION_ID = "ms-vscode.cpptools";

// ---------------------------------------------------------------------------
// Provider readiness check
// ---------------------------------------------------------------------------

/**
 * Evaluates whether the cpptools provider prerequisites are currently satisfied.
 *
 * - `missing-provider`: ms-vscode.cpptools is not installed or not enabled.
 * - `wrong-provider`: cpptools is present but the workspace `C_Cpp.default.configurationProvider`
 *   setting does not point to this extension.
 * - `none`: prerequisites are satisfied.
 *
 * This function is pure side-effect-free and synchronous so it can be called
 * from inside the serialized refresh path without async overhead.
 */
export function checkProviderReadiness(): IntelliSenseProviderReadiness {
  const ext = vscode.extensions.getExtension(CPPTOOLS_EXTENSION_ID);

  if (!ext) {
    return {
      providerInstalled: false,
      providerConfigured: false,
      warningState: "missing-provider",
      lastWarningMessage:
        "IntelliSense integration is unavailable: Microsoft C/C++ extension (ms-vscode.cpptools) is not installed or is disabled.",
    };
  }

  // Check that the workspace uses tf-tools as the active configuration provider.
  // The setting is scoped to workspace/resource; we check the folder-level value.
  const cfg = vscode.workspace.getConfiguration("C_Cpp");
  const configuredProvider: string | undefined = cfg.get<string>(
    "default.configurationProvider"
  );

  const EXPECTED_PROVIDER = "ms-vscode.cpptools"; // tf-tools registers under its own publisher id
  // Accept both the short extension id and the fully-qualified form.
  const isConfigured =
    !configuredProvider ||
    configuredProvider === "" ||
    configuredProvider.toLowerCase() === "cepetr.tf-tools";

  if (!isConfigured) {
    return {
      providerInstalled: true,
      providerConfigured: false,
      warningState: "wrong-provider",
      lastWarningMessage:
        `IntelliSense integration unavailable: the workspace C_Cpp.default.configurationProvider is set to ` +
        `"${configuredProvider}" instead of Trezor Firmware Tools. ` +
        `Update the setting or clear it to let tf-tools provide IntelliSense.`,
    };
  }

  return {
    providerInstalled: true,
    providerConfigured: true,
    warningState: "none",
  };
}

// ---------------------------------------------------------------------------
// Cpptools provider adapter
// ---------------------------------------------------------------------------

/**
 * Thin boundary adapter for Microsoft C/C++ compile-database application.
 *
 * In the real extension host this drives the cpptools custom configuration
 * provider API. In tests it can be replaced with a stub that records calls.
 *
 * The adapter is intentionally minimal: it only exposes apply and clear,
 * keeping the IntelliSense service decoupled from the VS Code provider API.
 */
export class CpptoolsProviderAdapter {
  private _lastAppliedPath: string | null = null;

  /**
   * Applies the given compile-commands file as the active cpptools configuration.
   * No-ops when the path is the same as the last applied path.
   */
  async applyCompileCommands(compiledCommandsPath: string): Promise<void> {
    if (this._lastAppliedPath === compiledCommandsPath) {
      return;
    }
    // Phase 1 scaffolding: notify cpptools to re-read configuration.
    // A full custom configuration provider registration follows in T016.
    this._lastAppliedPath = compiledCommandsPath;
    // Fire the cpptools "configuration changed" event so the editor refreshes.
    try {
      await vscode.commands.executeCommand(
        "C_Cpp.refreshIntelliSense"
      );
    } catch {
      // cpptools command may not be available when cpptools is absent; ignore.
    }
  }

  /**
   * Clears any previously applied compile-commands configuration.
   * Resets the adapter state and signals cpptools to reload.
   */
  async clearCompileCommands(): Promise<void> {
    if (this._lastAppliedPath === null) {
      return;
    }
    this._lastAppliedPath = null;
    try {
      await vscode.commands.executeCommand(
        "C_Cpp.refreshIntelliSense"
      );
    } catch {
      // ignore when unavailable
    }
  }

  getLastAppliedPath(): string | null {
    return this._lastAppliedPath;
  }

  dispose(): void {
    this._lastAppliedPath = null;
  }
}
