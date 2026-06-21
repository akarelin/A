import { App, TFile } from "obsidian";
import { asArray, parseWikilink, resolveLink } from "./util";

export interface KnownType {
  file: TFile;
  frontmatter: Record<string, unknown>;
  parentRefs: unknown[];
}

export class TypeIndex {
  private byPath = new Map<string, KnownType>();
  private pathsByKey = new Map<string, Set<string>>();
  private listeners = new Set<() => void>();
  private _ready = false;
  private rebuildScheduled = false;

  constructor(private readonly app: App) {}

  isReady(): boolean {
    return this._ready;
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  scheduleInitialBuild(): void {
    if (this.rebuildScheduled || this._ready) return;
    this.scheduleRebuild();
  }

  scheduleRebuild(): void {
    if (this.rebuildScheduled) return;
    this.rebuildScheduled = true;
    const run = () => {
      try {
        this.rebuild();
      } finally {
        this.rebuildScheduled = false;
      }
    };
    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void) => void;
    };
    if (typeof w.requestIdleCallback === "function") {
      w.requestIdleCallback(run);
    } else {
      run();
    }
  }

  rebuild(): void {
    this.byPath.clear();
    this.pathsByKey.clear();
    for (const file of this.app.vault.getMarkdownFiles()) {
      this.indexFile(file);
    }
    this._ready = true;
    this.notify();
  }

  updateFile(file: TFile): void {
    const before = this.byPath.has(file.path);
    this.removeFile(file.path);
    this.indexFile(file);
    const after = this.byPath.has(file.path);
    if (this._ready && (before || after)) this.notify();
  }

  handleRename(file: TFile, oldPath: string): void {
    this.removeFile(oldPath);
    this.indexFile(file);
    if (this._ready) this.notify();
  }

  removeFile(path: string): void {
    const known = this.byPath.get(path);
    if (!known) return;
    this.byPath.delete(path);
    for (const [key, paths] of this.pathsByKey) {
      paths.delete(path);
      if (paths.size === 0) this.pathsByKey.delete(key);
    }
  }

  knownTypeForFile(file: TFile): KnownType | null {
    return this.byPath.get(file.path) ?? null;
  }

  hasKnownType(file: TFile, fm: Record<string, unknown>): boolean {
    return this.resolveTypesForFrontmatter(file, fm).length > 0;
  }

  resolveTypesForFrontmatter(
    source: TFile,
    fm: Record<string, unknown>,
  ): TFile[] {
    const out: TFile[] = [];
    for (const ref of typeRefs(fm)) {
      const cls = this.resolveClassRef(source, ref);
      if (cls && !out.includes(cls)) out.push(cls);
    }
    return out;
  }

  resolveClassRef(source: TFile, ref: unknown): TFile | null {
    if (ref == null || ref === "") return null;

    const resolved = resolveLink(this.app, source, ref);
    if (resolved instanceof TFile && this.byPath.has(resolved.path)) {
      return resolved;
    }

    const key = keyFromRef(ref);
    if (!key) return null;

    const direct = this.app.metadataCache.getFirstLinkpathDest(key, source.path);
    if (direct && this.byPath.has(direct.path)) return direct;

    const paths = this.pathsByKey.get(normalizeKey(key));
    if (!paths || paths.size === 0) return null;

    const candidates = Array.from(paths)
      .map((path) => this.byPath.get(path))
      .filter((x): x is KnownType => !!x);
    if (candidates.length === 1) return candidates[0].file;

    const schemaClasses = candidates.filter((known) => {
      const t = known.frontmatter["type"] ?? known.frontmatter["Type"];
      return t == null || t === "" || typeRefs({ type: t }).includes("Class");
    });
    if (schemaClasses.length === 1) return schemaClasses[0].file;

    return candidates
      .slice()
      .sort((a, b) => a.file.path.localeCompare(b.file.path))[0]?.file ?? null;
  }

  classLineage(types: TFile[]): TFile[][] {
    const levels: TFile[][] = [];
    let current = uniqueFiles(types);
    const visited = new Set<string>();

    while (current.length) {
      levels.push(current);
      const next: TFile[] = [];
      for (const file of current) {
        visited.add(file.path);
        for (const parent of this.parentsOf(file)) {
          if (visited.has(parent.path)) continue;
          if (!next.includes(parent)) next.push(parent);
        }
      }
      current = next;
    }

    return levels;
  }

  parentsOf(file: TFile): TFile[] {
    const known = this.byPath.get(file.path);
    if (!known) return [];
    const out: TFile[] = [];
    for (const ref of known.parentRefs) {
      const parent = this.resolveClassRef(file, ref);
      if (parent && !out.includes(parent)) out.push(parent);
    }
    return out;
  }

  private indexFile(file: TFile): void {
    const fm =
      (this.app.metadataCache.getFileCache(file)?.frontmatter as
        | Record<string, unknown>
        | undefined) ?? {};
    if (!isClassDefinition(fm)) return;

    const parentRefs = asArray(fm["subClassOf"] ?? fm["SubClassOf"]);
    this.byPath.set(file.path, { file, frontmatter: fm, parentRefs });

    this.addKey(file.path, file.basename);
    if (typeof fm["name"] === "string") this.addKey(file.path, fm["name"]);

    const pathNoExt = file.path.replace(/\.md$/i, "");
    const segments = pathNoExt.split("/");
    for (let i = 0; i < segments.length; i++) {
      this.addKey(file.path, segments.slice(i).join("/"));
    }
  }

  private addKey(path: string, raw: string): void {
    const key = normalizeKey(raw);
    if (!key) return;
    let paths = this.pathsByKey.get(key);
    if (!paths) {
      paths = new Set<string>();
      this.pathsByKey.set(key, paths);
    }
    paths.add(path);
  }

  private notify(): void {
    for (const fn of this.listeners) fn();
  }
}

export function typeRefs(fm: Record<string, unknown>): string[] {
  const raw = fm["type"] ?? fm["Type"];
  const out: string[] = [];
  for (const item of asArray(raw)) {
    if (typeof item === "string") {
      const parts = item.includes(",") ? item.split(",") : [item];
      for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed) out.push(trimmed);
      }
    } else if (item && typeof item === "object") {
      const r = item as { path?: string; link?: string };
      if (r.path) out.push(r.path);
      if (r.link) out.push(r.link);
    }
  }
  return out;
}

export function isClassDefinition(fm: Record<string, unknown>): boolean {
  const t = fm["type"] ?? fm["Type"];
  if (typeRefs({ type: t }).includes("Class")) return true;
  if (Array.isArray(fm["fieldsOrder"])) return true;
  if (Object.prototype.hasOwnProperty.call(fm, "subClassOf")) return true;
  if (Object.prototype.hasOwnProperty.call(fm, "extends")) return true;
  return false;
}

function keyFromRef(ref: unknown): string {
  if (typeof ref === "string") return parseWikilink(ref).target;
  if (ref && typeof ref === "object") {
    const r = ref as { path?: string; link?: string };
    if (r.path) return r.path.replace(/\.md$/i, "");
    if (r.link) return parseWikilink(r.link).target;
  }
  return "";
}

function normalizeKey(raw: string): string {
  return raw.trim().replace(/\.md$/i, "").toLowerCase();
}

function uniqueFiles(files: TFile[]): TFile[] {
  const out: TFile[] = [];
  for (const file of files) {
    if (!out.includes(file)) out.push(file);
  }
  return out;
}
