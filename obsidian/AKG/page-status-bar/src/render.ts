import { App, MarkdownRenderer, Component, TFile } from "obsidian";
import { PageStatusBarSettings, RenderContext, TypeExtension } from "./types";
import {
  cap,
  resolveLink,
  fmtScalar,
} from "./util";
import { typeRefs } from "./type-index";

// Frontmatter keys that the status bar should NEVER show in Properties.
// These are structural Metadata Menu / class fields, not page data.
const SKIP_PROPS_CC = [
  "type", "mapWithTag", "tagNames", "filesPaths", "bookmarksGroups", "excludes",
  "savedViews", "favoriteView", "fields", "fieldsOrder", "columns", "limit",
  "version", "icon", "statusbar", "statusBar",
];
const SKIP_PROPS = new Set(SKIP_PROPS_CC.map((s) => s.toLowerCase()));

const CHILD_FIELDS: ReadonlyArray<readonly [string, string]> = [
  ["parentProject", "Sub-projects"],
  ["up", "Children"],
  ["broader", "Narrower"],
  ["subClassOf", "Subclasses"],
  ["extends", "Subclasses (UI)"],
  ["type", "Instances"],
  ["inScheme", "Members"],
  ["sameAs", "Aliases"],
];

function getFrontmatter(app: App, file: TFile): Record<string, unknown> {
  const cache = app.metadataCache.getFileCache(file);
  return (cache?.frontmatter as Record<string, unknown> | undefined) ?? {};
}

interface RendererOptions {
  showHeader: boolean;
  showProperties: boolean;
  showChildren: boolean;
  showFiles: boolean;
  showUsedBy: boolean;
}

function optsFromSettings(s: PageStatusBarSettings): RendererOptions {
  return {
    showHeader: s.sections.header,
    showProperties: s.sections.properties,
    showChildren: s.sections.children,
    showFiles: s.sections.files,
    showUsedBy: s.sections.usedBy,
  };
}

/**
 * Render the universal status bar into `container`. Pure DOM — no side effects
 * other than writing children. Markdown text is rendered via MarkdownRenderer
 * so wikilinks resolve correctly.
 */
