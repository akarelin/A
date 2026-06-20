import { App, PluginSettingTab, Setting } from "obsidian";
import type PageStatusBarPlugin from "./main";
import type { PageStatusBarSettings } from "./types";

export class PageStatusBarSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: PageStatusBarPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    const s = this.plugin.settings;

    new Setting(containerEl).setName("Rendering").setHeading();

    new Setting(containerEl)
      .setName("Render mode")
      .setDesc(
        "Where to render the status bar. Reading view = markdown post-processor; Edit modes = CodeMirror widget; Both = everywhere.",
      )
      .addDropdown((d) =>
        d
          .addOption("post-processor", "Reading view only")
          .addOption("view-extension", "Edit modes only")
          .addOption("both", "Both")
          .setValue(s.renderMode)
          .onChange(async (v) => {
            s.renderMode = v as PageStatusBarSettings["renderMode"];
            await this.plugin.saveSettings();
            this.plugin.refreshAll();
          }),
      );

    new Setting(containerEl)
      .setName("Render only on pages with a known type:")
      .setDesc(
        "When on, only pages whose frontmatter `type:` resolves to a class/type page get the metadata bar. `subClassOf:` is used for the displayed type chain.",
      )
      .addToggle((t) =>
        t.setValue(s.triggerOnAnyType).onChange(async (v) => {
          s.triggerOnAnyType = v;
          await this.plugin.saveSettings();
          this.plugin.refreshAll();
        }),
      );

    new Setting(containerEl)
      .setName("Defer to legacy dataview stub")
      .setDesc(
        "When on, the plugin skips rendering on pages that still contain a `dv.view(\"{internals}/Classes/_views/any\")` codeblock — so the old and new renderers don't both fire during migration.",
      )
      .addToggle((t) =>
        t.setValue(s.deferToLegacyStub).onChange(async (v) => {
          s.deferToLegacyStub = v;
          await this.plugin.saveSettings();
          this.plugin.refreshAll();
        }),
      );

    new Setting(containerEl)
      .setName("Hide native frontmatter properties")
      .setDesc(
        "Hide Obsidian's built-in properties block. The status bar renders properties itself; native UI is redundant when the plugin is on.",
      )
      .addToggle((t) =>
        t.setValue(s.hideNativeProperties).onChange(async (v) => {
          s.hideNativeProperties = v;
          await this.plugin.saveSettings();
          this.plugin.applyBodyClasses();
          this.plugin.refreshAll();
        }),
      );

    new Setting(containerEl).setName("Folders").setHeading();

    new Setting(containerEl)
      .setName("Include folders")
      .setDesc(
        "One folder path per line. If non-empty, the status bar renders ONLY in these folders (and their descendants). Empty = no restriction.",
      )
      .addTextArea((t) => {
        t.inputEl.rows = 4;
        t.inputEl.style.width = "100%";
        t.setValue(s.includeFolders.join("\n")).onChange(async (v) => {
          s.includeFolders = v.split("\n").map((x) => x.trim()).filter(Boolean);
          await this.plugin.saveSettings();
          this.plugin.refreshAll();
        });
      });

    new Setting(containerEl)
      .setName("Exclude folders")
      .setDesc(
        "One folder path per line. The status bar will NOT render in these folders (and their descendants).",
      )
      .addTextArea((t) => {
        t.inputEl.rows = 4;
        t.inputEl.style.width = "100%";
        t.setValue(s.excludeFolders.join("\n")).onChange(async (v) => {
          s.excludeFolders = v.split("\n").map((x) => x.trim()).filter(Boolean);
          await this.plugin.saveSettings();
          this.plugin.refreshAll();
        });
      });

    new Setting(containerEl).setName("Sections").setHeading();

    const sectionToggle = (key: keyof PageStatusBarSettings["sections"], label: string) => {
      new Setting(containerEl).setName(label).addToggle((t) =>
        t.setValue(s.sections[key]).onChange(async (v) => {
          s.sections[key] = v;
          await this.plugin.saveSettings();
          this.plugin.refreshAll();
        }),
      );
    };

    sectionToggle("header", "Type chain");
    sectionToggle("properties", "Metadata fields");
    sectionToggle("children", "Children");
    sectionToggle("files", "Files");
    sectionToggle("usedBy", "Used by");

    new Setting(containerEl).setName("Type extensions").setHeading();

    const types = new Set<string>([
      ...this.plugin.extensions.map((e) => e.type),
      ...Object.keys(s.enabledExtensions),
    ]);
    for (const type of Array.from(types).sort()) {
      new Setting(containerEl)
        .setName(type)
        .setDesc(`Render type-specific extras below the universal sections for \`type: ${type}\`.`)
        .addToggle((t) =>
          t.setValue(s.enabledExtensions[type] !== false).onChange(async (v) => {
            s.enabledExtensions[type] = v;
            await this.plugin.saveSettings();
            this.plugin.refreshAll();
          }),
        );
    }
  }
}
