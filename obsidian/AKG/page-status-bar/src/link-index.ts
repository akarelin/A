import { App, TFile } from "obsidian";
import { asArray, resolveLink } from "./util";

export interface IncomingEntry {
  sourcePath: string;
  field: string;
}

/**
 * Reverse-link index over frontmatter values. For every frontmatter field on
 * every markdown file, resolve the value(s) to target files and record the
 * (source, field) edge keyed by target.
 *
 * Without this, rendering Children + Used-by sections is O(files × keys) per
 * render — for a vault of ~2000 files that's seconds of blocking work and
 * freezes Obsidian. With it, each render is O(incoming-to-this-target).
 *
 * Index is built lazily after the vault's metadata cache resolves, and
 * maintained incrementally on metadataCache "changed" / vault delete + rename.
 */
export class LinkIndex {
  private incoming = new Map<string, IncomingEntry[]>();
  private knownSources = new Set<string>();
  private _ready = false;
  private rebuildScheduled = false;
  private listeners = new Set<() => void>();

  constructor(private readonly app: App) {}

  isReady(): boolean {
    return this._ready;
  }

  /** Subscribe to readiness flips and incremental updates. */
  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    for (const fn of this.listeners) {
      try {
        fn();
      } catch (e) {
        console.error("[page-status-bar] index listener threw:", e);
      }
    }
  }

  /** Schedule a one-time full rebuild on the next idle slot. Idempotent. */
  scheduleInitialBuild(): void {
    if (this.rebuildScheduled || this._ready) return;
    this.rebuildScheduled = true;
    const run = () => {
      try {
        this.rebuild();
        this._ready = true;
        this.notify();
      } finally {
        this.rebuildScheduled = false;
      }
    };
    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void;
    };
    if (typeof w.requestIdleCallback === "function") {
      w.requestIdleCallback(run, { timeout: 2000 });
    } else {
      setTimeout(run, 0);
    }
  }

  /** Full scan — O(files × keys). Called once. */
  rebuild(): void {
    this.incoming.clear();
    this.knownSources.clear();
    for (const file of this.app.vault.getMarkdownFiles()) {
      this.indexFile(file);
    }
  }

  /** Re-index one file (remove its old entries, scan its current frontmatter). */
  updateFile(file: TFile): void {
    this.removeSource(file.path);
    this.indexFile(file);
    if (this._ready) this.notify();
  }

  /** Drop all edges originating from this source (used on delete + rename-out). */
  removeSource(sourcePath: string): void {
    if (!this.knownSources.has(sourcePath)) return;
    this.knownSources.delete(sourcePath);
    // Walk the index and prune. Lists are usually short, so this is cheap.
    for (const [target, list] of this.incoming) {
      const filtered = list.filter((e) => e.sourcePath !== sourcePath);
      if (filtered.length === 0) this.incoming.delete(target);
      else if (filtered.length !== list.length) this.incoming.set(target, filtered);
    }
    if (this._ready) this.notify();
  }

  /** Handle rename: drop old, re-index under new path. */
  handleRename(file: TFile, oldPath: string): void {
    this.removeSource(oldPath);
    this.indexFile(file);
    if (this._ready) this.notify();
  }

  /** Look up incoming edges by target file path. O(1). */
  incomingFor(targetPath: string): IncomingEntry[] {
    return this.incoming.get(targetPath) ?? [];
  }

  // -- internal ----------------------------------------------------------

  private indexFile(source: TFile): void {
    const cache = this.app.metadataCache.getFileCache(source);
    const fm = (cache?.frontmatter as Record<string, unknown> | undefined) ?? {};
    if (Object.keys(fm).length === 0) return;
    this.knownSources.add(source.path);

    for (const key of Object.keys(fm)) {
      const v = fm[key];
      if (v == null) continue;
      for (const ref of asArray(v)) {
        const resolved = resolveLink(this.app, source, ref);
        if (resolved instanceof TFile) {
          this.add(resolved.path, source.path, key);
        }
      }
    }
  }

  private add(targetPath: string, sourcePath: string, field: string): void {
    let list = this.incoming.get(targetPath);
    if (!list) {
      list = [];
      this.incoming.set(targetPath, list);
    }
    list.push({ sourcePath, field });
  }
}