export async function renderStatusBar(
  container: HTMLElement,
  ctx: RenderContext,
  component: Component,
  extensions: TypeExtension[],
): Promise<void> {
  container.empty();
  container.addClass("psb-root");

  const { app, file, frontmatter: fm, settings } = ctx;
  const opts = optsFromSettings(settings);
  const sourcePath = file.path;

  const currentKnownType = ctx.typeIndex.knownTypeForFile(file);
  const typeFiles = ctx.typeIndex.resolveTypesForFrontmatter(file, fm);
  if (currentKnownType && !typeFiles.includes(currentKnownType.file)) {
    typeFiles.unshift(currentKnownType.file);
  }
  const lineage = ctx.typeIndex.classLineage(typeFiles);
  const isClassDef =
    Object.prototype.hasOwnProperty.call(fm, "subClassOf") ||
    Object.prototype.hasOwnProperty.call(fm, "extends");

  // 1. Type chain
  if (opts.showHeader && lineage.length) {
    const chip = container.createDiv({ cls: "psb-section psb-type-chip" });
    chip.createSpan({ cls: "psb-label", text: "Type: " });
    await renderInline(
      app,
      chip,
      lineage
        .map((level) => level.map((cls) => linkForFile(cls)).join(", "))
        .join(" -> "),
      sourcePath,
      component,
    );
  }

  // 2. Metadata fields
  if (opts.showProperties) {
    const ordered: Array<[string, string]> = [];

    if (!isClassDef) {
      const classes = typeFiles;
      for (const cls of classes) {
        const clsFm = getFrontmatter(app, cls);
        const fieldsOrder = clsFm?.["fieldsOrder"];
        if (Array.isArray(fieldsOrder)) {
          for (const f of fieldsOrder) ordered.push([String(f), cap(String(f))]);
        }
      }
    }

    // Append remaining present, non-technical keys.
    const seen = new Set(ordered.map(([k]) => k.toLowerCase()));
    for (const key of Object.keys(fm)) {
      const lk = key.toLowerCase();
      if (seen.has(lk)) continue;
      ordered.push([key, cap(key)]);
      seen.add(lk);
    }

    const fields: Array<[string, string]> = [];
    for (const [key, label] of ordered) {
      if (SKIP_PROPS.has(key.toLowerCase())) continue;
      const v = fm[key];
      const s = fmtFieldValue(app, file, key, v, ctx);
      if (!s) continue;
      fields.push([label, s]);
    }

    if (fields.length) {
      const sec = container.createDiv({ cls: "psb-section psb-properties" });
      sec.createEl("h4", { text: "Metadata" });
      const grid = sec.createDiv({ cls: "psb-field-grid" });
      for (const [label, md] of fields) {
        const item = grid.createDiv({ cls: "psb-field" });
        item.createDiv({ cls: "psb-field-label", text: label });
        const value = item.createDiv({ cls: "psb-field-value" });
        await renderInline(app, value, md, sourcePath, component);
      }
    }
  }

  // 3. Children — pages whose link fields point here, grouped by field.
  // Skip entirely until the link index has built; an empty grouped index here
  // would otherwise look like "no children" instead of "indexing".
  if (opts.showChildren && ctx.linkIndex.isReady()) {
    const grouped = groupIncomingByField(app, file, ctx);
    const childGroups: Array<{ label: string; pages: TFile[] }> = [];
    for (const [field, label] of CHILD_FIELDS) {
      const kids = grouped.get(field);
      if (kids && kids.length) childGroups.push({ label, pages: kids });
    }

    if (childGroups.length) {
      const sec = container.createDiv({ cls: "psb-section psb-children" });
      sec.createEl("h4", { text: "Children" });
      for (const { label, pages } of childGroups) {
        const grp = sec.createDiv({ cls: "psb-children-group" });
        grp.createEl("h5", { text: `${label} (${pages.length})` });
        await renderTable(
          app,
          grp,
          ["Item", "Type", "Status"],
          pages.map((p) => [
            `[[${p.path.replace(/\.md$/i, "")}|${p.basename}]]`,
            String(getFrontmatter(app, p)["type"] ?? ""),
            String(getFrontmatter(app, p)["status"] ?? ""),
          ]),
          sourcePath,
          component,
        );
      }
    }
  }

  // 5. Files — pages inside the co-located folder.
  if (opts.showFiles) {
    const folderHere = file.parent?.path ?? "";
    const filesFolder = folderHere
      ? `${folderHere}/${file.basename}`
      : file.basename;
    const files = app.vault
      .getMarkdownFiles()
      .filter((p) => p.path !== file.path && (p.parent?.path ?? "") === filesFolder)
      .sort((a, b) => a.basename.localeCompare(b.basename));

    if (files.length) {
      const sec = container.createDiv({ cls: "psb-section psb-files" });
      sec.createEl("h4", { text: `Files (${files.length})` });
      await renderTable(
        app,
        sec,
        ["File", "Type", "Updated"],
        files.map((p) => [
          `[[${p.path.replace(/\.md$/i, "")}|${p.basename}]]`,
          String(getFrontmatter(app, p)["type"] ?? ""),
          new Date(p.stat.mtime).toISOString().slice(0, 10),
        ]),
        sourcePath,
        component,
      );
      sec.createEl("div", {
        cls: "psb-meta",
        text: `Folder: ${filesFolder}/`,
      });
    }
  }

  // 6. Used by — incoming references via frontmatter fields NOT covered above.
  if (opts.showUsedBy && ctx.linkIndex.isReady()) {
    const childKeys = new Set(CHILD_FIELDS.map(([k]) => k));
    const incoming = collectIncoming(app, file, ctx).filter((m) =>
      m.fields.some((f) => !childKeys.has(f)),
    );

    if (incoming.length) {
      const sec = container.createDiv({ cls: "psb-section psb-used-by" });
      sec.createEl("h4", { text: `Used by (${incoming.length})` });
      await renderTable(
        app,
        sec,
        ["Item", "Type", "Status", "Field"],
        incoming.map(({ file: p, fields }) => [
          `[[${p.path.replace(/\.md$/i, "")}|${p.basename}]]`,
          String(getFrontmatter(app, p)["type"] ?? ""),
          String(getFrontmatter(app, p)["status"] ?? ""),
          fields.filter((f) => !childKeys.has(f)).join(", "),
        ]),
        sourcePath,
        component,
      );
    }
  }

  // 7. Type extensions
  const extensionTypes = new Set(typeRefs(fm));
  if (extensionTypes.size) {
    for (const ext of extensions) {
      if (!extensionTypes.has(ext.type)) continue;
      const enabled = ctx.settings.enabledExtensions[ext.type] !== false;
      if (!enabled) continue;
      const extEl = container.createDiv({
        cls: `psb-section psb-extension psb-ext-${ext.type.toLowerCase()}`,
      });
      try {
        await ext.render(extEl, ctx);
      } catch (e) {
        console.error(`[page-status-bar] extension ${ext.type} failed:`, e);
      }
    }
  }
}

