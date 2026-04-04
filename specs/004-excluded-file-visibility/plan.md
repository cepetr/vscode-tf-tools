# Implementation Plan: Excluded-File Visibility

**Branch**: `004-excluded-file-visibility` | **Date**: 2026-04-04 | **Spec**: `specs/004-excluded-file-visibility/spec.md`
**Input**: Feature specification from `specs/004-excluded-file-visibility/spec.md`

**File Reference Rule**: Use workspace-relative paths for any repository file references written into this plan.

## Summary

Implement excluded-file visibility by reusing the active compile-database payload already produced by the IntelliSense slice, then layering a small excluded-files matching service plus two presentation adapters: a `FileDecorationProvider` for Explorer badges and optional graying, and an editor overlay manager for first-line warnings. The work stays inside the existing activation and serialized refresh architecture by adding excluded-file settings readers, refresh wiring in `src/extension.ts`, and focused unit/integration coverage for basename-only matching, workspace-relative versus absolute folder globs, forward-slash normalization, empty-scope disabling, stale-state clearing, and UI refresh after active-context or settings changes.

## Informal Spec Alignment

**Selected Slice**: `4. Excluded-File Visibility`
**Source Anchor**: `Explorer badges, optional graying, editor overlay, and file-scope/pattern rules.`
**Scope Guard**: This plan includes excluded-file match evaluation, Explorer badges, optional Explorer graying, editor overlays, settings-driven scope filtering, refresh triggers, and stale-state clearing when compile-database inclusion data changes or disappears. It explicitly excludes new compile-commands parsing rules, cpptools integration changes, compile-commands artifact-path logic, Binary or Map File behavior, Flash and Upload actions, Debug launch, alternate providers, and multi-root behavior.
**Critical Informal Details**: Excluded-file visibility must consume only the active compile-database inclusion data for the selected build context; a file is marked only when it is absent from that inclusion set and matches at least one configured basename pattern plus at least one configured folder glob; `fileNamePatterns` are basename-only, case-sensitive, and do not support subpath globbing; `folderGlobs` are case-sensitive, may be absolute or workspace-relative, and use `/` separators while candidate paths are normalized to `/`; empty `fileNamePatterns` or `folderGlobs` disables excluded-file marking until repopulated; Explorer always shows the `✗` badge for excluded files and grays them only when `tfTools.excludedFiles.grayInTree` is enabled; editors show the first-line warning only when `tfTools.excludedFiles.showEditorOverlay` is enabled; overlay and tooltip text must explain that the file is not included in the active build configuration; refresh must cover activation, active-context changes, successful builds, manual refresh, workspace changes, manifest changes, `tfTools.artifactsPath` changes, and excluded-files setting changes; stale badges and overlays must be cleared as soon as the file stops matching or compile-database inclusion data becomes unavailable.

## Technical Context

**Language/Version**: TypeScript 5.x targeting VS Code 1.110+ desktop extension host
**Primary Dependencies**: VS Code Extension API, existing IntelliSense payload parser and service, existing manifest/settings helpers, Node.js `path` APIs, `minimatch` for constrained glob evaluation, Mocha test runner, `@vscode/test-electron` integration harness
**Storage**: Resource-scoped VS Code settings for `tfTools.excludedFiles.grayInTree`, `tfTools.excludedFiles.showEditorOverlay`, `tfTools.excludedFiles.fileNamePatterns`, and `tfTools.excludedFiles.folderGlobs`; existing active compile-database payload held in extension memory; no new persisted workspace state
**Testing**: Unit tests for settings normalization, basename-only matching, forward-slash path normalization, absolute and workspace-relative folder glob matching, empty-scope disabling, exclusion decisions, and stale-state clearing; integration tests for FileDecorationProvider output, editor overlay behavior, settings-driven refresh, active-context refresh, and compile-input loss
**Target Platform**: VS Code 1.110+ desktop extension host on single-root workspaces
**Project Type**: Single-package VS Code extension
**Performance Goals**: No perceptible Explorer or editor lag on refresh; excluded-file recomputation remains bounded to the active compile-database inclusion set plus currently rendered/visible resources rather than scanning arbitrary artifact roots
**Constraints**: Single-root workspace only, manifest/settings remain authoritative, no fallback compile input beyond the active IntelliSense payload, failure visibility stays explicit without silent stale state, matching remains case-sensitive with `/`-normalized paths, and added abstractions must stay minimal
**Scale/Scope**: One extension package, one active compile-database payload per workspace, one Explorer decoration provider, one editor overlay manager, and targeted fixture coverage for included versus excluded files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] Host compatibility: scoped to a TypeScript VS Code extension targeting VS Code 1.110+.
- [x] Informal-spec alignment: the selected slice is stated, the design stays within it, and cross-slice work is deferred or split.
- [x] Informal-spec detail capture: critical user-visible and implementation-sensitive behaviors from the selected slice are explicitly carried into this plan.
- [x] Manifest authority: build/debug/configuration choices derive from settings and manifest data, not hardcoded matrices.
- [x] Test discipline: tests are defined before implementation and cover each changed behavior plus regressions.
- [x] Failure visibility: diagnostics, notifications, and log-channel behavior are specified for new failure modes.
- [x] Simplicity: abstractions are minimal and any identifier or design complexity exception is justified.

