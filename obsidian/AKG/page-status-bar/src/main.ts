import {
  MarkdownPostProcessorContext,
  MarkdownRenderChild,
  Plugin,
  TFile,
  MarkdownView,
} from "obsidian";
import {
  PageStatusBarSettings,
  DEFAULT_SETTINGS,
  TypeExtension,
  RenderContext,
} from "./types";
import { renderStatusBar } from "./render";
import { shouldRenderFor } from "./trigger";
import { PageStatusBarSettingTab } from "./settings";
import { projectExtensions } from "./extensions/project";
import {
  statusBarViewExtension,
  setEditorViewBridge,
  refreshAllEditorViews,
} from "./editor-view";
import { debounce } from "./util";
import { LinkIndex } from "./link-index";

const LEGACY_STUB_RE =
  /```dataviewjs[\s\S]*?\bdv\.view\(\s*["']\{internals\}\/Classes\/_views\/any["']/;

export default class PageStatusBarPlugin extends Plugin {
  settings: PageStatusBarSettings = DEFAULT_SETTINGS;
  extensions: TypeExtension[] = [];
  linkIndex!: LinkIndex;

  // Per-file legacy-stub presence cache. Cleared on metadata change.
  private legacyStubCache = new Map<string, boolean>();

  async onload(): Promise<void> {
    await this.loadSettings();
    this.extensions.push(...projectExtensions);
    this.linkIndex = new LinkIndex(this.app);

    this.addSettingTab(new PageStatusBarSettingTab(this.app, this));

    setEditorViewBridge({
      app: this.app,
      getSettings: () => this.settings,
      getExtensions: () => this.extensions,
      getLinkIndex: () => this.linkIndex,
    });

    // Reading view path (markdown post-processor)
    this.registerMarkdownPostProcessor((el, ctx) => {
      if (this.settings.renderMode === "view-extension") return;
      this.handlePostProcess(el, ctx);
    });

    // Edit-mode path (CM6)
    this.registerEditorExtension(statusBarViewExtension);

    // Reactive updates
    const refresh = debounce(() => this.refreshAll(), 250);
    this.registerEvent(
      this.app.metadataCache.on("changed", (file) => {
        this.legacyStubCache.delete(file.path);
        if (file instanceof TFile) this.linkIndex.updateFile(file);
        refresh();
      }),
    );
    this.registerEvent(
      this.app.metadataCache.on("resolved", () => {
        // First resolved event = vault scan complete. Build index lazily.
        this.linkIndex.scheduleInitialBuild();
        refresh();
      }),
    );
    this.registerEvent(
      this.app.vault.on("rename", (af, oldPath) => {
        this.legacyStubCache.clear();
        if (af instanceof TFile) this.linkIndex.handleRename(af, oldPath);
        refresh();
      }),
    );
    this.registerEvent(
      this.app.vault.on("delete", (af) => {
        this.legacyStubCache.clear();
        this.linkIndex.removeSource(af.path);
        refresh();
      }),
    );

    // When the index flips ready, re-render so deferred sections fill in.
    this.linkIndex.onChange(() => refresh());

    // If the cache is already resolved at plugin-load time (common for hot
    // reloads), schedule the build now so we don't wait for the next event.
    this.app.workspace.onLayoutReady(() =>
      this.linkIndex.scheduleInitialBuild(),
    );

    // Layout-ready commands
    this.addCommand({
      id: "page-status-bar-refresh",
      name: "Refresh status bar (this note)",
      callback: () => this.refreshActiveView(),
    });
    this.addCommand({
      id: "page-status-bar-refresh-all",
      name: "Refresh status bars (all open notes)",
      callback: () => this.refreshAll(),
    });

    this.applyBodyClasses();
  }

  onunload(): void {
    setEditorViewBridge(null);
    document.body.classList.remove("psb-hide-native-properties");
  }

  async loadSettings(): Promise<void> {
    const raw = (await this.loadData()) as Partial<PageStatusBarSettings> | null;
    this.settings = mergeSettings(DEFAULT_SETTINGS, raw ?? {});
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  /** Toggle body class so styles.css can hide native properties. */
  applyBodyClasses(): void {
    document.body.classList.toggle(
      "psb-hide-native-properties",
      this.settings.hideNativeProperties,
    );
  }

  refreshAll(): void {
    // Re-render reading-view panes by re-triggering the post-processor.
    this.app.workspace.iterateAllLeaves((leaf) => {
      const v = leaf.view;
      if (v instanceof MarkdownView && v.getMode() === "preview") {
        v.previewMode?.rerender?.(true);
      }
    });
    // Re-render editor widgets.
    refreshAllEditorViews(this.app);
  }

  refreshActiveView(): void {
    const v = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!v) return;
    if (v.getMode() === "preview") {
      v.previewMode?.rerender?.(true);
    } else {
      // @ts-expect-error: cm runtime-only
      const cm = v.editor?.cm;
      if (cm) cm.dispatch({});
    }
  }

  private async handlePostProcess(
    el: HTMLElement,
    ctx: MarkdownPostProcessorContext,
  ): Promise<void> {
    const sourcePath = ctx.sourcePath;
    if (!sourcePath) return;

    // Only inject ONCE per rendered page — the post-processor fires for every
    // section. We use ctx.getSectionInfo + the section start offset to detect
    // "is this the first/top section?". The cheap check: only inject when
    // we're processing a section that contains offset 0.
    const info = ctx.getSectionInfo(el);
    if (info && info.lineStart > 0) return;

    const file = this.app.vault.getAbstractFileByPath(sourcePath);
    if (!(file instanceof TFile)) return;

    const fm =
      (this.app.metadataCache.getFileCache(file)?.frontmatter as
        | Record<string, unknown>
        | undefined) ?? {};

    if (!shouldRenderFor(file, fm, this.settings)) return;

    if (this.settings.deferToLegacyStub && (await this.fileHasLegacyStub(file))) {
      return;
    }

    // Avoid double-injecting if a previous post-process pass already rendered.
    if (el.querySelector(":scope > .psb-root")) return;
    if (el.previousElementSibling?.classList?.contains("psb-root")) return;
    const parent = el.parentElement;
    if (parent?.querySelector(":scope > .psb-root")) return;

    const host = createDiv({ cls: "psb-root psb-reading" });
    const child = new RenderComponent(host);
    ctx.addChild(child);
    const component = child;

    const renderCtx: RenderContext = {
      app: this.app,
      file,
      frontmatter: fm,
      settings: this.settings,
      linkIndex: this.linkIndex,
    };

    // Insert above the current section in the parent. If no parent yet, prepend.
    if (parent) {
      parent.insertBefore(host, el);
    } else {
      el.insertBefore(host, el.firstChild);
    }

    void renderStatusBar(host, renderCtx, component, this.extensions);
  }

  private async fileHasLegacyStub(file: TFile): Promise<boolean> {
    const cached = this.legacyStubCache.get(file.path);
    if (cached !== undefined) return cached;
    try {
      const content = await this.app.vault.cachedRead(file);
      const has = LEGACY_STUB_RE.test(content);
      this.legacyStubCache.set(file.path, has);
      return has;
    } catch {
      return false;
    }
  }
}

/**
 * MarkdownRenderChild that we hand to MarkdownPostProcessorContext.addChild so
 * Obsidian unloads our rendered subtree when the section is removed.
 */
class RenderComponent extends MarkdownRenderChild {
  constructor(containerEl: HTMLElement) {
    super(containerEl);
  }
}

/** Shallow-merge settings with safe defaults for nested objects. */
function mergeSettings(
  base: PageStatusBarSettings,
  override: Partial<PageStatusBarSettings>,
): PageStatusBarSettings {
  return {
    ...base,
    ...override,
    sections: { ...base.sections, ...(override.sections ?? {}) },
    enabledExtensions: {
      ...base.enabledExtensions,
      ...(override.enabledExtensions ?? {}),
    },
    includeFolders: override.includeFolders ?? base.includeFolders,
    excludeFolders: override.excludeFolders ?? base.excludeFolders,
  };
}
