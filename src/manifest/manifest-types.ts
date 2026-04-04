import * as vscode from "vscode";

// --- Manifest entry kinds ---

export type ManifestEntryKind = "model" | "target" | "component";

// --- Manifest entries ---

export interface ManifestModel {
  readonly kind: "model";
  readonly id: string;
  readonly name: string;
  /** Required artifact folder under tfTools.artifactsPath for this model. */
  readonly artifactFolder?: string;
}

export interface ManifestTarget {
  readonly kind: "target";
  readonly id: string;
  readonly name: string;
  readonly shortName?: string;
  /** Command-line flag appended to build commands when set to a non-null string. */
  readonly flag?: string | null;
  /** Optional suffix appended to the artifact basename for this target. Defaults to "". */
  readonly artifactSuffix?: string;
}

export interface ManifestComponent {
  readonly kind: "component";
  readonly id: string;
  readonly name: string;
  /** Required artifact basename stem for this component's compile-commands artifact. */
  readonly artifactName?: string;
}

// --- Validation issues ---

export type ValidationSeverity = "error" | "warning";

export type ValidationCode =
  | "yaml-parse"
  | "missing-field"
  | "duplicate-id"
  | "invalid-type"
  | "empty-collection"
  | "duplicate-flag"
  | "invalid-when";

export interface ValidationIssue {
  readonly severity: ValidationSeverity;
  readonly message: string;
  readonly code: ValidationCode;
  /** Source range in the manifest file, when available. */
  readonly range?: vscode.Range;
}

// ---------------------------------------------------------------------------
// When expression AST
// ---------------------------------------------------------------------------

export interface WhenPredicate {
  readonly type: "model" | "target" | "component";
  readonly id: string;
}

export interface WhenAll {
  readonly type: "all";
  readonly children: ReadonlyArray<WhenExpression>;
}

export interface WhenAny {
  readonly type: "any";
  readonly children: ReadonlyArray<WhenExpression>;
}

export interface WhenNot {
  readonly type: "not";
  readonly child: WhenExpression;
}

export type WhenExpression = WhenPredicate | WhenAll | WhenAny | WhenNot;

// ---------------------------------------------------------------------------
// Build Options
// ---------------------------------------------------------------------------

export type BuildOptionKind = "checkbox" | "multistate";

export interface BuildOptionState {
  readonly id: string;
  readonly label: string;
  readonly flag: string;
}

export interface BuildOption {
  /** Deterministic internal key used for workspace-state persistence. */
  readonly key: string;
  readonly label: string;
  /** Command-line flag emitted when this option is active. */
  readonly flag: string;
  readonly kind: BuildOptionKind;
  readonly group?: string;
  readonly description?: string;
  /** Parsed availability rule. Absent means always available. */
  readonly when?: WhenExpression;
  /** Ordered selectable states for `kind === "multistate"` options. */
  readonly states?: ReadonlyArray<BuildOptionState>;
  /** Default state id for `kind === "multistate"` when no selection is stored. */
  readonly defaultState?: string;
}

// --- Manifest state ---

export type ManifestStatus = "loaded" | "missing" | "invalid";

export interface ManifestStateLoaded {
  readonly status: "loaded";
  readonly manifestUri: vscode.Uri;
  readonly models: ReadonlyArray<ManifestModel>;
  readonly targets: ReadonlyArray<ManifestTarget>;
  readonly components: ReadonlyArray<ManifestComponent>;
  readonly buildOptions: ReadonlyArray<BuildOption>;
  /**
   * True when any build option has an invalid `when` expression.
   * When true, Build/Clippy/Check/Clean must be blocked.
   */
  readonly hasWorkflowBlockingIssues: boolean;
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
