import { App, TFile } from "obsidian";

export function basenameOf(path: string): string {
  const last = path.split("/").pop() ?? path;
  return last.replace(/\.md$/i, "");
}

export function parseWikilink(raw: string): { target: string; alias?: string } {
  const inner = raw.trim().replace(/^\[\[|\]\]$/g, "");
  const [target, alias] = inner.split("|");
  return { target: target.trim(), alias: alias?.trim() };
}

export function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function resolveLink(
  app: App,
  source: TFile,
  ref: unknown,
): TFile | { missingName: string } | null {
  if (ref == null || ref === "") return null;

  if (typeof ref === "object" && ref !== null) {
    const r = ref as { path?: string; link?: string };
    if (r.path) {
      const f = app.vault.getAbstractFileByPath(r.path);
      if (f instanceof TFile) return f;
      return { missingName: basenameOf(r.path) };
    }
    if (r.link) {
      const { target } = parseWikilink(`[[${r.link}]]`);
      const f = app.metadataCache.getFirstLinkpathDest(target, source.path);
      return f ?? { missingName: basenameOf(target) };
    }
    return null;
  }

  if (typeof ref === "string") {
    const trimmed = ref.trim();
    if (!trimmed) return null;
    const { target } = parseWikilink(trimmed);
    const f = app.metadataCache.getFirstLinkpathDest(target, source.path);
    return f ?? { missingName: basenameOf(target) };
  }

  return null;
}

export function asArray<T = unknown>(v: T | T[] | null | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

export function fmtScalar(v: unknown): string {
  if (v == null || v === "") return "";
  if (Array.isArray(v)) {
    return v.map(fmtScalar).filter(Boolean).join(", ");
  }
  if (typeof v === "object" && v !== null) {
    const r = v as { path?: string; link?: string };
    if (r.path) {
      const base = basenameOf(r.path);
      return `[[${r.path.replace(/\.md$/i, "")}|${base}]]`;
    }
    if (r.link) return `[[${r.link}]]`;
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return String(v);
  }
  return String(v);
}

export function debounce<T extends (...args: never[]) => void>(
  fn: T,
  ms: number,
): T & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const wrapped = ((...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T & { cancel: () => void };
  wrapped.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  return wrapped;
}
