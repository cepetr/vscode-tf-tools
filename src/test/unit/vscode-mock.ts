/**
 * Minimal vscode stub used by unit tests that run outside the VS Code
 * extension host. Provides only the subset of the API exercised by the
 * code under test.
 */

class Position {
  constructor(
    public readonly line: number,
    public readonly character: number
  ) {}
}

class Range {
  public readonly start: Position;
  public readonly end: Position;
  constructor(start: Position | number, startCharOrEnd: Position | number, endLine?: number, endChar?: number) {
    if (start instanceof Position && startCharOrEnd instanceof Position) {
      this.start = start;
      this.end = startCharOrEnd;
    } else {
      this.start = new Position(start as number, startCharOrEnd as number);
      this.end = new Position(endLine ?? 0, endChar ?? 0);
    }
  }
}

class Uri {
  constructor(
    public readonly scheme: string,
    public readonly fsPath: string
  ) {}
  static file(path: string): Uri {
    return new Uri("file", path);
  }
  static joinPath(base: Uri, ...segments: string[]): Uri {
    const joined = [base.fsPath, ...segments].join("/").replace(/\/+/g, "/");
    return new Uri(base.scheme, joined);
  }
  toString(): string {
    return `${this.scheme}://${this.fsPath}`;
  }
}

const DiagnosticSeverity = { Error: 0, Warning: 1, Information: 2, Hint: 3 };

class Diagnostic {
  public source: string | undefined;
  public code: string | number | undefined;
  constructor(
    public range: Range,
    public message: string,
    public severity: number = DiagnosticSeverity.Error
  ) {}
}

const languages = {
  createDiagnosticCollection: (_name: string) => ({
    set: () => {},
    delete: () => {},
    dispose: () => {},
  }),
};

const window = {
  createOutputChannel: (_name: string) => ({
    appendLine: () => {},
    show: () => {},
    dispose: () => {},
  }),
  createStatusBarItem: (_alignment?: number, _priority?: number) => ({
    text: "" as string,
    command: undefined as string | undefined,
    tooltip: undefined as string | undefined,
    show: () => {},
    hide: () => {},
    dispose: () => {},
  }),
  showWarningMessage: () => Promise.resolve(undefined),
  showErrorMessage: () => Promise.resolve(undefined),
  registerTreeDataProvider: () => ({ dispose: () => {} }),
};

const workspace = {
  workspaceFolders: undefined,
  getConfiguration: () => ({
    get: () => undefined,
  }),
  createFileSystemWatcher: () => ({
    onDidCreate: () => ({ dispose: () => {} }),
    onDidChange: () => ({ dispose: () => {} }),
    onDidDelete: () => ({ dispose: () => {} }),
    dispose: () => {},
  }),
};

const commands = {
  registerCommand: (_id: string, _handler: () => void) => ({ dispose: () => {} }),
  executeCommand: () => Promise.resolve(undefined),
};

class EventEmitter {
  private _listeners: Array<(e: unknown) => void> = [];
  event = (listener: (e: unknown) => void) => {
    this._listeners.push(listener);
    return { dispose: () => {} };
  };
  fire(e: unknown) {
    this._listeners.forEach((l) => l(e));
  }
  dispose() {
    this._listeners = [];
  }
}

class RelativePattern {
  constructor(public base: Uri, public pattern: string) {}
}

class TreeItem {
  public contextValue: string | undefined;
  public description: string | undefined;
  public collapsibleState: number;
  constructor(
    public label: string,
    collapsibleState: number = 0
  ) {
    this.collapsibleState = collapsibleState;
  }
}

const TreeItemCollapsibleState = { None: 0, Collapsed: 1, Expanded: 2 };
const StatusBarAlignment = { Left: 1, Right: 2 };

module.exports = {
  Position,
  Range,
  Uri,
  Diagnostic,
  DiagnosticSeverity,
  languages,
  window,
  workspace,
  commands,
  EventEmitter,
  RelativePattern,
  TreeItem,
  TreeItemCollapsibleState,
  StatusBarAlignment,
};
