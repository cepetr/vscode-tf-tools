import * as vscode from "vscode";
import { parseDocument, LineCounter, YAMLMap, YAMLSeq, Scalar } from "yaml";
import {
  ManifestState,
  ManifestModel,
  ManifestTarget,
  ManifestComponent,
  ValidationIssue,
  ValidationCode,
} from "./manifest-types";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function toVsRange(
  lineCounter: LineCounter,
  range: readonly [number, number, number] | undefined
): vscode.Range | undefined {
  if (!range) {
    return undefined;
  }
  const start = lineCounter.linePos(range[0]);
  const end = lineCounter.linePos(range[1]);
  // linePos returns 1-indexed; vscode.Position is 0-indexed
  return new vscode.Range(
    new vscode.Position(start.line - 1, start.col - 1),
    new vscode.Position(end.line - 1, end.col - 1)
  );
}

function issue(
  severity: ValidationIssue["severity"],
  code: ValidationCode,
  message: string,
  range?: vscode.Range
): ValidationIssue {
  return { severity, code, message, range };
}

// ---------------------------------------------------------------------------
// Entry validators
// ---------------------------------------------------------------------------

function validateStringField(
  map: YAMLMap,
  field: string,
  lineCounter: LineCounter,
  issues: ValidationIssue[],
  contextLabel: string
): string | undefined {
  const node = map.get(field, true);
  if (node === undefined || node === null) {
    const mapNode = map as YAMLMap & { range?: [number, number, number] };
    issues.push(
      issue(
        "error",
        "missing-field",
        `${contextLabel}: required field "${field}" is missing`,
        toVsRange(lineCounter, mapNode.range)
      )
    );
    return undefined;
  }
  if (!(node instanceof Scalar) || typeof node.value !== "string" || node.value.trim() === "") {
    const scalarNode = node as unknown as { range?: [number, number, number] };
    issues.push(
      issue(
        "error",
        "invalid-type",
        `${contextLabel}: field "${field}" must be a non-empty string`,
        toVsRange(lineCounter, scalarNode.range)
      )
    );
    return undefined;
  }
  return node.value;
}

function validateModels(
  doc: YAMLMap,
  lineCounter: LineCounter,
  issues: ValidationIssue[]
): ManifestModel[] {
  const models: ManifestModel[] = [];
  const seqNode = doc.get("models", true);

  if (!(seqNode instanceof YAMLSeq) || seqNode.items.length === 0) {
    const seqRange = seqNode instanceof YAMLSeq
      ? (seqNode as YAMLSeq & { range?: [number, number, number] }).range
      : undefined;
    issues.push(
      issue(
        "error",
        "empty-collection",
        "manifest must define at least one model",
        toVsRange(lineCounter, seqRange)
      )
    );
    return models;
  }

  const seen = new Set<string>();
  for (const item of seqNode.items) {
    if (!(item instanceof YAMLMap)) {
      continue;
    }
    const id = validateStringField(item, "id", lineCounter, issues, "models entry");
    const name = validateStringField(item, "name", lineCounter, issues, "models entry");
    if (!id || !name) {
      continue;
    }
    if (seen.has(id)) {
      const idNode = item.get("id", true) as unknown as { range?: [number, number, number] };
      issues.push(
        issue(
          "error",
          "duplicate-id",
          `models: duplicate id "${id}"`,
          toVsRange(lineCounter, idNode?.range)
        )
      );
      continue;
    }
    seen.add(id);
    models.push({ kind: "model", id, name });
  }
  return models;
}

function validateTargets(
  doc: YAMLMap,
  lineCounter: LineCounter,
  issues: ValidationIssue[]
): ManifestTarget[] {
  const targets: ManifestTarget[] = [];
  const seqNode = doc.get("targets", true);

  if (!(seqNode instanceof YAMLSeq) || seqNode.items.length === 0) {
    const seqRange = seqNode instanceof YAMLSeq
      ? (seqNode as YAMLSeq & { range?: [number, number, number] }).range
      : undefined;
    issues.push(
      issue(
        "error",
        "empty-collection",
        "manifest must define at least one target",
        toVsRange(lineCounter, seqRange)
      )
    );
    return targets;
  }

  const seen = new Set<string>();
  for (const item of seqNode.items) {
    if (!(item instanceof YAMLMap)) {
      continue;
    }
    const id = validateStringField(item, "id", lineCounter, issues, "targets entry");
    const name = validateStringField(item, "name", lineCounter, issues, "targets entry");
    if (!id || !name) {
      continue;
    }
    if (seen.has(id)) {
      const idNode = item.get("id", true) as unknown as { range?: [number, number, number] };
      issues.push(
        issue(
          "error",
          "duplicate-id",
          `targets: duplicate id "${id}"`,
          toVsRange(lineCounter, idNode?.range)
        )
      );
      continue;
    }
    seen.add(id);
    const shortNameNode = item.get("shortName", true);
    const shortName =
      shortNameNode instanceof Scalar && typeof shortNameNode.value === "string"
        ? shortNameNode.value
        : undefined;
    targets.push({ kind: "target", id, name, shortName });
  }
  return targets;
}

