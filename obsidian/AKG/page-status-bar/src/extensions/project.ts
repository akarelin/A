import { MarkdownRenderer, Component } from "obsidian";
import { TypeExtension, RenderContext } from "../types";
import { asArray, fmtScalar, cap } from "../util";

async function renderMd(
  el: HTMLElement,
  md: string,
  ctx: RenderContext,
  component: Component,
): Promise<void> {
  await MarkdownRenderer.render(ctx.app, md, el, ctx.file.path, component);
}

/**
 * Type extension for `type: Project` (and `type: Ongoing` — register both).
 * Renders Phases and Decisions sections from frontmatter.
 */
function makeProjectExtension(typeName: string): TypeExtension {
  return {
    type: typeName,
    async render(container, ctx) {
      const fm = ctx.frontmatter;
      const component = new Component();
      component.load();
      try {
        // Phases
        const phases = fm["phases"];
        if (Array.isArray(phases) && phases.length) {
          const sec = container.createDiv({
            cls: "psb-section psb-ext-phases",
          });
          sec.createEl("h4", { text: `Phases (${phases.length})` });

          if (typeof phases[0] === "object" && phases[0] !== null) {
            const keySet = new Set<string>();
            for (const ph of phases) {
              if (ph && typeof ph === "object") {
                for (const k of Object.keys(ph as Record<string, unknown>)) {
                  keySet.add(k);
                }
              }
            }
            const keys: string[] = Array.from(keySet);
            const table = sec.createEl("table", { cls: "psb-table" });
            const headerRow = table.createEl("thead").createEl("tr");
            for (const k of keys) headerRow.createEl("th", { text: cap(k) });
            const tbody = table.createEl("tbody");
            for (const ph of phases) {
              const tr = tbody.createEl("tr");
              for (const k of keys) {
                const td = tr.createEl("td");
                const v = (ph as Record<string, unknown>)[k];
                const md = fmtScalar(v);
                if (md) await renderMd(td, md, ctx, component);
              }
            }
          } else {
            const ul = sec.createEl("ul");
            for (const ph of phases) {
              const li = ul.createEl("li");
              const md = fmtScalar(ph);
              if (md) await renderMd(li, md, ctx, component);
            }
          }
        }

        // Decisions
        const decisions = fm["decisions"];
        if (Array.isArray(decisions) && decisions.length) {
          const sec = container.createDiv({
            cls: "psb-section psb-ext-decisions",
          });
          sec.createEl("h4", { text: `Decisions (${decisions.length})` });
          const ul = sec.createEl("ul");
          for (const d of asArray(decisions)) {
            const li = ul.createEl("li");
            const md = fmtScalar(d);
            if (md) await renderMd(li, md, ctx, component);
          }
        }
      } finally {
        component.unload();
      }
    },
  };
}

export const projectExtensions: TypeExtension[] = [
  makeProjectExtension("Project"),
  makeProjectExtension("Ongoing"),
];
