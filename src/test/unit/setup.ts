/**
 * Unit test setup — loaded by mocha before any test files run (--require).
 * Injects a minimal vscode stub so that extension modules can be imported
 * outside the VS Code extension host.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Module = require("module");
const originalLoad = Module._load as (request: string, ...args: unknown[]) => unknown;

Module._load = function (request: string, ...args: unknown[]): unknown {
  if (request === "vscode") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("./vscode-mock");
  }
  return originalLoad.call(this, request, ...args);
};
