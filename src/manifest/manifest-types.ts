import * as vscode from "vscode";

// --- Manifest entry kinds ---

export type ManifestEntryKind = "model" | "target" | "component";

// --- Manifest entries ---

export interface ManifestModel {
  readonly kind: "model";
  readonly id: string;
  readonly name: string;
}

export interface ManifestTarget {
  readonly kind: "target";
  readonly id: string;
  readonly name: string;
  readonly shortName?: string;
}

export interface ManifestComponent {
  readonly kind: "component";
  readonly id: string;
  readonly name: string;
}

// --- Validation issues ---

export type ValidationSeverity = "error" | "warning";

export type ValidationCode =
  | "yaml-parse"
  | "missing-field"
  | "duplicate-id"
  | "invalid-type"
  | "empty-collection";

export interface ValidationIssue {
  readonly severity: ValidationSeverity;
  readonly message: string;
  readonly code: ValidationCode;
  /** Source range in the manifest file, when available. */
  readonly range?: vscode.Range;
}

// --- Manifest state ---

export type ManifestStatus = "loaded" | "missing" | "invalid";

export interface ManifestStateLoaded {
  readonly status: "loaded";
  readonly manifestUri: vscode.Uri;
  readonly models: ReadonlyArray<ManifestModel>;
  readonly targets: ReadonlyArray<ManifestTarget>;
  readonly components: ReadonlyArray<ManifestComponent>;
  readonly validationIssues: ReadonlyArray<ValidationIssue>;
  readonly loadedAt: Date;
}

export interface ManifestStateMissing {
  readonly status: "missing";
  readonly manifestUri: vscode.Uri;
}

export interface ManifestStateInvalid {
  readonly status: "invalid";
  readonly manifestUri: vscode.Uri;
  readonly validationIssues: ReadonlyArray<ValidationIssue>;
  readonly loadedAt: Date;
}

export type ManifestState =
  | ManifestStateLoaded
  | ManifestStateMissing
  | ManifestStateInvalid;
