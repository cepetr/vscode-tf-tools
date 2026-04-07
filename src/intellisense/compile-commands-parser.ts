/**
 * Compile-commands parsing and normalization helpers.
 *
 * Exports a single public entry-point `parseCompileCommandsFile` that reads a
 * `.cc.json` compile database, tokenizes each entry, normalizes paths, infers
 * language mode, and de-duplicates by source file (first-entry-wins).
 *
 * Intentionally side-effect-free: all I/O is isolated to the top-level
 * `parseCompileCommandsFile` function so callers can inject fixtures easily.
 */

import * as path from "path";
import * as fs from "fs";
import {
  ParsedCompileEntry,
  BrowseConfigurationSnapshot,
  ProviderPayload,
} from "./intellisense-types";

// ---------------------------------------------------------------------------
// Raw compile-database entry (as stored in .cc.json)
// ---------------------------------------------------------------------------

interface RawEntry {
  directory: string;
  /** Full shell command string (mutually exclusive with `arguments`). */
  command?: string;
  /** Pre-tokenized argument list (mutually exclusive with `command`). */
  arguments?: string[];
  /** Source file path: may be relative to `directory`. */
  file: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parses the compile-commands file at `artifactPath` and builds an indexed
 * `ProviderPayload` for use by the cpptools provider.
 *
 * - Returns `undefined` when the file cannot be read or does not contain a
 *   valid JSON array (callers must treat absence transparently).
 * - Uses first-entry-wins when the same normalized absolute filePath appears
 *   more than once.
 * - Normalizes paths relative to each entry `directory`.
 */
export function parseCompileCommandsFile(
  artifactPath: string,
  contextKey: string
): ProviderPayload | undefined {
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
  } catch {
    return undefined;
  }

  if (!Array.isArray(raw)) {
    return undefined;
  }

  const entries: ParsedCompileEntry[] = [];
  const seenFiles = new Set<string>();

  for (let i = 0; i < raw.length; i++) {
    const entry = raw[i] as RawEntry;
    if (!isRawEntry(entry)) {
      continue;
    }

    const parsed = parseEntry(entry, i);
    if (!parsed) {
      continue;
    }

    // First-entry-wins deduplication
    if (seenFiles.has(parsed.filePath)) {
      continue;
    }
    seenFiles.add(parsed.filePath);
    entries.push(parsed);
  }

  const entriesByFile = new Map<string, ParsedCompileEntry>();
  for (const e of entries) {
    entriesByFile.set(e.filePath, e);
  }

  const browseSnapshot = buildBrowseSnapshot(entries);

  return {
    artifactPath,
    contextKey,
    entriesByFile,
    browseSnapshot,
  };
}

// ---------------------------------------------------------------------------
// Entry parsing
// ---------------------------------------------------------------------------

/**
 * Parses a single raw compile-database entry into a `ParsedCompileEntry`.
 * Returns `undefined` when the entry is malformed or unusable.
 */
export function parseEntry(
  raw: RawEntry,
  rawIndex: number
): ParsedCompileEntry | undefined {
  const directory = path.resolve(raw.directory);

  // Tokenize: prefer `arguments` array; fall back to splitting `command` string.
  const tokens = raw.arguments
    ? raw.arguments.slice()
    : tokenizeCommandString(raw.command ?? "");

  if (tokens.length === 0) {
    return undefined;
  }

  // First token is the compiler executable.
  const compilerPath = tokens[0];

  // Normalize the source file path.
  const rawFilePath = raw.file;
  const filePath = path.isAbsolute(rawFilePath)
    ? rawFilePath
    : path.resolve(directory, rawFilePath);

  // Collect include paths, defines, forced includes, and the remaining flags.
  const includePaths: string[] = [];
  const defines: string[] = [];
  const forcedIncludes: string[] = [];
  const remainingArgs: string[] = [];

  let standard: string | undefined;

  for (let i = 1; i < tokens.length; i++) {
    const tok = tokens[i];

    if (tok === "-I" && i + 1 < tokens.length) {
      // -I <path> (space-separated)
      includePaths.push(resolveArgPath(tokens[++i], directory));
    } else if (tok.startsWith("-I")) {
      includePaths.push(resolveArgPath(tok.slice(2), directory));
    } else if (tok === "-D" && i + 1 < tokens.length) {
      defines.push(tokens[++i]);
    } else if (tok.startsWith("-D")) {
      defines.push(tok.slice(2));
    } else if ((tok === "-include" || tok === "--include") && i + 1 < tokens.length) {
      forcedIncludes.push(resolveArgPath(tokens[++i], directory));
    } else if (tok.startsWith("-std=")) {
      standard = tok.slice(5);
      remainingArgs.push(tok);
    } else if (tok === filePath || tok === raw.file) {
      // Skip the source file argument itself — it is captured separately.
    } else {
      remainingArgs.push(tok);
    }
  }

  const languageFamily = inferLanguageFamily(standard, filePath, compilerPath);

  return {
    filePath,
    directory,
    compilerPath,
    arguments: remainingArgs,
    includePaths,
    defines,
    forcedIncludes,
    languageFamily,
    standard,
    rawIndex,
  };
}