function validateComponents(
  doc: YAMLMap,
  lineCounter: LineCounter,
  issues: ValidationIssue[]
): ManifestComponent[] {
  const components: ManifestComponent[] = [];
  const seqNode = doc.get("components", true);

  if (!(seqNode instanceof YAMLSeq) || seqNode.items.length === 0) {
    const seqRange = seqNode instanceof YAMLSeq
      ? (seqNode as YAMLSeq & { range?: [number, number, number] }).range
      : undefined;
    issues.push(
      issue(
        "error",
        "empty-collection",
        "manifest must define at least one component",
        toVsRange(lineCounter, seqRange)
      )
    );
    return components;
  }

  const seen = new Set<string>();
  for (const item of seqNode.items) {
    if (!(item instanceof YAMLMap)) {
      continue;
    }
    const id = validateStringField(item, "id", lineCounter, issues, "components entry");
    const name = validateStringField(item, "name", lineCounter, issues, "components entry");
    if (!id || !name) {
      continue;
    }
    if (seen.has(id)) {
      const idNode = item.get("id", true) as unknown as { range?: [number, number, number] };
      issues.push(
        issue(
          "error",
          "duplicate-id",
          `components: duplicate id "${id}"`,
          toVsRange(lineCounter, idNode?.range)
        )
      );
      continue;
    }
    seen.add(id);
    components.push({ kind: "component", id, name });
  }
  return components;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parses `source` as a tf-tools manifest YAML document and validates its
 * structure. Returns the parsed collections and any validation issues found.
 *
 * This function does not perform I/O; pass the file contents as a string.
 */
export function parseManifest(source: string): {
  models: ManifestModel[];
  targets: ManifestTarget[];
  components: ManifestComponent[];
  issues: ValidationIssue[];
} {
  const lineCounter = new LineCounter();
  const doc = parseDocument(source, { lineCounter });

  const issues: ValidationIssue[] = [];

  // Collect yaml parse errors
  for (const err of doc.errors) {
    const pos = (err as unknown as { pos?: [number, number] }).pos;
    let range: vscode.Range | undefined;
    if (pos) {
      const start = lineCounter.linePos(pos[0]);
      const end = lineCounter.linePos(pos[1]);
      range = new vscode.Range(
        new vscode.Position(start.line - 1, start.col - 1),
        new vscode.Position(end.line - 1, end.col - 1)
      );
    }
    issues.push(issue("error", "yaml-parse", err.message, range));
  }

  if (issues.length > 0) {
    return { models: [], targets: [], components: [], issues };
  }

  const root = doc.contents;
  if (!(root instanceof YAMLMap)) {
    issues.push(issue("error", "invalid-type", "manifest root must be a YAML mapping"));
    return { models: [], targets: [], components: [], issues };
  }

  const models = validateModels(root, lineCounter, issues);
  const targets = validateTargets(root, lineCounter, issues);
  const components = validateComponents(root, lineCounter, issues);

  return { models, targets, components, issues };
}

/**
 * Validates `source` against the manifest schema and constructs a
 * `ManifestState` from the results. Requires the manifest `uri` for
 * attaching state metadata.
 */
export function validateManifest(
  source: string,
  uri: vscode.Uri
): ManifestState {
  const { models, targets, components, issues } = parseManifest(source);

  const structuralErrors = issues.filter((i) => i.severity === "error");

  if (structuralErrors.length > 0 || models.length === 0 || targets.length === 0 || components.length === 0) {
    return {
      status: "invalid",
      manifestUri: uri,
      validationIssues: issues,
      loadedAt: new Date(),
    };
  }

  return {
    status: "loaded",
    manifestUri: uri,
    models,
    targets,
    components,
    validationIssues: issues, // may contain warnings
    loadedAt: new Date(),
  };
}