## Critical Detail Reconciliation

- Add excluded-file settings readers in `src/workspace/settings.ts` so basename patterns, folder globs, graying, and overlay preferences remain resource-scoped and refresh immediately; enforce with new unit tests for defaults, absolute versus workspace-relative folder globs, and empty-list disabling.
- Keep compile-database parsing inside `src/intellisense/compile-commands-parser.ts` and `src/intellisense/intellisense-service.ts`; expose only the active inclusion payload to the excluded-files layer so this slice does not extend cpptools or artifact resolution. Enforce with unit tests that excluded-file evaluation accepts parsed inclusion data and clears stale state when that payload becomes unavailable.
- Introduce a small matching/state module under `src/intellisense/` for basename-only, case-sensitive, forward-slash-normalized exclusion decisions, enforced by unit tests for basename matching, ignored subpath globbing, absolute and workspace-relative folder globs, and `\`-separator candidate paths.
- Implement Explorer presentation through a dedicated provider under `src/ui/` using `FileDecorationProvider`, enforced by integration tests that assert `✗` badge presence, optional gray color, and no decorations for included or out-of-scope files.
- Implement editor presentation through one reusable decoration manager under `src/ui/`, enforced by integration tests that open excluded and included files, toggle `tfTools.excludedFiles.showEditorOverlay`, and confirm overlays appear or clear on the first line only.
- Extend `src/extension.ts` to wire excluded-file refresh into existing activation, manifest, active-config, provider-refresh, successful-build, manual-refresh, workspace, and excluded-file-setting triggers without adding a new manual command. Enforce with integration tests that settings changes and active-context changes refresh excluded-file state without restart and clear stale markers.
- Preserve the visible failure contract by clearing badges and overlays when compile-database inclusion data is unavailable instead of logging new warnings or inventing new fallback behavior; enforce with integration coverage for compile-input loss after a previously valid state.
- Preserve slice boundaries by leaving package contributions for build, artifact actions, Flash/Upload, and Debug untouched, enforced by scope review and by confining source changes to settings, extension wiring, IntelliSense-adjacent excluded-file state, and UI decoration modules.

## Project Structure

### Documentation (this feature)

```text
specs/004-excluded-file-visibility/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── vscode-excluded-file-visibility-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
package.json
src/
├── extension.ts
├── intellisense/
│   ├── compile-commands-parser.ts
│   ├── intellisense-service.ts
│   └── intellisense-types.ts
├── ui/
├── workspace/
│   └── settings.ts
└── test/
    ├── integration/
    └── unit/

test-fixtures/
├── manifests/
└── workspaces/
```

**Structure Decision**: Keep the new logic close to the existing IntelliSense refresh boundary because excluded-file visibility is a downstream consumer of the active compile-database payload. Add one excluded-files matching service under `src/intellisense/` or an adjacent workflow-focused module, one Explorer decoration provider and one editor overlay manager under `src/ui/`, extend `src/workspace/settings.ts` for the new settings, and keep `src/extension.ts` as the composition root that wires refresh triggers and provider lifecycles. Concentrate tests in `src/test/unit/` for matching rules and in `src/test/integration/` for decoration and refresh behavior. This is the smallest structure that satisfies the spec without leaking decoration logic into manifest parsing, task execution, or tree rendering.

## Post-Design Constitution Check

- [x] Host compatibility remains limited to a TypeScript VS Code extension for VS Code 1.110+.
- [x] Design remains within the Excluded-File Visibility slice; compile-commands parsing rules, artifact resolution, build actions, Flash/Upload, Debug, and multi-root support stay out of scope.
- [x] Manifest and settings remain authoritative; excluded-file visibility consumes the active IntelliSense payload instead of inventing fallback file sets.
- [x] The design defines both unit and integration tests before implementation, including basename-only matching, path normalization, stale-state clearing, and UI presentation regressions.
- [x] Failure handling stays visible through cleared markers, existing manual refresh, and existing artifact/logging surfaces without adding silent fallback behavior.
- [x] No complexity exception is required; one matching service plus two thin presentation adapters are sufficient.

## Complexity Tracking

No constitutional violations or justified complexity exceptions were identified for this feature.
