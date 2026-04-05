import * as assert from "assert";
import { isSuccessfulBuildTaskProcess, TaskProcessEndLike } from "../../../extension";

function makeEvent(overrides: Partial<TaskProcessEndLike> = {}): TaskProcessEndLike {
  return {
    exitCode: 0,
    execution: {
      task: {
        definition: { type: "tfTools" },
        name: "Build Trezor Model T (v1) | HW | Core",
      },
    },
    ...overrides,
  };
}

suite("isSuccessfulBuildTaskProcess", () => {
  test("returns true for a successful tfTools Build task", () => {
    assert.strictEqual(isSuccessfulBuildTaskProcess(makeEvent()), true);
  });

  test("returns false when the task failed", () => {
    assert.strictEqual(
      isSuccessfulBuildTaskProcess(makeEvent({ exitCode: 1 })),
      false
    );
  });

  test("returns false for non-build tfTools tasks", () => {
    assert.strictEqual(
      isSuccessfulBuildTaskProcess(
        makeEvent({
          execution: {
            task: {
              definition: { type: "tfTools" },
              name: "Check Trezor Model T (v1) | HW | Core",
            },
          },
        })
      ),
      false
    );
  });

  test("returns false for non-tfTools tasks", () => {
    assert.strictEqual(
      isSuccessfulBuildTaskProcess(
        makeEvent({
          execution: {
            task: {
              definition: { type: "shell" },
              name: "Build Trezor Model T (v1) | HW | Core",
            },
          },
        })
      ),
      false
    );
  });
});