import { TFile } from "obsidian";
import type { PageStatusBarSettings } from "./types";
import { isClassDefinition, typeRefs, type TypeIndex } from "./type-index";

/**
 * Decide whether the plugin should render a status bar for this file.
 * Pure function — no side effects.
 *
 * Rules:
 *   - Always skip when frontmatter `statusBar: false`.
 *   - With `triggerOnAnyType`: render iff `type:` resolves to a known type.
 *   - Else: render unconditionally (subject to folder filters).
 *   - Honour include/exclude folder lists. Include wins over exclude when both
 *     set; if include is empty the file is included by default.
 */
export function shouldRenderFor(
  file: TFile,
  fm: Record<string, unknown>,
  settings: PageStatusBarSettings,
  typeIndex: TypeIndex,
): boolean {
  const optOut = fm["statusBar"] ?? fm["statusbar"];
  if (optOut === false) return false;

  const folder = file.parent?.path ?? "";

  if (settings.includeFolders.length) {
    const ok = settings.includeFolders.some((p) => withinFolder(folder, p));
    if (!ok) return false;
  }

  for (const p of settings.excludeFolders) {
    if (withinFolder(folder, p)) return false;
  }

  if (settings.triggerOnAnyType) {
    if (!isClassDefinition(fm) && typeRefs(fm).length === 0) {
      return false;
    }
  }

  return true;
}

function withinFolder(folder: string, prefix: string): boolean {
  const p = prefix.replace(/^\/|\/$/g, "");
  if (!p) return true;
  return folder === p || folder.startsWith(p + "/");
}
