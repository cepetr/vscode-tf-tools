/**
 * Unit tests for Build Workflow task label formatting.
 *
 * FR-014: Build task label = "Build {model-name} | {target-display} | {component-name}"
 * FR-015: Clippy task label = "Clippy {model-name} | {target-display} | {component-name}"
 * FR-016: Check task label = "Check {model-name} | {target-display} | {component-name}"
 * FR-017: Clean task label = "Clean"
 * FR-018: target-display = shortName when present, else full name
 */
import * as assert from "assert";
import { formatTaskLabel, CLEAN_TASK_LABEL, WorkflowContext } from "../../../commands/build-workflow";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ctx(
  modelId: string,
  modelName: string,
  targetDisplay: string,
  componentName: string,
  targetId = "hw",
  componentId = "core"
): WorkflowContext {
  return { modelId, modelName, targetId, targetDisplay, componentId, componentName };
}

// ---------------------------------------------------------------------------
// Suite: formatTaskLabel
// ---------------------------------------------------------------------------

suite("formatTaskLabel – Build / Clippy / Check labels", () => {
  test("Build label uses model-name, target-display, and component-name", () => {
    assert.strictEqual(
      formatTaskLabel("Build", ctx("T2T1", "T2T1", "HW", "Core")),
      "Build T2T1 | HW | Core"
    );
  });

  test("Clippy label uses model-name, target-display, and component-name", () => {
    assert.strictEqual(
      formatTaskLabel("Clippy", ctx("T2T1", "T2T1", "HW", "Core")),
      "Clippy T2T1 | HW | Core"
    );
  });

  test("Check label uses model-name, target-display, and component-name", () => {
    assert.strictEqual(
      formatTaskLabel("Check", ctx("T2T1", "T2T1", "HW", "Core")),
      "Check T2T1 | HW | Core"
    );
  });

  test("uses target shortName when present (via targetDisplay parameter)", () => {
    // shortName "HW" is passed as targetDisplay (resolved by caller)
    assert.strictEqual(
      formatTaskLabel("Build", ctx("T3W1", "T3W1", "HW", "Prodtest")),
      "Build T3W1 | HW | Prodtest"
    );
  });

  test("falls back to full target name when shortName is absent", () => {
    // full name "Emulator" passed when no shortName exists
    assert.strictEqual(
      formatTaskLabel("Build", ctx("T2T1", "T2T1", "Emulator", "Core", "emu")),
      "Build T2T1 | Emulator | Core"
    );
  });

  test("uses component name, not id, in the label", () => {
    // componentName must be the display name, not the id
    assert.strictEqual(
      formatTaskLabel("Build", ctx("T2T1", "T2T1", "HW", "Core Firmware")),
      "Build T2T1 | HW | Core Firmware"
    );
  });

  test("uses the model display name rather than the model id", () => {
    assert.strictEqual(
      formatTaskLabel("Build", ctx("model-t3w1", "T3W1", "HW", "Core")),
      "Build T3W1 | HW | Core"
    );
  });
});

suite("CLEAN_TASK_LABEL", () => {
  test("Clean label constant is 'Clean'", () => {
    assert.strictEqual(CLEAN_TASK_LABEL, "Clean");
  });
});

suite("formatTaskLabel – Clean always returns fixed label", () => {
  test("formatTaskLabel with Clean kind returns 'Clean' regardless of context", () => {
    assert.strictEqual(
      formatTaskLabel("Clean", ctx("T2T1", "T2T1", "HW", "Core")),
      "Clean"
    );
  });

  test("formatTaskLabel with Clean kind ignores long component name", () => {
    assert.strictEqual(
      formatTaskLabel("Clean", ctx("T3W1", "T3W1", "Emulator", "Core Firmware", "emu")),
      "Clean"
    );
  });
});
