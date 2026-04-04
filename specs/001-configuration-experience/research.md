# Research: Configuration Experience Root Sections Default Expansion

## Decision 1: Keep all three root sections expanded by default

- **Decision**: Emit `vscode.TreeItemCollapsibleState.Expanded` for `Build Context`, `Build Options`, and `Build Artifacts` when creating the root section items.
- **Rationale**: UI-02 in `informal_spec/user-spec.md` explicitly requires that the three root sections remain expanded by default. The current special-case collapse logic for non-`Build Context` sections is the direct cause of the mismatch.
- **Alternatives considered**:
  - Preserve collapsed defaults and amend the spec: rejected because the current product requirement is explicit and the bugfix request is to restore alignment.
  - Persist expansion state across sessions: rejected for this fix because the reported mismatch concerns initial default behavior, not user-customizable section state.

## Decision 2: Treat this as a tree-presentation bug inside Configuration Experience

- **Decision**: Limit the fix to the root section presentation logic and matching tests.
- **Rationale**: The issue is not about missing later-slice functionality. `Build Options` and `Build Artifacts` already have valid placeholder and status children for the current slice; the regression is that those children start hidden.
- **Alternatives considered**:
  - Rework the root tree model or add expansion event handling for top-level sections: rejected because there is no evidence the root section model itself is unstable.
  - Fold the fix into IntelliSense planning because of `Compile Commands` discoverability: rejected because the authoritative requirement already lives in the Configuration Experience UI structure.

## Decision 3: Cover the bug with focused regression tests

- **Decision**: Add regression coverage that asserts all three root sections are expanded on first render and that their child placeholder or status rows are immediately reachable.
- **Rationale**: This is a small UI-state regression that can easily recur during later tree refactors unless the default section state is explicitly tested.
- **Alternatives considered**:
  - Rely on manual verification only: rejected because the constitution requires automated coverage for functional changes and regressions.