// ---------------- helpers (DOM / lookups) ----------------

function linkForFile(file: TFile): string {
  return `[[${file.path.replace(/\.md$/i, "")}|${file.basename}]]`;
}

function fmtFieldValue(
  app: App,
  source: TFile,
  key: string,
  value: unknown,
  ctx: RenderContext,
): string {
  if (value == null || value === "") return "";

  if (key.toLowerCase() === "type") {
    return ctx.typeIndex
      .resolveTypesForFrontmatter(source, { type: value })
      .map((file) => linkForFile(file))
      .join(", ");
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => fmtFieldValue(app, source, key, item, ctx))
      .filter(Boolean)
      .join(", ");
  }

  if (typeof value === "object" && value !== null) {
    const resolved = resolveLink(app, source, value);
    if (resolved instanceof TFile) return linkForFile(resolved);
    const r = value as { path?: string; link?: string };
    if (r.path || r.link) return fmtScalar(value);
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";
    const resolved = resolveLink(app, source, trimmed);
    if (resolved instanceof TFile) return linkForFile(resolved);
  }

  return fmtScalar(value);
}

/** Render markdown inline — strips the wrapping <p> if any. */
async function renderInline(
  app: App,
  el: HTMLElement,
  md: string,
  sourcePath: string,
  component: Component,
): Promise<void> {
  const tmp = createDiv();
  await MarkdownRenderer.render(app, md, tmp, sourcePath, component);
  const p = tmp.querySelector("p");
  if (p) {
    while (p.firstChild) el.appendChild(p.firstChild);
  } else {
    while (tmp.firstChild) el.appendChild(tmp.firstChild);
  }
}

async function renderTable(
  app: App,
  el: HTMLElement,
  headers: string[],
  rows: string[][],
  sourcePath: string,
  component: Component,
): Promise<void> {
  const table = el.createEl("table", { cls: "psb-table" });
  const thead = table.createEl("thead");
  const headerRow = thead.createEl("tr");
  for (const h of headers) headerRow.createEl("th", { text: h });
  const tbody = table.createEl("tbody");
  for (const row of rows) {
    const tr = tbody.createEl("tr");
    for (const cell of row) {
      const td = tr.createEl("td");
      if (cell) await renderInline(app, td, cell, sourcePath, component);
    }
  }
}

/**
 * Group incoming-link edges by field name. O(incoming-to-target).
 * Backed by LinkIndex — no vault-wide scan per render.
 */
function groupIncomingByField(
  app: App,
  target: TFile,
  ctx: RenderContext,
): Map<string, TFile[]> {
  const out = new Map<string, TFile[]>();
  for (const e of ctx.linkIndex.incomingFor(target.path)) {
    if (e.sourcePath === target.path) continue;
    const af = app.vault.getAbstractFileByPath(e.sourcePath);
    if (!(af instanceof TFile)) continue;
    let list = out.get(e.field);
    if (!list) {
      list = [];
      out.set(e.field, list);
    }
    if (!list.includes(af)) list.push(af);
  }
  for (const list of out.values()) {
    list.sort((a, b) => a.basename.localeCompare(b.basename));
  }
  return out;
}

/**
 * Collect incoming-link edges grouped by source file. O(incoming-to-target).
 */
function collectIncoming(
  app: App,
  target: TFile,
  ctx: RenderContext,
): Array<{ file: TFile; fields: string[] }> {
  const byPath = new Map<string, Set<string>>();
  for (const e of ctx.linkIndex.incomingFor(target.path)) {
    if (e.sourcePath === target.path) continue;
    let set = byPath.get(e.sourcePath);
    if (!set) {
      set = new Set<string>();
      byPath.set(e.sourcePath, set);
    }
    set.add(e.field);
  }
  const out: Array<{ file: TFile; fields: string[] }> = [];
  for (const [path, fields] of byPath) {
    const af = app.vault.getAbstractFileByPath(path);
    if (!(af instanceof TFile)) continue;
    out.push({ file: af, fields: Array.from(fields) });
  }
  out.sort((a, b) => a.file.basename.localeCompare(b.file.basename));
  return out;
}

export { getFrontmatter };
