/**
 * Unit tests for Build Workflow effective argument derivation.
 *
 * Derive effective Build/Clippy/Check args from model, target,
 * component, and currently applicable build-option selections.
 * Build/Clippy/Check share the same effective configuration.
 * Clean runs without build-option arguments.
 */
import * as assert from "assert";
import {
  deriveWorkflowArguments,
  deriveCleanArguments,
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

  test("returns <component> -m <model> format with no options and no target flag", () => {
    const args = deriveWorkflowArguments("Build", baseContext, []);
    assert.deepStrictEqual(args, ["core", "-m", "T2T1"]);
  });

  test("appends target flag when present", () => {
    const ctx = { ...baseContext, targetFlag: "--hw" };
    const args = deriveWorkflowArguments("Build", ctx, []);
    assert.deepStrictEqual(args, ["core", "-m", "T2T1", "--hw"]);
  });

  test("omits target flag when null", () => {
    const ctx = { ...baseContext, targetFlag: null };
    const args = deriveWorkflowArguments("Build", ctx, []);
    assert.deepStrictEqual(args, ["core", "-m", "T2T1"]);
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

suite("deriveCleanArguments – Clean has no arguments", () => {
  const baseContext = { modelId: "T2T1", targetId: "hw", componentId: "core" };

  test("returns empty args (cargo xtask clean has no configuration-derived arguments)", () => {
    const args = deriveCleanArguments(baseContext);
    assert.deepStrictEqual(args, [], "Clean must produce no arguments");
  });

  test("args do not include model, target, component, or build-option flags", () => {
    const args = deriveCleanArguments(baseContext);
    assert.ok(!args.includes("T2T1"), "Clean must not include modelId");
    assert.ok(!args.includes("hw"), "Clean must not include targetId");
    assert.ok(!args.includes("core"), "Clean must not include componentId");
    assert.ok(!args.some((a) => a.startsWith("--")), "Clean args must not include option flags");
  });
});
