<!--
Sync Impact Report
Version change: 1.2.0 -> 1.3.0
Modified principles:
- None (core principle titles unchanged; Delivery Workflow materially expanded)
Added sections:
- None
Removed sections:
- None
Templates requiring updates:
- ✅ .specify/templates/constitution-template.md
- ✅ .specify/templates/spec-template.md
- ✅ .specify/templates/plan-template.md
- ✅ .specify/templates/tasks-template.md
- ✅ .github/agents/speckit.constitution.agent.md
- ✅ .github/agents/speckit.specify.agent.md
- ✅ .github/agents/speckit.plan.agent.md
- ✅ .github/agents/speckit.tasks.agent.md
- ✅ .github/agents/speckit.implement.agent.md
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

- Before `/speckit.specify`, `/speckit.plan`, `/speckit.tasks`, or
	`/speckit.implement` proceeds, the agent MUST read the relevant documents in
	`informal_spec/`, including `user-spec.md`, `tech-spec.md`, and
	`feature-split.md`, when those files exist.
- Those workflow steps MUST extract the concrete user-visible and
	implementation-sensitive details from the selected informal-spec slice,
	including UI interaction rules, ordering constraints, persistence behavior,
	and VS Code surface expectations that are easy to omit when only a summary is
	carried forward.
- Each feature spec MUST describe user-visible behavior, edge cases, operational
	constraints, and failure or diagnostic behavior.
- If the selected informal spec contains a concrete required behavior that is
	not yet represented in `spec.md`, `plan.md`, `tasks.md`, or the intended
	implementation approach, the agent MUST amend the missing artifact before
	continuing instead of silently proceeding with a partial interpretation.
- Each generated spec, implementation plan, and task list MUST explicitly name
	the informal-spec slice it implements and MUST stay aligned with that slice.
	If requested work spans multiple slices from `feature-split.md`, the workflow
	MUST stop and require the work to be split or the informal spec to be amended
	before continuing.
- Each implementation plan MUST record the critical informal-spec details that
	are most likely to be missed during coding, especially for tree-view
	behavior, event ordering, persistence semantics, command visibility, and
	other editor-integration details.
- Each implementation plan MUST pass a Constitution Check covering host
	compatibility, manifest-driven design, test coverage, failure visibility, and
	simplicity.
- Each task list MUST schedule tests before implementation tasks for every user
	story and MUST include observability work whenever a feature adds new failure
	modes or validation paths.
- Each task list and implementation run MUST include explicit coverage for
	critical informal-spec details through dedicated test tasks, validation tasks,
	or both.
- When an automated agent executes `tasks.md`, it MUST complete exactly one task
	at a time, mark that task complete in `tasks.md`, and create one descriptive
	git commit before starting the next task. Grouping multiple tasks into a
	single commit is prohibited unless this constitution is amended.
- Before a task is marked complete, self-review MUST compare the changed code
	against the selected informal-spec slice and confirm that the critical
	details were implemented as specified, not merely approximated.
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

**Version**: 1.3.0 | **Ratified**: 2026-04-02 | **Last Amended**: 2026-04-03
