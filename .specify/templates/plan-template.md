# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: [TypeScript 5.x targeting VS Code 1.110+ or NEEDS CLARIFICATION]
**Primary Dependencies**: [VS Code Extension API, existing extension libraries, and feature-specific packages]
**Storage**: [workspace state, VS Code settings, repository files, or justified alternative]
**Testing**: [automated unit tests plus VS Code integration tests are REQUIRED]
**Target Platform**: [VS Code 1.110+ desktop extension host]
**Project Type**: [single-package VS Code extension]
**Performance Goals**: [no perceptible UI lag, bounded refresh cost, or NEEDS CLARIFICATION]
**Constraints**: [single-root workspace, manifest-driven behavior, explicit diagnostics/logging, no support below VS Code 1.110]
**Scale/Scope**: [one extension package serving trezor-firmware workflows]

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [ ] Host compatibility: scoped to a TypeScript VS Code extension targeting VS Code 1.110+.
- [ ] Manifest authority: build/debug/configuration choices derive from settings and manifest data, not hardcoded matrices.
- [ ] Test discipline: tests are defined before implementation and cover each changed behavior plus regressions.
- [ ] Failure visibility: diagnostics, notifications, and log-channel behavior are specified for new failure modes.
- [ ] Simplicity: abstractions are minimal and any identifier or design complexity exception is justified.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── extension.ts
├── commands/
├── core/
├── state/
├── ui/
└── test/
    ├── unit/
    └── integration/

test-fixtures/
├── manifests/
└── workspaces/
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
