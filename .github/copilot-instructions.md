# tf-tools Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-04-03

## Active Technologies
- TypeScript 5.x targeting VS Code 1.110+ desktop extension host + VS Code Extension API, existing `yaml` parser for range-aware manifest parsing, Node.js path/process APIs, Mocha test runner, `@vscode/test-electron` for integration tests (002-build-workflow)
- Manifest file for build-option definitions and availability rules, workspace state for active build context plus build-option selections, VS Code settings for workspace paths and visibility, output channel and diagnostics collection for failure reporting (002-build-workflow)

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
- 002-build-workflow: Added TypeScript 5.x targeting VS Code 1.110+ desktop extension host + VS Code Extension API, existing `yaml` parser for range-aware manifest parsing, Node.js path/process APIs, Mocha test runner, `@vscode/test-electron` for integration tests

- 001-configuration-experience: Added TypeScript 5.x targeting VS Code 1.110+ desktop extension host + VS Code Extension API, `yaml` for range-aware manifest parsing, Node.js filesystem APIs, Mocha test runner, `@vscode/test-electron` for integration tests

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
