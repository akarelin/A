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
import { LinkIndex } from "./link-index";
import { TypeIndex } from "./type-index";

const LEGACY_STUB_RE =
  /```dataviewjs[\s\S]*?\bdv\.view\(\s*["']\{internals\}\/Classes\/_views\/any["']/;

export default class PageStatusBarPlugin extends Plugin {
  settings: PageStatusBarSettings = DEFAULT_SETTINGS;
  extensions: TypeExtension[] = [];
  linkIndex!: LinkIndex;
  typeIndex!: TypeIndex;

  // Per-file legacy-stub presence cache. Cleared on metadata change.
  private legacyStubCache = new Map<string, boolean>();

  async onload(): Promise<void> {
    await this.loadSettings();
    this.extensions.push(...projectExtensions);
    this.linkIndex = new LinkIndex(this.app);
    this.typeIndex = new TypeIndex(this.app);

    this.addSettingTab(new PageStatusBarSettingTab(this.app, this));

    setEditorViewBridge({
      app: this.app,
      getSettings: () => this.settings,
      getExtensions: () => this.extensions,
      getLinkIndex: () => this.linkIndex,
      getTypeIndex: () => this.typeIndex,
    });

    // Reading view path (markdown post-processor)
    this.registerMarkdownPostProcessor((el, ctx) => {
      if (this.settings.renderMode === "view-extension") return;
      this.handlePostProcess(el, ctx);
    });

    // Edit-mode path (CM6)
    this.registerEditorExtension(statusBarViewExtension);

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
    refreshAllEditorViews(this.app);
  }

  refreshActiveView(): void {
    const v = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!v) return;
    if (v.getMode() === "preview") {
      v.previewMode?.rerender?.(true);
    } else {
      refreshAllEditorViews(this.app);
    }
  }

  private async handlePostProcess(
    el: HTMLElement,
    ctx: MarkdownPostProcessorContext,
  ): Promise<void> {
    const sourcePath = ctx.sourcePath;
    if (!sourcePath) return;
    if (el.closest(".psb-root")) return;

    const file = this.app.vault.getAbstractFileByPath(sourcePath);
    if (!(file instanceof TFile)) return;

    const fm =
      (this.app.metadataCache.getFileCache(file)?.frontmatter as
        | Record<string, unknown>
        | undefined) ?? {};

    if (!shouldRenderFor(file, fm, this.settings, this.typeIndex)) return;

    if (this.settings.deferToLegacyStub && (await this.fileHasLegacyStub(file))) {
      return;
    }

    // Avoid double-injecting if a previous post-process pass already rendered.
    const previewRoot = el.closest(".markdown-preview-section") as HTMLElement | null;
    const parent = previewRoot ?? el.parentElement;
    if (el.querySelector(":scope > .psb-root")) return;
    if (el.previousElementSibling?.classList?.contains("psb-root")) return;
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
      typeIndex: this.typeIndex,
    };

    // Insert once at the top of the rendered preview when available.
    if (previewRoot) {
      previewRoot.insertBefore(host, previewRoot.firstChild);
    } else if (parent) {
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
