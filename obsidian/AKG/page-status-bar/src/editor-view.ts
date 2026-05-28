import { EditorView, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view";
import { Decoration, DecorationSet } from "@codemirror/view";
import { StateEffect, StateField } from "@codemirror/state";
import { App, Component, MarkdownView, TFile } from "obsidian";
import { renderStatusBar } from "./render";
import type { RenderContext, TypeExtension, PageStatusBarSettings } from "./types";
import type { LinkIndex } from "./link-index";
import { shouldRenderFor } from "./trigger";

/**
 * Bridge from the CM6 widget back to plugin state. Set by the plugin on load.
 */
export interface EditorViewContext {
  app: App;
  getSettings: () => PageStatusBarSettings;
  getExtensions: () => TypeExtension[];
  getLinkIndex: () => LinkIndex;
}

let bridge: EditorViewContext | null = null;

export function setEditorViewBridge(ctx: EditorViewContext | null): void {
  bridge = ctx;
}

/**
 * Find the TFile bound to a given CodeMirror EditorView by scanning workspace
 * leaves and matching their underlying CM6 instance.
 */
function fileForView(app: App, view: EditorView): TFile | null {
  let match: TFile | null = null;
  app.workspace.iterateAllLeaves((leaf) => {
    if (match) return;
    const mv = leaf.view;
    if (!(mv instanceof MarkdownView)) return;
    const editor = mv.editor;
    // @ts-expect-error: cm is exposed at runtime by Obsidian
    const cm: EditorView | undefined = editor?.cm;
    if (cm === view) match = mv.file ?? null;
  });
  return match;
}

class StatusBarWidget extends WidgetType {
  private component: Component | null = null;

  constructor(private readonly filePath: string, private readonly version: number) {
    super();
  }

  eq(other: WidgetType): boolean {
    return (
      other instanceof StatusBarWidget &&
      other.filePath === this.filePath &&
      other.version === this.version
    );
  }

  toDOM(): HTMLElement {
    const root = createDiv({ cls: "psb-editor-host" });
    if (!bridge) return root;

    const { app, getSettings, getExtensions, getLinkIndex } = bridge;
    const af = app.vault.getAbstractFileByPath(this.filePath);
    if (!(af instanceof TFile)) return root;

    const settings = getSettings();
    const fm =
      (app.metadataCache.getFileCache(af)?.frontmatter as
        | Record<string, unknown>
        | undefined) ?? {};

    if (!shouldRenderFor(af, fm, settings)) return root;

    const component = new Component();
    component.load();
    this.component = component;

    const ctx: RenderContext = {
      app,
      file: af,
      frontmatter: fm,
      settings,
      linkIndex: getLinkIndex(),
    };
    void renderStatusBar(root, ctx, component, getExtensions());
    return root;
  }

  destroy(): void {
    if (this.component) {
      this.component.unload();
      this.component = null;
    }
  }

  ignoreEvent(): boolean {
    return false;
  }
}

// Block decorations must come from a StateField (CM6 rejects them from a
// ViewPlugin's `decorations` accessor with "Block decorations may not be
// specified via plugins"). We hold the DecorationSet in a StateField and let
// a ViewPlugin act purely as an observer that dispatches setStatusBarDeco
// effects to keep the field in sync with the bound file / frontmatter.
const setStatusBarDeco = StateEffect.define<DecorationSet>();

const statusBarField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    for (const e of tr.effects) {
      if (e.is(setStatusBarDeco)) return e.value;
    }
    return deco.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

function buildDecoSet(view: EditorView, version: number): DecorationSet {
  if (!bridge) return Decoration.none;
  const file = fileForView(bridge.app, view);
  if (!file) return Decoration.none;
  const fm =
    (bridge.app.metadataCache.getFileCache(file)?.frontmatter as
      | Record<string, unknown>
      | undefined) ?? {};
  if (!shouldRenderFor(file, fm, bridge.getSettings())) return Decoration.none;
  const widget = Decoration.widget({
    widget: new StatusBarWidget(file.path, version),
    block: true,
    side: -1,
  });
  return Decoration.set([widget.range(0)]);
}

const statusBarObserver = ViewPlugin.fromClass(
  class {
    private version = 0;

    constructor(view: EditorView) {
      this.sync(view);
    }

    update(u: ViewUpdate): void {
      if (u.docChanged || u.viewportChanged || u.geometryChanged) {
        this.sync(u.view);
      }
    }

    private sync(view: EditorView): void {
      this.version++;
      const set = buildDecoSet(view, this.version);
      // Dispatching from inside update() is disallowed by CM6; defer.
      queueMicrotask(() => {
        view.dispatch({ effects: setStatusBarDeco.of(set) });
      });
    }
  },
);

export const statusBarViewExtension = [statusBarField, statusBarObserver];

/** Force a redraw of the status-bar widget in every open markdown editor. */
export function refreshAllEditorViews(app: App): void {
  app.workspace.iterateAllLeaves((leaf) => {
    const view = leaf.view;
    if (view instanceof MarkdownView) {
      // @ts-expect-error: cm is runtime-only
      const cm: EditorView | undefined = view.editor?.cm;
      if (cm) cm.dispatch({});
    }
  });
}
