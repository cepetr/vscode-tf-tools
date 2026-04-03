import * as path from "path";
import { runTests } from "@vscode/test-electron";

async function main(): Promise<void> {
  try {
    // Root of the extension under test
    const extensionDevelopmentPath = path.resolve(__dirname, "../../../");
    // Path to the compiled test index (runs inside VS Code extension host)
    const extensionTestsPath = path.resolve(__dirname, "./index");

    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: ["--disable-extensions"],
    });
  } catch (err) {
    console.error("Integration test run failed:", err);
    process.exit(1);
  }
}

main();