// ---------------------------------------------------------------------------
// Language inference
// ---------------------------------------------------------------------------

/**
 * Infers whether an entry is for C or C++ source.
 *
 * Priority:
 *  1. `-std=` flag: a value starting with "c++" signals C++.
 *  2. Source file extension: `.cpp`, `.cxx`, `.cc`, `.C`, `.c++` → C++.
 *  3. Compiler executable name: `g++`, `clang++`, etc. → C++.
 *  4. Default: C.
 */
export function inferLanguageFamily(
  standard: string | undefined,
  filePath: string,
  compilerPath: string
): "c" | "cpp" {
  if (standard !== undefined) {
    if (standard.startsWith("c++") || standard.startsWith("gnu++")) {
      return "cpp";
    }
    // Explicit C standard → C
    if (standard.startsWith("c") || standard.startsWith("gnu")) {
      return "c";
    }
  }

  const ext = path.extname(filePath).toLowerCase();
  if ([".cpp", ".cxx", ".cc", ".c++"].includes(ext)) {
    return "cpp";
  }
  // uppercase .C is C++ by convention
  if (path.extname(filePath) === ".C") {
    return "cpp";
  }

  const compilerName = path.basename(compilerPath).toLowerCase();
  if (compilerName.includes("g++") || compilerName.includes("clang++") || compilerName.includes("c++")) {
    return "cpp";
  }

  return "c";
}

// ---------------------------------------------------------------------------
// Browse configuration
// ---------------------------------------------------------------------------

/**
 * Builds a `BrowseConfigurationSnapshot` from an ordered list of parsed entries.
 * `browsePaths` is the de-duplicated union of source directories and include
 * paths in first-seen order.
 * Compiler metadata comes from the first entry that provides a compilerPath.
 */
export function buildBrowseSnapshot(
  entries: ReadonlyArray<ParsedCompileEntry>
): BrowseConfigurationSnapshot {
  const seen = new Set<string>();
  const browsePaths: string[] = [];

  let compilerPath: string | undefined;
  let compilerArgs: ReadonlyArray<string> = [];

  for (const entry of entries) {
    if (!compilerPath && entry.compilerPath) {
      compilerPath = entry.compilerPath;
      compilerArgs = entry.arguments;
    }

    const sourceDir = path.dirname(entry.filePath);
    if (!seen.has(sourceDir)) {
      seen.add(sourceDir);
      browsePaths.push(sourceDir);
    }

    for (const ip of entry.includePaths) {
      if (!seen.has(ip)) {
        seen.add(ip);
        browsePaths.push(ip);
      }
    }
  }

  return { browsePaths, compilerPath, compilerArgs };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Resolves a path argument against the entry working directory when it is not
 * already absolute.
 */
function resolveArgPath(argPath: string, directory: string): string {
  return path.isAbsolute(argPath) ? argPath : path.resolve(directory, argPath);
}

/**
 * Minimal shell tokenizer: splits on whitespace while respecting
 * single-quoted and double-quoted strings. Sufficient for the compiler driver
 * command lines produced by CMake and xtask compile-database generators.
 */
export function tokenizeCommandString(cmd: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < cmd.length; i++) {
    const ch = cmd[i];

    if (inSingle) {
      if (ch === "'") {
        inSingle = false;
      } else {
        current += ch;
      }
    } else if (inDouble) {
      if (ch === '"') {
        inDouble = false;
      } else if (ch === "\\" && i + 1 < cmd.length) {
        current += cmd[++i];
      } else {
        current += ch;
      }
    } else if (ch === "'") {
      inSingle = true;
    } else if (ch === '"') {
      inDouble = true;
    } else if (ch === "\\" && i + 1 < cmd.length) {
      current += cmd[++i];
    } else if (/\s/.test(ch)) {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

function isRawEntry(v: unknown): v is RawEntry {
  if (typeof v !== "object" || v === null) {
    return false;
  }
  const obj = v as Record<string, unknown>;
  return typeof obj["directory"] === "string" && typeof obj["file"] === "string";
}
