<!--
Sync Impact Report
Version change: template -> 1.0.0
Modified principles:
- Template principle slot 1 -> I. TypeScript Extension First
- Template principle slot 2 -> II. Manifest-Driven Behavior
- Template principle slot 3 -> III. Tests Are Mandatory
- Template principle slot 4 -> IV. Failures Must Be Visible
- Template principle slot 5 -> V. Keep It Small And Clear
Added sections:
- Technical Guardrails
- Delivery Workflow
Removed sections:
- None
Templates requiring updates:
- ✅ .specify/templates/plan-template.md
- ✅ .specify/templates/spec-template.md
- ✅ .specify/templates/tasks-template.md
- ✅ .github/agents/speckit.tasks.agent.md
Follow-up TODOs:
- None
-->
# Trezor Firmware Tools Constitution

## Core Principles

### I. TypeScript Extension First
All shipped code MUST be authored in TypeScript and MUST target the stable VS Code
extension API available in VS Code 1.110 or newer. Work to preserve behavior on
older VS Code releases is out of scope unless the constitution is amended first.
Rationale: the project is a VS Code extension, and narrowing the support window keeps
implementation and test effort focused on the supported host.

### II. Manifest-Driven Behavior
Available build context, build options, artifact resolution, and debug selection MUST
derive from workspace settings and repository data such as `tf-tools.yaml`. Features
MUST NOT hardcode firmware matrices, silently infer alternate artifacts, or retain
stale state once the manifest or settings disallow it. Invalid or missing source data
MUST trigger visible normalization or failure handling.
Rationale: the firmware repository is the source of truth, and the extension must stay
aligned with it instead of drifting into duplicated configuration.

### III. Tests Are Mandatory
Every functional change MUST ship with automated tests that fail before the fix or
feature is implemented when practical. User-story work MUST include tests for the
primary success path, and bug fixes MUST include regression coverage. Changes that
touch VS Code integration, manifest parsing, task execution, or persisted state MUST
include integration-level coverage in addition to focused unit tests where feasible.
Rationale: this extension coordinates workspace state, UI, tasks, and tooling; without
tests, regressions will be hard to detect and expensive to diagnose.

### IV. Failures Must Be Visible
User-blocking and state-changing failures MUST be surfaced through explicit VS Code
feedback. File-backed problems MUST produce diagnostics when a concrete file can be
identified, and runtime warnings or errors MUST be written to a dedicated output
channel with enough context to troubleshoot the failure. Silent fallbacks that hide
manifest, artifact, provider, or debug-resolution problems are prohibited.
Rationale: this tool is operational infrastructure inside the editor, so invisible
failures are worse than explicit failure states.

### V. Keep It Small And Clear
Designs MUST prefer the smallest implementation that satisfies the current
requirement. New abstractions, background services, or compatibility layers require
an explicit need. Identifiers SHOULD stay under 25 characters when that does not
reduce clarity; longer names MUST be justified by disambiguation or API constraints.
Complexity exceptions MUST be recorded in the implementation plan.
Rationale: the extension spans UI, task orchestration, and editor integration;
concise code and justified complexity keep it maintainable.

## Technical Guardrails

- The product is a single-package VS Code extension for the `trezor-firmware`
	workspace and is implemented in TypeScript.
- The supported editor baseline is VS Code 1.110+.
- The extension may assume a single-root workspace unless a future amendment
	expands that scope.
- Integration with external tools such as cpptools, Cargo tasks, YAML manifests,
	and debug templates MUST use stable, documented interfaces and fail explicitly
	when prerequisites are missing.
- Repository data and workspace settings are authoritative over cached extension
	state.

## Delivery Workflow

- Each feature spec MUST describe user-visible behavior, edge cases, operational
	constraints, and failure or diagnostic behavior.
- Each implementation plan MUST pass a Constitution Check covering host
	compatibility, manifest-driven design, test coverage, failure visibility, and
	simplicity.
- Each task list MUST schedule tests before implementation tasks for every user
	story and MUST include observability work whenever a feature adds new failure
	modes or validation paths.
- Code review and self-review MUST verify constitutional compliance before merge.
- Documentation and generated scaffolding MUST stay consistent with this
	constitution whenever the rules change.

## Governance

This constitution overrides conflicting local process guidance for this repository.
Amendments require a documented change to this file, an explicit rationale, and
synchronization of impacted templates or agent instructions in the same change.
Versioning follows semantic rules for governance documents: MAJOR for incompatible
principle changes or removals, MINOR for new principles or materially expanded
requirements, and PATCH for clarifications that do not change project obligations.
Compliance review is required for every plan, task list, and pull request that
changes behavior, tooling, or development workflow.

**Version**: 1.0.0 | **Ratified**: 2026-04-02 | **Last Amended**: 2026-04-02
