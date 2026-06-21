import type { App, TFile } from "obsidian";
import type { LinkIndex } from "./link-index";
import type { TypeIndex } from "./type-index";

export interface PageStatusBarSettings {
  renderMode: "post-processor" | "view-extension" | "both";
  triggerOnAnyType: boolean;
  includeFolders: string[];
  excludeFolders: string[];
  hideNativeProperties: boolean;
  sections: {
    header: boolean;
    properties: boolean;
    navigation: boolean;
    children: boolean;
    files: boolean;
    usedBy: boolean;
  };
  enabledExtensions: Record<string, boolean>;
  deferToLegacyStub: boolean;
}

export const DEFAULT_SETTINGS: PageStatusBarSettings = {
  renderMode: "post-processor",
  triggerOnAnyType: false,
  includeFolders: [],
  excludeFolders: [],
  hideNativeProperties: true,
  sections: {
    header: true,
    properties: true,
    navigation: true,
    children: true,
    files: true,
    usedBy: true,
  },
  enabledExtensions: {
    Project: true,
    Ongoing: true,
  },
  deferToLegacyStub: true,
};

export interface RenderContext {
  app: App;
  file: TFile;
  frontmatter: Record<string, unknown>;
  settings: PageStatusBarSettings;
  linkIndex: LinkIndex;
  typeIndex: TypeIndex;
}

export interface TypeExtension {
  type: string;
  render(container: HTMLElement, ctx: RenderContext): void | Promise<void>;
}
