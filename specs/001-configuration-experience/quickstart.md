# Quickstart: Configuration Experience Root Sections Default Expansion

## Goal

Verify that the `Configuration` tree shows `Build Context`, `Build Options`, and `Build Artifacts` expanded by default, with their current-slice placeholder or status content immediately visible.

## Prerequisites

- Install repository dependencies.
- Compile the extension sources.
- Prepare a workspace fixture with a valid manifest and one with a missing or invalid manifest.

## Scenario 1: Valid workspace shows all root sections expanded

1. Launch the extension in an Extension Development Host against a workspace with a valid manifest.
2. Open the `Trezor` activity-bar container and the `Configuration` view.
3. Confirm the root contains exactly three sections: `Build Context`, `Build Options`, and `Build Artifacts`.
4. Confirm all three sections are already expanded without any manual click.
5. Confirm `Build Context` shows `Model`, `Target`, and `Component` rows.
6. Confirm `Build Options` shows its current placeholder or slice-appropriate content immediately.
7. Confirm `Build Artifacts` shows its current placeholder or status content immediately.

## Scenario 2: Missing or invalid manifest keeps section visibility intact

1. Launch against a workspace where the manifest is missing or invalid.
2. Open the `Configuration` view.
3. Confirm `Build Context`, `Build Options`, and `Build Artifacts` are still expanded by default.
4. Confirm the warning or placeholder rows inside each section are visible without manually expanding the section.

## Automated Test Expectations

- Unit tests assert that each root section item emits `Expanded` as its default collapsible state.
- Integration tests assert that the Configuration view initially exposes all three root sections in expanded form for representative manifest states.