# Data Model: Configuration Experience Root Sections Default Expansion

## Configuration View State

- **Purpose**: Represents derived UI state for the `Configuration` tree root and its section contents.
- **Fields**:
  - `topLevelSections`: fixed ordered set of `Build Context`, `Build Options`, `Build Artifacts`
  - `rootSectionDefaultState`: always `expanded` for each top-level section
  - `expandedSelector`: optional selector currently expanded inside `Build Context`
  - `buildContextRows`: derived selector rows and choice rows
  - `optionsContent`: placeholder, warning, or later-slice content for `Build Options`
  - `artifactsContent`: placeholder, warning, or later-slice content for `Build Artifacts`
- **Validation rules**:
  - the root always contains exactly three top-level sections in that order
  - all three top-level sections render expanded by default
  - top-level sections remain plain-text headers without dedicated icons
  - only `Build Context` exposes interactive selector rows in this slice

## Root Section Item

- **Purpose**: Represents one of the three fixed top-level tree sections.
- **Fields**:
  - `sectionId`: one of `build-context`, `build-options`, `build-artifacts`
  - `label`: user-visible section label
  - `collapsibleState`: `Expanded` on initial render
  - `tooltip`: empty string to suppress VS Code's label-as-tooltip fallback
- **Validation rules**:
  - `sectionId` remains stable for tests and tree reconciliation
  - `collapsibleState` must not vary by manifest status during initial render

## State Transitions

1. Tree provider initializes root sections with all three sections expanded.
2. Manifest-state changes may change the children under a section, but not the required default expanded state of the root sections.
3. Selector accordion behavior inside `Build Context` remains independent from the root section expanded state.