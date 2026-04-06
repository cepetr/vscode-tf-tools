/**
 * Unit tests for blocked-action gating and failure reasons.
 *
 * Blocked Build/Clippy/Check/Clean actions produce visible failure feedback.
 * Unsupported workspaces block all four workflow actions.
 * Failed tasks produce a visible notification and a persistent log entry.
 */
import * as assert from "assert";
import {
  evaluateWorkflowPreconditions,
  blockReasonMessage,
  WorkflowBlockReason,
  PreconditionInputs,
} from "../../../commands/build-workflow";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function inputs(
  manifestStatus: "loaded" | "missing" | "invalid",
  hasWorkflowBlockingIssues: boolean,
  workspaceSupported: boolean
): PreconditionInputs {
  return { manifestStatus, hasWorkflowBlockingIssues, workspaceSupported };
}

// ---------------------------------------------------------------------------
// Suite: evaluateWorkflowPreconditions
// ---------------------------------------------------------------------------

suite("evaluateWorkflowPreconditions – blocking logic", () => {
  test("returns no-block when all preconditions are met", () => {
    assert.strictEqual(
      evaluateWorkflowPreconditions(inputs("loaded", false, true)),
      "no-block"
    );
  });

  test("workspace-unsupported blocks when workspace has multiple/no folders", () => {
    assert.strictEqual(
      evaluateWorkflowPreconditions(inputs("loaded", false, false)),
      "workspace-unsupported"
    );
  });

  test("manifest-missing blocks when manifest file absent", () => {
    assert.strictEqual(
      evaluateWorkflowPreconditions(inputs("missing", false, true)),
      "manifest-missing"
    );
  });

  test("manifest-invalid blocks when manifest has structural errors", () => {
    assert.strictEqual(
      evaluateWorkflowPreconditions(inputs("invalid", false, true)),
      "manifest-invalid"
    );
  });

  test("manifest-invalid blocks when manifest has invalid when expressions", () => {
    assert.strictEqual(
      evaluateWorkflowPreconditions(inputs("loaded", true, true)),
      "manifest-invalid"
    );
  });

  test("workspace-unsupported takes priority over manifest-missing", () => {
    assert.strictEqual(
      evaluateWorkflowPreconditions(inputs("missing", false, false)),
      "workspace-unsupported"
    );
  });

  test("workspace-unsupported takes priority over manifest-invalid", () => {
    assert.strictEqual(
      evaluateWorkflowPreconditions(inputs("invalid", false, false)),
      "workspace-unsupported"
    );
  });

  test("workspace-unsupported takes priority over hasWorkflowBlockingIssues", () => {
    assert.strictEqual(
      evaluateWorkflowPreconditions(inputs("loaded", true, false)),
      "workspace-unsupported"
    );
  });
});

// ---------------------------------------------------------------------------
// Suite: blockReasonMessage
// ---------------------------------------------------------------------------

suite("blockReasonMessage – user-facing failure text", () => {
  const REASONS: WorkflowBlockReason[] = [
    "workspace-unsupported",
    "manifest-missing",
    "manifest-invalid",
  ];

  for (const reason of REASONS) {
    test(`produces non-empty message for ${reason}`, () => {
      const msg = blockReasonMessage(reason);
      assert.ok(msg.length > 0, `expected non-empty message for ${reason}`);
    });
  }

  test("workspace-unsupported message mentions single folder requirement", () => {
    const msg = blockReasonMessage("workspace-unsupported");
    assert.ok(
      msg.toLowerCase().includes("folder"),
      "message should mention workspace folder requirement"
    );
  });

  test("manifest-missing message mentions the manifest file", () => {
    const msg = blockReasonMessage("manifest-missing");
    assert.ok(
      msg.toLowerCase().includes("manifest"),
      "message should mention the manifest file"
    );
  });

  test("manifest-invalid message mentions validation errors or availability rules", () => {
    const msg = blockReasonMessage("manifest-invalid");
    assert.ok(
      msg.toLowerCase().includes("validation") ||
        msg.toLowerCase().includes("error") ||
        msg.toLowerCase().includes("availability"),
      "message should mention errors or validation"
    );
  });

  test("no-block returns an empty string", () => {
    assert.strictEqual(blockReasonMessage("no-block"), "");
  });
});
