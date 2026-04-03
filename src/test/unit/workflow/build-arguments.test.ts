/**
 * Unit tests for Build Workflow effective argument derivation.
 *
 * FR-019: Derive effective Build/Clippy/Check args from model, target,
 *         component, and currently applicable build-option selections.
 * FR-020: Build/Clippy/Check share the same effective configuration.
 * FR-021: Clean runs without build-option arguments.
 */
import * as assert from "assert";
import {
  deriveWorkflowArguments,
  deriveCleanArguments,
  WorkflowKind,
} from "../../../commands/build-workflow";
import { ResolvedOption } from "../../../configuration/build-options";
import { BuildOption } from "../../../manifest/manifest-types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function checkboxOpt(
  key: string,
  flag: string,
  available: boolean,
  checked: boolean
): ResolvedOption {
  const option: BuildOption = {
    key,
    label: key,
    flag,
    kind: "checkbox",
  };
  return { option, available, value: checked };
}

function multistateOpt(
  key: string,
  available: boolean,
  activeFlag: string,
  activeStateId: string,
  states: Array<{ id: string; label: string; flag: string }>
): ResolvedOption {
  const option: BuildOption = {
    key,
    label: key,
    flag: "",
    kind: "multistate",
    states,
    defaultState: states[0]?.id,
  };
  return { option, available, value: activeStateId };
}

// ---------------------------------------------------------------------------
// Suite: deriveWorkflowArguments
// ---------------------------------------------------------------------------

suite("deriveWorkflowArguments – effective Build/Clippy/Check args", () => {
  const baseContext = { modelId: "T2T1", targetId: "hw", componentId: "core" };

  test("returns base model/target/component args when no options selected", () => {
    const args = deriveWorkflowArguments("Build", baseContext, []);
    assert.ok(args.includes("T2T1"), "expected modelId in args");
    assert.ok(args.includes("hw"), "expected targetId in args");
    assert.ok(args.includes("core"), "expected componentId in args");
  });

  test("Build, Clippy, Check produce the same effective configuration", () => {
    const resolved: ResolvedOption[] = [checkboxOpt("debug", "--debug", true, true)];
    const buildArgs = deriveWorkflowArguments("Build", baseContext, resolved);
    const clippyArgs = deriveWorkflowArguments("Clippy", baseContext, resolved);
    const checkArgs = deriveWorkflowArguments("Check", baseContext, resolved);
    // Same option flags derived for all three
    const optionFlagsBuild = buildArgs.filter((a) => a.startsWith("--"));
    const optionFlagsClippy = clippyArgs.filter((a) => a.startsWith("--"));
    const optionFlagsCheck = checkArgs.filter((a) => a.startsWith("--"));
    assert.deepStrictEqual(optionFlagsBuild, optionFlagsClippy);
    assert.deepStrictEqual(optionFlagsBuild, optionFlagsCheck);
  });

  test("includes flag for enabled checkbox option", () => {
    const resolved: ResolvedOption[] = [checkboxOpt("debug", "--debug", true, true)];
    const args = deriveWorkflowArguments("Build", baseContext, resolved);
    assert.ok(args.includes("--debug"), "expected --debug flag");
  });

  test("excludes flag for disabled checkbox option", () => {
    const resolved: ResolvedOption[] = [checkboxOpt("debug", "--debug", true, false)];
    const args = deriveWorkflowArguments("Build", baseContext, resolved);
    assert.ok(!args.includes("--debug"), "should not include --debug");
  });

  test("excludes flag for unavailable option even if saved as true", () => {
    const resolved: ResolvedOption[] = [checkboxOpt("debug", "--debug", false, true)];
    const args = deriveWorkflowArguments("Build", baseContext, resolved);
    assert.ok(!args.includes("--debug"), "unavailable option should not contribute flag");
  });

  test("includes active multistate state flag", () => {
    const states = [
      { id: "off", label: "Off", flag: "" },
      { id: "normal", label: "Normal", flag: "--verbose" },
      { id: "high", label: "High", flag: "--verbose=2" },
    ];
    const resolved: ResolvedOption[] = [
      multistateOpt("verbosity", true, "--verbose", "normal", states),
    ];
    const args = deriveWorkflowArguments("Build", baseContext, resolved);
    assert.ok(args.includes("--verbose"), "expected --verbose flag from normal state");
  });

  test("omits flag for multistate state with empty flag string", () => {
    const states = [
      { id: "off", label: "Off", flag: "" },
      { id: "normal", label: "Normal", flag: "--verbose" },
    ];
    const resolved: ResolvedOption[] = [
      multistateOpt("verbosity", true, "", "off", states),
    ];
    const args = deriveWorkflowArguments("Build", baseContext, resolved);
    assert.ok(!args.includes("--verbose"), "off state should not contribute --verbose");
  });

  test("multiple available options all contribute flags", () => {
    const resolved: ResolvedOption[] = [
      checkboxOpt("debug", "--debug", true, true),
      checkboxOpt("fast", "--fast", true, true),
    ];
    const args = deriveWorkflowArguments("Build", baseContext, resolved);
    assert.ok(args.includes("--debug"));
    assert.ok(args.includes("--fast"));
  });
});

// ---------------------------------------------------------------------------
// Suite: deriveCleanArguments
// ---------------------------------------------------------------------------

suite("deriveCleanArguments – Clean does not use build-option flags", () => {
  const baseContext = { modelId: "T2T1", targetId: "hw", componentId: "core" };

  test("args include model/target/component", () => {
    const args = deriveCleanArguments(baseContext);
    assert.ok(args.includes("T2T1"));
    assert.ok(args.includes("hw"));
    assert.ok(args.includes("core"));
  });

  test("args do not include build-option flags even with active options", () => {
    // deriveCleanArguments takes no resolved options — it cannot accept them
    const args = deriveCleanArguments(baseContext);
    // No --debug, --fast, etc. should appear
    assert.ok(!args.some((a) => a.startsWith("--")), "Clean args must not include option flags");
  });
});
