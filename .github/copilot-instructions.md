# tf-tools Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-04-03

## Active Technologies
- TypeScript 5.x targeting VS Code 1.110+ desktop extension host + VS Code Extension API, existing `yaml` parser for range-aware manifest parsing, Node.js path/process APIs, Mocha test runner, `@vscode/test-electron` for integration tests (002-build-workflow)
- Manifest file for build-option definitions and availability rules, workspace state for active build context plus build-option selections, VS Code settings for workspace paths and visibility, output channel and diagnostics collection for failure reporting (002-build-workflow)
- TypeScript 5.x targeting VS Code 1.110+ desktop extension host + VS Code Extension API, existing `yaml` parser for range-aware manifest parsing, Node.js `fs`/`path` APIs, existing diagnostics and output-channel helpers, Mocha test runner, `@vscode/test-electron` for integration tests (003-intellisense-integration)
- Manifest file for artifact metadata and provider-facing context, workspace state for active model/target/component selection, VS Code resource-scoped settings for manifest and artifacts paths plus provider selection state, and output channel logging for runtime failure reporting (003-intellisense-integration)

- TypeScript 5.x targeting VS Code 1.110+ desktop extension host + VS Code Extension API, `yaml` for range-aware manifest parsing, Node.js filesystem APIs, Mocha test runner, `@vscode/test-electron` for integration tests (001-configuration-experience)

## Project Structure

```text
src/
tests/
```

## Commands

npm test && npm run lint

## Code Style

TypeScript 5.x targeting VS Code 1.110+ desktop extension host: Follow standard conventions

## Recent Changes
- 003-intellisense-integration: Added TypeScript 5.x targeting VS Code 1.110+ desktop extension host + VS Code Extension API, existing `yaml` parser for range-aware manifest parsing, Node.js `fs`/`path` APIs, existing diagnostics and output-channel helpers, Mocha test runner, `@vscode/test-electron` for integration tests
- 002-build-workflow: Added TypeScript 5.x targeting VS Code 1.110+ desktop extension host + VS Code Extension API, existing `yaml` parser for range-aware manifest parsing, Node.js path/process APIs, Mocha test runner, `@vscode/test-electron` for integration tests

- 001-configuration-experience: Added TypeScript 5.x targeting VS Code 1.110+ desktop extension host + VS Code Extension API, `yaml` for range-aware manifest parsing, Node.js filesystem APIs, Mocha test runner, `@vscode/test-electron` for integration tests

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
